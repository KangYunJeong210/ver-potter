// js/api.js
export async function callStoryAPI(payload) {
    const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    // 서버가 에러를 주면 텍스트도 같이 보고 싶어서 분기
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (!res.ok) {
        const msg = data?.error || text || "API Error";
        throw new Error(msg);
    }

    if (!data) throw new Error("Invalid JSON from /api/story");
    return data;
}
