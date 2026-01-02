// api/story.js (Vercel Serverless)
// Requires: npm i @google/generative-ai
import { GoogleGenerativeAI } from "@google/generative-ai";

/* ===============================
   CORS (개발 중엔 * 가능)
   배포 땐 origin 제한 추천
================================ */
function setCors(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
}

/* ===============================
   safeJson: 모델이 실수로
   코드펜스/설명/앞뒤 텍스트 붙여도
   JSON만 뽑아서 파싱
================================ */
function safeJson(text) {
    if (!text) return null;

    let t = String(text).trim();

    // 1) ```json ... ``` 제거
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

    // 2) 가장 바깥 JSON 객체만 추출
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;

    t = t.slice(first, last + 1);

    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}

/* ===============================
   System Prompt (EN) / Output (KO)
   - 해리포터 "플롯 체크포인트"는 따라가되
   - 주요 인물 이름/외모는 전부 새로 창작
   - 절대 원작 인명(해리/헤르미온느/론/해그리드 등) 출력 금지
================================ */
const SYSTEM_PROMPT = `
You are an interactive story engine for a mobile game.

STORY FOUNDATION:
- The overall plot beats and major event checkpoints should follow the general storyline structure of the Harry Potter series (especially early school years).
- HOWEVER: All major characters must be re-imagined with completely different names and different appearances.
- Do NOT use the original canon character names (e.g., do not output "Harry", "Hermione", "Ron", "Hagrid", "Dumbledore", etc.).
- Do NOT describe the original canon appearances. Invent fresh appearances, vibes, and character designs.

PROTAGONIST:
- The protagonist is Ver Potter (베르 포터), who fills the central role of the original main character in the plot structure.

IMPORTANT LANGUAGE RULE:
- All outputs MUST be written in Korean.
- Only this system prompt is in English.
- All JSON values must be Korean.

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema:

{
  "turn": number,
  "chapter": string,
  "narration": string,
  "cast": {
    "active": { "id": string, "name": string, "expression": string },
    "others": [ { "id": string, "name": string, "expression": string } ]
  },
  "status": { "place": string, "time": string, "summary": string },
  "question": { "text": string, "input_hint": string, "max_chars": number } | null,
  "delta": {
    "stats": { "sanity": number, "stamina": number, "luck": number },
    "flags_add": string[],
    "flags_remove": string[]
  },
  "end": null | { "endingId": string, "title": string, "summary": string }
}

RULES:
- narration: 1~3 short paragraphs for mobile reading.
- Always include exactly ONE question when end is null.
- question.max_chars must always be exactly 140.
- The player's free-text input is Ver's action/intent and must directly affect the next narration.
- If the input is vague or unrealistic, reinterpret it into the closest plausible action instead of refusing.
- Stats deltas must be integers between -3 and +3.
- cast.active is the speaking/featured character whose image should be shown above the dialogue.
- cast.others includes other important present characters (optional, 0~3 entries).
- expression must be a short token like: neutral, smile, angry, sad, surprised, afraid, calm.
- IMPORTANT: Never output the original canon names anywhere in narration, cast names, status, question, or ending.

ENDING IDS (choose only from this list):
E_TRUE_01
E_NORMAL_01
E_NORMAL_02
E_BAD_01
E_BAD_02
E_SECRET_01

When end is not null:
- Set question to null.
- Keep narration concise and impactful.

No markdown.
No explanations.
Only output JSON in Korean.
`.trim();

export default async function handler(req, res) {
    setCors(req, res);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
        }

        const body = req.body || {};
        const { state, memory, user_input } = body;

        if (!state || typeof user_input !== "string") {
            return res.status(400).json({ error: "Missing required fields: state, user_input" });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // 속도/비용 우선이면 flash, 품질 우선이면 pro
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // 모델에 줄 입력(매 턴 변화)
        const input = {
            state,
            memory: memory || null,
            user_input
        };

        const prompt = `${SYSTEM_PROMPT}\n\nINPUT(JSON):\n${JSON.stringify(input)}`;

        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.() ?? "";

        const json = safeJson(text);
        if (!json) {
            return res.status(502).json({
                error: "AI returned invalid JSON",
                raw: String(text).slice(0, 800)
            });
        }

        // 최소한의 형태 검증 (깨짐 방지)
        if (!json.narration || !json.cast || !json.status || !json.delta) {
            return res.status(502).json({
                error: "AI JSON missing required keys",
                got: json
            });
        }

        return res.status(200).json(json);
    } catch (e) {
        return res.status(500).json({ error: String(e?.message || e) });
    }
}
