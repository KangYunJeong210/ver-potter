import { GoogleGenerativeAI } from "@google/generative-ai";

/* ===============================
   CORS
================================ */
function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/* ===============================
   safeJson
================================ */
function safeJson(text) {
  if (!text) return null;

  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

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
   raw body parser (Vercel safe)
================================ */
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/* ===============================
   SYSTEM PROMPT
================================ */
const SYSTEM_PROMPT = `
You are an interactive story engine for a mobile game.

STORY FOUNDATION:
- The overall plot beats should follow the structure of the Harry Potter story,
  but all characters, names, and appearances must be completely different.
- Never output any original Harry Potter names or canon details.

PROTAGONIST:
- The protagonist is Ver Potter (베르 포터).

LANGUAGE:
- All output must be written in Korean.
- Only this prompt is in English.

OUTPUT:
Return ONLY valid JSON with this exact structure:

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

Rules:
- narration: 1~3 short paragraphs.
- Always include exactly ONE question when end is null.
- question.max_chars must always be 140.
- Stats delta range: -3 to +3.
- expression: neutral, smile, angry, sad, surprised, afraid, calm.
- Never output any original Harry Potter names.
- No markdown. No explanation. Only JSON.
`.trim();

/* ===============================
   Handler
================================ */
export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const body = await readBody(req);
    const { state, memory, user_input } = body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
    }

    if (!state || typeof user_input !== "string") {
      return res.status(400).json({
        error: "Missing required fields: state, user_input",
        got: { stateType: typeof state, userInputType: typeof user_input }
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const payload = {
      state,
      memory: memory || null,
      user_input
    };

    const prompt = `${SYSTEM_PROMPT}\n\nINPUT(JSON):\n${JSON.stringify(payload)}`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() ?? "";

    const json = safeJson(text);
    if (!json) {
      return res.status(502).json({
        error: "AI returned invalid JSON",
        raw: String(text).slice(0, 800)
      });
    }

    return res.status(200).json(json);

  } catch (e) {
    console.error("api/story error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
