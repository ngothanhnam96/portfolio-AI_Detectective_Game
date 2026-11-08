/** UI controller: renders the casebook, the briefing and the investigation; turns clicks into game calls. */

import { CASES, caseById, isUnlocked } from "./core/cases/index.js";
import { Investigation, MAX_CREDIBILITY, SCORE_COST } from "./core/investigation.js";
import { nextStep } from "./core/solver.js";
import { duckMusic, isMusicOn, isMuted, setMusic, setMuted, sfx, startMusic, stopMusic } from "./ui/audio.js";
import { floorplan } from "./ui/floorplan.js";
import { portrait } from "./ui/portrait.js";
import {
  currentVoice, hasVietnameseVoice, isSpeaking, isSpeechOn, isVoiceAutomatic, onSpeaking, onVoicesChanged, RATES,
  refreshVoices, repeatSpeech, setSpeech, setSpeechRate, setupTips, setVoice, speak, speechRate, speechSupported,
  speechVoices, stopSpeech, voiceLabel, voiceNote,
} from "./ui/speech.js";
import { load, save } from "./ui/storage.js";
import { initAnalytics, track } from "./ui/analytics.js";

initAnalytics();

const $ = (id) => document.getElementById(id);
const ui = {
  home: $("home"),
  caseList: $("case-list"),
  briefing: $("briefing"),
  briefSetting: $("brief-setting"),
  briefTitle: $("brief-title"),
  briefSub: $("brief-sub"),
  briefText: $("brief-text"),
  briefButtons: $("brief-buttons"),
  game: $("game"),
  caseTitle: $("case-title"),
  caseProgress: $("case-progress"),
  credibility: $("credibility"),
  hintButton: $("hint-btn"),
  soundButton: $("sound-btn"),
  speechButton: $("speech-btn"),
  homeSound: $("home-sound"),
  homeMusic: $("home-music"),
  homeSpeech: $("home-speech"),
  homeRate: $("home-rate"),
  homeVoice: $("home-voice"),
  tabs: [...document.querySelectorAll("[data-tab]")],
  peopleDot: document.querySelector("#tab-people .dot"),
  clueCount: $("clue-count"),
  panel: $("panel"),
  dialog: $("dialog"),
  toasts: $("toasts"),
};

const KIND_LABEL = { evidence: "Vật chứng", testimony: "Lời khai", deduction: "Suy luận" };
const RANK_ORDER = ["S", "A", "B", "C"];
const WRONG_REACTIONS = [
  "không hề nao núng. Manh mối này chẳng chứng minh được gì.",
  "nhíu mày: “Cái đó thì liên quan gì tới lời tôi nói?”",
  "nhìn bạn đầy nghi ngại. Có vẻ bạn đã vội vàng.",
];

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// State ------------------------------------------------------------------------------------

let progress = load("progress", { solved: {} });
let current = null; // { data, inv, heard: Set }
let tab = "scenes";
let selectedLocation = null;
let selectedSuspect = null;
let lastResult = null; // { where: "scenes" | "people", title, text, gained, tone }
let filter = "all";
let picking = [];
let draft = {};
let showMap = load("show-map", true);
let recentSpot = null; // the point examined last: its marker pulses on the map
let dossierSpeech = []; // what the 🔊 button reads on the briefing and ending screens

setMuted(load("muted", false));
setMusic(load("music", true));
setSpeech(load("tts", false));
setSpeechRate(load("tts-rate", 1));
setVoice(load("tts-voice", null));
onVoicesChanged(() => {
  updateSoundButtons();
  if (ui.dialog.open && ui.dialog.querySelector(".voice-picker")) renderVoiceDialog();
});
onSpeaking(duckMusic);

// Screens ----------------------------------------------------------------------------------

function show(screen) {
  for (const el of [ui.home, ui.briefing, ui.game]) el.hidden = el !== screen;
  window.scrollTo(0, 0);
}

function rankOf(id) {
  return progress.solved[id] ?? null;
}

function renderHome() {
  const solvedIds = Object.keys(progress.solved);
  ui.caseList.innerHTML = CASES.map((c, index) => {
    const open = isUnlocked(c.id, solvedIds);
    const saved = load(`case:${c.id}`, null);
    const rank = rankOf(c.id);
    let status = "";
    if (!open) status = `<span class="status locked">🔒 Phá vụ trước để mở</span>`;
    else if (saved?.inv?.status === "investigating") status = `<span class="status going">Đang điều tra · ${Math.round((saved.inv.found.length / c.clues.length) * 100)}%</span>`;
    else if (rank) status = `<span class="status done">Đã phá · Hạng ${rank}</span>`;
    else status = `<span class="status new">Hồ sơ mới</span>`;
    const source = c.source.kind === "adaptation" ? `Phỏng theo ${esc(c.source.author)}` : "Sáng tác gốc";
    return `
      <li>
        <button class="case-card${open ? "" : " is-locked"}" type="button" data-action="open-case" data-id="${c.id}" ${open ? "" : "disabled"}>
          <span class="case-no">Hồ sơ số ${index + 1}</span>
          ${rank ? `<span class="rank-stamp small" aria-label="Hạng ${rank}">${rank}</span>` : ""}
          <span class="case-title">${esc(c.title)}</span>
          <span class="case-sub">${esc(c.subtitle)}</span>
          <span class="case-meta"><span>${esc(c.setting)}</span><span aria-label="Độ khó ${c.difficulty} trên 3">${"★".repeat(c.difficulty)}${"☆".repeat(3 - c.difficulty)}</span><span>${source}</span></span>
          ${status}
        </button>
      </li>`;
  }).join("");
  updateSoundButtons();
  show(ui.home);
}

function openBriefing(id) {
  const data = caseById(id);
  const saved = load(`case:${id}`, null);
  const resumable = saved?.inv?.status === "investigating";
  ui.briefSetting.textContent = data.setting;
  ui.briefTitle.textContent = data.title;
  ui.briefSub.textContent = data.subtitle;
  ui.briefText.innerHTML = data.intro.map((p) => `<p>${esc(p)}</p>`).join("");
  ui.briefButtons.innerHTML = `
    ${resumable ? `<button class="button" type="button" data-action="start" data-id="${id}" data-resume="1">Tiếp tục điều tra</button>` : ""}
    <button class="button${resumable ? " secondary" : ""}" type="button" data-action="start" data-id="${id}">${resumable ? "Điều tra lại từ đầu" : "Bắt đầu điều tra"}</button>
    ${listenButton()}
    <button class="button ghost" type="button" data-action="home">← Sổ hồ sơ</button>`;
  sfx.page();
  show(ui.briefing);
  ui.briefButtons.querySelector("button").focus();
  dossierSpeech = [data.setting, data.title, data.subtitle, ...data.intro];
  speak(dossierSpeech);
}

/** A "listen" button for a block of text (hidden when the browser cannot speak). */
function listenButton(what = "brief", extra = "", label = "🔊 Nghe đọc") {
  if (!speechSupported()) return "";
  return `<button class="button ghost listen" type="button" data-action="say" data-id="${what}" ${extra}>${label}</button>`;
}

function listenIcon(what, extra = "", name = "Nghe đọc") {
  if (!speechSupported()) return "";
  return `<button class="icon-btn small listen" type="button" data-action="say" data-id="${what}" ${extra} title="${name}" aria-label="${name}">🔊</button>`;
}

function startCase(id, resume) {
  const data = caseById(id);
  const saved = resume ? load(`case:${id}`, null) : null;
  let inv;
  try {
    inv = new Investigation(data, saved?.inv ?? null);
  } catch {
    inv = new Investigation(data); // an old or broken save: start fresh
  }
  current = { data, inv, heard: new Set(saved?.heard ?? []) };
  if (!saved) track("detective/case-start");
  tab = "scenes";
  selectedLocation = inv.locations()[0].id;
  selectedSuspect = null;
  lastResult = null;
  recentSpot = null;
  picking = [];
  draft = {};
  filter = "all";
  persist();
  syncMusic();
  show(ui.game);
  renderGame();
  speak(locationSpeech());
}

function persist() {
  if (!current) return;
  save(`case:${current.data.id}`, { inv: current.inv.toJSON(), heard: [...current.heard] });
}

// Investigation screen ----------------------------------------------------------------------

function renderGame() {
  const { data, inv } = current;
  ui.caseTitle.textContent = data.title;
  ui.caseProgress.textContent = `${inv.found.length}/${data.clues.length} manh mối`;
  ui.credibility.setAttribute("aria-label", `Uy tín ${inv.credibility}/${MAX_CREDIBILITY}`);
  ui.credibility.innerHTML = Array.from({ length: MAX_CREDIBILITY }, (_, i) => `<i class="${i < inv.credibility ? "on" : ""}"></i>`).join("");
  ui.clueCount.textContent = inv.found.length;
  ui.peopleDot.hidden = !hasUnheard();
  for (const button of ui.tabs) {
    const active = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  updateSoundButtons();
  const render = { scenes: renderScenes, people: renderPeople, notebook: renderNotebook, accuse: renderAccuse }[tab];
  ui.panel.innerHTML = render();
  // On phones the side list scrolls sideways: keep the chosen place/person in view.
  const active = ui.panel.querySelector(".side-item.active");
  const strip = active?.closest(".side-list");
  if (strip && strip.scrollWidth > strip.clientWidth) {
    strip.scrollLeft = active.parentElement.offsetLeft - strip.offsetLeft - 16;
  }
}

function hasUnheard() {
  const { inv, heard } = current;
  return inv.suspects().some((s) => inv.statements(s.id).some((st) => !heard.has(`${s.id}/${st.id}`)));
}

function clueChips(clues) {
  if (!clues?.length) return "";
  return `<ul class="chips">${clues.map((c) => `<li class="clue-chip ${c.kind}">${c.icon} ${esc(c.name)}</li>`).join("")}</ul>`;
}

function resultBox(where) {
  if (!lastResult || lastResult.where !== where) return "";
  const r = lastResult;
  return `
    <div class="result ${r.tone ?? ""}" role="status">
      ${listenIcon("result", "", "Nghe lại kết quả")}
      ${r.title ? `<p class="result-title">${esc(r.title)}</p>` : ""}
      <p>${esc(r.text)}</p>
      ${r.gained?.length ? `<p class="result-new">Ghi vào sổ tay:</p>${clueChips(r.gained)}` : ""}
    </div>`;
}

function renderScenes() {
  const { inv } = current;
  const locations = inv.locations();
  if (!inv.location(selectedLocation)) selectedLocation = locations[0].id;
  const location = inv.location(selectedLocation);
  const spots = inv.hotspots(location.id);
  const sideItems = locations.map((l) => {
    const all = inv.hotspots(l.id);
    const done = all.filter((s) => s.examined).length;
    return `<li><button type="button" class="side-item${l.id === location.id ? " active" : ""}" data-action="location" data-id="${l.id}" aria-current="${l.id === location.id}">
      <span class="side-icon" aria-hidden="true">${l.icon}</span><span class="side-name">${esc(l.name)}</span><span class="side-meta">${done}/${all.length}</span></button></li>`;
  });
  const plan = showMap ? floorplan(current.data, inv, location.id, { recent: recentSpot }) : "";
  const canMap = Boolean(current.data.locations[0].area);
  return `
    <div class="split">
      <ul class="side-list" aria-label="Địa điểm">${sideItems.join("")}</ul>
      <section class="detail">
        <div class="banner">
          <span class="banner-icon" aria-hidden="true">${location.icon}</span><h2>${esc(location.name)}</h2>
          <div class="banner-tools">
            ${listenIcon("scene", "", "Nghe mô tả địa điểm")}
            ${canMap ? `<button type="button" class="chip map-toggle" data-action="toggle-map" aria-pressed="${showMap}">🗺️ Sơ đồ</button>` : ""}
          </div>
        </div>
        <div class="scene${plan ? " with-map" : ""}">
          <div class="scene-text">
            <p class="lead">${esc(location.description)}</p>
            <h3 class="section-label">Điểm cần xem xét</h3>
            <div class="spots">
              ${spots.map((s, i) => `<button type="button" class="spot${s.examined ? " examined" : ""}" data-action="examine" data-id="${s.id}" data-spot="${s.id}">
                <span class="spot-no" aria-hidden="true">${i + 1}</span><span aria-hidden="true">${s.examined ? "✓" : "🔍"}</span> ${esc(s.name)}<span class="sr-only">${s.examined ? " (đã xem)" : ""}</span></button>`).join("")}
            </div>
            ${resultBox("scenes")}
          </div>
          ${plan}
        </div>
      </section>
    </div>`;
}

function renderPeople() {
  const { inv, heard } = current;
  const suspects = inv.suspects();
  const sideItems = suspects.map((s) => {
    const fresh = inv.statements(s.id).some((st) => !heard.has(`${s.id}/${st.id}`));
    return `<li><button type="button" class="side-item person${s.id === selectedSuspect ? " active" : ""}" data-action="suspect" data-id="${s.id}" aria-current="${s.id === selectedSuspect}">
      ${portrait(s.look, { size: 40 })}<span class="side-name">${esc(s.name)}<small>${esc(s.role)}</small></span>${fresh ? `<i class="dot" aria-label="có lời khai mới"></i>` : ""}</button></li>`;
  });
  let detail = `<div class="empty"><p>Chọn một người để nghe lời khai.</p><p class="muted">Khi một lời khai không khớp với manh mối trong sổ tay, hãy bấm <strong>Đối chất</strong> và đưa ra manh mối đó.</p></div>`;
  const suspect = selectedSuspect && inv.suspect(selectedSuspect);
  if (suspect) {
    const statements = inv.statements(suspect.id);
    detail = `
      <div class="profile">
        ${portrait(suspect.look, { size: 88, title: suspect.name })}
        <div><h2>${esc(suspect.name)}</h2><p class="role">${esc(suspect.role)}${suspect.age ? ` · ${suspect.age} tuổi` : ""}</p><p class="bio">${esc(suspect.bio)}</p></div>
        ${listenIcon("suspect", "", "Nghe hồ sơ và lời khai")}
      </div>
      <h3 class="section-label">Lời khai</h3>
      <ol class="statements">
        ${statements.map((st) => `
          <li class="statement${st.resolved ? " resolved" : ""}">
            ${listenIcon("statement", `data-statement="${st.id}"`, "Nghe lời khai")}
            <blockquote>“${esc(st.text)}”</blockquote>
            ${st.resolved
              ? `<p class="reply"><span class="tag">⚡ Mâu thuẫn</span> ${esc(st.contradiction.reply)}</p>`
              : `<button type="button" class="button small outline" data-action="confront" data-id="${st.id}">Đối chất</button>`}
          </li>`).join("")}
      </ol>
      ${resultBox("people")}`;
  }
  return `<div class="split"><ul class="side-list" aria-label="Nhân chứng">${sideItems.join("")}</ul><section class="detail">${detail}</section></div>`;
}

function renderNotebook() {
  const { inv } = current;
  const clues = inv.notebook().filter((c) => filter === "all" || c.kind === filter);
  const filters = ["all", "evidence", "testimony", "deduction"].map((f) =>
    `<button type="button" class="chip${filter === f ? " active" : ""}" data-action="filter" data-id="${f}" aria-pressed="${filter === f}">${f === "all" ? "Tất cả" : KIND_LABEL[f]}</button>`);
  const cards = clues.length
    ? clues.map((c) => {
        const selected = picking.includes(c.id);
        return `<li><button type="button" class="clue-card ${c.kind}${selected ? " picked" : ""}" data-action="pick" data-id="${c.id}" aria-pressed="${selected}">
          <span class="clue-icon" aria-hidden="true">${c.icon}</span>
          <span class="clue-kind">${KIND_LABEL[c.kind]}</span>
          <span class="clue-name">${esc(c.name)}</span>
          <span class="clue-text">${esc(c.text)}</span>
        </button></li>`;
      }).join("")
    : `<li class="empty">Chưa có manh mối nào ở mục này. Hãy xem xét hiện trường và nghe lời khai.</li>`;
  const log = [...inv.log].reverse().map((e) => `<li><strong>${esc(e.title)}</strong>${e.text ? `<p>${esc(e.text)}</p>` : ""}</li>`).join("");
  return `
    <section class="notebook">
      <div class="deduce-bar" role="region" aria-label="Ghép suy luận">
        <p>🧠 <strong>Suy luận:</strong> chọn <strong>hai</strong> manh mối có liên quan rồi bấm Ghép. <span class="muted">(${picking.length}/2 đã chọn)</span></p>
        <div class="buttons">
          <button type="button" class="button small" data-action="deduce" ${picking.length === 2 ? "" : "disabled"}>Ghép suy luận</button>
          ${picking.length ? `<button type="button" class="button small ghost" data-action="unpick">Bỏ chọn</button>` : ""}
        </div>
      </div>
      <div class="filters" role="group" aria-label="Lọc manh mối">${filters.join("")}</div>
      <ul class="clue-grid">${cards}</ul>
      <details class="log"><summary>📜 Nhật ký điều tra (${inv.log.length})</summary><ol>${log}</ol></details>
    </section>`;
}

function renderAccuse() {
  const { data, inv } = current;
  const truth = data.accusation;
  const radio = (name, value, label, extra = "") =>
    `<label class="option${draft[name] === value ? " chosen" : ""}"><input type="radio" name="${name}" value="${value}" ${draft[name] === value ? "checked" : ""}>${extra}<span>${label}</span></label>`;
  const evidence = inv.notebook();
  return `
    <form class="accuse" id="accuse-form">
      <p class="lead">Khi đã chắc chắn, hãy trình bày lời buộc tội. Bạn phải chỉ đúng cả <strong>bốn</strong> điều. Mỗi lần sai mất <strong>2 uy tín</strong>, và bạn chỉ biết mình đúng bao nhiêu phần.</p>
      <fieldset><legend>1 · Thủ phạm là ai?</legend><div class="options people">
        ${data.suspects.filter((s) => inv.suspect(s.id)).map((s) => radio("culprit", s.id, `${esc(s.name)}<small>${esc(s.role)}</small>`, portrait(s.look, { size: 44 }))).join("")}
      </div></fieldset>
      <fieldset><legend>2 · Thủ đoạn?</legend><div class="options">${truth.method.options.map((o) => radio("method", o.id, esc(o.text))).join("")}</div></fieldset>
      <fieldset><legend>3 · Động cơ?</legend><div class="options">${truth.motive.options.map((o) => radio("motive", o.id, esc(o.text))).join("")}</div></fieldset>
      <fieldset><legend>4 · Chứng cứ quyết định?</legend><div class="options evidence">
        ${evidence.map((c) => radio("evidence", c.id, `${c.icon} ${esc(c.name)}`)).join("")}
      </div></fieldset>
      <button type="submit" class="button danger big" ${["culprit", "method", "motive", "evidence"].every((k) => draft[k]) ? "" : "disabled"}>⚖️ Buộc tội!</button>
    </form>`;
}

// Actions ----------------------------------------------------------------------------------

// What is read aloud ------------------------------------------------------------------------

const textOf = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

function locationSpeech() {
  const { inv } = current;
  const location = inv.location(selectedLocation);
  const spots = inv.hotspots(location.id);
  return [
    location.name,
    location.description,
    `Có ${spots.length} điểm cần xem xét`,
    ...spots.map((s, i) => `Số ${i + 1}, ${s.name}${s.examined ? ", đã xem" : ""}`),
  ];
}

function resultSpeech(r = lastResult) {
  if (!r) return [];
  return [r.title, r.text, r.gained?.length ? `Ghi vào sổ tay: ${r.gained.map((c) => c.name).join(", ")}` : ""];
}

function statementSpeech(suspect, st, index) {
  return [`Lời khai ${index + 1}`, st.text, st.resolved ? `Mâu thuẫn. ${st.contradiction.reply}` : ""];
}

function suspectSpeech(suspect) {
  const { inv } = current;
  return [
    suspect.name,
    suspect.age ? `${suspect.role}, ${suspect.age} tuổi` : suspect.role,
    suspect.bio,
    ...inv.statements(suspect.id).flatMap((st, i) => statementSpeech(suspect, st, i)),
    lastResult?.where === "people" ? resultSpeech() : [],
  ];
}

function tabSpeech() {
  const { inv } = current;
  if (tab === "scenes") return locationSpeech();
  if (tab === "people") return ["Nhân chứng", `${inv.suspects().length} người`, inv.suspects().map((s) => s.name).join(", "), "Chọn một người để nghe lời khai"];
  if (tab === "notebook") return ["Sổ tay", `${inv.found.length} manh mối`, "Chọn hai manh mối có liên quan rồi bấm Ghép suy luận"];
  return ["Buộc tội", "Chỉ ra thủ phạm, thủ đoạn, động cơ và chứng cứ quyết định. Mỗi lần sai mất 2 uy tín"];
}

/** Read whatever has keyboard focus (a clue card, a statement, an option…), or repeat the last text. */
function readFocused() {
  const el = document.activeElement?.closest?.(".clue-card, .statement, .spot, .case-card, .option, .side-item, .pick");
  if (el && !el.matches(".listen")) return speak(textOf(el), { force: true });
  if (repeatSpeech()) return true;
  if (current) return speak(tabSpeech(), { force: true });
  return speak(textOf(document.querySelector(".screen:not([hidden]) h1, .screen:not([hidden]) h2")), { force: true });
}

function sayTarget(target) {
  const what = target.dataset.id;
  const force = { force: true };
  if (what === "brief") return speak(dossierSpeech, force);
  if (what === "scene") return speak(locationSpeech(), force);
  if (what === "result") return speak(resultSpeech(), force);
  const suspect = selectedSuspect && current.inv.suspect(selectedSuspect);
  if (what === "suspect" && suspect) return speak(suspectSpeech(suspect), force);
  if (what === "statement" && suspect) {
    const statements = current.inv.statements(suspect.id);
    const index = statements.findIndex((s) => s.id === target.dataset.statement);
    if (index >= 0) speak([suspect.name, ...statementSpeech(suspect, statements[index], index)], force);
  }
}

function toggleSpeech() {
  if (!speechSupported()) return;
  setSpeech(!isSpeechOn());
  save("tts", isSpeechOn());
  updateSoundButtons();
  if (!isSpeechOn()) return;
  if (!hasVietnameseVoice()) {
    toast("Máy chưa có giọng đọc tiếng Việt, trình duyệt sẽ dùng giọng mặc định.", {
      say: false,
      action: { label: "🎙️ Cách cài giọng", run: voiceDialog },
    });
  }
  speak(["Đã bật đọc to", "Bấm phím R để nghe lại, phím Esc để dừng"]);
}

function cycleRate() {
  const next = RATES[(RATES.indexOf(speechRate()) + 1) % RATES.length];
  setSpeechRate(next);
  save("tts-rate", next);
  updateSoundButtons();
  speak(`Tốc độ đọc ${String(next).replace(".", ",")}`, { force: true });
}

/** The voice dialog: choose among the Vietnamese voices, or see how to install one. */
function voiceDialog() {
  refreshVoices();
  renderVoiceDialog();
  speak(textOf(ui.dialog.querySelector("h2, p")), { force: true });
}

function renderVoiceDialog() {
  const voices = speechVoices();
  const auto = isVoiceAutomatic();
  const chosen = currentVoice()?.name;
  const tips = setupTips(navigator.userAgent);
  const option = (value, label, note, checked) =>
    `<label class="option${checked ? " chosen" : ""}"><input type="radio" name="voice" value="${esc(value)}" ${checked ? "checked" : ""}><span>${esc(label)}<small>${esc(note)}</small></span></label>`;
  const body = voices.length
    ? `<p>Chọn một giọng, trò chơi sẽ đọc thử ngay. Lựa chọn được lưu cho lần sau.</p>
      <fieldset class="voice-picker"><legend class="sr-only">Giọng đọc</legend><div class="options">
        ${option("", `Tự động: ${voiceLabel(voices[0])}`, "luôn dùng giọng tốt nhất có trên máy", auto)}
        ${voices.map((v) => option(v.name, voiceLabel(v), voiceNote(v), !auto && v.name === chosen)).join("")}
      </div></fieldset>
      <details class="voice-more"><summary>Muốn thêm giọng khác?</summary><ol class="howto">${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ol></details>`
    : `<p class="voice-picker">Máy này chưa có giọng đọc tiếng Việt, nên trình duyệt sẽ đọc bằng giọng mặc định và phát âm sai. Cách cài:</p>
      <ol class="howto">${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ol>`;
  // Re-rendering (after a choice, or when voices arrive) must not throw keyboard focus away.
  const focused = ui.dialog.open && ui.dialog.contains(document.activeElement) ? document.activeElement : null;
  ui.dialog.innerHTML = `
    <h2 id="dialog-title">🎙️ Giọng đọc</h2>
    ${body}
    <div class="buttons">
      ${voices.length ? `<button type="button" class="button ghost" data-action="voice-test">🔊 Nghe thử</button>` : ""}
      <button type="button" class="button ghost" data-action="voice-refresh">🔄 Kiểm tra lại</button>
      <button type="button" class="button" data-action="close">Xong</button>
    </div>`;
  if (!ui.dialog.open) ui.dialog.showModal();
  const restore = focused?.name === "voice"
    ? ui.dialog.querySelector("input[name=voice]:checked")
    : focused?.dataset?.action ? ui.dialog.querySelector(`[data-action="${focused.dataset.action}"]`) : null;
  (restore ?? ui.dialog.querySelector("input[name=voice]:checked, button"))?.focus();
}

function testVoice() {
  const v = currentVoice();
  speak([v ? `Xin chào, tôi là ${voiceLabel(v)}` : "Xin chào", "Thám tử, vụ án đang chờ bạn"], { force: true });
}

function chooseVoice(name) {
  setVoice(name);
  save("tts-voice", name || null);
  updateSoundButtons();
  renderVoiceDialog();
  testVoice();
}

function announce(gained) {
  if (!gained?.length) return;
  sfx.clue();
  const names = gained.map((clue) => `${clue.icon} ${clue.name}`).join(", ");
  // Not read aloud: the result that triggered it already says what was written down.
  toast(gained.length === 1 ? `📌 Manh mối mới: ${names}` : `📌 ${gained.length} manh mối mới: ${names}`, { say: false });
}

function afterAction() {
  persist();
  if (current.inv.status === "failed") return showFailed();
  if (current.inv.status === "solved") return showSolved();
  renderGame();
}

function examine(spotId) {
  const { inv } = current;
  const location = inv.location(selectedLocation);
  const spot = inv.hotspots(location.id).find((s) => s.id === spotId);
  const result = inv.examine(location.id, spotId);
  lastResult = { where: "scenes", title: spot.name, text: result.text, gained: result.gained };
  recentSpot = spotId;
  if (!result.gained.length) sfx.page();
  announce(result.gained);
  afterAction();
  if (current) speak(resultSpeech());
}

function openSuspect(id) {
  selectedSuspect = id;
  const { inv, heard } = current;
  const result = inv.interview(id);
  for (const st of inv.statements(id)) heard.add(`${id}/${st.id}`);
  lastResult = result.gained.length ? { where: "people", title: "Lời khai mới được ghi lại", text: "Những điều đáng chú ý đã được ghi vào sổ tay.", gained: result.gained } : null;
  if (result.gained.length) announce(result.gained);
  else sfx.page();
  afterAction();
  if (current) speak(suspectSpeech(inv.suspect(id)));
}

function confront(statementId) {
  const { inv } = current;
  const suspect = inv.suspect(selectedSuspect);
  const statement = inv.statements(suspect.id).find((s) => s.id === statementId);
  openDialog(`
    <h2 id="dialog-title">Đối chất với ${esc(suspect.name)}</h2>
    <blockquote>“${esc(statement.text)}”</blockquote>
    <p class="muted">Manh mối nào cho thấy lời khai này sai? (Sai sẽ mất 1 uy tín)</p>
    <ul class="pick-list">${inv.notebook().map((c) => `<li><button type="button" class="pick ${c.kind}" data-action="present" data-statement="${statementId}" data-id="${c.id}">${c.icon} ${esc(c.name)}</button></li>`).join("")}</ul>
    <div class="buttons"><button type="button" class="button ghost" data-action="close">Thôi</button></div>`);
}

function present(statementId, clueId) {
  closeDialog();
  const { inv } = current;
  const suspect = inv.suspect(selectedSuspect);
  const result = inv.present(suspect.id, statementId, clueId);
  if (result.correct) {
    if (!result.already) {
      sfx.contradiction();
      flash("MÂU THUẪN!");
    }
    lastResult = { where: "people", title: `${suspect.name} lúng túng…`, text: result.text, gained: result.gained, tone: "good" };
    announce(result.gained);
  } else {
    sfx.wrong();
    shakeCredibility();
    const reaction = WRONG_REACTIONS[(inv.mistakes.present - 1) % WRONG_REACTIONS.length];
    lastResult = { where: "people", title: "Không có mâu thuẫn", text: `${suspect.name} ${reaction} (−1 uy tín)`, tone: "bad" };
  }
  afterAction();
  if (current) speak(resultSpeech());
}

function deduce() {
  const { inv } = current;
  const [a, b] = picking;
  const result = inv.deduce(a, b);
  picking = [];
  if (result.correct && !result.already) {
    sfx.deduce();
    flash("SUY LUẬN!");
    openDialog(`
      <p class="stamp">Suy luận mới</p>
      <h2 id="dialog-title">${result.gained.map((c) => `${c.icon} ${esc(c.name)}`).join(", ")}</h2>
      <p>${esc(result.text)}</p>
      <div class="buttons"><button type="button" class="button" data-action="close">Ghi vào sổ tay</button></div>`);
  } else if (result.already) {
    toast("Bạn đã rút ra suy luận này rồi.");
  } else {
    sfx.wrong();
    toast("🤔 Hai manh mối này chưa nói lên điều gì. (tính là một lần đoán sai)");
  }
  afterAction();
}

function accuse() {
  const { inv } = current;
  const result = inv.accuse(draft);
  if (result.correct) {
    persist();
    return showSolved();
  }
  sfx.wrong();
  shakeCredibility();
  persist();
  if (result.failed) return showFailed();
  openDialog(`
    <p class="stamp bad">Buộc tội thất bại</p>
    <h2 id="dialog-title">Chỉ đúng ${result.right}/${result.of} điều</h2>
    <p>Lập luận của bạn có lỗ hổng. Hãy xem lại sổ tay và các lời khai. (−2 uy tín, còn ${result.credibility})</p>
    <div class="buttons"><button type="button" class="button" data-action="close">Điều tra tiếp</button></div>`);
  renderGame();
}

function hint() {
  const { inv } = current;
  const step = nextStep(inv);
  inv.useHint();
  persist();
  let text = "Trợ lý cũng đang bí. Hãy xem lại toàn bộ sổ tay.";
  let go = "";
  if (step.type === "examine") {
    const location = inv.location(step.location);
    const spot = inv.hotspots(step.location).find((s) => s.id === step.hotspot);
    text = `Ở ${location.name}, hãy xem kỹ “${spot.name}”.`;
    go = `data-tab="scenes" data-location="${step.location}"`;
  } else if (step.type === "interview") {
    const suspect = inv.suspect(step.suspect);
    text = `${suspect.name} vẫn còn điều chưa kể. Hãy tới nghe lời khai.`;
    go = `data-tab="people" data-suspect="${step.suspect}"`;
  } else if (step.type === "present") {
    const suspect = inv.suspect(step.suspect);
    const statement = inv.statements(step.suspect).find((s) => s.id === step.statement);
    text = `Có một lời khai của ${suspect.name} không khớp với manh mối bạn đang có: “${statement.text}”`;
    go = `data-tab="people" data-suspect="${step.suspect}"`;
  } else if (step.type === "deduce") {
    text = `Hãy thử ghép “${inv.clue(step.from[0]).name}” với một manh mối khác trong sổ tay.`;
    go = `data-tab="notebook" data-pick="${step.from[0]}"`;
  } else if (step.type === "accuse") {
    text = "Bạn đã có đủ chứng cứ. Đã đến lúc buộc tội!";
    go = `data-tab="accuse"`;
  }
  openDialog(`
    <p class="stamp">Trợ lý</p>
    <h2 id="dialog-title">💡 Gợi ý</h2>
    <p>${esc(text)}</p>
    <p class="muted">Mỗi gợi ý trừ ${SCORE_COST.hint} điểm xếp hạng. Đã dùng: ${inv.hints}.</p>
    <div class="buttons">${go ? `<button type="button" class="button" data-action="go" ${go}>Đi tới</button>` : ""}<button type="button" class="button ghost" data-action="close">Đóng</button></div>`);
  renderGame();
}

function goTo(dataset) {
  closeDialog();
  tab = dataset.tab;
  if (dataset.location) selectedLocation = dataset.location;
  if (dataset.pick) picking = [dataset.pick];
  if (dataset.suspect) return openSuspect(dataset.suspect);
  renderGame();
}

// Endings ----------------------------------------------------------------------------------

function showSolved() {
  const { data, inv } = current;
  sfx.solved();
  track("detective/solved");
  const previous = rankOf(data.id);
  const best = previous && RANK_ORDER.indexOf(previous) < RANK_ORDER.indexOf(inv.rank) ? previous : inv.rank;
  progress = { ...progress, solved: { ...progress.solved, [data.id]: best } };
  save("progress", progress);
  save(`case:${data.id}`, null);
  const next = CASES[CASES.findIndex((c) => c.id === data.id) + 1];
  ui.briefSetting.textContent = "Vụ án đã khép lại";
  ui.briefTitle.textContent = data.title;
  ui.briefSub.innerHTML = `<span class="rank-stamp" aria-label="Hạng ${inv.rank}">${inv.rank}</span>`;
  ui.briefText.innerHTML = `
    ${data.epilogue.map((p) => `<p>${esc(p)}</p>`).join("")}
    <dl class="stats">
      <div><dt>Điểm</dt><dd>${inv.score}</dd></div>
      <div><dt>Uy tín còn lại</dt><dd>${inv.credibility}/${MAX_CREDIBILITY}</dd></div>
      <div><dt>Đối chất sai</dt><dd>${inv.mistakes.present}</dd></div>
      <div><dt>Ghép sai</dt><dd>${inv.mistakes.deduce}</dd></div>
      <div><dt>Buộc tội sai</dt><dd>${inv.mistakes.accuse}</dd></div>
      <div><dt>Gợi ý</dt><dd>${inv.hints}</dd></div>
    </dl>`;
  ui.briefButtons.innerHTML = `
    ${next ? `<button class="button" type="button" data-action="open-case" data-id="${next.id}">Hồ sơ tiếp theo →</button>` : ""}
    <button class="button ${next ? "secondary" : ""}" type="button" data-action="home">Về sổ hồ sơ</button>
    ${listenButton()}`;
  dossierSpeech = ["Vụ án đã khép lại", data.title, `Xếp hạng ${inv.rank}`, ...data.epilogue, `Điểm ${inv.score}`, `Uy tín còn lại ${inv.credibility} trên ${MAX_CREDIBILITY}`];
  current = null;
  show(ui.briefing);
  ui.briefButtons.querySelector("button").focus();
  speak(dossierSpeech);
}

function showFailed() {
  const { data } = current;
  sfx.failed();
  track("detective/failed");
  save(`case:${data.id}`, null);
  ui.briefSetting.textContent = "Mất uy tín";
  ui.briefTitle.textContent = data.title;
  ui.briefSub.textContent = "Bạn đã bị mời ra khỏi vụ án.";
  ui.briefText.innerHTML = `<p>Quá nhiều lời buộc tội vội vàng khiến không ai còn tin bạn nữa. Nhưng một thám tử giỏi luôn học từ sai lầm: hãy điều tra lại từ đầu, và lần này chỉ đưa ra chứng cứ khi thật chắc chắn.</p>`;
  ui.briefButtons.innerHTML = `
    <button class="button" type="button" data-action="start" data-id="${data.id}">Điều tra lại từ đầu</button>
    <button class="button secondary" type="button" data-action="home">Về sổ hồ sơ</button>
    ${listenButton()}`;
  dossierSpeech = [ui.briefSetting.textContent, data.title, ui.briefSub.textContent, textOf(ui.briefText)];
  current = null;
  show(ui.briefing);
  speak(dossierSpeech);
}

// Small UI helpers -------------------------------------------------------------------------

function openDialog(html) {
  ui.dialog.innerHTML = html;
  if (!ui.dialog.open) ui.dialog.showModal();
  ui.dialog.querySelector("button")?.focus();
  speak([...ui.dialog.querySelectorAll("h2, p, blockquote, li:not(:has(button))")].map(textOf));
}

function closeDialog() {
  if (ui.dialog.open) {
    ui.dialog.close();
    stopSpeech();
  }
}

function toast(message, { say = true, action = null } = {}) {
  if (say) speak(message);
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      node.remove();
      action.run();
    });
    node.append(" ", button);
  }
  ui.toasts.append(node);
  while (ui.toasts.children.length > 3) ui.toasts.firstElementChild.remove();
  setTimeout(() => node.remove(), action ? 8000 : 3200); // longer when there is something to click
}

function flash(text) {
  const node = document.createElement("div");
  node.className = "flash";
  node.textContent = text;
  node.setAttribute("aria-hidden", "true");
  document.body.append(node);
  setTimeout(() => node.remove(), 1100);
}

function shakeCredibility() {
  ui.credibility.classList.remove("shake");
  void ui.credibility.offsetWidth;
  ui.credibility.classList.add("shake");
}

function updateSoundButtons() {
  const sound = isMuted() ? "🔇" : "🔊";
  ui.soundButton.textContent = sound;
  ui.soundButton.setAttribute("aria-pressed", String(!isMuted()));
  ui.homeSound.textContent = `${sound} Âm thanh: ${isMuted() ? "tắt" : "bật"}`;
  ui.homeMusic.textContent = `🎵 Nhạc nền: ${isMusicOn() ? "bật" : "tắt"}`;
  ui.homeSound.setAttribute("aria-pressed", String(!isMuted()));
  ui.homeMusic.setAttribute("aria-pressed", String(isMusicOn()));

  const can = speechSupported();
  const on = isSpeechOn();
  ui.speechButton.hidden = !can;
  ui.speechButton.setAttribute("aria-pressed", String(on));
  ui.speechButton.classList.toggle("on", on);
  ui.speechButton.title = `Đọc to: ${on ? "bật" : "tắt"} (V)`;
  ui.homeSpeech.disabled = !can;
  ui.homeSpeech.textContent = can ? `🗣️ Đọc to: ${on ? "bật" : "tắt"}` : "🗣️ Đọc to: trình duyệt không hỗ trợ";
  ui.homeSpeech.setAttribute("aria-pressed", String(on));
  ui.homeRate.hidden = !can;
  ui.homeRate.textContent = `⏩ Tốc độ đọc: ${String(speechRate()).replace(".", ",")}×`;
  ui.homeVoice.hidden = !can;
  ui.homeVoice.textContent = hasVietnameseVoice() ? `🎙️ Giọng đọc: ${voiceLabel(currentVoice())}` : "🎙️ Giọng đọc: chưa có tiếng Việt";
  ui.homeVoice.classList.toggle("warn", can && !hasVietnameseVoice());
}

function syncMusic() {
  sfx.unlock();
  if (isMusicOn() && !isMuted()) startMusic();
  else stopMusic();
}

function toggleSound() {
  setMuted(!isMuted());
  save("muted", isMuted());
  syncMusic();
  updateSoundButtons();
}

function toggleMusic() {
  setMusic(!isMusicOn());
  save("music", isMusicOn());
  syncMusic();
  updateSoundButtons();
}

function howTo() {
  openDialog(`
    <h2 id="dialog-title">Cách chơi</h2>
    <ol class="howto">
      <li><strong>🔎 Hiện trường:</strong> chọn địa điểm, bấm vào các điểm đáng ngờ để tìm vật chứng.</li>
      <li><strong>🗣️ Nhân chứng:</strong> nghe lời khai. Khi một lời khai trái với manh mối bạn có, bấm <em>Đối chất</em> và đưa ra manh mối đó. Đưa sai mất 1 uy tín.</li>
      <li><strong>📓 Sổ tay:</strong> chọn hai manh mối liên quan và bấm <em>Ghép suy luận</em> để rút ra kết luận mới.</li>
      <li><strong>⚖️ Buộc tội:</strong> chỉ ra thủ phạm, thủ đoạn, động cơ và chứng cứ quyết định. Sai mất 2 uy tín.</li>
      <li>Hết 5 uy tín là thua. <strong>💡 Gợi ý</strong> luôn sẵn sàng, nhưng sẽ hạ xếp hạng (S, A, B, C).</li>
      <li><strong>🗺️ Sơ đồ:</strong> địa điểm đang xem được tô sáng, các số trên sơ đồ là vị trí thật của từng điểm cần xem xét.</li>
      <li><strong>🗣️ Đọc to:</strong> bật để nghe đọc mọi nội dung. Nút 🔊 đọc riêng từng đoạn. Mọi âm thanh trong game đều có chữ hoặc hình báo kèm.</li>
    </ol>
    <p class="muted">Phím tắt: <kbd>1</kbd>–<kbd>4</kbd> đổi khu vực, <kbd>H</kbd> gợi ý, <kbd>M</kbd> âm thanh, <kbd>V</kbd> bật/tắt đọc to, <kbd>R</kbd> đọc mục đang chọn hoặc đọc lại, <kbd>Esc</kbd> dừng đọc.</p>
    <p class="muted">Chưa nghe được giọng tiếng Việt, hoặc muốn đổi giọng? Bấm <strong>🎙️ Giọng đọc</strong>.</p>
    <div class="buttons">
      ${speechSupported() ? `<button type="button" class="button ghost" data-action="voice">🎙️ Giọng đọc</button>` : ""}
      <button type="button" class="button" data-action="close">Đã hiểu</button>
    </div>`);
}

// Events -----------------------------------------------------------------------------------

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const { action, id } = target.dataset;
  sfx.unlock();
  switch (action) {
    case "open-case": return openBriefing(id);
    case "start": return startCase(id, target.dataset.resume === "1");
    case "home": return renderHome();
    case "location":
      selectedLocation = id;
      lastResult = null;
      recentSpot = null;
      sfx.page();
      renderGame();
      return speak(locationSpeech());
    case "toggle-map":
      showMap = !showMap;
      save("show-map", showMap);
      renderGame();
      return ui.panel.querySelector(".map-toggle")?.focus();
    case "say": return sayTarget(target);
    case "voice": return voiceDialog();
    case "voice-test": return testVoice();
    case "voice-refresh": {
      const found = refreshVoices();
      renderVoiceDialog();
      return toast(found ? `Tìm thấy ${found} giọng tiếng Việt.` : "Vẫn chưa thấy giọng tiếng Việt. Sau khi cài, hãy đóng hẳn trình duyệt rồi mở lại.");
    }
    case "examine": return examine(id);
    case "suspect": return openSuspect(id);
    case "confront": return confront(id);
    case "present": return present(target.dataset.statement, id);
    case "filter":
      filter = id;
      return renderGame();
    case "pick": {
      const adding = !picking.includes(id);
      picking = adding ? [...picking.slice(-1), id] : picking.filter((p) => p !== id);
      renderGame();
      const clue = current.inv.clue(id);
      return speak([adding ? "Đã chọn" : "Bỏ chọn", clue.name, adding ? clue.text : "", `${picking.length} trên 2 đã chọn`]);
    }
    case "unpick":
      picking = [];
      return renderGame();
    case "deduce": return deduce();
    case "go": return goTo(target.dataset);
    case "close": return closeDialog();
    default:
  }
});

for (const button of ui.tabs) {
  button.addEventListener("click", () => {
    tab = button.dataset.tab;
    sfx.page();
    renderGame();
    speak(tabSpeech());
  });
}

// Pointing at a point in the list lights up its marker on the map, and the other way round.
function highlightSpot(event, on) {
  const el = event.target.closest?.("[data-spot], [data-marker]");
  if (!el) return;
  const id = el.dataset.spot ?? el.dataset.marker;
  for (const node of ui.panel.querySelectorAll(`[data-spot="${CSS.escape(id)}"], [data-marker="${CSS.escape(id)}"]`)) node.classList.toggle("hot", on);
}
ui.panel.addEventListener("pointerover", (event) => highlightSpot(event, true));
ui.panel.addEventListener("pointerout", (event) => highlightSpot(event, false));
ui.panel.addEventListener("focusin", (event) => highlightSpot(event, true));
ui.panel.addEventListener("focusout", (event) => highlightSpot(event, false));

// Arrow keys move between tabs (WAI-ARIA tabs pattern).
document.querySelector(".tabs").addEventListener("keydown", (event) => {
  const index = ui.tabs.findIndex((b) => b.dataset.tab === tab);
  const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!delta) return;
  tab = ui.tabs[(index + delta + ui.tabs.length) % ui.tabs.length].dataset.tab;
  renderGame();
  ui.tabs.find((b) => b.dataset.tab === tab).focus();
  speak(tabSpeech());
});

ui.panel.addEventListener("change", (event) => {
  if (event.target.type !== "radio") return;
  draft = { ...draft, [event.target.name]: event.target.value };
  const scroll = window.scrollY;
  renderGame();
  window.scrollTo(0, scroll);
  const input = ui.panel.querySelector(`input[name="${event.target.name}"][value="${CSS.escape(event.target.value)}"]`);
  input?.focus();
  const legend = textOf(input?.closest("fieldset")?.querySelector("legend"));
  speak([legend, `Đã chọn: ${textOf(input?.closest(".option"))}`]);
});

ui.panel.addEventListener("submit", (event) => {
  event.preventDefault();
  accuse();
});

$("back-btn").addEventListener("click", () => {
  persist();
  current = null;
  renderHome();
});
ui.hintButton.addEventListener("click", hint);
ui.soundButton.addEventListener("click", toggleSound);
ui.speechButton.addEventListener("click", toggleSpeech);
ui.homeSound.addEventListener("click", toggleSound);
ui.homeMusic.addEventListener("click", toggleMusic);
ui.homeSpeech.addEventListener("click", toggleSpeech);
ui.homeRate.addEventListener("click", cycleRate);
ui.homeVoice.addEventListener("click", voiceDialog);
ui.dialog.addEventListener("change", (event) => {
  if (event.target.name === "voice") chooseVoice(event.target.value);
});
$("home-howto").addEventListener("click", howTo);

ui.dialog.addEventListener("click", (event) => {
  if (event.target === ui.dialog) closeDialog(); // click on the backdrop
});
ui.dialog.addEventListener("close", stopSpeech); // also when closed with Esc

// Read-aloud keys work on every screen, also inside dialogs and on radio buttons.
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches("textarea, input[type=text], input[type=search]")) return;
  const key = event.key.toLowerCase();
  if (key === "r") {
    event.preventDefault();
    readFocused();
  } else if (key === "v") {
    toggleSpeech();
  } else if (event.key === "Escape" && isSpeaking()) {
    stopSpeech();
  }
});

document.addEventListener("keydown", (event) => {
  if (!current || ui.dialog.open || event.target.matches("input, textarea")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const tabKey = { 1: "scenes", 2: "people", 3: "notebook", 4: "accuse" }[event.key];
  if (tabKey) {
    tab = tabKey;
    renderGame();
  } else if (event.key === "h" || event.key === "H") hint();
  else if (event.key === "m" || event.key === "M") toggleSound();
});

window.sotay = { get current() { return current; } }; // for debugging and browser tests

renderHome();
if (!load("seen-howto", false)) {
  save("seen-howto", true);
  howTo();
}
