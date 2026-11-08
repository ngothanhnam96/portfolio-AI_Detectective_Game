/**
 * Read aloud with the browser's own speech synthesis (Web Speech API): no audio files, no
 * service. For players who can't read the screen comfortably. Off by default, because screen
 * reader users already have their own voice.
 *
 * The text helpers (speakable, chunks, pickVoice) are pure and tested in Node.
 */

const LANG = "vi-VN";
export const RATES = [0.8, 1, 1.25, 1.5];
const MAX_CHUNK = 180; // some browsers cut off long utterances, so long text is queued in pieces

/** Text as it should be spoken: no emoji or symbols, no quote marks, short pauses kept. */
export function speakable(text) {
  return String(text ?? "")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍︎️⃣]/gu, "")
    .replace(/[“”"„«»]/g, "")
    .replace(/\s*[·•|]\s*/g, ", ")
    .replace(/\s*→\s*/g, ", ")
    .replace(/&/g, " và ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?…])/g, "$1")
    .replace(/^[\s,.;:]+/, "")
    .trim();
}

/** Join parts into sentences: each part ends with punctuation so the voice pauses between them. */
export function sentences(parts) {
  return parts
    .flat()
    .map(speakable)
    .filter(Boolean)
    .map((part) => (/[.!?…:]$/.test(part) ? part : `${part}.`))
    .join(" ");
}

/** Split long text at sentence (or comma) boundaries into pieces of at most `max` characters. */
export function chunks(text, max = MAX_CHUNK) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    const head = rest.slice(0, max + 1);
    let cut = Math.max(...[". ", "! ", "? ", "… ", ": "].map((mark) => head.lastIndexOf(mark)));
    if (cut < max / 3) cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "));
    if (cut < max / 3) cut = head.lastIndexOf(" ");
    if (cut <= 0) cut = max - 1; // one very long word: hard cut at max characters
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

const isVietnamese = (v) => /^vi([-_]|$)/i.test(v?.lang ?? "");
const isNatural = (v) => /natural|neural|online/i.test(v.name);
const score = (v) => (isNatural(v) ? 2 : 0) + (/google|microsoft/i.test(v.name) ? 1 : 0) + (/^vi[-_]VN$/i.test(v.lang) ? 1 : 0);

/** All Vietnamese voices, best first (natural/online voices, then Google/Microsoft, then the rest). */
export function vietnameseVoices(voices) {
  return voices.filter(isVietnamese).sort((a, b) => score(b) - score(a));
}

/** The voice the player chose (by name) if it is still installed, else the best Vietnamese voice; null if none. */
export function pickVoice(voices, preferred = null) {
  const vietnamese = vietnameseVoices(voices);
  return vietnamese.find((v) => v.name === preferred) ?? vietnamese[0] ?? null;
}

/** A short name for the voice list: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)" → "HoaiMy". */
export function voiceLabel(v) {
  const short = String(v?.name ?? "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/^Microsoft\s+/i, "")
    .replace(/\s*\((natural|neural)\)\s*/gi, " ")
    .replace(/\s+online\b/gi, "")
    .trim();
  return short || String(v?.name ?? "");
}

/** What kind of voice it is, for the voice list. */
export function voiceNote(v) {
  if (isNatural(v) || v.localService === false) return "giọng tự nhiên, cần mạng";
  return "có sẵn trên máy, dùng được khi không có mạng";
}

/** Steps to get a Vietnamese voice on the player's device, chosen from the browser's user agent. */
export function setupTips(userAgent = "") {
  const ua = String(userAgent);
  if (/Edg\//.test(ua)) {
    return ["Edge có sẵn giọng tiếng Việt tự nhiên (HoaiMy, NamMinh), nhưng cần kết nối mạng. Hãy kiểm tra mạng rồi bấm Kiểm tra lại.",
      "Muốn dùng khi không có mạng: Cài đặt Windows → Thời gian và ngôn ngữ → Giọng nói → Thêm giọng nói → Tiếng Việt."];
  }
  if (/Android/i.test(ua)) {
    return ["Mở Cài đặt → Hệ thống → Ngôn ngữ → Chuyển văn bản thành giọng nói.",
      "Chọn Dịch vụ lời nói của Google, bấm biểu tượng cài đặt → Cài đặt dữ liệu giọng nói → Tiếng Việt.",
      "Đóng hẳn trình duyệt rồi mở lại trò chơi."];
  }
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) {
    return ["Mở Cài đặt (trên Mac: Cài đặt hệ thống) → Trợ năng → Nội dung được đọc → Giọng nói.",
      "Chọn Tiếng Việt và tải giọng Linh.",
      "Đóng hẳn trình duyệt rồi mở lại trò chơi."];
  }
  if (/Windows/i.test(ua)) {
    return ["Cách nhanh nhất: mở trò chơi bằng trình duyệt Microsoft Edge, Edge có sẵn giọng tiếng Việt tự nhiên.",
      "Hoặc: Cài đặt Windows → Thời gian và ngôn ngữ → Giọng nói → Thêm giọng nói → Tiếng Việt, rồi khởi động lại trình duyệt. Một số trình duyệt như Chrome có thể không thấy giọng cài theo cách này."];
  }
  if (/Linux|CrOS/i.test(ua)) {
    return ["Cài gói espeak-ng và speech-dispatcher (giọng tiếng Việt có sẵn trong espeak-ng), rồi khởi động lại trình duyệt.",
      "Hoặc dùng trình duyệt Microsoft Edge để có giọng tự nhiên."];
  }
  return ["Cài giọng đọc tiếng Việt trong phần cài đặt chuyển văn bản thành giọng nói của máy, hoặc dùng trình duyệt Microsoft Edge.",
    "Sau đó đóng hẳn trình duyệt rồi mở lại trò chơi."];
}

// Browser side -------------------------------------------------------------------------------

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

let enabled = false;
let rate = 1;
let voice = null;
let voices = [];
let preferred = null; // name of the voice the player chose; null = best available
let last = "";
let onChange = () => {};
let onVoices = () => {};
let generation = 0;

function loadVoices() {
  const s = synth();
  if (!s) return;
  voices = vietnameseVoices(s.getVoices());
  voice = pickVoice(voices, preferred);
  onVoices();
}
if (synth()) {
  loadVoices();
  synth().addEventListener?.("voiceschanged", loadVoices);
}

export const speechSupported = () => synth() !== null;
export const hasVietnameseVoice = () => voice !== null;
export const isSpeechOn = () => enabled;
export const speechRate = () => rate;
export const isSpeaking = () => Boolean(synth()?.speaking);
/** The Vietnamese voices on this device, best first. */
export const speechVoices = () => voices;
/** The voice in use (null: none installed), and whether the player picked it or it is automatic. */
export const currentVoice = () => voice;
export const isVoiceAutomatic = () => !voices.some((v) => v.name === preferred);

/** Called whenever the browser's voice list changes (voices often arrive after page load). */
export function onVoicesChanged(callback) {
  onVoices = callback;
}

/** Look for voices again (after the player installed one or reconnected). */
export function refreshVoices() {
  loadVoices();
  return voices.length;
}

/** Use the voice with this name; null (or a name that is not installed) means pick the best automatically. */
export function setVoice(name) {
  preferred = typeof name === "string" && name ? name : null;
  voice = pickVoice(voices, preferred);
}

/** Called with true/false when speaking starts and ends (to lower the music). */
export function onSpeaking(callback) {
  onChange = callback;
}

export function setSpeech(value) {
  enabled = Boolean(value) && speechSupported();
  if (!enabled) stopSpeech();
}

export function setSpeechRate(value) {
  rate = RATES.includes(value) ? value : 1;
}

export function stopSpeech() {
  generation += 1;
  synth()?.cancel();
  onChange(false);
}

/**
 * Speak parts of text (strings or arrays of strings), replacing anything being read.
 * `force` reads even when auto-reading is off (the 🔊 buttons).
 */
export function speak(parts, { force = false } = {}) {
  const s = synth();
  const text = sentences([parts]);
  if (!s || !text || (!enabled && !force)) return false;
  last = text;
  stopSpeech();
  const mine = generation;
  const pieces = chunks(text);
  pieces.forEach((piece, index) => {
    const utterance = new SpeechSynthesisUtterance(piece);
    utterance.lang = voice?.lang ?? LANG;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    if (index === 0) utterance.onstart = () => mine === generation && onChange(true);
    if (index === pieces.length - 1) {
      utterance.onend = () => mine === generation && onChange(false);
      utterance.onerror = utterance.onend;
    }
    s.speak(utterance);
  });
  return true;
}

/** Read the last spoken text again. */
export function repeatSpeech() {
  return last ? speak(last, { force: true }) : false;
}
