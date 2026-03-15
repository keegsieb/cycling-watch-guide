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

export interface StageProfile {
  race_slug: string;
  race_year: number;
  race_name: string | null;
  race_edition: string | null;
  race_start_date: string | null;
  race_end_date: string | null;
  race_classification: string | null;
  race_uci_tour: string | null;
  race_category: string | null;
  stage_number: number | null;
  stage_label: string | null;
  stage_full_label: string | null;
  stage_date: string | null;
  stage_pcs_url: string | null;
  distance_km: number | null;
  departure: string | null;
  arrival: string | null;
  parcours_type: string | null;
  profile_score: number | null;
  vertical_meters: number | null;
  gradient_final_km: number | null;
  start_time: string | null;
  profile_image_url: string | null;
  scraped_at: string;
}

// ─── Stage profiles ──────────────────────────────────────────────────────────

/**
 * Returns all scraped stage profiles for a given year.
 */
export async function getStageProfilesByYear(year: number): Promise<StageProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('stage_profiles')
    .select('*')
    .eq('race_year', year);
  if (error) {
    console.error('getStageProfilesByYear error:', error.message);
    return [];
  }
  return (data ?? []) as StageProfile[];
}

/**
 * Returns upcoming stage profiles (stage_date strictly after afterDate ISO string).
 * Results are ordered nearest-first, then by race slug for ties.
 */
export async function getUpcomingStageProfiles(
  year: number,
  afterDate: string
): Promise<StageProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('stage_profiles')
    .select('*')
    .eq('race_year', year)
    .gt('stage_date', afterDate)
    .order('stage_date', { ascending: true })
    .order('race_slug', { ascending: true });
  if (error) {
    console.error('getUpcomingStageProfiles error:', error.message);
    return [];
  }
  return (data ?? []) as StageProfile[];
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
