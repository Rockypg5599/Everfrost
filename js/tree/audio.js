// Reuse the homepage's synthesized Everfrost sound engine and its shared user-gesture gating.
export function createTreeAudio() {
  return {
    toggle: async () => window.EverfrostAudio ? window.EverfrostAudio.toggle() : false,
    setPreference: () => {},
    get enabled() { return window.EverfrostAudio ? window.EverfrostAudio.isEnabled() : false; },
    supported: () => Boolean(window.AudioContext || window.webkitAudioContext)
  };
}
