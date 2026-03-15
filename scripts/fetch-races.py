#!/usr/bin/env python3
"""
Pre-build script for the CyclingWorthWatching site.

Uses the `procyclingstats` Python library to fetch recent races from
ProCyclingStats.com and writes the result as a JSON file that the
Astro build consumes.

Run by GitHub Actions before `npm run build`.
Usage: python3 scripts/fetch-races.py
Output: src/data/races-live.json
"""

import json
import sys
import os
from datetime import datetime, timedelta

try:
    from procyclingstats import Race, Stage, RaceStartlist
except ImportError:
    print("procyclingstats not installed. Run: pip install procyclingstats", file=sys.stderr)
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

DAYS_BACK = 7
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'races-live.json')

# Major UCI WorldTour races by month (fallback list of known race slugs)
# These are checked even if the calendar scrape fails.
KNOWN_RACE_SLUGS_2026 = [
    # ── Men ──────────────────────────────────────────────────────────────────
    ('omloop-het-nieuwsblad-elite', '2026'),
    ('kuurne-brussels-kuurne', '2026'),
    ('strade-bianche', '2026'),
    ('paris-nice', '2026'),
    ('tirreno-adriatico', '2026'),
    ('milano-sanremo', '2026'),
    ('volta-ciclista-a-catalunya', '2026'),
    ('e3-saxo-bank-classic', '2026'),
    ('gent-wevelgem', '2026'),
    ('dwars-door-vlaanderen', '2026'),
    ('ronde-van-vlaanderen', '2026'),
    ('paris-roubaix', '2026'),
    ('amstel-gold-race', '2026'),
    ('la-fleche-wallonne', '2026'),
    ('liege-bastogne-liege', '2026'),
    ('tour-de-romandie', '2026'),
    ('criterium-du-dauphine', '2026'),
    # ── Women ─────────────────────────────────────────────────────────────────
    ('strade-bianche-donne', '2026'),
    ('omloop-het-nieuwsblad-women-elite', '2026'),
    ('gent-wevelgem-women', '2026'),
    ('ronde-van-vlaanderen-women', '2026'),
    ('paris-roubaix-femmes', '2026'),
    ('la-fleche-wallonne-femmes', '2026'),
    ('liege-bastogne-liege-femmes', '2026'),
    ('milano-sanremo-donne', '2026'),
    ('la-vuelta-femenina', '2026'),
    ('giro-donne', '2026'),
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def safe_get(fn):
    try:
        return fn()
    except Exception:
        return None


def fetch_race(slug, year):
    """Attempt to fetch race data for a given slug/year. Returns a dict or None."""
    url = f"race/{slug}/{year}"
    try:
        race = Race(url)
        name = safe_get(race.name) or slug.replace('-', ' ').title()
        start_date = safe_get(race.startdate) or ''
        end_date = safe_get(race.enddate) or start_date
        category = safe_get(race.classification) or ''

        # Normalize date format to YYYY-MM-DD
        def norm_date(d):
            if not d:
                return ''
            for fmt in ('%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%d.%m.%Y'):
                try:
                    return datetime.strptime(str(d), fmt).strftime('%Y-%m-%d')
                except ValueError:
                    continue
            return str(d)

        start = norm_date(start_date)
        end = norm_date(end_date) or start

        # Try to get stages
        stages = []
        try:
            raw_stages = race.stages()
            for s in (raw_stages or []):
                stage_url_path = s.get('stage_url', '') if isinstance(s, dict) else getattr(s, 'stage_url', '')
                stage_name = s.get('stage_name', '') if isinstance(s, dict) else getattr(s, 'stage_name', '')
                stage_date = s.get('date', '') if isinstance(s, dict) else getattr(s, 'date', '')
                if stage_url_path:
                    full_url = f"https://www.procyclingstats.com/{stage_url_path}"
                    stages.append({
                        'name': name,
                        'label': stage_name or stage_url_path.split('/')[-1],
                        'url': full_url,
                        'profileImageUrl': None,
                        'distanceKm': None,
                        'date': norm_date(stage_date) or end,
                    })
        except Exception:
            pass

        # If no stages, treat as one-day race
        if not stages:
            stages = [{
                'name': name,
                'label': name,
                'url': f"https://www.procyclingstats.com/{url}",
                'profileImageUrl': None,
                'distanceKm': None,
                'date': end,
            }]

        return {
            'name': name,
            'slug': f"{slug}-{year}",
            'url': f"https://www.procyclingstats.com/{url}",
            'startDate': start,
            'endDate': end,
            'category': category,
            'country': '',
            'stages': stages,
        }
    except Exception as e:
        print(f"  Warning: could not fetch {url}: {e}", file=sys.stderr)
        return None


def is_recent(race_dict, days=7):
    """Returns True if the race's end date is within the last `days` days."""
    end = race_dict.get('endDate', '')
    if not end:
        return False
    try:
        end_dt = datetime.strptime(end, '%Y-%m-%d')
        cutoff = datetime.now() - timedelta(days=days)
        return cutoff <= end_dt <= datetime.now()
    except ValueError:
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Fetching recent cycling races from ProCyclingStats...")
    races = []

    current_year = datetime.now().year

    for slug, year in KNOWN_RACE_SLUGS_2026:
        if int(year) != current_year:
            continue
        print(f"  Trying {slug} {year}...")
        r = fetch_race(slug, year)
        if r and is_recent(r, DAYS_BACK):
            races.append(r)
            print(f"  ✓ {r['name']} ({r['startDate']} – {r['endDate']})")

    print(f"\nFound {len(races)} recent race(s).")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(races, f, indent=2)
    print(f"Written to {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
