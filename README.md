# Everfrost

A static countdown homepage for an atmospheric Christmas experience. Built with HTML, CSS, and vanilla JavaScript; no build step, dependencies, backend, or account system is required.

## Run locally

Open `index.html` in a modern browser, or serve the project directory with any static web server. For example, with Python installed:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Static hosting such as GitHub Pages is also supported.

## Features

- Countdown to **December 25, 2026 at midnight in the visitor's local timezone**.
- Live Christmas progress, local date and time, and one festive message selected consistently for each calendar day.
- Animated winter scene with forest silhouettes, stars, mist, snowfall, and warm particles.
- Responsive desktop and mobile layouts.
- Settings saved in browser `localStorage`, including snow, motion, graphics, music and ambience preferences.
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

Settings are stored under `everfrost.preferences.v1` in `localStorage`. Use **Reset to defaults** in the settings dialog to clear custom preferences. The preferences API is exposed as `window.EverfrostSettings` for future Everfrost experiences.

## Scope

This project is the countdown homepage only. The Christmas Tree and Discoveries destinations are not implemented yet; their controls are placeholders for future stages. No 3D tree, present interactions, external audio assets, or audio autoplay are included.
