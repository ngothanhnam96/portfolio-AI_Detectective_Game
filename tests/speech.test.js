import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CASES } from "../src/core/cases/index.js";
import {
  chunks, pickVoice, sentences, setupTips, speakable, speak, speechSupported, vietnameseVoices, voiceLabel, voiceNote,
} from "../src/ui/speech.js";

describe("read aloud: text", () => {
  it("drops emoji and quote marks but keeps every Vietnamese letter", () => {
    assert.equal(speakable("📌 Manh mối mới: 🔑 Chìa trong ổ"), "Manh mối mới: Chìa trong ổ");
    assert.equal(speakable("“Tôi đi ngủ lúc 22 giờ 30.”"), "Tôi đi ngủ lúc 22 giờ 30.");
    assert.equal(speakable("🕵️‍♂️ Thám tử 👍🏽"), "Thám tử");
    assert.equal(speakable("Đà Lạt · một đêm mưa"), "Đà Lạt, một đêm mưa");
    assert.equal(speakable("Sàn gạch & giá ô"), "Sàn gạch và giá ô");
    assert.equal(speakable("ăn ằ ẳ ẵ ặ ơ ư đ Ư Ơ Đ"), "ăn ằ ẳ ẵ ặ ơ ư đ Ư Ơ Đ");
    assert.equal(speakable(undefined), "");
  });

  it("turns parts into sentences so the voice pauses between them", () => {
    assert.equal(sentences(["Phòng làm việc", "Có 5 điểm cần xem xét", ["Số 1, Ổ khóa", ""]]), "Phòng làm việc. Có 5 điểm cần xem xét. Số 1, Ổ khóa.");
    assert.equal(sentences(["Hết giờ!", "Thử lại?"]), "Hết giờ! Thử lại?");
  });

  it("splits long text at sentence boundaries without losing a word", () => {
    for (const c of CASES) {
      const text = sentences([...c.intro, ...c.epilogue]);
      const pieces = chunks(text, 180);
      assert.ok(pieces.every((p) => p.length <= 181), c.id);
      assert.equal(pieces.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "), c.id);
      assert.ok(pieces.slice(0, -1).filter((p) => /[.!?…:]$/.test(p)).length >= (pieces.length - 1) / 2, `${c.id}: mostly whole sentences`);
    }
    assert.deepEqual(chunks("ngắn"), ["ngắn"]);
    assert.deepEqual(chunks("x".repeat(400), 180).map((p) => p.length), [180, 180, 40], "a word longer than the limit is still cut");
  });

  it("every piece of case text becomes clean speech", () => {
    for (const c of CASES) {
      const all = [
        ...c.intro, ...c.epilogue, ...c.clues.map((x) => `${x.icon} ${x.name}. ${x.text}`),
        ...c.locations.flatMap((l) => [l.name, l.description, ...l.hotspots.flatMap((h) => [h.name, h.text])]),
        ...c.suspects.flatMap((s) => [s.bio, ...s.statements.flatMap((st) => [st.text, st.contradiction?.reply ?? ""])]),
      ];
      for (const text of all) {
        const spoken = speakable(text);
        assert.ok(!/\p{Extended_Pictographic}|[“”]/u.test(spoken), `${c.id}: ${spoken}`);
        if (text.trim()) assert.ok(spoken.length > 0);
      }
    }
  });
});

describe("read aloud: voice", () => {
  const v = (name, lang) => ({ name, lang });
  it("prefers a natural Vietnamese voice, then any Vietnamese voice, else none", () => {
    const voices = [v("Microsoft David", "en-US"), v("Vietnamese basic", "vi"), v("Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", "vi-VN"), v("Google Deutsch", "de-DE")];
    assert.equal(pickVoice(voices).name, "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)");
    assert.equal(pickVoice([v("Microsoft An", "vi_VN"), v("Samantha", "en-US")]).name, "Microsoft An");
    assert.equal(pickVoice([v("Samantha", "en-US"), v("Video", "vid")]), null);
    assert.equal(pickVoice([]), null);
  });

  it("keeps the player's chosen voice while it is installed, else falls back to the best one", () => {
    const voices = [v("Microsoft An - Vietnamese (Vietnam)", "vi-VN"), v("Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", "vi-VN"), v("Samantha", "en-US")];
    assert.equal(pickVoice(voices, "Microsoft An - Vietnamese (Vietnam)").name, "Microsoft An - Vietnamese (Vietnam)");
    assert.equal(pickVoice(voices, "Samantha").name, voices[1].name, "a non-Vietnamese choice is ignored");
    assert.equal(pickVoice(voices, "Uninstalled voice").name, voices[1].name);
    assert.deepEqual(vietnameseVoices(voices).map((x) => x.name), [voices[1].name, voices[0].name]);
  });

  it("shows short voice names and says which need the internet", () => {
    assert.equal(voiceLabel(v("Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", "vi-VN")), "HoaiMy");
    assert.equal(voiceLabel(v("Microsoft An - Vietnamese (Vietnam)", "vi-VN")), "An");
    assert.equal(voiceLabel(v("Google Tiếng Việt", "vi-VN")), "Google Tiếng Việt");
    assert.equal(voiceLabel(v("Linh", "vi-VN")), "Linh");
    assert.match(voiceNote(v("Microsoft NamMinh Online (Natural)", "vi-VN")), /cần mạng/);
    assert.match(voiceNote({ name: "Google Tiếng Việt", lang: "vi-VN", localService: false }), /cần mạng/);
    assert.match(voiceNote({ name: "Linh", lang: "vi-VN", localService: true }), /không có mạng/);
  });

  it("gives setup steps that fit the player's device", () => {
    const ua = {
      edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
      chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
      iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    };
    assert.match(setupTips(ua.edge).join(" "), /cần kết nối mạng/);
    assert.match(setupTips(ua.chromeWin).join(" "), /Microsoft Edge/);
    assert.match(setupTips(ua.android).join(" "), /Google/);
    assert.match(setupTips(ua.iphone).join(" "), /Linh/);
    assert.ok(setupTips("").length > 0);
  });

  it("does nothing (and never throws) where the browser cannot speak", () => {
    assert.equal(speechSupported(), false);
    assert.equal(speak("Xin chào", { force: true }), false);
  });
});
