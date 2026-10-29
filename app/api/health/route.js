export async function GET() {
  const raw = process.env.GROQ_API_KEY || "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  let groqStatus = null;
  if (key) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      groqStatus = r.status;
    } catch (e) {
      groqStatus = String(e);
    }
  }
  return Response.json({
    hasKey: !!key,
    keyStart: key.slice(0, 4),
    keyEnd: key.slice(-4),
    keyLength: key.length,
    hadExtraSpacesOrQuotes: raw !== key,
    groqStatus,
    env: process.env.VERCEL_ENV || null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
  });
}