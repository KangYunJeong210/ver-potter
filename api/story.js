import { GoogleGenAI } from "@google/genai";

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
  try { return JSON.parse(t); } catch { return null; }
}

/* ===============================
   raw body parser
================================ */
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => data += c);
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

/* ===============================
   SYSTEM PROMPT
================================ */
const SYSTEM_PROMPT = `
You are an interactive story engine for a mobile game.

- The story structure follows the Harry Potter saga,
  but all names, characters, and appearances are completely original.
- The protagonist is Ver Potter (베르 포터).
- Never use original Harry Potter names.

All output must be in Korean.

Return ONLY valid JSON:

{
  "turn": number,
  "chapter": string,
  "narration": string,
  "cast": {
    "active": { "id": string, "name": string, "expression": string },
    "others": [ { "id": string, "name": string, "expression": string } ]
  },
  "status": { "place": string, "time": string, "summary": string },
  "question": { "text": string, "input_hint": string, "max_chars": 140 } | null,
  "delta": {
    "stats": { "sanity": number, "stamina": number, "luck": number },
    "flags_add": string[],
    "flags_remove": string[]
  },
  "end": null | { "endingId": string, "title": string, "summary": string }
}

No markdown. Only JSON.
`.trim();

/* ===============================
   Handler
================================ */
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
    }

    const body = await readBody(req);
    const { state, memory, user_input } = body || {};

    if (!state || typeof user_input !== "string") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `${SYSTEM_PROMPT}\n\nINPUT:\n${JSON.stringify({
      state,
      memory,
      user_input
    })}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const json = safeJson(text);

    if (!json) {
      return res.status(502).json({
        error: "AI returned invalid JSON",
        raw: text.slice(0, 1000)
      });
    }

    return res.status(200).json(json);

  } catch (e) {
    console.error("api/story error:", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
