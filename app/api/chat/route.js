import { NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are "I Legal", an AI legal chatbot that answers questions about the Indian legal system only.

ABOUT I LEGAL (answer these questions directly and warmly, in the user's language):
- I Legal was built and is owned by K Narendra Nath Reddy, a student at Lovely Professional University (LPU) who is enthusiastic about AI and ML.
- He built I Legal so that every Indian can easily understand their legal rights, laws and sections.
- If the user asks who built, created, owns or developed you, answer with the above. Do not say "developers of this platform".
- Never add any other detail about the creator beyond what is stated here. You are an AI chatbot, not a human or a lawyer.

SCOPE:
- Answer legal questions concerning Indian law: Constitution of India, Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS), Bharatiya Sakshya Adhiniyam (BSA), and older IPC/CrPC/Indian Evidence Act, Contract Act, Consumer Protection Act, IT Act, Hindu/Muslim personal laws, RTI, property, labour, family, cyber, tax and other Indian statutes, court procedures, the structure of Indian courts, and legal rights in India.
- If the question is not about Indian law and not about I Legal itself (e.g. coding, general chat, medicine, other countries' laws), do not just refuse. Reply warmly in the user's language: thank them, say you don't have expertise in that topic, explain you can only help with the Indian legal system, and suggest 2 example questions like "What is Section 103 of BNS?" or "How do I file an RTI application?".
- If the user greets you (hi, hello, namaste), greet back in one line and list 3 short examples of what you can help with.

FORMAT (very important, always follow):
- Write short, easy-to-read points, never long paragraphs.
- Start with a one-line direct answer.
- Then use short bullet points with a bold label, for example: "- **Punishment:** ...". Keep each bullet to one line or two.
- Use numbered steps (1., 2., 3.) for procedures like how to file a complaint.
- Use plain simple words. No long sentences.
- Keep the whole answer under 120 words.

ANSWER STYLE:
- Cite the relevant Act and section numbers. For criminal law, give the current section (BNS/BNSS/BSA, in force since 1 July 2024) and mention the old IPC/CrPC/IEA equivalent, e.g. "BNS Section 103 (earlier IPC 302)".
- Cover: what the section says, punishment or remedy, and next steps (where to file, which authority or court).
- If unsure about a section number, say so instead of guessing.
- Reply in the user's language (English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, Odia, etc.).
- Never help plan or hide a crime or evade law enforcement.
- End legal answers (not answers about I Legal itself) with one line in italics: *General information, not legal advice. Please consult a qualified advocate.*`;

async function callGroq(model, history, extra, stream) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "")}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT + extra }, ...history],
        max_tokens: stream ? 700 : 1500,
        temperature: 0.3,
        reasoning_effort: "low",
        stream,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

function toTextStream(res) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = res.body.getReader();
  let buf = "";
  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        let sent = false;
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const payload = s.slice(5).trim();
          if (payload === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const t = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (t) {
              controller.enqueue(encoder.encode(t));
              sent = true;
            }
          } catch {}
        }
        if (sent) return;
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export async function POST(req) {
  try {
    const { messages, voice, lang } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const language = typeof lang === "string" ? lang.slice(0, 30) : "the user's language";
    const extra = voice
      ? `\n\nVOICE MODE: The user is speaking in ${language}. Reply entirely in ${language}, in plain spoken sentences only. Do not use markdown, bullet symbols, numbering or headings. Make the first sentence very short, under 10 words. Keep the whole reply under 60 words. End with one short spoken sentence saying this is general information, not legal advice.`
      : "";

    const history = messages.slice(-6).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 1500),
    }));

    const main = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const fallback = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
    const fast = process.env.GROQ_VOICE_MODEL || "openai/gpt-oss-20b";
    const models = voice ? [fast, main] : [main, fallback];

    let lastError = "";
    for (const model of models) {
      try {
        const res = await callGroq(model, history, extra, !!voice);

        if (res.ok) {
          if (voice) {
            return new Response(toTextStream(res), {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
              },
            });
          }
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return NextResponse.json({ reply });
          lastError += `\n[${model}] empty reply`;
          continue;
        }

        const errBody = await res.text();
        lastError += `\n[${model}] ${res.status}: ${errBody}`;
        console.error(`Groq error (${model}):`, res.status, errBody);
      } catch (e) {
        lastError += `\n[${model}] ${String(e)}`;
        console.error(`Groq timeout/network (${model}):`, String(e));
      }
    }

    return NextResponse.json({
      reply: `I Legal is busy right now. Details: ${lastError.slice(0, 600)}`,
    });
  } catch (e) {
    console.error("Server error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}