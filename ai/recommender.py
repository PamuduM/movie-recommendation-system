"""Hybrid movie recommendation module for FlickX (standalone)."""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class Movie:
    id: int
    title: str
    description: str
    genres: List[str]


@dataclass
class Interaction:
    user_id: int
    movie_id: int
    score: float


def _find_table(conn: sqlite3.Connection, candidates: Iterable[str]) -> Optional[str]:
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]
    table_map = {name.lower(): name for name in tables}
    for cand in candidates:
        if cand.lower() in table_map:
            return table_map[cand.lower()]
    return None


def _parse_genres(value: object) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(g) for g in value]
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(g) for g in parsed]
        except json.JSONDecodeError:
            pass
        return [s.strip() for s in raw.replace("|", ",").split(",") if s.strip()]
    return [str(value)]


def _load_movies(conn: sqlite3.Connection) -> Dict[int, Movie]:
    table = _find_table(conn, ["Movie", "Movies"])
    if not table:
        raise RuntimeError("Movies table not found in database.")
    conn.row_factory = sqlite3.Row
    rows = conn.execute(f"SELECT id, title, description, genres FROM {table}").fetchall()
    movies: Dict[int, Movie] = {}
    for row in rows:
        movie_id = int(row["id"])
        movies[movie_id] = Movie(
            id=movie_id,
            title=row["title"] or "",
            description=row["description"] or "",
            genres=_parse_genres(row["genres"]),
        )
    return movies


def _load_reviews(conn: sqlite3.Connection) -> List[Interaction]:
    table = _find_table(conn, ["Review", "Reviews"])
    if not table:
        return []
    conn.row_factory = sqlite3.Row
    rows = conn.execute(f"SELECT userId, movieId, rating FROM {table}").fetchall()
    interactions: List[Interaction] = []
    for row in rows:
        rating = float(row["rating"])
        score = max(0.0, min(rating / 5.0, 1.0))
        interactions.append(Interaction(int(row["userId"]), int(row["movieId"]), score))
    return interactions


def _load_favorites(conn: sqlite3.Connection) -> List[Interaction]:
    table = _find_table(conn, ["Favorite", "Favorites"])
    if not table:
        return []
    conn.row_factory = sqlite3.Row
    rows = conn.execute(f"SELECT userId, movieId FROM {table}").fetchall()
    return [Interaction(int(r["userId"]), int(r["movieId"]), 1.0) for r in rows]


def _load_watchlist(conn: sqlite3.Connection) -> List[Interaction]:
    table = _find_table(conn, ["Watchlist", "Watchlists"])
    if not table:
        return []
    conn.row_factory = sqlite3.Row
    rows = conn.execute(f"SELECT userId, movieId FROM {table}").fetchall()
    return [Interaction(int(r["userId"]), int(r["movieId"]), 0.4) for r in rows]


def _aggregate_interactions(interactions: List[Interaction]) -> Dict[Tuple[int, int], float]:
    agg: Dict[Tuple[int, int], float] = {}
    for inter in interactions:
        key = (inter.user_id, inter.movie_id)
        agg[key] = agg.get(key, 0.0) + inter.score
    return agg


def _min_max_scale(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values
    vmin = float(values.min())
    vmax = float(values.max())
    if math.isclose(vmin, vmax):
        return np.zeros_like(values)
    return (values - vmin) / (vmax - vmin)


def _build_user_item_matrix(
    interactions: Dict[Tuple[int, int], float],
    movie_ids: List[int],
    user_ids: List[int],
) -> np.ndarray:
    item_index = {mid: idx for idx, mid in enumerate(movie_ids)}
    user_index = {uid: idx for idx, uid in enumerate(user_ids)}
    matrix = np.zeros((len(movie_ids), len(user_ids)), dtype=np.float32)
    for (uid, mid), score in interactions.items():
        if mid in item_index and uid in user_index:
            matrix[item_index[mid], user_index[uid]] = score
    return matrix


def _collaborative_scores(
    user_id: int,
    movie_ids: List[int],
    user_ids: List[int],
    user_item_matrix: np.ndarray,
    interactions: Dict[Tuple[int, int], float],
) -> np.ndarray:
    if user_id not in user_ids:
        return np.zeros(len(movie_ids), dtype=np.float32)
    item_sim = cosine_similarity(user_item_matrix)
    user_idx = user_ids.index(user_id)
    user_vector = user_item_matrix[:, user_idx]
    if user_vector.sum() == 0:
        return np.zeros(len(movie_ids), dtype=np.float32)
    scores = item_sim.dot(user_vector)
    for i, mid in enumerate(movie_ids):
        if (user_id, mid) in interactions:
            scores[i] = 0.0
    return _min_max_scale(scores)


def _content_scores(
    user_id: int,
    movies: Dict[int, Movie],
    interactions: Dict[Tuple[int, int], float],
) -> np.ndarray:
    movie_ids = list(movies.keys())
    texts = []
    for mid in movie_ids:
        movie = movies[mid]
        genre_text = " ".join(movie.genres)
        texts.append(f"{movie.title} {movie.description} {genre_text}")
    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
    item_matrix = vectorizer.fit_transform(texts)

    profile = None
    for mid in movie_ids:
        key = (user_id, mid)
        if key in interactions:
            weight = interactions[key]
            row = item_matrix[movie_ids.index(mid)]
            profile = row.multiply(weight) if profile is None else profile + row.multiply(weight)
    if profile is None:
        return np.zeros(len(movie_ids), dtype=np.float32)

    scores = cosine_similarity(item_matrix, profile).reshape(-1)
    for i, mid in enumerate(movie_ids):
        if (user_id, mid) in interactions:
            scores[i] = 0.0
    return _min_max_scale(scores)


def _popularity_fallback(
    movie_ids: List[int],
    interactions: Dict[Tuple[int, int], float],
) -> np.ndarray:
    counts = np.zeros(len(movie_ids), dtype=np.float32)
    item_index = {mid: idx for idx, mid in enumerate(movie_ids)}
    for (_, mid), score in interactions.items():
        if mid in item_index:
            counts[item_index[mid]] += score
    return _min_max_scale(counts)


def recommend_for_user(
    user_id: int,
    db_path: str,
    top_n: int = 10,
    alpha: float = 0.6,
) -> List[Dict[str, object]]:
    conn = sqlite3.connect(db_path)
    try:
        movies = _load_movies(conn)
        if not movies:
            return []
        interactions_list = _load_reviews(conn) + _load_favorites(conn) + _load_watchlist(conn)
        interactions = _aggregate_interactions(interactions_list)

        movie_ids = list(movies.keys())
        user_ids = sorted({uid for (uid, _) in interactions.keys()})

        if user_ids:
            user_item_matrix = _build_user_item_matrix(interactions, movie_ids, user_ids)
            collab = _collaborative_scores(user_id, movie_ids, user_ids, user_item_matrix, interactions)
        else:
            collab = np.zeros(len(movie_ids), dtype=np.float32)

        content = _content_scores(user_id, movies, interactions)

        if collab.sum() == 0 and content.sum() == 0:
            final_scores = _popularity_fallback(movie_ids, interactions)
        else:
            final_scores = (alpha * collab) + ((1.0 - alpha) * content)

        ranked = sorted(
            [(mid, float(score)) for mid, score in zip(movie_ids, final_scores)],
            key=lambda x: x[1],
            reverse=True,
        )
        results = [
            {"movie_id": mid, "score": score, "title": movies[mid].title}
            for mid, score in ranked
            if score > 0
        ][:top_n]
        return results
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="FlickX hybrid movie recommender")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--user-id", required=True, type=int, help="User ID")
    parser.add_argument("--top-n", type=int, default=10, help="Number of recommendations")
    parser.add_argument("--alpha", type=float, default=0.6, help="Collaborative weight")
    args = parser.parse_args()

    recs = recommend_for_user(args.user_id, args.db, args.top_n, args.alpha)
    print(json.dumps(recs, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
