# Everfrost

A static countdown homepage for an atmospheric Christmas experience. The site uses HTML, CSS, and vanilla JavaScript, with Vite for the production build and GitHub Actions for GitHub Pages deployment. No framework, backend, or account system is used.

## GitHub Pages deployment

The site deploys to GitHub Pages as a project site (`https://<user>.github.io/<repo>/`). A workflow at `.github/workflows/deploy.yml` builds and deploys automatically on every push to `main` (and on manual runs via **Run workflow**).

One-time setup in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**. After the first workflow run, the site is live at the project URL.

The build is fully self-contained: `npm run build` runs `vite build` and then `scripts/inline-dist.mjs`, which folds every CSS file and JS chunk into each HTML page and adds a `.nojekyll` marker so Pages serves the output as-is, without Jekyll processing. Because of this, each page also keeps working when opened directly from disk or in single-file previews, where sibling asset files cannot load. Relative asset paths (`base: './'` in `vite.config.js`) make the build work from the repository subpath.

Install dependencies with `npm install` (Node.js 22.12 or newer). The preview command serves this production output locally; it does not run the development server.

## Local development and production preview

- `npm run dev` starts Vite's development server.
- `npm run build` creates the production site in `dist/`.
- `npm run preview` serves the production build locally for final checks.

## Features

- Countdown to **December 25, 2026 at midnight in the visitor's local timezone**.
- Live Christmas progress, local date and time, and one festive message selected consistently for each calendar day.
- Animated winter scene with forest silhouettes, stars, mist, snowfall, and warm particles, plus gentle pointer/scroll parallax and staggered entrance choreography (all suppressed under reduced-motion preferences).
- Responsive desktop and mobile layouts with safe-area insets for notched phones.
- Settings saved in browser `localStorage`, including snow, motion, graphics, music, and ambience preferences.
- Optional browser-generated melody and winter-wind ambience. Select **Sound off** in the header to start playback; audio does not autoplay. Browsers require this user interaction before sound can begin. Volume and mute preferences adjust the generated audio.
- Audio scheduling runs with a ~2 s lookahead on the audio clock so timer jitter and background-tab throttling never make notes late or clipped, and the context suspends/resumes correctly across backgrounding, interruptions, and back/forward-cache restores.
- On iOS, a looped silent `<audio>` track opens the media channel while sound is playing, so the physical silent switch no longer mutes the generated soundscape.
- A separate interactive Three.js tree scene at `tree.html`, with shared preferences/audio, snowfall, presents, discoveries, and a PBR Norway spruce model.

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

## Tree model and credits

The standalone `tree.html` experience loads the [Norway Spruce model](https://tevy.dev/models/norway-spruce) (LOD0), distributed under **CC0 1.0**. The GLB includes branch and needle geometry with compressed PBR color and normal textures. It is bundled at `public/assets/norway-spruce-lod0.glb` and served locally with the site; Three.js decodes its Basis/KTX2 textures using the pinned Three.js Basis transcoder.

The tree experience remains separate from the countdown homepage. Audio starts only after a user gesture, and tree settings reuse the shared Everfrost preferences. The optional Google Fonts stylesheet has system serif and sans-serif fallbacks if that service is unavailable.
