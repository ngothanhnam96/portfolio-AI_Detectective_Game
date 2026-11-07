/**
 * Synthesised sound effects and a quiet background loop (WebAudio, no audio files).
 * The music is an original slow minor-key loop.
 */

let context = null;
let master = null;
let musicBus = null;
let muted = false;
let musicOn = true;

const MASTER_GAIN = 0.9;
const MUSIC_GAIN = 0.22;

function audio() {
  if (muted) return null;
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);
    musicBus = context.createGain();
    musicBus.gain.value = musicOn ? MUSIC_GAIN : 0;
    musicBus.connect(master);
  }
  if (context.state === "suspended") context.resume();
  return context;
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
}

export const isMuted = () => muted;

export function setMusic(value) {
  musicOn = value;
  if (musicBus) musicBus.gain.value = musicOn ? MUSIC_GAIN : 0;
}

export const isMusicOn = () => musicOn;

const hz = (semitones) => 440 * 2 ** (semitones / 12);

function tone(freq, duration, { type = "sine", gain = 0.1, delay = 0, bus = null, slide = 0 } = {}) {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, start + duration);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(bus || master);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function rustle(duration = 0.12, gain = 0.05) {
  const ctx = audio();
  if (!ctx) return;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 2400;
  env.gain.value = gain;
  source.connect(filter).connect(env).connect(master);
  source.start();
}

export const sfx = {
  unlock: () => audio(),
  page: () => rustle(0.14, 0.06),
  clue() {
    tone(hz(3), 0.18, { type: "triangle", gain: 0.09 });
    tone(hz(10), 0.3, { type: "triangle", gain: 0.08, delay: 0.09 });
  },
  contradiction() {
    [-12, -5, 0, 3].forEach((s) => tone(hz(s), 0.5, { type: "sawtooth", gain: 0.035 }));
    tone(hz(15), 0.35, { type: "square", gain: 0.03, delay: 0.05 });
  },
  wrong() {
    tone(hz(-20), 0.3, { type: "square", gain: 0.04, slide: 0.7 });
  },
  deduce() {
    [0, 4, 7, 12].forEach((s, i) => tone(hz(s), 0.22, { type: "triangle", gain: 0.07, delay: i * 0.07 }));
  },
  solved() {
    [0, 4, 7, 12, 16].forEach((s, i) => tone(hz(s - 5), 0.4, { type: "triangle", gain: 0.08, delay: i * 0.12 }));
  },
  failed() {
    [0, -3, -6, -10].forEach((s, i) => tone(hz(s - 5), 0.45, { type: "sawtooth", gain: 0.04, delay: i * 0.2 }));
  },
};

// Background music: original 16-step loop in A minor, slow and quiet --------------------------

const SONG = {
  tempo: 3.2,
  lead: [12, null, 15, null, 14, 12, null, null, 10, null, 12, null, 7, null, null, null,
         12, null, 15, 17, 15, 14, null, 12, 10, null, 8, null, 7, null, null, null],
  bass: [-24, -21, -17, -21, -26, -22, -19, -22, -27, -24, -20, -24, -29, -25, -22, -17],
};

let timer = null;
let step = 0;
let nextTime = 0;

export function startMusic() {
  if (timer) return;
  step = 0;
  nextTime = 0;
  timer = setInterval(schedule, 80);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
}

function schedule() {
  if (!context || muted || !musicOn || context.state !== "running") return;
  const length = 1 / SONG.tempo;
  const now = context.currentTime;
  if (nextTime < now) nextTime = now + 0.05;
  while (nextTime < now + 0.3) {
    const delay = nextTime - now;
    const lead = SONG.lead[step % SONG.lead.length];
    if (lead !== null) tone(hz(lead - 12), length * 1.6, { type: "triangle", gain: 0.06, delay, bus: musicBus });
    if (step % 2 === 0) tone(hz(SONG.bass[(step / 2) % SONG.bass.length]), length * 1.9, { type: "sine", gain: 0.16, delay, bus: musicBus });
    step += 1;
    nextTime += length;
  }
}
