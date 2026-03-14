/**
 * Constructs candidate URLs for ProCyclingStats profile images.
 *
 * PCS serves profile images at paths like:
 *   /images/profiles/{race-slug}-{year}.jpeg          (one-day races)
 *   /images/profiles/{race-slug}-{year}-s{n}.jpeg     (stage races)
 *
 * We also fall back to alt formats PCS has used historically.
 * These URLs are loaded in the browser (client-side) — not during the build —
 * so Cloudflare's server-side challenge doesn't apply.
 */

const PCS_BASE = 'https://www.procyclingstats.com';

export function buildProfileImageCandidates(
  raceSlug: string,
  year: number,
  stageNumber?: number
): string[] {
  // Strip the year suffix that we append to slugs internally
  const slug = raceSlug.replace(/-\d{4}$/, '');
  const urls: string[] = [];

  if (stageNumber != null) {
    urls.push(`${PCS_BASE}/images/profiles/${slug}-${year}-s${stageNumber}.jpeg`);
    urls.push(`${PCS_BASE}/images/profiles/${slug}-${year}-s${String(stageNumber).padStart(2, '0')}.jpeg`);
    urls.push(`${PCS_BASE}/images/race/large/${slug}-${year}-s${stageNumber}.png`);
  }
  urls.push(`${PCS_BASE}/images/profiles/${slug}-${year}.jpeg`);
  urls.push(`${PCS_BASE}/images/race/large/${slug}-${year}.png`);

  return urls;
}

/**
 * Given a PCS race/stage URL, attempt to extract the race slug and
 * stage number for use with buildProfileImageCandidates.
 *
 * e.g. "https://www.procyclingstats.com/race/paris-nice/2026/stage-3"
 *   → { slug: "paris-nice", year: 2026, stageNumber: 3 }
 */
export function parseStageUrl(stageUrl: string): {
  slug: string;
  year: number;
  stageNumber: number | undefined;
} | null {
  try {
    const url = new URL(stageUrl);
    const parts = url.pathname.replace(/^\/race\//, '').split('/');
    if (parts.length < 2) return null;
    const slug = parts[0];
    const year = parseInt(parts[1], 10);
    if (isNaN(year)) return null;
    let stageNumber: number | undefined;
    if (parts[2]) {
      const m = parts[2].match(/stage-(\d+)/i) || parts[2].match(/prologue/i);
      if (m) stageNumber = m[1] ? parseInt(m[1], 10) : 0;
    }
    return { slug, year, stageNumber };
  } catch {
    return null;
  }
}
