// js/engine.js
import { state, pushRecent } from "./store.js";
import { callStoryAPI } from "./api.js";
import { renderHUD, renderCast, renderStory } from "./render/gameView.js";
import { saveState } from "./storage.js";

function clamp(n, min, max) {
    n = Number(n);
    if (Number.isNaN(n)) return 0;
    return Math.max(min, Math.min(max, n));
}

function applyDelta(ai) {
    const d = ai?.delta;

    // stats
    const s = d?.stats || {};
    state.stats.sanity += clamp(s.sanity ?? 0, -3, 3);
    state.stats.stamina += clamp(s.stamina ?? 0, -3, 3);
    state.stats.luck += clamp(s.luck ?? 0, -3, 3);

    // flags
    const add = Array.isArray(d?.flags_add) ? d.flags_add : [];
    const rem = Array.isArray(d?.flags_remove) ? d.flags_remove : [];
    for (const f of add) if (!state.flags.includes(f)) state.flags.push(f);
    state.flags = state.flags.filter(f => !rem.includes(f));
}

function applyEnding(ai) {
    if (!ai?.end) return;
    const { endingId, title, summary } = ai.end;
    if (!endingId) return;

    state.endings[endingId] = {
        unlocked: true,
        title: title || endingId,
        summary: summary || "",
        atTurn: state.turn
    };
}

function updateMemory(userInput, ai) {
    // 최근 로그 유지(짧게)
    if (userInput && userInput !== "__START__") pushRecent("user", userInput);
    pushRecent("ai", ai?.narration || "");

    // 아주 단순 요약(원하면 나중에 AI로 summary 갱신하도록 확장 가능)
    // 너무 길어지면 컷
    const line = (ai?.status?.summary || "").trim();
    if (line) {
        const merged = (state.memory.summary ? state.memory.summary + " / " : "") + line;
        state.memory.summary = merged.slice(-400); // 뒤쪽 400자만 유지
    }
}

function applyAI(ai) {
    state.lastAI = ai;
    state.turn = Number(ai?.turn ?? (state.turn + 1)) || (state.turn + 1);
    state.chapter = ai?.chapter || state.chapter;

    applyDelta(ai);
    applyEnding(ai);

    // 렌더
    renderHUD(state.stats);
    renderCast(ai.cast);
    renderStory(ai);

    // 저장(매 턴 자동 저장)
    saveState(state);
}

export async function runTurn(userInput) {
    const payload = {
        state: {
            turn: state.turn,
            chapter: state.chapter,
            stats: state.stats,
            flags: state.flags,
            endings: Object.keys(state.endings || {}) // 모델이 참고만 하게
        },
        memory: state.memory,
        user_input: userInput
    };

    const ai = await callStoryAPI(payload);
    updateMemory(userInput, ai);
    applyAI(ai);
    return ai;
}

export async function startNewGame() {
    // 초기화는 필요에 따라 더 세게
    state.turn = 0;
    state.chapter = "BOOK1_CH01";
    state.stats = { sanity: 5, stamina: 5, luck: 5 };
    state.flags = [];
    state.memory = { summary: "", recent: [] };
    state.endings = {};
    state.lastAI = null;

    renderHUD(state.stats);
    return await runTurn("__START__");
}
