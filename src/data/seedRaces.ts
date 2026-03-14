/**
 * Seed data: a list of major UCI races from the 2026 spring calendar.
 *
 * This is used as a fallback when the ProCyclingStats build-time fetch
 * is blocked (e.g. locally). In production, the Supabase database is
 * the primary source; PCS scraping supplements it.
 *
 * To add a race: copy one of the entries below, update the fields,
 * and submit a PR. Alternatively, admins can add races directly via
 * the Supabase dashboard.
 */

import type { Race } from '../lib/procyclingstats';

export const SEED_RACES: Race[] = [
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
];
