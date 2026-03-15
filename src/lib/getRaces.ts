/**
 * Unified race-fetching utility.
 *
 * Priority order:
 *   1. Supabase `stage_profiles` table — scraped once from PCS via browser,
 *      covers all 2026 WorldTour races with full metadata + profile images.
 *   2. `src/data/races-live.json`  — legacy Python-generated fallback
 *   3. `src/data/seedRaces.ts`     — static fallback for local dev
 *
 * When loaded from Supabase (case 1), all metadata and profile images are
 * already present — no further enrichment queries are needed.
 * cyclingoo.com is used as a fallback only for the ~46 stages where PCS
 * has not yet uploaded a profile image.
 */

import type { Race, Stage } from './procyclingstats';
import { SEED_RACES } from '../data/seedRaces';
import { enrichRacesWithCyclingoo } from './cyclingoo';
import { getStageProfilesByYear, type StageProfile } from './supabase';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// ─── Supabase primary loader ──────────────────────────────────────────────────

/**
 * Build the full Race[] list directly from the stage_profiles Supabase table.
 * Groups rows by race_slug, reconstructs Race + Stage objects, preserving all
 * metadata and profile image URLs that were scraped from PCS.
 */
async function loadRacesFromSupabase(year: number): Promise<Race[]> {
  const profiles = await getStageProfilesByYear(year);
  if (profiles.length === 0) return [];

  // Group rows by race_slug (preserving insertion order = calendar order)
  const raceMap = new Map<string, StageProfile[]>();
  for (const p of profiles) {
    if (!raceMap.has(p.race_slug)) raceMap.set(p.race_slug, []);
    raceMap.get(p.race_slug)!.push(p);
  }

  const races: Race[] = [];
  for (const [slug, stageRows] of raceMap) {
    // Sort by stage_number; null = single-day race (one row, stageNumber = null)
    stageRows.sort((a, b) => (a.stage_number ?? 0) - (b.stage_number ?? 0));
    const first = stageRows[0];

    const stages: Stage[] = stageRows.map((p) => ({
      name: p.race_name ?? slug,
      label: p.stage_label ?? p.stage_full_label ?? p.race_name ?? slug,
      url: p.stage_pcs_url ?? `https://www.procyclingstats.com/race/${slug}/${year}`,
      profileImageUrl: p.profile_image_url,
      distanceKm: p.distance_km != null ? Number(p.distance_km) : null,
      date: p.stage_date ?? p.race_start_date ?? '',
    }));

    races.push({
      name: first.race_name ?? slug,
      slug: `${slug}-${year}`,
      url: `https://www.procyclingstats.com/race/${slug}/${year}`,
      startDate: first.race_start_date ?? '',
      endDate: first.race_end_date ?? '',
      category: first.race_classification ?? '',
      country: '',
      stages,
    });
  }

  return races;
}

// ─── Legacy JSON fallback ─────────────────────────────────────────────────────

let liveRaces: Race[] | null = null;

function loadLiveJson(): Race[] {
  if (liveRaces !== null) return liveRaces;
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const jsonPath = join(dir, '../../src/data/races-live.json');
    const raw = readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw) as Race[];
    liveRaces = Array.isArray(data) ? data : [];
    return liveRaces;
  } catch {
    liveRaces = [];
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAllRaces(): Promise<{ races: Race[]; source: string }> {
  let races: Race[];
  let source: string;

  // 1. Supabase stage_profiles (all 2026 WorldTour races, always available)
  const year = new Date().getFullYear();
  try {
    const fromSupabase = await loadRacesFromSupabase(year);
    if (fromSupabase.length > 0) {
      races = fromSupabase;
      source = 'supabase';
      console.log(`[getRaces] loaded ${races.length} races from Supabase`);
    } else {
      throw new Error('empty');
    }
  } catch {
    // 2. Legacy Python-generated JSON
    const live = loadLiveJson();
    if (live.length > 0) {
      races = live;
      source = 'live-json';
    } else {
      // 3. Static seed data
      races = SEED_RACES;
      source = 'seed';
    }
  }

  // When not loaded from Supabase, enrich with profile images from the DB
  if (source !== 'supabase') {
    try {
      races = await enrichRacesWithSupabase(races);
    } catch (err) {
      console.error('[getRaces] supabase enrichment failed:', err);
    }
  }

  // Cyclingoo fallback for stages still missing a profile image (~46 races
  // where PCS hasn't uploaded a profile yet)
  try {
    races = await enrichRacesWithCyclingoo(races);
  } catch (err) {
    console.error('[getRaces] cyclingoo enrichment failed:', err);
  }

  // Filter to races/stages that have already started
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  races = races
    .filter((r) => {
      const start = r.startDate ? new Date(r.startDate + 'T00:00:00Z') : null;
      return start !== null && start <= today;
    })
    .map((r) => ({
      ...r,
      stages: r.stages.filter((s) => {
        if (!s.date) return true;
        return new Date(s.date + 'T23:59:59Z') <= today;
      }),
    }))
    .filter((r) => r.stages.length > 0);

  return { races, source };
}

// ─── Supabase enrichment (used when falling back to JSON/seed) ────────────────

/**
 * Enrich races loaded from a non-Supabase source with PCS profile images.
 * Matches by stage_pcs_url. PCS image takes priority over any existing URL.
 */
async function enrichRacesWithSupabase(races: Race[]): Promise<Race[]> {
  const year = new Date().getFullYear();
  const profiles = await getStageProfilesByYear(year);
  if (profiles.length === 0) {
    console.log('[getRaces] no stage_profiles found in Supabase for', year);
    return races;
  }

  const byUrl = new Map<string, StageProfile>();
  for (const p of profiles) {
    if (p.stage_pcs_url) {
      byUrl.set(p.stage_pcs_url.replace(/\/$/, ''), p);
    }
  }

  return races.map((race) => ({
    ...race,
    stages: race.stages.map((stage): Stage => {
      const p = byUrl.get(stage.url.replace(/\/$/, ''));
      if (!p) return stage;
      return {
        ...stage,
        profileImageUrl: p.profile_image_url ?? stage.profileImageUrl,
        distanceKm: stage.distanceKm ?? (p.distance_km != null ? Number(p.distance_km) : null),
      };
    }),
  }));
}
