// js/app.js
import { startNewGame, runTurn } from "./engine.js";
import { loadState, saveState } from "./storage.js";
import { state } from "./store.js";
import { renderHUD, renderCast, renderStory } from "./render/gameView.js";

const $ = (sel) => document.querySelector(sel);

const screens = {
    title: $("#screen-title"),
    game: $("#screen-game"),
    endings: $("#screen-endings"),
};

function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle("hidden", key !== name);
    });
}

const btnNew = $("#btn-new");
const btnContinue = $("#btn-continue");
const btnEndings = $("#btn-endings");
const btnBackTitle = $("#btn-back-title");
const btnMenu = $("#btn-menu");
const btnSave = $("#btn-save");

const input = $("#player-input");
const sendBtn = $("#send-btn");
const chipsWrap = $("#chips");
const toast = $("#toast");

// ===== 칩 클릭 → 입력창 자동 입력 =====
chipsWrap?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-btn");
    if (!chip || !input) return;
    const text = chip.textContent?.trim();
    if (!text) return;

    const current = input.value.trim();
    input.value = current ? `${current} ${text}` : text;

    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
});

// ===== 엔터키 → 보내기 트리거 =====
input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        if (e.isComposing) return; // 한글 조합 중이면 무시
        sendBtn?.click();
    }
});

function setLoading(on) {
    if (!sendBtn || !input) return;
    sendBtn.disabled = on;
    input.disabled = on;
    sendBtn.textContent = on ? "생성중…" : "보내기";
}

function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 1200);
}

// ===== 게임 진행: 보내기 =====
sendBtn?.addEventListener("click", async () => {
    if (!input) return;
    const userText = input.value.trim();
    if (!userText) return;

    try {
        setLoading(true);
        input.value = "";
        await runTurn(userText);
    } catch (err) {
        showToast(`오류: ${err?.message || err}`);
    } finally {
        setLoading(false);
        input.focus();
    }
});

// ===== 화면 전환 =====
btnNew?.addEventListener("click", async () => {
    showScreen("game");
    try {
        setLoading(true);
        await startNewGame(); // __START__ 호출
    } catch (err) {
        showToast(`오류: ${err?.message || err}`);
    } finally {
        setLoading(false);
        input?.focus();
    }
});

btnContinue?.addEventListener("click", () => {
    const saved = loadState();
    if (!saved) {
        showToast("저장 데이터가 없어!");
        return;
    }

    // saved → 현재 state에 덮어쓰기(간단히)
    Object.assign(state, saved);

    showScreen("game");
    renderHUD(state.stats);
    if (state.lastAI) {
        renderCast(state.lastAI.cast);
        renderStory(state.lastAI);
    } else {
        // lastAI가 없으면 안전하게 start로
        showToast("진행 데이터를 복구 중…");
    }
    input?.focus();
});

btnEndings?.addEventListener("click", () => showScreen("endings"));
btnBackTitle?.addEventListener("click", () => showScreen("title"));

btnMenu?.addEventListener("click", () => showScreen("title"));

btnSave?.addEventListener("click", () => {
    saveState(state);
    showToast("저장됨");
});

// ===== 초기 화면 =====
showScreen("title");


// ===== MENU MODAL =====
const modal = document.getElementById("menu-modal");
const btnMenuClose = document.getElementById("btn-menu-close");

const mSave = document.getElementById("m-save");
const mLoad = document.getElementById("m-load");
const mTitle = document.getElementById("m-title");

// settings inputs
const sTextSize = document.getElementById("s-text-size");
const sTypewriter = document.getElementById("s-typewriter");
const sBgm = document.getElementById("s-bgm");

// settings persist keys
const SETTINGS_KEY = "verpotter_settings_v1";

function openModal() {
    modal?.classList.remove("hidden");
}

function closeModal() {
    modal?.classList.add("hidden");
}

function loadSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { textSize: "md", typewriter: false, bgm: false };
    try { return JSON.parse(raw); } catch { return { textSize: "md", typewriter: false, bgm: false }; }
}

function saveSettings(obj) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj));
}

function applySettingsUI(settings) {
    // game screen text size 적용
    const gameScreen = document.getElementById("screen-game");
    if (gameScreen) gameScreen.dataset.text = settings.textSize || "md";

    if (sTextSize) sTextSize.value = settings.textSize || "md";
    if (sTypewriter) sTypewriter.checked = !!settings.typewriter;
    if (sBgm) sBgm.checked = !!settings.bgm;
}

// 메뉴 버튼은 기존에 title로 보내는 임시 동작을 지우고 "모달 오픈"으로 바꿔줘
btnMenu?.addEventListener("click", () => openModal());

// 닫기: X 버튼
btnMenuClose?.addEventListener("click", () => closeModal());

// 닫기: backdrop/닫기 버튼(data-close)
modal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.dataset?.close === "1") closeModal();
});

// ESC로 닫기
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
        closeModal();
    }
});

// Settings 이벤트
const settings = loadSettings();
applySettingsUI(settings);

sTextSize?.addEventListener("change", () => {
    const next = loadSettings();
    next.textSize = sTextSize.value;
    saveSettings(next);
    applySettingsUI(next);
});

sTypewriter?.addEventListener("change", () => {
    const next = loadSettings();
    next.typewriter = sTypewriter.checked;
    saveSettings(next);
    applySettingsUI(next);
    // TODO: 나중에 타자효과 엔진에 연결
});

sBgm?.addEventListener("change", () => {
    const next = loadSettings();
    next.bgm = sBgm.checked;
    saveSettings(next);
    applySettingsUI(next);
    // TODO: 나중에 오디오 플레이어 연결
});

// 메뉴 액션들
mSave?.addEventListener("click", () => {
    // 기존 save 버튼과 동일 로직 사용
    saveState(state);
    showToast("저장됨");
    closeModal();
});

mLoad?.addEventListener("click", () => {
    const saved = loadState();
    if (!saved) {
        showToast("저장 데이터가 없어!");
        return;
    }
    Object.assign(state, saved);

    renderHUD(state.stats);
    if (state.lastAI) {
        renderCast(state.lastAI.cast);
        renderStory(state.lastAI);
    }
    showToast("불러오기 완료");
    closeModal();
});

mTitle?.addEventListener("click", () => {
    closeModal();
    showScreen("title");
});
