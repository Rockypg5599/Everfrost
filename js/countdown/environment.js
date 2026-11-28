(() => {
  const canvas = document.getElementById('snow-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  // Layers used for the gentle pointer/scroll parallax. The translate property is
  // used (not transform) so it composes with the CSS keyframe animations instead
  // of fighting them.
  const auroraLayer = document.querySelector('.aurora');
  const farStars = document.querySelector('.stars-two');
  const forestNear = document.querySelector('.forest-near');
  const forestFar = document.querySelector('.forest-far');
  const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const reducedByOS = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = (min, max) => min + Math.random() * (max - min);

  const defaultSettings = {
    graphicsQuality: 'medium', snowDensity: 55, particlesEnabled: true, snowEnabled: true,
    animationsEnabled: true, reducedMotion: false, windIntensity: 30
  };
  let settingsCache = { ...defaultSettings };
  let capsCache = null;

  let width = 0;
  let height = 0;
  let ratio = 1;
  let flakes = [];
  let particles = [];
  let raf = 0;
  let running = false;
  let lastTime = 0;
  let gust = 0;
  let nextGust = 0;
  let staticDirty = true;

  // Golden particles are drawn from a pre-rendered glow sprite instead of
  // per-frame shadowBlur, which is far cheaper on mobile GPUs and looks softer.
  const spriteSize = 26;
  let particleSprite = null;
  function makeSprite() {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = spriteSize;
    const glow = sprite.getContext('2d');
    const gradient = glow.createRadialGradient(spriteSize / 2, spriteSize / 2, 0, spriteSize / 2, spriteSize / 2, spriteSize / 2);
    gradient.addColorStop(0, 'rgba(255, 236, 178, .95)');
    gradient.addColorStop(.4, 'rgba(245, 204, 121, .5)');
    gradient.addColorStop(1, 'rgba(240, 191, 100, 0)');
    glow.fillStyle = gradient;
    glow.fillRect(0, 0, spriteSize, spriteSize);
    return sprite;
  }

  function readSettings() {
    settingsCache = window.EverfrostSettings ? window.EverfrostSettings.get() : { ...defaultSettings };
    capsCache = null;
  }

  function caps() {
    if (capsCache) return capsCache;
    const quality = settingsCache.graphicsQuality;
    const density = settingsCache.snowDensity / 100;
    const pixelBudget = quality === 'high' ? 180 : quality === 'low' ? 70 : 115;
    const multiplier = width < 560 ? .55 : 1;
    capsCache = {
      snow: Math.round(pixelBudget * multiplier * density),
      particles: settingsCache.particlesEnabled ? Math.round((quality === 'high' ? 20 : quality === 'low' ? 7 : 13) * multiplier) : 0,
      wind: settingsCache.windIntensity / 100
    };
    return capsCache;
  }

  const motionReduced = () => reducedByOS || settingsCache.reducedMotion || !settingsCache.animationsEnabled;

  function newFlake() {
    return { x: random(0, width), y: random(0, height), r: random(.55, 2.1), speed: random(13, 46), drift: random(-9, 9), alpha: random(.18, .72), phase: random(0, 6.28) };
  }

  function newParticle() {
    return { x: random(0, width), y: random(height * .18, height * .78), r: random(.6, 1.7), phase: random(0, 6.28), speed: random(.3, 1.1), alpha: random(.1, .42) };
  }

  // Grow or trim the populations to the current budget, keeping existing flakes
  // in place so resizing (mobile URL bar, window drag) never resets the scene.
  function population() {
    const budget = caps();
    while (flakes.length < budget.snow) flakes.push(newFlake());
    if (flakes.length > budget.snow) flakes.length = budget.snow;
    while (particles.length < budget.particles) particles.push(newParticle());
    if (particles.length > budget.particles) particles.length = budget.particles;
  }

  function seed() {
    flakes = Array.from({ length: caps().snow }, newFlake);
    particles = Array.from({ length: caps().particles }, newParticle);
    staticDirty = true;
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    if (width && height) {
      const scaleX = nextWidth / width;
      const scaleY = nextHeight / height;
      for (const flake of flakes) { flake.x *= scaleX; flake.y *= scaleY; }
      for (const particle of particles) { particle.x *= scaleX; particle.y *= scaleY; }
    }
    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    capsCache = null;
    staticDirty = true;
    population();
    ensureRunning();
  }

  let resizeTimer = 0;
  function scheduleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 140);
  }

  function drawFlake(flake) {
    context.beginPath();
    context.fillStyle = `rgba(236, 243, 244, ${flake.alpha})`;
    context.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
    context.fill();
  }

  function drawParticle(particle) {
    particle.phase += lastDelta * particle.speed;
    const shimmer = .55 + .45 * Math.sin(particle.phase);
    const size = particle.r * 7;
    context.globalAlpha = particle.alpha * shimmer;
    context.drawImage(particleSprite, particle.x + Math.sin(particle.phase * .3) * 4 - size / 2, particle.y + Math.sin(particle.phase * .45) * 3 - size / 2, size, size);
  }

  let lastDelta = 0;

  // Pointer tilt and scroll drift targets, eased every frame while animating.
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let scrollTarget = 0;
  let scrollCurrent = 0;

  function updateParallax(delta) {
    if (motionReduced()) {
      for (const layer of [auroraLayer, farStars, forestNear, forestFar]) {
        if (layer) layer.style.translate = '';
      }
      return;
    }
    const ease = Math.min(1, delta * 3.2);
    parallaxX += (pointerTargetX - parallaxX) * ease;
    parallaxY += (pointerTargetY - parallaxY) * ease;
    scrollCurrent += (scrollTarget - scrollCurrent) * ease;
    if (auroraLayer) auroraLayer.style.translate = `${(parallaxX * 1.4).toFixed(2)}px ${(parallaxY * .6).toFixed(2)}px`;
    if (farStars) farStars.style.translate = `${(parallaxX * .8).toFixed(2)}px ${(parallaxY * .4).toFixed(2)}px`;
    if (forestFar) forestFar.style.translate = `0px ${(scrollCurrent * .03).toFixed(2)}px`;
    if (forestNear) forestNear.style.translate = `0px ${(scrollCurrent * .06).toFixed(2)}px`;
  }

  function paintStatic() {
    context.clearRect(0, 0, width, height);
    if (settingsCache.snowEnabled) for (const flake of flakes) drawFlake(flake);
    staticDirty = false;
  }

  function draw(time) {
    raf = 0;
    if (!running) return;
    if (document.hidden) {
      lastTime = 0;
      raf = window.requestAnimationFrame(draw);
      return;
    }
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    lastDelta = delta;

    if (motionReduced()) {
      if (staticDirty) paintStatic();
      updateParallax(delta);
      stop();
      return;
    }

    context.clearRect(0, 0, width, height);
    const wind = caps().wind;
    if (time > nextGust) {
      gust = random(-1, 1) * wind * 20;
      nextGust = time + random(6500, 14000);
    }
    gust *= .997;

    if (settingsCache.snowEnabled) {
      for (const flake of flakes) {
        flake.phase += delta * .8;
        flake.y += flake.speed * delta;
        flake.x += (flake.drift * .23 + gust) * delta + Math.sin(flake.phase) * delta * 5;
        if (flake.y > height + 5) { flake.y = -5; flake.x = random(0, width); }
        if (flake.x < -6) flake.x = width + 4;
        if (flake.x > width + 6) flake.x = -4;
        drawFlake(flake);
      }
    }

    if (settingsCache.particlesEnabled && particles.length) {
      if (!particleSprite) particleSprite = makeSprite();
      for (const particle of particles) drawParticle(particle);
      context.globalAlpha = 1;
    }

    updateParallax(delta);
    raf = window.requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function ensureRunning() {
    if (running) return;
    const reduced = motionReduced();
    const hasWork = reduced ? staticDirty : settingsCache.snowEnabled || caps().particles > 0;
    if (!hasWork) return;
    running = true;
    lastTime = 0;
    raf = window.requestAnimationFrame(draw);
  }

  window.addEventListener('resize', scheduleResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { lastTime = 0; ensureRunning(); }
  });
  window.addEventListener('pointermove', (event) => {
    if (!finePointer || !width || motionReduced()) return;
    pointerTargetX = (event.clientX / width - .5) * 2 * 10;
    pointerTargetY = (event.clientY / height - .5) * 2 * 10 * .6;
  }, { passive: true });
  window.addEventListener('scroll', () => { scrollTarget = window.scrollY; }, { passive: true });
  window.addEventListener('everfrost:preferences', () => {
    readSettings();
    population();
    staticDirty = true;
    ensureRunning();
  });
  // The page can survive navigation in the back/forward cache on mobile; the
  // loop must restart when it is shown again, not just die on pagehide.
  window.addEventListener('pagehide', () => stop());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) { lastTime = 0; ensureRunning(); }
  });

  readSettings();
  resize();
  ensureRunning();
})();
