/**
 * Seed data: a list of major UCI races from the 2026 spring calendar.
 *
 * Used as fallback when the Python/PCS build-time fetch fails (e.g. locally).
 * Includes both men's and women's races.
 *
 * PCS slug convention: procyclingstats.com/race/{slug}/{year}
 * Cyclingoo will be used to fill in profileImageUrl at build time.
 */

import type { Race } from '../lib/procyclingstats';

export const SEED_RACES: Race[] = [
  // ── Men ──────────────────────────────────────────────────────────────────
  {
    name: 'Strade Bianche',
    slug: 'strade-bianche-2026',
    url: 'https://www.procyclingstats.com/race/strade-bianche/2026',
    startDate: '2026-03-07',
    endDate: '2026-03-07',
    category: '1.UWT',
    country: 'it',
    stages: [
      {
        name: 'Strade Bianche',
        label: 'Strade Bianche 2026',
        url: 'https://www.procyclingstats.com/race/strade-bianche/2026',
        profileImageUrl: null,
        distanceKm: 215,
        date: '2026-03-07',
      },
    ],
  },
  {
    name: 'Paris-Nice',
    slug: 'paris-nice-2026',
    url: 'https://www.procyclingstats.com/race/paris-nice/2026',
    startDate: '2026-03-08',
    endDate: '2026-03-15',
    category: '2.UWT',
    country: 'fr',
    stages: [],
  },
  {
    name: 'Tirreno-Adriatico',
    slug: 'tirreno-adriatico-2026',
    url: 'https://www.procyclingstats.com/race/tirreno-adriatico/2026',
    startDate: '2026-03-11',
    endDate: '2026-03-17',
    category: '2.UWT',
    country: 'it',
    stages: [],
  },
  {
    name: 'Milan-San Remo',
    slug: 'milan-san-remo-2026',
    url: 'https://www.procyclingstats.com/race/milano-sanremo/2026',
    startDate: '2026-03-21',
    endDate: '2026-03-21',
    category: '1.UWT',
    country: 'it',
    stages: [
      {
        name: 'Milan-San Remo',
        label: 'Milan-San Remo 2026',
        url: 'https://www.procyclingstats.com/race/milano-sanremo/2026',
        profileImageUrl: null,
        distanceKm: 294,
        date: '2026-03-21',
      },
    ],
  },

  // ── Women ─────────────────────────────────────────────────────────────────
  {
    name: 'Strade Bianche Donne',
    slug: 'strade-bianche-donne-2026',
    url: 'https://www.procyclingstats.com/race/strade-bianche-donne/2026',
    startDate: '2026-03-07',
    endDate: '2026-03-07',
    category: '1.UWT',
    country: 'it',
    stages: [
      {
        name: 'Strade Bianche Donne',
        label: 'Strade Bianche Donne 2026',
        url: 'https://www.procyclingstats.com/race/strade-bianche-donne/2026',
        profileImageUrl: null,
        distanceKm: 136,
        date: '2026-03-07',
      },
    ],
  },
  {
    name: 'Milan-San Remo Donne',
    slug: 'milan-san-remo-donne-2026',
    url: 'https://www.procyclingstats.com/race/milano-sanremo-donne/2026',
    startDate: '2026-03-21',
    endDate: '2026-03-21',
    category: '1.UWT',
    country: 'it',
    stages: [
      {
        name: 'Milan-San Remo Donne',
        label: 'Milan-San Remo Donne 2026',
        url: 'https://www.procyclingstats.com/race/milano-sanremo-donne/2026',
        profileImageUrl: null,
        distanceKm: 148,
        date: '2026-03-21',
      },
    ],
  },
];
