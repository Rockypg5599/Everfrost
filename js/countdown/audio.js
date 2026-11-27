(() => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let ambienceGain = null;
  let windSource = null;
  let musicTimer = 0;
  let musicStartedAt = 0;
  let enabled = false;
  let disposed = false;

  // A slow, repeating winter lullaby. Notes are generated with oscillators—no external assets.
  const melody = [
    [0, 659.25], [1, 783.99], [2, 987.77], [4, 880], [5, 783.99], [7, 659.25],
    [8, 587.33], [10, 659.25], [11, 783.99], [13, 659.25], [14, 587.33]
  ];
  const chords = [
    [261.63, 329.63, 392], // C
    [220, 261.63, 329.63], // Am
    [174.61, 220, 261.63], // F
    [196, 246.94, 293.66] // G
  ];
  const beatSeconds = 0.72;
  const loopBeats = 16;
  let scheduledMelodyBeat = -1;
  let scheduledChord = -1;

  function preferences() {
    return window.EverfrostSettings ? window.EverfrostSettings.get() : {
      musicVolume: 45, ambientVolume: 55, musicMuted: false, ambientMuted: false
    };
  }

  function setGain(gain, value) {
    if (!gain || !audioContext) return;
    const now = audioContext.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), now, 0.12);
  }

  function applyPreferences() {
    if (!audioContext) return;
    const prefs = preferences();
    setGain(musicGain, enabled && !prefs.musicMuted ? (prefs.musicVolume / 100) * 0.48 : 0);
    setGain(ambienceGain, enabled && !prefs.ambientMuted ? (prefs.ambientVolume / 100) * 0.72 : 0);
  }

  function createNoiseBuffer() {
    const seconds = 4;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * seconds, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.36;
    return buffer;
  }

  function startWind() {
    const source = audioContext.createBufferSource();
    const lowpass = audioContext.createBiquadFilter();
    const highpass = audioContext.createBiquadFilter();
    const windGain = audioContext.createGain();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    source.buffer = createNoiseBuffer();
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.value = 90;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 460;
    windGain.gain.value = 0.6;
    lfo.type = 'sine';
    lfo.frequency.value = 0.085;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(windGain);
    windGain.connect(ambienceGain);
    source.start();
    lfo.start();
    windSource = { source, lfo };
  }

  function playNote(frequency, startAt, duration, volume, type = 'sine') {
    if (!audioContext || !musicGain) return;
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), startAt + 0.045);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(envelope);
    envelope.connect(musicGain);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.04);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
  }

  function scheduleMusic() {
    if (!enabled || !audioContext) return;
    const elapsed = audioContext.currentTime - musicStartedAt;
    const beat = Math.floor(elapsed / beatSeconds);
    const position = (beat + loopBeats) % loopBeats;
    const stepStart = musicStartedAt + beat * beatSeconds;
    if (position !== scheduledMelodyBeat && elapsed >= 0) {
      const note = melody.find(([at]) => at === position);
      if (note) playNote(note[1], Math.max(audioContext.currentTime + 0.012, stepStart), beatSeconds * 1.5, 0.36, 'sine');
      scheduledMelodyBeat = position;
    }
    const chordIndex = Math.floor(position / 4);
    if (chordIndex !== scheduledChord && position % 4 === 0) {
      const chord = chords[chordIndex];
      const chordStart = Math.max(audioContext.currentTime + 0.012, stepStart);
      chord.forEach((frequency, index) => playNote(frequency, chordStart, beatSeconds * 7.5, index === 0 ? 0.12 : 0.075, 'sine'));
      // A quiet fifth harmonic lends the chord a little wooden resonance.
      playNote(chord[0] * 2, chordStart, beatSeconds * 5, 0.025, 'triangle');
      scheduledChord = chordIndex;
    }
    musicTimer = window.setTimeout(scheduleMusic, 90);
  }

  function updateButton() {
    const button = document.getElementById('sound-toggle');
    if (!button) return;
    const label = button.querySelector('.sound-label');
    const prefs = preferences();
    const musicSilent = prefs.musicMuted || prefs.musicVolume === 0;
    const ambienceSilent = prefs.ambientMuted || prefs.ambientVolume === 0;
    const allMuted = enabled && musicSilent && ambienceSilent;
    button.classList.toggle('is-on', enabled && !allMuted);
    button.setAttribute('aria-pressed', String(enabled && !allMuted));
    button.setAttribute('aria-label', allMuted ? 'Sound is muted in settings. Open settings to enable music or ambience.' : enabled ? 'Turn off music and winter ambience' : 'Turn on music and winter ambience');
    if (label) label.textContent = allMuted ? 'Muted' : enabled ? 'Sound on' : 'Sound off';
  }

  async function toggle() {
    if (disposed) return false;
    if (enabled) {
      enabled = false;
      applyPreferences();
      window.clearTimeout(musicTimer);
      updateButton();
      return false;
    }
    if (!AudioContextClass) {
      const label = document.querySelector('.sound-label');
      if (label) label.textContent = 'Audio unavailable';
      return false;
    }
    try {
      let resumePromise;
      if (!audioContext) {
        audioContext = new AudioContextClass({ latencyHint: 'interactive' });
        // Resume immediately while the tap/click still carries the browser's user activation.
        resumePromise = audioContext.resume();
        masterGain = audioContext.createGain();
        musicGain = audioContext.createGain();
        ambienceGain = audioContext.createGain();
        musicGain.connect(masterGain);
        ambienceGain.connect(masterGain);
        masterGain.connect(audioContext.destination);
        masterGain.gain.value = 0.82;
        startWind();
      } else {
        resumePromise = audioContext.resume();
      }
      // Queue the first audible notes synchronously in the tap handler. Some mobile
      // browsers only allow Web Audio sources created while user activation is active.
      enabled = true;
      musicStartedAt = audioContext.currentTime;
      scheduledMelodyBeat = -1;
      scheduledChord = -1;
      applyPreferences();
      const firstNoteAt = audioContext.currentTime + 0.025;
      playNote(783.99, firstNoteAt, 1.15, 0.58, 'triangle');
      playNote(987.77, firstNoteAt + 0.16, 1.35, 0.4, 'sine');
      updateButton();
      await resumePromise;
      if (audioContext.state !== 'running') throw new Error('Audio context did not start');
      scheduleMusic();
      return true;
    } catch (error) {
      enabled = false;
      updateButton();
      console.warn('Everfrost audio could not start:', error);
      const label = document.querySelector('.sound-label');
      if (label) label.textContent = 'Tap to retry';
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('sound-toggle');
    if (button) button.addEventListener('click', toggle);
    window.addEventListener('everfrost:preferences', () => {
      applyPreferences();
      updateButton();
    });
    window.addEventListener('pagehide', () => {
      disposed = true;
      window.clearTimeout(musicTimer);
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    }, { once: true });
    updateButton();
  }, { once: true });

  window.EverfrostAudio = Object.freeze({ toggle, isEnabled: () => enabled });
})();
