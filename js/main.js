(() => {
  const dialog = document.getElementById('settings-dialog');
  const toast = document.getElementById('toast');
  let toastTimeout;
  let previousSettings = window.EverfrostSettings ? window.EverfrostSettings.get() : null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  function syncControl(key, value) {
    document.querySelectorAll(`[data-setting="${key}"]`).forEach((control) => {
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else control.value = String(value);
      if (control.type === 'range') {
        const output = document.querySelector(`output[for="${control.id}"]`);
        if (output) output.value = `${value}%`;
      }
    });
  }

  function syncAll(preferences) {
    Object.entries(preferences).forEach(([key, value]) => syncControl(key, value));
  }

  function openSettings() {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeSettings() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  document.querySelectorAll('[data-open-settings]').forEach((button) => button.addEventListener('click', openSettings));
  document.querySelectorAll('[data-close-settings]').forEach((button) => button.addEventListener('click', closeSettings));

  const shareButton = document.getElementById('share-button');
  if (shareButton) shareButton.addEventListener('click', async () => {
    const shareData = {
      title: document.title,
      text: 'Step into Everfrost — a little winter magic, counting down to Christmas.',
      url: window.location.href
    };
    const touchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    async function copyShareLink() {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(shareData.url);
          showToast('Everfrost link copied — share a little winter magic.');
          return;
        } catch (_) {
          // Try the legacy clipboard route below if permission was denied.
        }
      }
      const input = document.createElement('textarea');
      input.value = shareData.url;
      input.setAttribute('readonly', '');
      input.setAttribute('aria-label', 'Everfrost share link');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      input.remove();
      if (copied) showToast('Everfrost link copied — share a little winter magic.');
      else window.prompt('Copy this Everfrost link to share it:', shareData.url);
    }

    // Desktop Web Share implementations may exist but have no available targets.
    // Copying is predictable there; keep the native share sheet for touch devices.
    if (touchDevice && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    await copyShareLink();
  });
  document.querySelectorAll('[data-coming-soon]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    showToast(`${link.dataset.comingSoon} will be part of the Everfrost journey soon.`);
  }));

  // Arrow-key navigation for the settings tablist, per the ARIA tabs pattern.
  const settingsTabs = Array.from(document.querySelectorAll('[data-settings-tab]'));
  document.querySelectorAll('[data-settings-tab]').forEach((tab) => tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const index = settingsTabs.indexOf(tab);
    const next = settingsTabs[(index + (event.key === 'ArrowRight' ? 1 : settingsTabs.length - 1)) % settingsTabs.length];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }));

  document.querySelectorAll('[data-settings-tab]').forEach((tab) => tab.addEventListener('click', () => {
    const selected = tab.dataset.settingsTab;
    document.querySelectorAll('[data-settings-tab]').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== selected;
    });
  }));

  document.querySelectorAll('[data-setting]').forEach((control) => {
    const key = control.dataset.setting;
    const onChange = () => {
      if (!window.EverfrostSettings) return;
      const value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
      window.EverfrostSettings.update(key, value);
      const current = window.EverfrostSettings.get();
      syncControl(key, current[key]);
      const saved = document.getElementById('saved-note');
      if (saved) saved.textContent = 'Preferences saved on this device.';
    };
    control.addEventListener('input', onChange);
    control.addEventListener('change', onChange);
  });

  const resetButton = document.getElementById('reset-settings');
  if (resetButton) resetButton.addEventListener('click', () => {
    window.EverfrostSettings.reset();
    syncAll(window.EverfrostSettings.get());
    const saved = document.getElementById('saved-note');
    if (saved) saved.textContent = 'Preferences reset to defaults.';
  });

  window.addEventListener('everfrost:preferences', (event) => {
    const next = event.detail;
    if (!next) return;
    syncAll(next);
    if (previousSettings) {
      const changed = Object.keys(next).some((key) => next[key] !== previousSettings[key]);
      if (changed) {
        const saved = document.getElementById('saved-note');
        if (saved) saved.textContent = 'Preferences saved on this device.';
      }
    }
    previousSettings = { ...next };
  });

  if (dialog) dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeSettings();
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (window.EverfrostSettings) syncAll(window.EverfrostSettings.get());
  }, { once: true });
})();
