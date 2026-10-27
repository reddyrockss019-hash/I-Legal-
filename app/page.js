"use client";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import "./chat.css";

const LANGS = [
  { code: "en-IN", label: "English", name: "English" },
  { code: "hi-IN", label: "हिन्दी", name: "Hindi" },
  { code: "te-IN", label: "తెలుగు", name: "Telugu" },
  { code: "ta-IN", label: "தமிழ்", name: "Tamil" },
  { code: "kn-IN", label: "ಕನ್ನಡ", name: "Kannada" },
  { code: "ml-IN", label: "മലയാളം", name: "Malayalam" },
  { code: "mr-IN", label: "मराठी", name: "Marathi" },
  { code: "bn-IN", label: "বাংলা", name: "Bengali" },
  { code: "gu-IN", label: "ગુજરાતી", name: "Gujarati" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ", name: "Punjabi" },
  { code: "ur-IN", label: "اردو", name: "Urdu" },
  { code: "or-IN", label: "ଓଡ଼ିଆ", name: "Odia" },
];

const TOPICS = [
  { t: "Constitution", d: "Fundamental Rights and duties.", q: "Explain the Fundamental Rights in the Constitution of India." },
  { t: "Crimes and punishment", d: "The Bharatiya Nyaya Sanhita.", q: "What is the Bharatiya Nyaya Sanhita and how is it different from the IPC?" },
  { t: "FIR, arrest and bail", d: "Criminal procedure under BNSS.", q: "How do FIR, arrest and bail work under the BNSS?" },
  { t: "Consumer rights", d: "Complaints about goods and services.", q: "How do I file a consumer complaint?" },
  { t: "Right to Information", d: "Ask any public office for records.", q: "How do I file an RTI application?" },
  { t: "Cyber law", d: "Online fraud and data misuse.", q: "What should I do if I am a victim of online fraud in India?" },
  { t: "Family law", d: "Marriage, divorce and maintenance.", q: "What are the laws on divorce and maintenance in India?" },
  { t: "Property law", d: "Buying, renting and inheriting.", q: "What documents do I need to buy property in India?" },
];

const COURTS = [
  { t: "Supreme Court of India", d: "Constitutional cases and final appeals.", q: "What does the Supreme Court of India do?" },
  { t: "High Courts", d: "Appeals and writ petitions in each state.", q: "What is a High Court and what is a writ petition?" },
  { t: "District and Sessions Courts", d: "Main trial courts in a district.", q: "What cases do District and Sessions Courts hear?" },
  { t: "Magistrate Courts", d: "Local disputes and minor offences.", q: "What do Magistrate courts handle in India?" },
  { t: "Tribunals and Commissions", d: "Specialised forums, such as consumer commissions.", q: "What are tribunals in India and when do I approach one?" },
];

const BOOKS = [
  { t: "The Constitution of India", q: "Explain the structure of the Constitution of India." },
  { t: "Bharatiya Nyaya Sanhita (BNS)", q: "What is the Bharatiya Nyaya Sanhita and how is it different from the IPC?" },
  { t: "Bharatiya Nagarik Suraksha Sanhita (BNSS)", q: "How do FIR, arrest and bail work under the BNSS?" },
  { t: "Bharatiya Sakshya Adhiniyam (BSA)", q: "What is the Bharatiya Sakshya Adhiniyam?" },
  { t: "Indian Contract Act, 1872", q: "What makes a contract valid under the Indian Contract Act?" },
  { t: "Consumer Protection Act, 2019", q: "How do I file a consumer complaint?" },
  { t: "Right to Information Act, 2005", q: "How do I file an RTI application?" },
  { t: "Information Technology Act, 2000", q: "What offences does the IT Act cover?" },
];

const BOOK_COLORS = [
  ["#6d3fc7", "#2c1466"],
  ["#4f46b8", "#1c1a5e"],
  ["#8a3fa8", "#43144f"],
  ["#3f5fc4", "#17255e"],
  ["#5b3aa8", "#25155c"],
  ["#7a2f86", "#3a123f"],
];
const BOOK_W = [100, 95, 98, 93, 97, 94];
const BOOK_ML = [0, 6, 2, 10, 4, 8];

const FACTS = [
  "The Constitution of India came into force on 26 January 1950.",
  "Fundamental Rights are in Articles 12 to 35.",
  "BNS, BNSS and BSA replaced the IPC, CrPC and Evidence Act on 1 July 2024.",
];

const STATUS = {
  idle: "Tap the circle and speak",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking. Tap to interrupt",
};

const END = /[.!?।॥؟۔]/;
const ABBR = /\b(Sec|Secs|Art|No|Dr|Mr|Mrs|vs|Ch|Cl)$/i;

function splitSentences(buf) {
  const out = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (!END.test(c)) continue;
    if (c === ".") {
      const nx = buf[i + 1];
      if (nx === undefined || /\d/.test(nx) || ABBR.test(buf.slice(start, i))) continue;
    }
    let j = i + 1;
    while (j < buf.length && /["')\]]/.test(buf[j])) j++;
    out.push(buf.slice(start, j));
    start = j;
    i = j - 1;
  }
  return { sentences: out, rest: buf.slice(start) };
}

function cleanForSpeech(s) {
  return s
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/[*#_`>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadVoices() {
  const s = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!s) return Promise.resolve([]);
  const v = s.getVoices();
  if (v.length) return Promise.resolve(v);
  return new Promise((resolve) => {
    const done = () => resolve(s.getVoices());
    s.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [vstate, setVstate] = useState("idle");
  const [heard, setHeard] = useState("");
  const [replyText, setReplyText] = useState("");
  const [vnote, setVnote] = useState("");
  const [lang, setLang] = useState(LANGS[0]);

  const scrollRef = useRef(null);
  const messagesRef = useRef([]);
  const loadingRef = useRef(false);
  const langRef = useRef(LANGS[0]);
  const recRef = useRef(null);
  const listeningRef = useRef(false);
  const voiceOn = useRef(false);
  const silenceRef = useRef(null);
  const turnRef = useRef(0);
  const queueRef = useRef([]);
  const speakingRef = useRef(false);
  const streamDoneRef = useRef(true);
  const haltedRef = useRef(false);
  const voicesRef = useRef([]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && (messages.length > 0 || loading)) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  /* ---------- text chat ---------- */
  async function send(override) {
    const text = (override ?? input).trim();
    if (!text || loadingRef.current) return;
    const next = [...messagesRef.current, { role: "user", content: text }];
    messagesRef.current = next;
    setMessages(next);
    setInput("");
    setLoading(true);
    loadingRef.current = true;

    let reply = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const errText =
        typeof data.error === "string" ? data.error.slice(0, 300) : "Something went wrong.";
      reply = data.reply || `Error: ${errText}`;
    } catch (e) {
      reply = `Network error: ${String(e).slice(0, 200)}`;
    }

    const done = [...messagesRef.current, { role: "assistant", content: reply }];
    messagesRef.current = done;
    setMessages(done);
    setLoading(false);
    loadingRef.current = false;
  }

  function newChat() {
    messagesRef.current = [];
    setMessages([]);
  }

  function goHome() {
    if (voiceOn.current) closeVoice();
    newChat();
    setInput("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- voice mode ---------- */
  function pickVoice(code) {
    const all = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    const norm = (x) => x.lang.replace("_", "-").toLowerCase();
    return (
      all.find((x) => norm(x) === code.toLowerCase()) ||
      all.find((x) => norm(x).startsWith(code.slice(0, 2).toLowerCase())) ||
      null
    );
  }

  function maybeResume() {
    if (!voiceOn.current || haltedRef.current) return;
    if (speakingRef.current || queueRef.current.length) return;
    if (!streamDoneRef.current) return;
    listen();
  }

  function pump() {
    if (speakingRef.current) return;
    const synth = window.speechSynthesis;
    const next = queueRef.current.shift();
    if (!next) {
      maybeResume();
      return;
    }
    const code = langRef.current.code;
    const voice = pickVoice(code);
    if (!voice && !code.startsWith("en")) {
      queueRef.current = [];
      haltedRef.current = true;
      setVnote("No voice for this language is installed on this device. The reply is on screen.");
      setVstate("idle");
      return;
    }
    const u = new SpeechSynthesisUtterance(next);
    u.lang = code;
    if (voice) u.voice = voice;
    u.rate = 1.05;
    const token = turnRef.current;
    u.onstart = () => setVstate("speaking");
    const finish = () => {
      speakingRef.current = false;
      if (token !== turnRef.current) return;
      pump();
    };
    u.onend = finish;
    u.onerror = finish;
    speakingRef.current = true;
    synth.speak(u);
  }

  function enqueueSpeech(text) {
    const clean = cleanForSpeech(text);
    if (!/[\p{L}\p{N}]/u.test(clean)) return;
    queueRef.current.push(clean);
    pump();
  }

  function setAssistant(content) {
    const arr = [...messagesRef.current];
    arr[arr.length - 1] = { role: "assistant", content };
    messagesRef.current = arr;
    setMessages(arr);
    setReplyText(content);
  }

  async function voiceTurn(text) {
    const turn = ++turnRef.current;
    queueRef.current = [];
    speakingRef.current = false;
    streamDoneRef.current = false;
    haltedRef.current = false;
    window.speechSynthesis?.cancel();

    const history = [...messagesRef.current, { role: "user", content: text }];
    messagesRef.current = [...history, { role: "assistant", content: "" }];
    setMessages(messagesRef.current);
    setReplyText("");

    let full = "";
    let buf = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, voice: true, lang: langRef.current.name }),
      });
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const data = await res.json();
        full = data.reply || `Error: ${String(data.error || "Something went wrong.").slice(0, 200)}`;
        setAssistant(full);
        if (data.reply && !data.reply.includes("Details:")) {
          splitSentences(full + " ").sentences.forEach(enqueueSpeech);
        } else {
          haltedRef.current = true;
          setVnote("The AI service is busy. Please try again in a moment.");
          setVstate("idle");
        }
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (turn !== turnRef.current) {
            reader.cancel();
            return;
          }
          const chunk = dec.decode(value, { stream: true });
          full += chunk;
          buf += chunk;
          setAssistant(full);
          const { sentences, rest } = splitSentences(buf);
          buf = rest;
          sentences.forEach(enqueueSpeech);
        }
        if (buf.trim()) enqueueSpeech(buf);
      }
    } catch (e) {
      full = full || `Network error: ${String(e).slice(0, 200)}`;
      setAssistant(full);
      haltedRef.current = true;
      setVstate("idle");
    }
    if (turn === turnRef.current) {
      streamDoneRef.current = true;
      maybeResume();
    }
  }

  function listen() {
    if (!voiceOn.current || listeningRef.current) return;
    const SR =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setVnote("Voice input is not supported in this browser. Please use Chrome or Edge.");
      setVstate("idle");
      return;
    }
    haltedRef.current = false;
    window.speechSynthesis?.cancel();

    const rec = new SR();
    rec.lang = langRef.current.code;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    setHeard("");
    setVnote("");

    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      finalText = t;
      setHeard(t);
      clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => {
        try {
          rec.stop();
        } catch {}
      }, 700);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech") setVnote("I did not hear anything. Tap the circle and speak.");
      else if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setVnote("Microphone access is blocked. Allow it in your browser settings.");
      else if (e.error === "language-not-supported")
        setVnote("This browser cannot listen in this language. Try Chrome on Android.");
      else if (e.error === "network")
        setVnote("Speech recognition needs an internet connection.");
      else if (e.error !== "aborted") setVnote(`Voice error: ${e.error}`);
    };
    rec.onend = () => {
      listeningRef.current = false;
      clearTimeout(silenceRef.current);
      if (!voiceOn.current) return;
      const text = finalText.trim();
      if (!text) {
        setVstate("idle");
        return;
      }
      setVstate("thinking");
      voiceTurn(text);
    };

    recRef.current = rec;
    listeningRef.current = true;
    setVstate("listening");
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setVstate("idle");
    }
  }

  function interrupt() {
    turnRef.current++;
    queueRef.current = [];
    speakingRef.current = false;
    streamDoneRef.current = true;
    window.speechSynthesis?.cancel();
  }

  async function openVoice() {
    voiceOn.current = true;
    setVoiceOpen(true);
    setHeard("");
    setReplyText("");
    setVnote("");
    try {
      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""));
    } catch {}
    voicesRef.current = await loadVoices();
    listen();
  }

  function closeVoice() {
    voiceOn.current = false;
    clearTimeout(silenceRef.current);
    interrupt();
    try {
      recRef.current?.abort();
    } catch {}
    listeningRef.current = false;
    setVstate("idle");
    setVoiceOpen(false);
  }

  function orbTap() {
    if (vstate === "listening") {
      clearTimeout(silenceRef.current);
      try {
        recRef.current?.stop();
      } catch {}
      return;
    }
    interrupt();
    listen();
  }

  function pickLang(e) {
    const next = LANGS.find((l) => l.code === e.target.value) || LANGS[0];
    langRef.current = next;
    setLang(next);
  }

  const empty = messages.length === 0;

  return (
    <div className={`app ${empty ? "" : "chatting"}`}>
      <header className="banner">
        <div className="title-wrap">
          <span className="rule" aria-hidden="true" />
          <h1 className="title-plate">
            <button
              className="title-btn"
              onClick={goHome}
              aria-label="I Legal, go to the home page"
              title="Go to home"
            >
              I Legal
            </button>
          </h1>
          <span className="rule r" aria-hidden="true" />
        </div>
        <p className="tag-motto">JUSTICE · LIBERTY · EQUALITY · FRATERNITY</p>
        <p className="tag-en">INDIAN LAW, IN PLAIN WORDS</p>
        <div className="facts" aria-label="Quick facts">
          {FACTS.map((f) => (
            <div key={f} className="fact">
              {f}
            </div>
          ))}
        </div>
      </header>

      <div className="stage">
        <aside className="left">
          <section className="panel courts">
            <h2 className="panel-title">How Indian courts are arranged</h2>
            <ol className="flow">
              {COURTS.map((x, i) => (
                <li key={x.t}>
                  <button className="step" onClick={() => send(x.q)}>
                    <span className="num">{i + 1}</span>
                    <span className="stext">
                      <b>{x.t}</b>
                      <span>{x.d}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel shelf">
            <h2 className="panel-title">The Indian law shelf</h2>
            <div className="books" style={{ "--leather": "url(/images/leather.jpg)" }}>
              {BOOKS.map((b, i) => (
                <button
                  key={b.t}
                  className="book"
                  onClick={() => send(b.q)}
                  aria-label={b.t}
                  style={{
                    "--w": `${BOOK_W[i % 6]}%`,
                    "--ml": `${BOOK_ML[i % 6]}px`,
                    "--i": i,
                  }}
                >
                  <span className="spine">
                    <span className="btitle">{b.t}</span>
                  </span>
                  <span className="pages" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="panel chat">
          <div className="chat-head">
            <h2>Ask I Legal</h2>
            {!empty && (
              <button className="ghost" onClick={newChat}>
                New chat
              </button>
            )}
          </div>

          <div className="scroll" ref={scrollRef}>
            <div className="col">
              {empty && (
                <div className="home">
                  <div className="intro">
                    <h2>Learn Indian law, one question at a time</h2>
                    <p>
                      Type or speak in your own language. Every answer names the Act and section
                      and tells you where to go next.
                    </p>
                  </div>
                  <div className="grid">
                    {TOPICS.map((x) => (
                      <button key={x.t} className="card" onClick={() => send(x.q)}>
                        <b>{x.t}</b>
                        <span>{x.d}</span>
                      </button>
                    ))}
                  </div>
                  <p className="credit">
                    Built by K Narendra Nath Reddy, LPU. General information only, not legal advice.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`row ${m.role === "user" ? "user" : "bot"}`}>
                  <div className={`bubble ${m.role === "user" ? "me" : "ai"}`}>
                    {m.role === "user" ? (
                      m.content
                    ) : m.content ? (
                      <div className="md">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="dots" aria-label="I Legal is typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="row bot">
                  <div className="bubble ai" aria-label="I Legal is typing">
                    <div className="dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="dock">
            <div className="field">
              <input
                value={input}
                placeholder="Ask a legal question about India"
                aria-label="Your question"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button className="mic" onClick={openVoice} aria-label="Start voice chat">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Voice</span>
              </button>
              <button
                className="send"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Send question"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="note">I Legal gives general information, not legal advice.</p>
          </div>
        </section>

        <aside className="right">
          <figure className="shot">
            <div
              className="photo"
              role="img"
              aria-label="Lady Justice holding the scales of justice, with a gavel and law books"
              style={{ backgroundImage: "url(/images/justice.png)" }}
            />
            <figcaption>
              <q>Equality before the law.</q>
              <small>
                Article 14 of the Constitution of India says the State cannot deny any person
                equality before the law.
              </small>
            </figcaption>
          </figure>
        </aside>
      </div>

      {voiceOpen && (
        <div className="voice" role="dialog" aria-label="Voice chat">
          <h2>Talk to I Legal</h2>
          <select className="langsel" value={lang.code} onChange={pickLang} aria-label="Language">
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} ({l.name})
              </option>
            ))}
          </select>
          <button className={`orb ${vstate}`} onClick={orbTap} aria-label="Microphone">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="vstatus">{STATUS[vstate]}</div>
          <div className="heard">{heard}</div>
          <div className="reply-live">{replyText}</div>
          <div className="vnote">{vnote}</div>
          <button className="endbtn" onClick={closeVoice}>
            End voice chat
          </button>
        </div>
      )}
    </div>
  );
}