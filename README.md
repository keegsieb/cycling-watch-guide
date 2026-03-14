# CyclingWorthWatching

A crowdsourced resource for cycling fans: find out how many kilometres of a race are worth watching — without being spoiled on the result.

- Browse races that finished in the last 7 days
- See the route profile for each stage
- Click on the profile to vote on where the race gets exciting
- Rate the stage 1–10 after watching
- The community consensus shows you exactly where to start watching

---

## How it works

The site is a **static Astro website** hosted on GitHub Pages. It rebuilds itself every day via GitHub Actions, which:

1. Runs a Python script that fetches the latest race data from [ProCyclingStats](https://www.procyclingstats.com) using the [`procyclingstats`](https://github.com/themm1/procyclingstats) library
2. Builds the static site with Astro
3. Deploys it to GitHub Pages

User votes and ratings are stored in a free [Supabase](https://supabase.com) database, which the site reads and writes to directly from the browser.

---

## Deploying to GitHub Pages — Step by step

### What you'll need

- A free [GitHub](https://github.com) account
- A free [Supabase](https://supabase.com) account
- [Git](https://git-scm.com/downloads) installed on your computer
- [Node.js](https://nodejs.org) version 18 or higher (for local development)

---

### Step 1 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** button in the top-right corner → **New repository**
3. Give it a name, e.g. `cycling-watch-guide`
4. Keep it **Public** (required for free GitHub Pages hosting)
5. Leave everything else as default and click **Create repository**

---

### Step 2 — Push the code to GitHub

Open your Terminal (on Mac: press `⌘ Space`, type "Terminal", press Enter).

Run these commands one at a time, pressing Enter after each:

```bash
# Navigate to the project folder
cd "/path/to/cycling-watch-guide"

# Set up Git in this folder
git init

# Tell Git your name and email (only needed once ever)
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# Stage all the files
git add .

# Create the first commit
git commit -m "Initial commit"

# Connect to your GitHub repository
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push the code
git branch -M main
git push -u origin main
```

> **Tip:** The GitHub repository page shows the exact `git remote add origin …` command to copy. Look for it under "…or push an existing repository from the command line".

---

### Step 3 — Update `astro.config.mjs`

Open `astro.config.mjs` in a text editor and update the `site` line:

```js
site: 'https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME',
base: '/YOUR_REPO_NAME',
```

For example, if your GitHub username is `alice` and the repo is `cycling-watch-guide`:

```js
site: 'https://alice.github.io/cycling-watch-guide',
base: '/cycling-watch-guide',
```

Save the file, then push the change:

```bash
git add astro.config.mjs
git commit -m "Set GitHub Pages URL"
git push
```

---

### Step 4 — Enable GitHub Pages

1. In your GitHub repository, click the **Settings** tab (top of the page)
2. In the left sidebar, click **Pages**
3. Under **Source**, select **GitHub Actions**
4. That's it — the first deploy will happen automatically when you pushed in Step 2

---

### Step 5 — Set up Supabase (for votes and ratings)

The voting and rating features require a Supabase database. It's free for small projects.

#### 5a — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account)
2. Click **New project**
3. Choose a name (e.g. `cycling-watch-guide`), set a database password, pick a region close to you
4. Click **Create new project** and wait ~2 minutes for it to be ready

#### 5b — Create the database tables

1. In your Supabase project dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-schema.sql` from this project and copy its entire contents
4. Paste into the SQL editor and click **Run**

You should see a success message. This creates the `watch_points` and `ratings` tables.

#### 5c — Get your API credentials

1. In the Supabase dashboard, go to **Settings** → **API**
2. You need two values:
   - **Project URL** — looks like `https://abcdefghijklm.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`

#### 5d — Add credentials for local development

1. In the project folder, copy `.env.example` to a new file called `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in a text editor and fill in your values:
   ```
   PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJyour-long-key-here
   ```
3. **Never commit `.env` to Git** — it's already in `.gitignore`.

#### 5e — Add credentials to GitHub Actions

This is how the live site gets access to Supabase:

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**, add:
   - Name: `PUBLIC_SUPABASE_URL` → Value: your Supabase URL
   - Name: `PUBLIC_SUPABASE_ANON_KEY` → Value: your Supabase anon key
3. Click **Add secret** for each one

---

### Step 6 — Check your deployment

1. Go to your repository → **Actions** tab
2. You should see a workflow run in progress. Click it to watch the build.
3. Once it shows a green ✓, visit:
   ```
   https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/
   ```

If you see the site, you're done! 🎉

---

## Local development

```bash
# Install dependencies
npm install

# Copy and fill in your Supabase credentials
cp .env.example .env

# Start the dev server
npm run dev
```

Then open [http://localhost:4321/cycling-watch-guide/](http://localhost:4321/cycling-watch-guide/).

> **Note:** Race data fetched locally may fall back to a static list of known races
> because ProCyclingStats uses Cloudflare bot protection. The live GitHub Actions
> build uses Python's `procyclingstats` library which may succeed from GitHub's
> server IPs. You can also run the Python script locally first:
> ```bash
> pip install procyclingstats
> python3 scripts/fetch-races.py
> ```

---

## Race data sources

Race data is fetched in this priority order:

| Source | When used |
|--------|-----------|
| `src/data/races-live.json` | Generated by Python script in GitHub Actions |
| ProCyclingStats HTML scrape (Node.js) | If JSON file is absent and PCS is accessible |
| `src/data/seedRaces.ts` | Fallback — static list of current-season races |

Route profile images are loaded **in the user's browser** directly from ProCyclingStats, which avoids the Cloudflare block that affects server-side fetches.

---

## Adding races manually

To add a race that isn't showing up automatically, edit `src/data/seedRaces.ts` and add an entry following the existing format, then commit and push.

---

## Tech stack

- [Astro 5](https://astro.build) — static site framework
- [Supabase](https://supabase.com) — database for votes and ratings
- [procyclingstats](https://github.com/themm1/procyclingstats) — Python library for race data
- [cheerio](https://cheerio.js.org) — HTML parsing for Node.js fallback scraper
- [GitHub Pages](https://pages.github.com) — free static hosting
- [GitHub Actions](https://github.com/features/actions) — automated daily rebuilds
