import silentMp3Url from './silent.mp3';

(() => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  // iOS quirk: Web Audio plays on the "ringer" channel, so the silent switch
  // mutes it even at full volume, while <audio> elements play on the media
  // channel. Looping a silent MP3 through an <audio> element while the page
  // makes sound makes iOS merge Web Audio onto the media channel, so the
  // ringer switch no longer mutes the soundscape. Best-effort and iOS-only.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let silentTrack = null;
  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let ambienceGain = null;
  let windSource = null;
  let musicTimer = 0;
  let musicStartedAt = 0;
  let enabled = false;

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
  // Lookahead scheduling: notes are queued on the audio clock ~2 seconds before
  // they play. Mobile browsers jitter or throttle setTimeout while rendering the
  // snow scene, and just-in-time scheduling makes notes late or clipped there;
  // with a lookahead the timer only tops up the queue, it never sets the timing.
  const lookaheadSeconds = 2;
  const timerIntervalMs = 300;
  let nextBeat = 0;

  function preferences() {
    return window.EverfrostSettings ? window.EverfrostSettings.get() : {
      musicVolume: 100, ambientVolume: 100, musicMuted: false, ambientMuted: false
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
    setGain(musicGain, enabled && !prefs.musicMuted ? (prefs.musicVolume / 100) * 0.78 : 0);
    setGain(ambienceGain, enabled && !prefs.ambientMuted ? (prefs.ambientVolume / 100) * 0.88 : 0);
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

  function scheduleBeat(beat, startAt) {
    const position = beat % loopBeats;
    const note = melody.find(([at]) => at === position);
    if (note) playNote(note[1], startAt, beatSeconds * 1.5, 0.36, 'sine');
    if (position % 4 === 0) {
      const chord = chords[Math.floor(position / 4) % chords.length];
      chord.forEach((frequency, index) => playNote(frequency, startAt, beatSeconds * 7.5, index === 0 ? 0.18 : 0.12, 'sine'));
      // A soft fifth harmonic lends the chord a little wooden resonance.
      playNote(chord[0] * 2, startAt, beatSeconds * 5, 0.045, 'triangle');
    }
  }

  function scheduleMusic() {
    if (!enabled || !audioContext || audioContext.state !== 'running') return;
    const horizon = audioContext.currentTime + lookaheadSeconds;
    while (true) {
      const startAt = musicStartedAt + nextBeat * beatSeconds;
      if (startAt >= horizon) break;
      // Skip beats that already passed (long suspension), then keep going.
      if (startAt >= audioContext.currentTime - 0.05) scheduleBeat(nextBeat, startAt);
      nextBeat++;
    }
    window.clearTimeout(musicTimer);
    musicTimer = window.setTimeout(scheduleMusic, timerIntervalMs);
  }

  function ensureSilentTrack() {
    if (!isIOS || silentTrack) return;
    const audio = new Audio(silentMp3Url);
    audio.loop = true;
    audio.volume = 0.01;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('x-webkit-airplay', 'deny');
    silentTrack = audio;
  }

  function playSilentTrack() {
    if (!isIOS) return;
    ensureSilentTrack();
    if (silentTrack && silentTrack.paused) silentTrack.play().catch(() => {});
  }

  // Pausing when the page is hidden keeps the silent track out of the iOS
  // Control Center / lock screen player while it is not needed.
  function pauseSilentTrack() {
    if (silentTrack && !silentTrack.paused) silentTrack.pause();
  }

  function restartScheduling() {
    window.clearTimeout(musicTimer);
    scheduleMusic();
  }

  // Mobile browsers suspend the context when the page is backgrounded, the screen
  // locks, or a call interrupts playback, and they never auto-resume. Try to bring
  // the context back whenever the page becomes visible again.
  async function resumeIfEnabled() {
    if (!enabled || !audioContext || audioContext.state === 'running') {
      updateButton();
      return;
    }
    try {
      await audioContext.resume();
    } catch (_) {
      // The browser may require another tap while user activation is active.
    }
    if (enabled && audioContext.state === 'running') {
      restartScheduling();
      playSilentTrack();
    }
    updateButton();
  }

  function updateButton() {
    const button = document.getElementById('sound-toggle');
    if (!button) return;
    const label = button.querySelector('.sound-label');
    const prefs = preferences();
    const musicSilent = prefs.musicMuted || prefs.musicVolume === 0;
    const ambienceSilent = prefs.ambientMuted || prefs.ambientVolume === 0;
    const allMuted = enabled && musicSilent && ambienceSilent;
    const suspended = enabled && audioContext && audioContext.state !== 'running';
    button.classList.toggle('is-on', enabled && !allMuted && !suspended);
    button.setAttribute('aria-pressed', String(enabled && !allMuted && !suspended));
    button.setAttribute('aria-label', allMuted ? 'Sound is muted in settings. Open settings to enable music or ambience.' : suspended ? 'Resume music and winter ambience' : enabled ? 'Turn off music and winter ambience' : 'Turn on music and winter ambience');
    if (label) label.textContent = allMuted ? 'Muted' : suspended ? 'Resume sound' : enabled ? 'Sound on' : 'Sound off';
  }

  async function toggle() {
    if (enabled && audioContext && audioContext.state !== 'running') {
      // The context was suspended by the browser (backgrounded or interrupted).
      // Treat this tap as a resume, not as turning the sound off.
      await resumeIfEnabled();
      return enabled && audioContext.state === 'running';
    }
    if (enabled) {
      enabled = false;
      applyPreferences();
      window.clearTimeout(musicTimer);
      pauseSilentTrack();
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
        audioContext.addEventListener('statechange', () => {
          if (enabled && audioContext.state === 'running') restartScheduling();
          updateButton();
        });
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
      playSilentTrack();
      musicStartedAt = audioContext.currentTime;
      nextBeat = 0;
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
    // Suspend instead of closing: on mobile, pagehide also fires when the page
    // enters the back/forward cache, and a closed context can never come back
    // (Home → Christmas Tree → back used to leave the toggle permanently dead).
    window.addEventListener('pagehide', () => {
      window.clearTimeout(musicTimer);
      pauseSilentTrack();
      if (audioContext && audioContext.state === 'running') audioContext.suspend();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) resumeIfEnabled();
      else updateButton();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resumeIfEnabled();
      else pauseSilentTrack();
    });
    updateButton();
  }, { once: true });

  window.EverfrostAudio = Object.freeze({ toggle, isEnabled: () => enabled });
})();
