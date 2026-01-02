// js/store.js
export const state = {
    turn: 0,
    chapter: "BOOK1_CH01",
    stats: { sanity: 5, stamina: 5, luck: 5 },
    flags: [],
    memory: {
        summary: "",     // 토큰 절약용 요약(서버에서 갱신해도 되고, 여기선 간단히 누적)
        recent: []       // 최근 대화 로그(짧게)
    },
    endings: {},        // endingId: { unlocked, title, summary, atTurn }
    lastAI: null
};

// 최근 로그는 너무 길어지지 않게
export function pushRecent(role, text, limit = 6) {
    state.memory.recent.push({ role, text });
    if (state.memory.recent.length > limit) state.memory.recent.shift();
}
