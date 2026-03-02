#!/usr/bin/env node
/*
 * Seeds the SQLite development database with curated movies and review ratings
 * to power the AI mood recommender locally.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sequelize = require('../src/config/database');
require('../src/models');
const { Movie, Review, User } = require('../src/models');

const MOVIE_SEED = [
  {
    title: 'Sunshine Avenue',
    description: 'A vibrant comedy about neighbors who start a community music night to shake off the weekday blues.',
    releaseDate: '2021-06-18',
    poster: 'https://image.tmdb.org/t/p/w500/sunshine-avenue.jpg',
    genres: ['Comedy', 'Family', 'Music'],
  },
  {
    title: 'Neon Pulse',
    description: 'A kinetic action thriller set in a rainy neon metropolis where a courier uncovers a corporate conspiracy.',
    releaseDate: '2022-11-04',
    poster: 'https://image.tmdb.org/t/p/w500/neon-pulse.jpg',
    genres: ['Action', 'Thriller', 'Sci-Fi'],
  },
  {
    title: 'Letters to Lila',
    description: 'Two pen pals finally meet after ten years of anonymous letters and must decide if reality can match their daydreams.',
    releaseDate: '2020-02-14',
    poster: 'https://image.tmdb.org/t/p/w500/letters-to-lila.jpg',
    genres: ['Romance', 'Drama'],
  },
  {
    title: 'Moonlit Harbor',
    description: 'A gentle slice-of-life drama about a chef who returns to her seaside hometown to heal family rifts.',
    releaseDate: '2019-09-27',
    poster: 'https://image.tmdb.org/t/p/w500/moonlit-harbor.jpg',
    genres: ['Drama', 'Slice of life'],
  },
  {
    title: 'Skyline Rush',
    description: 'Urban climbers race across the city skyline to stop a cyber attack before sunrise.',
    releaseDate: '2023-07-07',
    poster: 'https://image.tmdb.org/t/p/w500/skyline-rush.jpg',
    genres: ['Action', 'Adventure'],
  },
  {
    title: 'Champions of Nowhere',
    description: 'An underdog street basketball team plays for their community court in a winner-take-all tournament.',
    releaseDate: '2018-05-25',
    poster: 'https://image.tmdb.org/t/p/w500/champions-of-nowhere.jpg',
    genres: ['Drama', 'Sport'],
  },
  {
    title: 'Orbiting Hearts',
    description: 'Astronauts on a long-haul mission send audio diaries back home and fall in love through static-filled messages.',
    releaseDate: '2024-01-05',
    poster: 'https://image.tmdb.org/t/p/w500/orbiting-hearts.jpg',
    genres: ['Romance', 'Sci-Fi'],
  },
  {
    title: 'Quiet Forest',
    description: 'A meditative documentary following a park ranger who records the changing sounds of his forest.',
    releaseDate: '2021-03-12',
    poster: 'https://image.tmdb.org/t/p/w500/quiet-forest.jpg',
    genres: ['Documentary'],
  },
  {
    title: 'Hurricane Alley',
    description: 'First responders face a chain reaction of storms and must cooperate with estranged partners to survive.',
    releaseDate: '2020-08-21',
    poster: 'https://image.tmdb.org/t/p/w500/hurricane-alley.jpg',
    genres: ['Thriller', 'Action'],
  },
  {
    title: 'Velvet Arcade',
    description: 'A synth-pop infused coming-of-age story set inside a retro arcade slated for demolition.',
    releaseDate: '2017-10-06',
    poster: 'https://image.tmdb.org/t/p/w500/velvet-arcade.jpg',
    genres: ['Drama', 'Music'],
  },
  {
    title: 'Lantern Festival',
    description: 'Three siblings reunite for their hometown lantern festival and uncover the legend behind their family shop.',
    releaseDate: '2022-01-28',
    poster: 'https://image.tmdb.org/t/p/w500/lantern-festival.jpg',
    genres: ['Family', 'Comedy'],
  },
  {
    title: 'Emberfall',
    description: 'A dark fantasy mystery where a fire whisperer must solve crimes committed with elemental magic.',
    releaseDate: '2019-12-13',
    poster: 'https://image.tmdb.org/t/p/w500/emberfall.jpg',
    genres: ['Fantasy', 'Thriller'],
  },
  {
    title: 'Signal Flare',
    description: 'Radio amateurs decode a mysterious broadcast that predicts acts of kindness before they happen.',
    releaseDate: '2016-04-22',
    poster: 'https://image.tmdb.org/t/p/w500/signal-flare.jpg',
    genres: ['Adventure', 'Mystery'],
  },
  {
    title: 'Storm Surfers',
    description: 'Documentary following big-wave surfers chasing the most dangerous swells on earth.',
    releaseDate: '2015-11-20',
    poster: 'https://image.tmdb.org/t/p/w500/storm-surfers.jpg',
    genres: ['Documentary', 'Sport'],
  },
  {
    title: 'Afterglow Choir',
    description: 'An intergenerational choir heals a fractured town after a factory shutdown.',
    releaseDate: '2018-03-30',
    poster: 'https://image.tmdb.org/t/p/w500/afterglow-choir.jpg',
    genres: ['Drama', 'Music'],
  },
];

const REVIEW_SEED = [
  {
    title: 'Sunshine Avenue',
    reviews: [
      { userId: 1, rating: 4.6, comment: 'Instant smile material.' },
      { userId: 2, rating: 4.2, comment: 'Perfect comfort film.' },
    ],
  },
  {
    title: 'Neon Pulse',
    reviews: [
      { userId: 1, rating: 4.8, comment: 'Adrenaline shot straight to the heart.' },
      { userId: 3, rating: 4.4, comment: 'Stylish fights and great pacing.' },
    ],
  },
  {
    title: 'Letters to Lila',
    reviews: [
      { userId: 2, rating: 4.9, comment: 'Romance done right.' },
      { userId: 3, rating: 4.5, comment: 'Soft, sincere, lovely.' },
    ],
  },
  {
    title: 'Moonlit Harbor',
    reviews: [
      { userId: 1, rating: 4.3, comment: 'Calm and hopeful.' },
      { userId: 2, rating: 4.1, comment: 'Slow, but in the best way.' },
    ],
  },
  {
    title: 'Skyline Rush',
    reviews: [
      { userId: 1, rating: 4.2, comment: 'Wild parkour finale.' },
      { userId: 3, rating: 4.0, comment: 'Soundtrack slaps.' },
    ],
  },
  {
    title: 'Orbiting Hearts',
    reviews: [
      { userId: 2, rating: 4.7, comment: 'Space long-distance romance hits hard.' },
      { userId: 1, rating: 4.4, comment: 'Poetic and nerdy.' },
    ],
  },
  {
    title: 'Hurricane Alley',
    reviews: [
      { userId: 3, rating: 4.3, comment: 'Tense disaster thrills.' },
    ],
  },
  {
    title: 'Velvet Arcade',
    reviews: [
      { userId: 1, rating: 4.1, comment: 'Retro vibes and synth bliss.' },
    ],
  },
  {
    title: 'Emberfall',
    reviews: [
      { userId: 1, rating: 4.0, comment: 'Moody, magical noir.' },
      { userId: 2, rating: 4.2, comment: 'Loved the worldbuilding.' },
    ],
  },
];

async function seedMovies() {
  await sequelize.authenticate();
  await sequelize.sync();

  const existingUsers = await User.count();
  if (!existingUsers) {
    throw new Error('No users found. Please create at least one user before seeding reviews.');
  }

  const createdMovies = [];
  for (const payload of MOVIE_SEED) {
    const [movie, created] = await Movie.findOrCreate({
      where: { title: payload.title },
      defaults: payload,
    });
    if (!created) {
      await movie.update(payload);
    }
    createdMovies.push(movie);
  }

  for (const bucket of REVIEW_SEED) {
    const movie = createdMovies.find((m) => m.title === bucket.title) || (await Movie.findOne({ where: { title: bucket.title } }));
    if (!movie) continue;
    for (const entry of bucket.reviews) {
      const existing = await Review.findOne({ where: { userId: entry.userId, movieId: movie.id } });
      if (existing) {
        await existing.update({ rating: entry.rating, comment: entry.comment });
      } else {
        await Review.create({
          userId: entry.userId,
          movieId: movie.id,
          rating: entry.rating,
          comment: entry.comment,
        });
      }
    }
  }

  const movieCount = await Movie.count();
  const reviewCount = await Review.count();
  console.log(`Seed complete. Movies: ${movieCount}, Reviews: ${reviewCount}`);
}

seedMovies()
  .then(() => {
    return sequelize.close();
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    sequelize.close().finally(() => process.exit(1));
  });
