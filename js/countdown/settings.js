(() => {
  const STORAGE_KEY = 'everfrost.preferences.v1';
  const defaults = Object.freeze({
    musicVolume: 100,
    ambientVolume: 100,
    musicMuted: false,
    ambientMuted: false,
    snowEnabled: true,
    animationsEnabled: true,
    graphicsQuality: 'medium',
    snowDensity: 55,
    windIntensity: 30,
    particlesEnabled: true,
    reducedMotion: false
  });
  const allowedQuality = new Set(['low', 'medium', 'high']);
  let preferences = { ...defaults };

  function readStored() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return;
      preferences = { ...defaults, ...saved };
      for (const key of ['musicVolume', 'ambientVolume', 'snowDensity', 'windIntensity']) {
        const value = Number(preferences[key]);
        preferences[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : defaults[key];
      }
      for (const key of ['snowEnabled', 'animationsEnabled', 'particlesEnabled', 'reducedMotion', 'musicMuted', 'ambientMuted']) {
        preferences[key] = Boolean(preferences[key]);
      }
      if (!allowedQuality.has(preferences.graphicsQuality)) preferences.graphicsQuality = defaults.graphicsQuality;
    } catch (_) {
      preferences = { ...defaults };
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (_) {
      // The site remains usable when storage is disabled or full.
    }
  }

  function apply() {
    const { body } = document;
    body.classList.toggle('snow-disabled', !preferences.snowEnabled);
    body.classList.toggle('reduce-motion', preferences.reducedMotion || !preferences.animationsEnabled);
    body.classList.toggle('particles-disabled', !preferences.particlesEnabled);
    body.classList.remove('quality-low', 'quality-medium', 'quality-high');
    body.classList.add(`quality-${preferences.graphicsQuality}`);
    window.dispatchEvent(new CustomEvent('everfrost:preferences', { detail: { ...preferences } }));
  }

  function update(key, value) {
    if (!(key in defaults)) return;
    if (['musicVolume', 'ambientVolume', 'snowDensity', 'windIntensity'].includes(key)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      value = Math.max(0, Math.min(100, number));
    } else if (['snowEnabled', 'animationsEnabled', 'particlesEnabled', 'reducedMotion', 'musicMuted', 'ambientMuted'].includes(key)) {
      value = Boolean(value);
    } else if (key === 'graphicsQuality' && !allowedQuality.has(value)) return;
    preferences[key] = value;
    save();
    apply();
  }

  readStored();
  window.EverfrostSettings = Object.freeze({
    defaults,
    get: () => ({ ...preferences }),
    update,
    reset: () => { preferences = { ...defaults }; save(); apply(); }
  });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
})();
