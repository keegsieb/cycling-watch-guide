import { createClient } from '@supabase/supabase-js';

// These are public (anon) keys — safe to expose in client-side code.
// Set them in your .env file and in GitHub repository secrets.
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ─── Database types ─────────────────────────────────────────────────────────

export interface RaceRecord {
  id: string;
  name: string;
  slug: string;
  pcs_url: string;
  start_date: string; // ISO date
  end_date: string;
  category: string;
  country: string;
  is_stage_race: boolean;
  created_at: string;
}

export interface StageRecord {
  id: string;
  race_id: string;
  label: string;
  stage_url: string;
  /** Direct URL to the profile image (if known) */
  profile_image_url: string | null;
  distance_km: number | null;
  date: string;
  stage_number: number | null;
  created_at: string;
}

export interface WatchPoint {
  id: number;
  race_slug: string;
  stage_url: string;
  /** Percentage from the finish (0 = finish line, 100 = start) */
  pct_from_finish: number;
  created_at: string;
}

export interface Rating {
  id: number;
  race_slug: string;
  stage_url: string;
  rating: number; // 1–10
  created_at: string;
}

// ─── Race fetching ───────────────────────────────────────────────────────────

/**
 * Returns races from the last `days` days, stored in Supabase.
 * Returns an empty array if Supabase is not configured.
 */
export async function getRecentRacesFromDB(days = 7): Promise<RaceRecord[]> {
  if (!supabase) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const { data, error } = await supabase
    .from('races')
    .select('*')
    .gte('end_date', cutoff.toISOString().slice(0, 10))
    .lte('end_date', new Date().toISOString().slice(0, 10))
    .order('end_date', { ascending: false });
  if (error) {
    console.error('getRecentRacesFromDB error:', error.message);
    return [];
  }
  return (data ?? []) as RaceRecord[];
}

/**
 * Returns stages for a race from Supabase.
 */
export async function getStagesFromDB(raceId: string): Promise<StageRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('race_id', raceId)
    .order('stage_number', { ascending: true });
  if (error) {
    console.error('getStagesFromDB error:', error.message);
    return [];
  }
  return (data ?? []) as StageRecord[];
}

// ─── Watch-point voting ───────────────────────────────────────────────────────

/**
 * Submits a "worth watching from" vote.
 * pctFromFinish: 0–100, where 100 = entire race, 0 = just the finish.
 */
export async function submitWatchPoint(
  raceSlug: string,
  stageUrl: string,
  pctFromFinish: number
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { error } = await supabase.from('watch_points').insert({
    race_slug: raceSlug,
    stage_url: stageUrl,
    pct_from_finish: Math.round(pctFromFinish * 10) / 10,
  });
  return { error: error?.message ?? null };
}

/**
 * Submits a stage rating (1–10).
 */
export async function submitRating(
  raceSlug: string,
  stageUrl: string,
  rating: number
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { error } = await supabase.from('ratings').insert({
    race_slug: raceSlug,
    stage_url: stageUrl,
    rating: Math.min(10, Math.max(1, Math.round(rating))),
  });
  return { error: error?.message ?? null };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Returns aggregated watch point data for a stage.
 * median + count
 */
export async function getWatchPoints(
  stageUrl: string
): Promise<{ median: number | null; count: number }> {
  if (!supabase) return { median: null, count: 0 };

  const { data, error } = await supabase
    .from('watch_points')
    .select('pct_from_finish')
    .eq('stage_url', stageUrl);

  if (error || !data || data.length === 0) {
    return { median: null, count: 0 };
  }

  const values = (data as { pct_from_finish: number }[])
    .map((r) => r.pct_from_finish)
    .sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

  return { median, count: values.length };
}

/**
 * Returns aggregated rating data for a stage.
 */
export async function getRatings(
  stageUrl: string
): Promise<{ average: number | null; count: number }> {
  if (!supabase) return { average: null, count: 0 };

  const { data, error } = await supabase
    .from('ratings')
    .select('rating')
    .eq('stage_url', stageUrl);

  if (error || !data || data.length === 0) {
    return { average: null, count: 0 };
  }

  const sum = (data as { rating: number }[]).reduce((acc, r) => acc + r.rating, 0);
  return { average: Math.round((sum / data.length) * 10) / 10, count: data.length };
}
