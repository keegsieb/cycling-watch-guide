/**
 * Cyclingoo scraper — fetches route profile images for races and stages.
 *
 * Cyclingoo (cyclingoo.com) is not Cloudflare-protected so it can be
 * scraped at build time from both Node.js locally and GitHub Actions.
 *
 * Flow:
 *   1. Fetch /en/races to get the full race list with numeric IDs.
 *   2. Match each of our races to a cyclingoo race (fuzzy slug matching).
 *   3. Fetch the cyclingoo race page to get its stage links.
 *   4. Fetch each stage page to get the profile image URL and distance.
 */

import * as cheerio from 'cheerio';
import type { Race, Stage } from './procyclingstats';

const BASE = 'https://cyclingoo.com';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface CyclingooRace {
  slug: string; // e.g. "paris-nice-2026"
  id: number;   // e.g. 482
  url: string;  // full URL
}

interface CyclingooStage {
  slug: string; // e.g. "paris-nice-2026-stage-7"
  id: number;   // e.g. 2137
  url: string;
  stageNum: number | null;
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`cyclingoo: ${res.status} fetching ${url}`);
  return res.text();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── Slug matching ────────────────────────────────────────────────────────────

/** Normalise a slug for comparison: strip trailing year, lowercase, letters+digits only. */
function norm(slug: string): string {
  return slug
    .replace(/-\d{4}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Levenshtein edit distance. */
function editDist(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(dp[j], dp[j - 1], prev);
      prev = tmp;
    }
  }
  return dp[n];
}

function bestMatch(ourSlug: string, races: CyclingooRace[]): CyclingooRace | null {
  const key = norm(ourSlug);

  // Exact normalised match
  const exact = races.find((r) => norm(r.slug) === key);
  if (exact) return exact;

  // Fuzzy: lowest edit distance within 15 % of slug length
  let best: CyclingooRace | null = null;
  let bestD = Infinity;
  for (const r of races) {
    const d = editDist(key, norm(r.slug));
    const threshold = Math.ceil(Math.max(key.length, norm(r.slug).length) * 0.15);
    if (d < bestD && d <= threshold) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/** Extract a stage number from a cyclingoo stage slug or URL fragment. */
function extractStageNum(slug: string): number | null {
  const m = slug.match(/stage-(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse "07-03-2026" → "2026-03-07". */
function parseCyclingooDate(text: string): string {
  const m = text.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/** Fetch the /en/races page and return all race entries. */
async function fetchRaceList(): Promise<CyclingooRace[]> {
  const html = await fetchHtml(`${BASE}/en/races`);
  const $ = cheerio.load(html);
  const seen = new Set<number>();
  const races: CyclingooRace[] = [];

  $('a[href*="/en/race/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/\/en\/race\/([^/?#]+)\/(\d+)/);
    if (!m) return;
    const id = parseInt(m[2], 10);
    if (seen.has(id)) return;
    seen.add(id);
    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    races.push({ slug: m[1], id, url });
  });

  return races;
}

/** Fetch a cyclingoo race page and return its stage entries. */
async function fetchStageList(race: CyclingooRace): Promise<CyclingooStage[]> {
  const html = await fetchHtml(race.url);
  const $ = cheerio.load(html);
  const seen = new Set<number>();
  const stages: CyclingooStage[] = [];

  $('a[href*="/en/stage/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/\/en\/stage\/([^/?#]+)\/(\d+)/);
    if (!m) return;
    const id = parseInt(m[2], 10);
    if (seen.has(id)) return;
    seen.add(id);
    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    stages.push({
      slug: m[1],
      id,
      url,
      stageNum: extractStageNum(m[1]),
    });
  });

  // Sort by stage number so index-based matching lines up
  stages.sort((a, b) => (a.stageNum ?? 99) - (b.stageNum ?? 99));
  return stages;
}

interface StageData {
  profileImageUrl: string | null;
  distanceKm: number | null;
  date: string;
  label: string;
}

/** Fetch a cyclingoo stage page and extract profile image + metadata. */
async function fetchStageData(stage: CyclingooStage): Promise<StageData> {
  const html = await fetchHtml(stage.url);
  const $ = cheerio.load(html);

  // Profile image: cyclingoo uses a background-image on an <a> lightbox link.
  // The <a> has href pointing directly to the image file.
  let profileImageUrl: string | null = null;

  // Primary: <a href="...stages/profiles/..."> (lightbox link)
  const profileLink = $('a[href*="storage/media/stages/profiles/"]').first();
  if (profileLink.length) {
    const href = profileLink.attr('href') || '';
    profileImageUrl = href.startsWith('http') ? href : `${BASE}/${href.replace(/^\//, '')}`;
  }

  // Fallback: background-image style on any element
  if (!profileImageUrl) {
    $('[style*="stages/profiles"]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const m = style.match(/url\(['"]?(https?:[^'")\s]+stages\/profiles\/[^'")\s]+)['"]?\)/);
      if (m) { profileImageUrl = m[1]; return false; }
    });
  }

  // Distance: "203.0 kms" or "138.7 km"
  let distanceKm: number | null = null;
  const bodyText = $('body').text();
  const distM = bodyText.match(/(\d[\d.,]+)\s*kms?\b/i);
  if (distM) {
    distanceKm = parseFloat(distM[1].replace(',', '.'));
  }

  // Date: "07-03-2026" format
  const date = parseCyclingooDate(bodyText);

  // Label: page heading
  const label = $('h1').first().text().trim();

  return { profileImageUrl, distanceKm, date, label };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich a list of races by fetching stage profile images from cyclingoo.
 * Races that already have profileImageUrl populated are left unchanged.
 * Mutates nothing — returns new race objects.
 */
export async function enrichRacesWithCyclingoo(races: Race[]): Promise<Race[]> {
  let cyclingooRaces: CyclingooRace[];
  try {
    cyclingooRaces = await fetchRaceList();
    console.log(`[cyclingoo] race list: ${cyclingooRaces.length} entries`);
  } catch (err) {
    console.error('[cyclingoo] could not fetch race list:', err);
    return races;
  }

  const result: Race[] = [];

  for (const race of races) {
    const enriched = await enrichOneRace(race, cyclingooRaces);
    result.push(enriched);
  }

  return result;
}

async function enrichOneRace(race: Race, cyclingooRaces: CyclingooRace[]): Promise<Race> {
  const matched = bestMatch(race.slug, cyclingooRaces);
  if (!matched) {
    console.log(`[cyclingoo] no match for ${race.slug}`);
    return race;
  }
  console.log(`[cyclingoo] ${race.slug} → ${matched.slug} (id ${matched.id})`);

  let cyclingooStages: CyclingooStage[];
  try {
    await sleep(300);
    cyclingooStages = await fetchStageList(matched);
  } catch (err) {
    console.error(`[cyclingoo] could not fetch stage list for ${matched.slug}:`, err);
    return race;
  }

  if (cyclingooStages.length === 0) {
    console.log(`[cyclingoo] no stages found for ${matched.slug}`);
    return race;
  }

  // ── Case 1: race already has stages (from Python/PCS) ─────────────────────
  // Match by stage number; fill in missing profileImageUrl and distanceKm.
  if (race.stages.length > 0) {
    const enrichedStages: Stage[] = [];
    for (const stage of race.stages) {
      // Skip if we already have a profile image
      if (stage.profileImageUrl) {
        enrichedStages.push(stage);
        continue;
      }

      // Extract stage number from the PCS stage URL
      const ourNum = extractStageNumFromUrl(stage.url);

      // Find corresponding cyclingoo stage
      const cs =
        ourNum != null
          ? cyclingooStages.find((s) => s.stageNum === ourNum)
          : cyclingooStages[enrichedStages.length]; // fallback: by index

      if (!cs) {
        enrichedStages.push(stage);
        continue;
      }

      try {
        await sleep(300);
        const data = await fetchStageData(cs);
        enrichedStages.push({
          ...stage,
          profileImageUrl: data.profileImageUrl ?? stage.profileImageUrl,
          distanceKm: stage.distanceKm ?? data.distanceKm,
        });
      } catch (err) {
        console.error(`[cyclingoo] error fetching stage ${cs.slug}:`, err);
        enrichedStages.push(stage);
      }
    }
    return { ...race, stages: enrichedStages };
  }

  // ── Case 2: race has no stages (e.g. seed entry for stage race) ────────────
  // Build stage objects from cyclingoo, keeping PCS URLs for Supabase keys.
  const builtStages: Stage[] = [];
  for (const cs of cyclingooStages) {
    try {
      await sleep(300);
      const data = await fetchStageData(cs);
      // Construct a PCS-style URL so Supabase keys stay consistent
      const pcsStageUrl = buildPcsStageUrl(race.url, cs.stageNum);
      builtStages.push({
        name: race.name,
        label: cs.stageNum ? `Stage ${cs.stageNum}` : (data.label || cs.slug),
        url: pcsStageUrl,
        profileImageUrl: data.profileImageUrl,
        distanceKm: data.distanceKm,
        date: data.date || race.endDate,
      });
    } catch (err) {
      console.error(`[cyclingoo] error fetching stage ${cs.slug}:`, err);
    }
  }

  return builtStages.length > 0 ? { ...race, stages: builtStages } : race;
}

/** Extract stage number from a PCS stage URL like ".../stage-3". */
function extractStageNumFromUrl(url: string): number | null {
  const m = url.match(/\/stage-(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Build a PCS-style stage URL from the race URL and stage number.
 * e.g. "https://www.procyclingstats.com/race/paris-nice/2026" + 3
 *   → "https://www.procyclingstats.com/race/paris-nice/2026/stage-3"
 */
function buildPcsStageUrl(raceUrl: string, stageNum: number | null): string {
  const base = raceUrl.replace(/\/$/, '');
  return stageNum != null ? `${base}/stage-${stageNum}` : base;
}
