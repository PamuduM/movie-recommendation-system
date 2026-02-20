"""Hybrid movie recommendation module for FlickX (standalone)."""

from __future__ import annotations

import argparse
import json
import math
import re
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
    release_year: Optional[int] = None


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


def _extract_year(value: object) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        year = int(value)
        if 1800 <= year <= 3000:
            return year
        return None
    text = str(value).strip()
    if not text:
        return None
    match = re.search(r"(\d{4})", text)
    if not match:
        return None
    year = int(match.group(1))
    if 1800 <= year <= 3000:
        return year
    return None


def _load_movies(conn: sqlite3.Connection) -> Dict[int, Movie]:
    table = _find_table(conn, ["Movie", "Movies"])
    if not table:
        raise RuntimeError("Movies table not found in database.")
    conn.row_factory = sqlite3.Row
    rows = conn.execute(f"SELECT id, title, description, genres, releaseDate FROM {table}").fetchall()
    movies: Dict[int, Movie] = {}
    for row in rows:
        movie_id = int(row["id"])
        movies[movie_id] = Movie(
            id=movie_id,
            title=row["title"] or "",
            description=row["description"] or "",
            genres=_parse_genres(row["genres"]),
            release_year=_extract_year(row["releaseDate"]),
        )
    return movies


def _load_movies_from_json(input_path: str) -> Dict[int, Movie]:
    with open(input_path, "r", encoding="utf-8") as file:
        payload = json.load(file)

    records = payload.get("movies", payload) if isinstance(payload, dict) else payload
    if not isinstance(records, list):
        raise RuntimeError("Invalid input JSON: expected list or { movies: [...] }.")

    movies: Dict[int, Movie] = {}
    for row in records:
        if not isinstance(row, dict):
            continue
        movie_id = row.get("id")
        if movie_id is None:
            continue
        try:
            normalized_id = int(movie_id)
        except (TypeError, ValueError):
            continue

        movies[normalized_id] = Movie(
            id=normalized_id,
            title=str(row.get("title") or row.get("original_title") or ""),
            description=str(row.get("description") or row.get("overview") or ""),
            genres=_parse_genres(row.get("genres")),
            release_year=_extract_year(
                row.get("releaseYear") or row.get("release_year") or row.get("releaseDate") or row.get("release_date")
            ),
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


def search_movies_by_keyword(
    query: str,
    movies: Dict[int, Movie],
    top_n: int = 20,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    genres: Optional[List[str]] = None,
    sort: str = "score-desc",
) -> List[Dict[str, object]]:
    normalized_query = str(query).strip()
    if not normalized_query:
        return []
    if not movies:
        return []

    movie_ids = list(movies.keys())
    texts = []
    for mid in movie_ids:
        movie = movies[mid]
        genre_text = " ".join(movie.genres)
        texts.append(f"{movie.title} {movie.description} {genre_text}")

    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(texts + [normalized_query])
    query_vector = matrix[-1]
    movie_matrix = matrix[:-1]
    scores = cosine_similarity(movie_matrix, query_vector).reshape(-1)

    min_year = None
    max_year = None
    if year_min is not None or year_max is not None:
        resolved_start = year_min if year_min is not None else year_max
        resolved_end = year_max if year_max is not None else year_min
        if resolved_start is not None and resolved_end is not None:
            min_year = min(resolved_start, resolved_end)
            max_year = max(resolved_start, resolved_end)

    genre_filters = {g.strip().lower() for g in (genres or []) if g and g.strip()}

    ranked: List[Dict[str, object]] = []
    for movie_id, score in zip(movie_ids, scores):
        movie = movies[movie_id]
        if min_year is not None and max_year is not None:
            if movie.release_year is None or movie.release_year < min_year or movie.release_year > max_year:
                continue

        if genre_filters:
            movie_genres = {g.strip().lower() for g in movie.genres if str(g).strip()}
            if not movie_genres.intersection(genre_filters):
                continue

        ranked.append(
            {
                "movie_id": movie_id,
                "title": movie.title,
                "score": float(score),
                "release_year": movie.release_year,
                "genres": movie.genres,
            }
        )

    sort_key = (sort or "score-desc").strip().lower()
    if sort_key == "title-asc":
        ranked.sort(key=lambda item: str(item.get("title") or "").lower())
    elif sort_key == "title-desc":
        ranked.sort(key=lambda item: str(item.get("title") or "").lower(), reverse=True)
    elif sort_key == "release-asc":
        ranked.sort(key=lambda item: int(item.get("release_year") or 0))
    elif sort_key == "release-desc":
        ranked.sort(key=lambda item: int(item.get("release_year") or 0), reverse=True)
    elif sort_key == "score-asc":
        ranked.sort(key=lambda item: float(item.get("score") or 0.0))
    else:
        ranked.sort(key=lambda item: float(item.get("score") or 0.0), reverse=True)

    if sort_key.startswith("score"):
        ranked = [item for item in ranked if float(item.get("score") or 0.0) > 0]

    return ranked[:top_n]


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
    parser.add_argument("--mode", choices=["recommend", "keyword"], default="recommend")
    parser.add_argument("--db", help="Path to SQLite database")
    parser.add_argument("--input-json", help="Path to input JSON payload with movies")
    parser.add_argument("--user-id", type=int, help="User ID")
    parser.add_argument("--query", help="Keyword query for AI movie search")
    parser.add_argument("--top-n", type=int, default=10, help="Number of recommendations")
    parser.add_argument("--alpha", type=float, default=0.6, help="Collaborative weight")
    parser.add_argument("--year-min", type=int, help="Minimum release year for keyword search")
    parser.add_argument("--year-max", type=int, help="Maximum release year for keyword search")
    parser.add_argument("--genres", help="Comma-separated genres for keyword search")
    parser.add_argument(
        "--sort",
        default="score-desc",
        help="Sort option: score-desc, score-asc, title-asc, title-desc, release-asc, release-desc",
    )
    args = parser.parse_args()

    if args.mode == "recommend":
        if args.user_id is None or not args.db:
            raise SystemExit("recommend mode requires --db and --user-id")
        recs = recommend_for_user(args.user_id, args.db, args.top_n, args.alpha)
        print(json.dumps(recs, indent=2))
        return 0

    if args.mode == "keyword":
        if not args.query:
            raise SystemExit("keyword mode requires --query")

        if args.input_json:
            movies = _load_movies_from_json(args.input_json)
        elif args.db:
            conn = sqlite3.connect(args.db)
            try:
                movies = _load_movies(conn)
            finally:
                conn.close()
        else:
            raise SystemExit("keyword mode requires --input-json or --db")

        genre_filters = _parse_genres(args.genres)
        results = search_movies_by_keyword(
            query=args.query,
            movies=movies,
            top_n=args.top_n,
            year_min=args.year_min,
            year_max=args.year_max,
            genres=genre_filters,
            sort=args.sort,
        )
        print(json.dumps(results, indent=2))
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
