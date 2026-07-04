# Buck Builds Website

Public website for the business in this folder. The pages are mostly static HTML/CSS/JS, with small Cloudflare Pages Functions for the request inbox.

## Source Notes Used

- Company purpose, product catalog, and local-first operating direction from the private business folder.
- Public product links for Gumroad, GitHub, itch.io, and Amazon.
- Audience and page notes for the Stormlight Village and Planetary Researcher game listings.

## Files

- `index.html`: public homepage.
- `seller-kits.html`: seller kit category page.
- `utilities.html`: free utility category page.
- `games.html`: games, books, and creative products page.
- `local-first-systems.html`: local-first workflow page.
- `assets/styles.css`: responsive visual system.
- `assets/site.js`: product-category filter tabs.
- `assets/request-board.json`: public, scrubbed request/job board data generated from the private inbox.
- `assets/hero-local-tools.png`: generated bitmap hero image saved into the project so the site is self-contained.
- `functions/api/requests.js`: Cloudflare Pages Function that receives Request a Tool submissions.
- `functions/api/request-board.js`: Cloudflare Pages Function that returns public request-board rows.
- `functions/admin/[[path]].js`: Cloudflare Pages Function for the private admin inbox and CSV export.
- `_routes.json`: keeps Functions limited to `/api/*` and `/admin*` routes.
- `wrangler.toml`: Cloudflare project metadata for local/dev tooling.

## Cloudflare Pages Setup

Recommended dashboard values:

- Project name: `buck-builds-site`
- GitHub repo: `buckbuilds/buck-builds-site`
- Production branch: `main`
- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `.`
- Custom domains: `buckbuilds.org` and optionally `www.buckbuilds.org`

Create a D1 database named `buck_builds_requests`, then add a Pages binding:

- Binding type: D1 database
- Variable name: `DB`
- D1 database: `buck_builds_requests`

Add this Pages environment variable as a secret:

- `BUCK_ADMIN_PASSWORD`: password for `https://buckbuilds.org/admin`

The first successful request or admin page load creates the D1 table automatically.

## Preview

Open `index.html` directly in a browser, or serve this folder locally if preferred.
