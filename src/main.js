/** UI controller: renders the casebook, the briefing and the investigation; turns clicks into game calls. */

import { CASES, caseById, isUnlocked } from "./core/cases/index.js";
import { Investigation, MAX_CREDIBILITY, SCORE_COST } from "./core/investigation.js";
import { nextStep } from "./core/solver.js";
import { isMusicOn, isMuted, setMusic, setMuted, sfx, startMusic, stopMusic } from "./ui/audio.js";
import { portrait } from "./ui/portrait.js";
import { load, save } from "./ui/storage.js";

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
  homeSound: $("home-sound"),
  homeMusic: $("home-music"),
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

setMuted(load("muted", false));
setMusic(load("music", true));

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
    <button class="button ghost" type="button" data-action="home">← Sổ hồ sơ</button>`;
  sfx.page();
  show(ui.briefing);
  ui.briefButtons.querySelector("button").focus();
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
  tab = "scenes";
  selectedLocation = inv.locations()[0].id;
  selectedSuspect = null;
  lastResult = null;
  picking = [];
  draft = {};
  filter = "all";
  persist();
  syncMusic();
  show(ui.game);
  renderGame();
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
  return `
    <div class="split">
      <ul class="side-list" aria-label="Địa điểm">${sideItems.join("")}</ul>
      <section class="detail">
        <div class="banner"><span class="banner-icon" aria-hidden="true">${location.icon}</span><h2>${esc(location.name)}</h2></div>
        <p class="lead">${esc(location.description)}</p>
        <h3 class="section-label">Điểm cần xem xét</h3>
        <div class="spots">
          ${spots.map((s) => `<button type="button" class="spot${s.examined ? " examined" : ""}" data-action="examine" data-id="${s.id}">
            <span aria-hidden="true">${s.examined ? "✓" : "🔍"}</span> ${esc(s.name)}<span class="sr-only">${s.examined ? " (đã xem)" : ""}</span></button>`).join("")}
        </div>
        ${resultBox("scenes")}
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
      </div>
      <h3 class="section-label">Lời khai</h3>
      <ol class="statements">
        ${statements.map((st) => `
          <li class="statement${st.resolved ? " resolved" : ""}">
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

function announce(gained) {
  if (!gained?.length) return;
  sfx.clue();
  const names = gained.map((clue) => `${clue.icon} ${clue.name}`).join(", ");
  toast(gained.length === 1 ? `📌 Manh mối mới: ${names}` : `📌 ${gained.length} manh mối mới: ${names}`);
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
  if (!result.gained.length) sfx.page();
  announce(result.gained);
  afterAction();
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
    <button class="button ${next ? "secondary" : ""}" type="button" data-action="home">Về sổ hồ sơ</button>`;
  current = null;
  show(ui.briefing);
  ui.briefButtons.querySelector("button").focus();
}

function showFailed() {
  const { data } = current;
  sfx.failed();
  save(`case:${data.id}`, null);
  ui.briefSetting.textContent = "Mất uy tín";
  ui.briefTitle.textContent = data.title;
  ui.briefSub.textContent = "Bạn đã bị mời ra khỏi vụ án.";
  ui.briefText.innerHTML = `<p>Quá nhiều lời buộc tội vội vàng khiến không ai còn tin bạn nữa. Nhưng một thám tử giỏi luôn học từ sai lầm: hãy điều tra lại từ đầu, và lần này chỉ đưa ra chứng cứ khi thật chắc chắn.</p>`;
  ui.briefButtons.innerHTML = `
    <button class="button" type="button" data-action="start" data-id="${data.id}">Điều tra lại từ đầu</button>
    <button class="button secondary" type="button" data-action="home">Về sổ hồ sơ</button>`;
  current = null;
  show(ui.briefing);
}

// Small UI helpers -------------------------------------------------------------------------

function openDialog(html) {
  ui.dialog.innerHTML = html;
  if (!ui.dialog.open) ui.dialog.showModal();
  ui.dialog.querySelector("button")?.focus();
}

function closeDialog() {
  if (ui.dialog.open) ui.dialog.close();
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  ui.toasts.append(node);
  while (ui.toasts.children.length > 3) ui.toasts.firstElementChild.remove();
  setTimeout(() => node.remove(), 3200);
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
    </ol>
    <p class="muted">Phím tắt khi điều tra: <kbd>1</kbd>–<kbd>4</kbd> đổi khu vực, <kbd>H</kbd> gợi ý, <kbd>M</kbd> âm thanh.</p>
    <div class="buttons"><button type="button" class="button" data-action="close">Đã hiểu</button></div>`);
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
      sfx.page();
      return renderGame();
    case "examine": return examine(id);
    case "suspect": return openSuspect(id);
    case "confront": return confront(id);
    case "present": return present(target.dataset.statement, id);
    case "filter":
      filter = id;
      return renderGame();
    case "pick":
      picking = picking.includes(id) ? picking.filter((p) => p !== id) : [...picking.slice(-1), id];
      return renderGame();
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
  });
}

// Arrow keys move between tabs (WAI-ARIA tabs pattern).
document.querySelector(".tabs").addEventListener("keydown", (event) => {
  const index = ui.tabs.findIndex((b) => b.dataset.tab === tab);
  const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!delta) return;
  tab = ui.tabs[(index + delta + ui.tabs.length) % ui.tabs.length].dataset.tab;
  renderGame();
  ui.tabs.find((b) => b.dataset.tab === tab).focus();
});

ui.panel.addEventListener("change", (event) => {
  if (event.target.type !== "radio") return;
  draft = { ...draft, [event.target.name]: event.target.value };
  const scroll = window.scrollY;
  renderGame();
  window.scrollTo(0, scroll);
  ui.panel.querySelector(`input[name="${event.target.name}"][value="${CSS.escape(event.target.value)}"]`)?.focus();
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
ui.homeSound.addEventListener("click", toggleSound);
ui.homeMusic.addEventListener("click", toggleMusic);
$("home-howto").addEventListener("click", howTo);

ui.dialog.addEventListener("click", (event) => {
  if (event.target === ui.dialog) closeDialog(); // click on the backdrop
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
