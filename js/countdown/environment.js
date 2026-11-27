(() => {
  const canvas = document.getElementById('snow-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  let width = 0;
  let height = 0;
  let ratio = 1;
  let flakes = [];
  let particles = [];
  let raf = 0;
  let lastTime = 0;
  let gust = 0;
  let nextGust = 0;
  const reducedByOS = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = (min, max) => min + Math.random() * (max - min);

  function caps() {
    const settings = window.EverfrostSettings ? window.EverfrostSettings.get() : { graphicsQuality: 'medium', snowDensity: 55, particlesEnabled: true };
    const quality = settings.graphicsQuality;
    const density = settings.snowDensity / 100;
    const pixelBudget = quality === 'high' ? 180 : quality === 'low' ? 70 : 115;
    const multiplier = width < 560 ? .55 : 1;
    return {
      snow: Math.round(pixelBudget * multiplier * density),
      particles: settings.particlesEnabled ? Math.round((quality === 'high' ? 20 : quality === 'low' ? 7 : 13) * multiplier) : 0,
      wind: settings.windIntensity / 100
    };
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    seed();
  }

  function seed() {
    const budget = caps();
    flakes = Array.from({ length: budget.snow }, () => ({ x: random(0, width), y: random(0, height), r: random(.55, 2.1), speed: random(13, 46), drift: random(-9, 9), alpha: random(.18, .72), phase: random(0, 6.28) }));
    particles = Array.from({ length: budget.particles }, () => ({ x: random(0, width), y: random(height * .18, height * .78), r: random(.6, 1.7), phase: random(0, 6.28), speed: random(.3, 1.1), alpha: random(.1, .42) }));
  }

  function draw(time) {
    if (!document.hidden) {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
      lastTime = time;
      context.clearRect(0, 0, width, height);
      const settings = window.EverfrostSettings ? window.EverfrostSettings.get() : { snowEnabled: true, animationsEnabled: true, reducedMotion: false };
      const motionReduced = reducedByOS || settings.reducedMotion || !settings.animationsEnabled;
      if (!motionReduced) {
        const wind = caps().wind;
        if (time > nextGust) {
          gust = random(-1, 1) * wind * 20;
          nextGust = time + random(6500, 14000);
        }
        gust *= .997;
      } else gust = 0;

      if (settings.snowEnabled) {
        for (const flake of flakes) {
          if (!motionReduced) {
            flake.phase += delta * .8;
            flake.y += flake.speed * delta;
            flake.x += (flake.drift * .23 + gust) * delta + Math.sin(flake.phase) * delta * 5;
            if (flake.y > height + 5) { flake.y = -5; flake.x = random(0, width); }
            if (flake.x < -6) flake.x = width + 4;
            if (flake.x > width + 6) flake.x = -4;
          }
          context.beginPath();
          context.fillStyle = `rgba(236, 243, 244, ${flake.alpha})`;
          context.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
          context.fill();
        }
      }
      if (!motionReduced && settings.particlesEnabled) {
        for (const particle of particles) {
          particle.phase += delta * particle.speed;
          const shimmer = .55 + .45 * Math.sin(particle.phase);
          context.beginPath();
          context.fillStyle = `rgba(245, 204, 121, ${particle.alpha * shimmer})`;
          context.shadowColor = 'rgba(240, 191, 100, .7)';
          context.shadowBlur = 8;
          context.arc(particle.x + Math.sin(particle.phase * .3) * 4, particle.y + Math.sin(particle.phase * .45) * 3, particle.r, 0, Math.PI * 2);
          context.fill();
        }
        context.shadowBlur = 0;
      }
    } else lastTime = 0;
    raf = window.requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { lastTime = 0; });
  window.addEventListener('everfrost:preferences', seed);
  resize();
  raf = window.requestAnimationFrame(draw);
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(raf), { once: true });
})();
