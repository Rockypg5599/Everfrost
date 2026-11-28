(() => {
  let previousDay = '';
  let previousPercent = '';
  const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function update() {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (key !== previousDay) {
      const date = document.getElementById('local-date');
      if (date) date.textContent = dateFormat.format(now);
      previousDay = key;
    }
    const time = document.getElementById('local-time');
    if (time) time.textContent = timeFormat.format(now);
    if (!window.EverfrostCountdown) return;
    const target = window.EverfrostCountdown.getTarget();
    const start = new Date(target.getFullYear() - 1, 11, 25, 0, 0, 0, 0);
    const span = target.getTime() - start.getTime();
    const percent = span <= 0 ? 100 : Math.max(0, Math.min(100, ((now.getTime() - start.getTime()) / span) * 100));
    const text = `${percent.toFixed(1)}%`;
    // The clock ticks every second but the percentage moves once every few
    // hours; only touch the DOM when the rendered value actually changes.
    if (text === previousPercent) return;
    previousPercent = text;
    const fill = document.getElementById('progress-fill');
    const track = document.getElementById('progress-track');
    const value = document.getElementById('progress-value');
    const footer = document.getElementById('footer-progress');
    if (fill) fill.style.width = `${percent}%`;
    if (track) track.setAttribute('aria-valuenow', percent.toFixed(1));
    if (value) value.textContent = text;
    if (footer) footer.textContent = text;
  }

  document.addEventListener('DOMContentLoaded', () => {
    update();
    window.setInterval(update, 1000);
    window.addEventListener('everfrost:countdown', update);
  }, { once: true });
})();
