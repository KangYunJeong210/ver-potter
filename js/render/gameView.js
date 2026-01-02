// js/render/gameView.js
const $ = (sel) => document.querySelector(sel);

const hudSanity = $("#hud-sanity");
const hudStamina = $("#hud-stamina");
const hudLuck = $("#hud-luck");

const charImg = $("#char-img");
const charName = $("#char-name");
const castStrip = $("#cast-strip");

const narrationEl = $("#narration");
const statusEl = $("#status");
const questionEl = $("#question");

const dialogScroll = $("#dialog-scroll");

function charSrc(id, expression) {
    const exp = (expression || "neutral").trim();
    return `assets/characters/${id}/ch_${id}_${exp}.png`;
}

function setImgWithFallback(imgEl, src, fallbackSrc) {
    if (!imgEl) return;
    imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = fallbackSrc;
    };
    imgEl.src = src;
}

export function renderHUD(stats) {
    if (hudSanity) hudSanity.innerHTML = `SAN <b>${stats?.sanity ?? 0}</b>`;
    if (hudStamina) hudStamina.innerHTML = `STA <b>${stats?.stamina ?? 0}</b>`;
    if (hudLuck) hudLuck.innerHTML = `LUK <b>${stats?.luck ?? 0}</b>`;
}

export function renderCast(cast) {
    // active
    const a = cast?.active;
    if (a && charImg && charName) {
        charName.textContent = a.name || "";
        const mainSrc = charSrc(a.id, a.expression);
        const fallback = charSrc(a.id, "neutral");
        setImgWithFallback(charImg, mainSrc, fallback);
    }

    // others thumbnails (0~3)
    if (castStrip) {
        castStrip.innerHTML = "";
        const list = (cast?.others || []).slice(0, 3);
        for (const p of list) {
            const img = document.createElement("img");
            img.className = "thumb";
            img.alt = p.name || p.id || "";
            const src = charSrc(p.id, p.expression);
            const fallback = charSrc(p.id, "neutral");
            setImgWithFallback(img, src, fallback);
            castStrip.appendChild(img);
        }
    }
}

export function renderStory(ai) {
    // narration: string → <p>로 변환
    if (narrationEl) {
        const text = String(ai?.narration || "").trim();
        const paras = text ? text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean) : [];
        narrationEl.innerHTML = paras.length
            ? paras.map(p => `<p>${escapeHTML(p)}</p>`).join("")
            : `<p>…</p>`;
    }

    // status
    if (statusEl) {
        const place = ai?.status?.place ?? "";
        const time = ai?.status?.time ?? "";
        const summary = ai?.status?.summary ?? "";
        statusEl.innerHTML = `
      <span class="badge">장소</span> ${escapeHTML(place)}
      <span class="dot"></span>
      <span class="badge">시간</span> ${escapeHTML(time)}
      ${summary ? `<span class="dot"></span><span class="badge">상태</span> ${escapeHTML(summary)}` : ""}
    `;
    }

    // question (end면 숨김)
    if (questionEl) {
        if (ai?.end) {
            questionEl.innerHTML = `
        <div class="q-title">엔딩 도달</div>
        <div class="q-hint">${escapeHTML(ai.end.title || "")} — ${escapeHTML(ai.end.summary || "")}</div>
      `;
        } else {
            const q = ai?.question;
            questionEl.innerHTML = `
        <div class="q-title">${escapeHTML(q?.text || "베르는 어떻게 할 거야?")}</div>
        <div class="q-hint">${escapeHTML(q?.input_hint || "")}</div>
      `;
        }
    }

    // 자동 스크롤
    if (dialogScroll) {
        requestAnimationFrame(() => {
            dialogScroll.scrollTop = dialogScroll.scrollHeight;
        });
    }
}

function escapeHTML(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
