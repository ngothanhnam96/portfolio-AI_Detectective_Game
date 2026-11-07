/** A tiny, hand-checkable case for engine tests. */

export function miniCase() {
  return {
    id: "mini",
    title: "Chiếc bánh biến mất",
    subtitle: "Ai ăn bánh?",
    setting: "Nhà bếp",
    difficulty: 1,
    source: { kind: "original" },
    intro: ["Chiếc bánh trên bàn đã biến mất."],
    epilogue: ["Con mèo nhận tội."],
    start: ["c_brief"],
    clues: [
      { id: "c_brief", kind: "evidence", icon: "📁", name: "Hồ sơ", text: "Bánh mất lúc 3 giờ." },
      { id: "c_crumbs", kind: "evidence", icon: "🍞", name: "Vụn bánh", text: "Vụn bánh dẫn ra cửa sổ." },
      { id: "c_paw", kind: "evidence", icon: "🐾", name: "Dấu chân", text: "Dấu chân mèo trên bậu cửa." },
      { id: "c_secret", kind: "evidence", icon: "🗝️", name: "Ngăn bí mật", text: "Chỉ thấy khi đã có dấu chân." },
      { id: "c_says", kind: "testimony", icon: "🐱", name: "Mèo khai", text: "Mèo ngủ cả chiều." },
      { id: "c_lie", kind: "testimony", icon: "😼", name: "Mèo nói dối", text: "Mèo thừa nhận có ra bếp." },
      { id: "d_cat", kind: "deduction", icon: "💡", name: "Mèo ra cửa sổ", text: "Vụn bánh và dấu chân cùng ra cửa sổ." },
    ],
    locations: [
      {
        id: "kitchen",
        name: "Nhà bếp",
        icon: "🍳",
        description: "Bếp nhỏ.",
        hotspots: [
          { id: "table", name: "Bàn", text: "Có vụn bánh.", gives: ["c_crumbs"] },
          { id: "window", name: "Cửa sổ", text: "Có dấu chân.", gives: ["c_paw"] },
          { id: "drawer", name: "Ngăn kéo", text: "Ngăn bí mật.", requires: ["c_paw"], gives: ["c_secret"] },
          { id: "stove", name: "Bếp lò", text: "Không có gì." },
        ],
      },
      { id: "attic", name: "Gác mái", icon: "🏚️", description: "Chỉ mở sau suy luận.", requires: ["d_cat"], hotspots: [{ id: "box", name: "Hộp", text: "Trống." }] },
    ],
    suspects: [
      {
        id: "cat",
        name: "Con mèo",
        role: "Nghi phạm",
        bio: "Tham ăn.",
        look: { hue: 30 },
        statements: [
          {
            id: "s1",
            text: "Tôi ngủ cả chiều.",
            gives: ["c_says"],
            contradiction: { clue: ["c_paw"], reply: "Thôi được, tôi có ra bếp.", gives: ["c_lie"] },
          },
        ],
      },
      { id: "dog", name: "Con chó", role: "Nhân chứng", bio: "Thật thà.", look: { hue: 200 }, statements: [{ id: "s1", text: "Tôi thấy mèo." }] },
      { id: "mouse", name: "Con chuột", role: "Nhân chứng", bio: "Chỉ xuất hiện sau suy luận.", look: { hue: 90 }, requires: ["d_cat"], statements: [{ id: "s1", text: "Chít." }] },
    ],
    deductions: [{ id: "x_cat", from: ["c_crumbs", "c_paw"], gives: ["d_cat"], text: "Mèo đã mang bánh ra cửa sổ." }],
    accusation: {
      culprit: "cat",
      method: { answer: "m1", options: [{ id: "m1", text: "Tha bánh ra cửa sổ" }, { id: "m2", text: "Ăn tại chỗ" }, { id: "m3", text: "Giấu dưới gầm" }] },
      motive: { answer: "o1", options: [{ id: "o1", text: "Đói" }, { id: "o2", text: "Ghen" }, { id: "o3", text: "Trả thù" }] },
      evidence: ["d_cat"],
    },
    support: ["d_cat", "c_lie"],
  };
}

export const RIGHT = { culprit: "cat", method: "m1", motive: "o1", evidence: "d_cat" };
