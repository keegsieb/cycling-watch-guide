import * as cheerio from 'cheerio';

export interface Race {
  name: string;
  slug: string;
  url: string;
  startDate: string;
  endDate: string;
  category: string;
  country: string;
  /** For stage races, the list of stages. For one-day races, a single entry. */
  stages: Stage[];
}

export interface Stage {
  name: string;
  /** e.g. "Stage 1", "Stage 2", or the race name for one-day races */
  label: string;
  url: string;
  /** The direct URL to the profile image on PCS */
  profileImageUrl: string | null;
  /** Total race/stage distance in km, if extractable */
  distanceKm: number | null;
  date: string;
}

const PCS_BASE = 'https://www.procyclingstats.com';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

/**
 * Fetches the list of races that finished within the last `days` days.
 * Parses the PCS race calendar page.
 */
export async function getRecentRaces(days = 7): Promise<Race[]> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  // PCS shows a calendar per month; fetch current and previous month if needed
  const months = new Set<string>();
  months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  if (cutoff.getMonth() !== now.getMonth()) {
    months.add(
      `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
    );
  }

  const races: Race[] = [];

  for (const ym of months) {
    const [year, month] = ym.split('-');
    const url = `${PCS_BASE}/races.php?year=${year}&month=${month}&WT.mc_id=sitemap`;
    try {
      const html = await fetchPage(url);
      const parsed = parseRaceCalendar(html, cutoff, now);
      races.push(...parsed);
    } catch (err) {
      console.error(`Error fetching calendar for ${ym}:`, err);
    }
  }

  // Deduplicate by slug, sort by end date descending (most recent first)
  const seen = new Set<string>();
  const unique = races.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });

  unique.sort((a, b) => (a.endDate < b.endDate ? 1 : -1));
  return unique;
}

function parseRaceCalendar(html: string, from: Date, to: Date): Race[] {
  const $ = cheerio.load(html);
  const races: Race[] = [];

  // PCS calendar: races are in a table with class "basic" inside #calendar
  // Each row: <tr> with <td class="date">, <td class="name">, etc.
  $('table.basic tbody tr, ul.raceListDefault li').each((_, el) => {
    const $el = $(el);

    // Try table row format
    const dateText = $el.find('td.date, td:first-child').first().text().trim();
    const nameEl = $el.find('td.name a, a.name, td:nth-child(2) a').first();
    const name = nameEl.text().trim();
    const href = nameEl.attr('href') || '';

    if (!name || !href) return;

    // Parse dates from PCS format: "01.03" or "01.03 - 07.03" or full "01.03.2026"
    const { startDate, endDate } = parseDateRange(dateText, to.getFullYear());
    if (!startDate || !endDate) return;

    const endDateObj = new Date(endDate);
    if (endDateObj < from || endDateObj > to) return;

    const slug = href.replace(/^\/race\//, '').replace(/\/\d{4}.*$/, '');
    const fullUrl = href.startsWith('http') ? href : `${PCS_BASE}${href}`;

    const category = $el.find('td.cat, .category').first().text().trim();
    const country = $el.find('td.country span, .flag').first().attr('class')?.replace('flag flag-', '') || '';

    races.push({
      name,
      slug: slug + '-' + endDate.slice(0, 4),
      url: fullUrl,
      startDate,
      endDate,
      category,
      country,
      stages: [],
    });
  });

  return races;
}

function parseDateRange(text: string, year: number): { startDate: string; endDate: string } {
  // Formats seen on PCS: "01.03", "28.02 - 01.03", "01.03.2026"
  const clean = text.replace(/\s+/g, ' ').trim();
  const rangeMatch = clean.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[-–]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  if (rangeMatch) {
    const sy = rangeMatch[3] ? parseInt(rangeMatch[3]) : year;
    const ey = rangeMatch[6] ? parseInt(rangeMatch[6]) : year;
    const startDate = `${sy}-${rangeMatch[2].padStart(2, '0')}-${rangeMatch[1].padStart(2, '0')}`;
    const endDate = `${ey}-${rangeMatch[5].padStart(2, '0')}-${rangeMatch[4].padStart(2, '0')}`;
    return { startDate, endDate };
  }
  const singleMatch = clean.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  if (singleMatch) {
    const y = singleMatch[3] ? parseInt(singleMatch[3]) : year;
    const date = `${y}-${singleMatch[2].padStart(2, '0')}-${singleMatch[1].padStart(2, '0')}`;
    return { startDate: date, endDate: date };
  }
  return { startDate: '', endDate: '' };
}

/**
 * Fetches the stages for a race from its PCS overview page.
 * For one-day races this returns a single Stage entry.
 */
export async function getRaceStages(race: Race): Promise<Stage[]> {
  try {
    const html = await fetchPage(race.url);
    const $ = cheerio.load(html);

    const stages: Stage[] = [];

    // Check for stage list
    const stageRows = $('ul.stageList li, table.basic tbody tr').toArray();

    if (stageRows.length > 0) {
      // Stage race
      for (const el of stageRows) {
        const $el = $(el);
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        if (!href.includes('/stage-') && !href.includes('/prologue')) continue;

        const stageUrl = href.startsWith('http') ? href : `${PCS_BASE}${href}`;
        const label = linkEl.text().trim() || $el.find('.stageName').text().trim();
        const dateText = $el.find('.date, td:first-child').first().text().trim();
        const { endDate } = parseDateRange(dateText, new Date(race.endDate).getFullYear());

        const stage: Stage = {
          name: race.name,
          label: label || href.split('/').pop() || 'Stage',
          url: stageUrl,
          profileImageUrl: null,
          distanceKm: null,
          date: endDate || race.endDate,
        };

        // Extract profile image URL and distance from the stage page
        try {
          const stageHtml = await fetchPage(stageUrl);
          const stageData = extractStageData(stageHtml);
          stage.profileImageUrl = stageData.profileImageUrl;
          stage.distanceKm = stageData.distanceKm;
        } catch {
          // Non-fatal — we'll show what we can
        }

        stages.push(stage);
      }
    }

    if (stages.length === 0) {
      // One-day race — use the race page itself
      const stageData = extractStageData(html);
      stages.push({
        name: race.name,
        label: race.name,
        url: race.url,
        profileImageUrl: stageData.profileImageUrl,
        distanceKm: stageData.distanceKm,
        date: race.endDate,
      });
    }

    return stages;
  } catch (err) {
    console.error(`Error fetching stages for ${race.name}:`, err);
    return [];
  }
}

/**
 * Extracts the profile image URL and distance from a PCS race/stage page.
 */
function extractStageData(html: string): { profileImageUrl: string | null; distanceKm: number | null } {
  const $ = cheerio.load(html);

  // Profile image: PCS embeds it as <img> inside a div with class "profileImage"
  // or as a background-image in an element with class "stageImage"
  let profileImageUrl: string | null = null;

  // Try common selectors
  const imgSelectors = [
    '.profileImage img',
    '.stageImage img',
    'img[src*="/profiles/"]',
    'img[src*="profile"]',
    '.info img',
  ];

  for (const sel of imgSelectors) {
    const src = $(sel).first().attr('src');
    if (src) {
      profileImageUrl = src.startsWith('http') ? src : `${PCS_BASE}${src}`;
      break;
    }
  }

  // Background image fallback
  if (!profileImageUrl) {
    const style = $('[style*="background-image"]').first().attr('style') || '';
    const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (match) {
      const src = match[1];
      profileImageUrl = src.startsWith('http') ? src : `${PCS_BASE}${src}`;
    }
  }

  // Distance: look for "xxx km" pattern near the race info
  let distanceKm: number | null = null;
  const infoText = $('.infolist, .info, .raceInfo').text();
  const distMatch = infoText.match(/(\d[\d,.]+)\s*km/i);
  if (distMatch) {
    distanceKm = parseFloat(distMatch[1].replace(',', '.'));
  }
  // Also try the page title area
  if (!distanceKm) {
    const titleText = $('h1, .title, .pageTitle').first().text();
    const m = titleText.match(/(\d[\d,.]+)\s*km/i);
    if (m) distanceKm = parseFloat(m[1].replace(',', '.'));
  }

  return { profileImageUrl, distanceKm };
}

/**
 * Fetches full race details including stages.
 * This is called on demand per race page to avoid hammering PCS at build time.
 */
export async function getFullRace(race: Race): Promise<Race> {
  const stages = await getRaceStages(race);
  return { ...race, stages };
}
