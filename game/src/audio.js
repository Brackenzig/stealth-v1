// Sound: WebAudio-synthesised, no audio files, no network.
// Guard footsteps get louder as a guard gets closer (the "where is the
// guard" cue); player steps are softer when sneaking; alarm, pickup and
// win sounds are short oscillator phrases.
export function createAudio() {
  return { ctx: null, noiseBuf: null, master: null, muted: false };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    const len = Math.floor(audio.ctx.sampleRate * 0.08);
    audio.noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = audio.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return true;
  } catch {
    return false;
  }
}

function footstepTick(audio, volume, lowpass) {
  if (!audio.ctx || !audio.noiseBuf || audio.muted) return;
  try {
    const src = audio.ctx.createBufferSource();
    src.buffer = audio.noiseBuf;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = audio.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  } catch { /* audio is best-effort */ }
}

export function playPlayerStep(audio, sneaking) {
  footstepTick(audio, sneaking ? 0.05 : 0.12, sneaking ? 500 : 900);
}

export function playGuardStep(audio, distance) {
  // Audible to ~420 px, louder the nearer the guard.
  const volume = Math.max(0, 0.22 * (1 - distance / 420));
  if (volume <= 0.01) return;
  footstepTick(audio, volume, 700);
}

function tone(audio, freq, startAt, dur, volume, type = 'sine') {
  if (!audio.ctx || audio.muted) return;
  try {
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = audio.ctx.createGain();
    const t0 = audio.ctx.currentTime + startAt;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* best-effort */ }
}

export function playAlarm(audio) {
  tone(audio, 660, 0, 0.16, 0.25, 'square');
  tone(audio, 440, 0.16, 0.16, 0.25, 'square');
  tone(audio, 660, 0.32, 0.3, 0.25, 'square');
}

export function playPickup(audio) {
  tone(audio, 880, 0, 0.12, 0.2);
  tone(audio, 1318, 0.1, 0.18, 0.2);
}

export function playPebble(audio) {
  tone(audio, 1200, 0, 0.05, 0.12, 'triangle');
}

export function playWin(audio) {
  [523, 659, 784, 1046].forEach((f, i) => tone(audio, f, i * 0.12, 0.22, 0.2));
}

export function playCaught(audio) {
  tone(audio, 220, 0, 0.25, 0.25, 'sawtooth');
  tone(audio, 165, 0.22, 0.4, 0.25, 'sawtooth');
}
