# Everfrost

A static countdown homepage for an atmospheric Christmas experience. The site uses HTML, CSS, and vanilla JavaScript, with Vite for the production build and Wrangler for Cloudflare Pages deployment. No framework, backend, or account system is used.

## Cloudflare Pages deployment

Create a Pages project connected to this repository and use these settings:

- **Framework preset:** None
- **Root directory:** `/`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Deploy command:** `npm run deploy` (runs `npx wrangler pages deploy dist`)
- **Preview command:** `npm run preview`

Install dependencies with `npm install`. Use Node.js 22.12 or newer for the current Wrangler 4 deployment CLI. The Vite build writes both `dist/index.html` and `dist/tree.html`, plus the referenced generated assets. The preview command serves this production output locally; it does not run the development server. The Vite build and preview were verified in the project environment; its installed Node.js 18 runtime is too old to verify Wrangler 4 execution or deployment.

### Wrangler authentication

Before deploying, authenticate Wrangler using either method:

1. Run `npx wrangler login` and complete the Cloudflare browser authorization flow; or
2. In CI, set `CLOUDFLARE_API_TOKEN` as a protected environment secret. Create a token with Cloudflare Pages project edit/deploy permissions for the correct account. Do not commit the token.

Then run `npm run deploy`. On initial setup, Wrangler may ask you to select an account and provide/create the Pages project name. You can pass a known project name with `npm run deploy -- --project-name <project-name>`.

## Local development and production preview

- `npm run dev` starts Vite's development server.
- `npm run build` creates the production site in `dist/`.
- `npm run preview` serves the production build locally for final checks.

## Features

- Countdown to **December 25, 2026 at midnight in the visitor's local timezone**.
- Live Christmas progress, local date and time, and one festive message selected consistently for each calendar day.
- Animated winter scene with forest silhouettes, stars, mist, snowfall, and warm particles.
- Responsive desktop and mobile layouts.
- Settings saved in browser `localStorage`, including snow, motion, graphics, music, and ambience preferences.
- Optional browser-generated melody and winter-wind ambience. Select **Sound off** in the header to start playback; audio does not autoplay. Browsers require this user interaction before sound can begin. Volume and mute preferences adjust the generated audio.

## Project layout

```text
index.html                 Homepage markup and settings dialog
css/main.css               Visual theme, environment, navigation, responsive layout
css/countdown.css          Countdown cards, progress bar, and CTA
js/main.js                 Navigation, settings UI, and toast messages
js/countdown/timer.js      Configurable countdown target and timer
js/countdown/progress.js   Progress bar and local date/time
js/countdown/messages.js   Daily message rotation
js/countdown/environment.js Canvas snowfall and particles
js/countdown/settings.js   Shared preferences and local storage
js/countdown/audio.js      User-initiated generated music and ambience
```

## Configuration and preferences

Edit `TARGET` in `js/countdown/timer.js` to change the countdown year, month, day, or local time. JavaScript months are zero-based (`11` is December).

Settings are stored under `everfrost.preferences.v1` in `localStorage`. Use **Reset to defaults** in the settings dialog to clear custom preferences. The preferences API is exposed as `window.EverfrostSettings` for future Everfrost experiences. Browser storage is scoped to the deployed origin; visitors' preferences are not shared between different domains.

## Current scope and deployment notes

This checkout contains the countdown homepage and a `tree.html` placeholder route so direct navigation and refresh work after deployment. The placeholder does not implement a 3D tree: there is no Three.js dependency, tree renderer, model, texture, or other tree asset in this project. The Christmas Tree route states that the experience is forthcoming; Discoveries remains a homepage placeholder. No present interactions, external audio assets, or audio autoplay are included.

The page optionally loads typography from Google Fonts; system serif and sans-serif fallbacks are defined in CSS if that external service is unavailable. The current experience has no third-party JavaScript runtime dependencies; Vite and Wrangler are development/deployment tools only.
