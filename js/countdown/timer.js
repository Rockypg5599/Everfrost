(() => {
  // Change these values to configure the countdown. Date() uses the visitor's local timezone.
  const TARGET = Object.freeze({ year: 2026, month: 11, day: 25, hour: 0, minute: 0, second: 0 });

  function getTarget() {
    return new Date(TARGET.year, TARGET.month, TARGET.day, TARGET.hour, TARGET.minute, TARGET.second, 0);
  }

  let targetDate = getTarget();
  let previous = {};

  function updateUnit(unit, value, width) {
    const element = document.querySelector(`[data-unit="${unit}"]`);
    const next = String(value).padStart(width, '0');
    if (!element || previous[unit] === next) return;
    if (previous[unit] !== undefined) {
      element.classList.add('changing');
      window.setTimeout(() => {
        element.textContent = next;
        element.classList.remove('changing');
      }, 90);
    } else {
      element.textContent = next;
    }
    previous[unit] = next;
  }

  function tick() {
    const now = new Date();
    const remaining = Math.max(0, targetDate.getTime() - now.getTime());
    const totalSeconds = Math.floor(remaining / 1000);
    updateUnit('days', Math.floor(totalSeconds / 86400), 3);
    updateUnit('hours', Math.floor((totalSeconds % 86400) / 3600), 2);
    updateUnit('minutes', Math.floor((totalSeconds % 3600) / 60), 2);
    updateUnit('seconds', totalSeconds % 60, 2);
    const caption = document.getElementById('countdown-caption');
    if (caption) caption.textContent = remaining === 0 ? 'Merry Christmas — the day is here' : 'until Christmas morning';
    window.dispatchEvent(new CustomEvent('everfrost:countdown', { detail: { now, target: new Date(targetDate), remaining } }));
  }

  window.EverfrostCountdown = Object.freeze({
    getTarget: () => new Date(targetDate),
    getConfiguration: () => ({ ...TARGET }),
    refresh: tick
  });
  document.addEventListener('DOMContentLoaded', () => {
    tick();
    window.setInterval(tick, 1000);
  }, { once: true });
})();
