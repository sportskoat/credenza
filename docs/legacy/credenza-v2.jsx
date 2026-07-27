import { useState, useEffect, useRef } from "react";

// ————— Credenza v2 —————
// New: digest notecard deck, flip-to-write card backs, duplicate catch,
// voice capture, and resurfacing from the back of the shelf.

const WALNUT = "#261E17";
const PANEL = "#1D1712";
const PANEL_LT = "#322820";
const CREAM = "#F0E6D2";
const CREAM_DIM = "#B7A98E";
const MUSTARD = "#D9A441";
const LINE = "#3E3226";
const CARD_RULE = "#C46A5A"; // index-card red rule

const TYPES = {
  video: { label: "VIDEO", color: "#C4652F" },
  tweet: { label: "POST", color: "#6E8CA0" },
  audio: { label: "AUDIO", color: "#8A8B5C" },
  article: { label: "READ", color: "#D9A441" },
  note: { label: "NOTE", color: "#A8988A" },
};

const FILTERS = ["all", "video", "tweet", "article", "audio", "note"];
const FUTURA = "Futura, 'Century Gothic', 'Trebuchet MS', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// ————— URL parsing —————
function getYouTubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/+$/, "").toLowerCase();
  } catch (e) {
    return url.toLowerCase();
  }
}

function classify(raw) {
  const text = raw.trim();
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return { type: "note", url: null, text };
  const url = urlMatch[0];
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return { type: "note", url: null, text };
  }
  const ytId = getYouTubeId(url);
  if (ytId) return { type: "video", url, host, videoId: ytId };
  if (/(^|\.)(twitter\.com|x\.com)$/.test(host)) return { type: "tweet", url, host };
  if (/(^|\.)(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com)$/.test(host))
    return { type: "video", url, host };
  if (/(^|\.)(spotify\.com|soundcloud\.com|music\.apple\.com)$/.test(host))
    return { type: "audio", url, host };
  return { type: "article", url, host };
}

// ————— Claude —————
async function callClaude(prompt, useSearch) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function parseJson(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(clean.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

async function enrich(item) {
  const schema =
    'Respond with ONLY minified JSON, no markdown, exactly this shape: {"title":"short title","summary":"one crisp sentence","tags":["tag1","tag2","tag3"]}';
  let prompt;
  let useSearch = false;
  if (item.type === "note") {
    prompt = `Here is a personal note someone saved for later:\n"""${item.text}"""\nGive it a short title, a one-sentence summary, and 3 lowercase topic tags. ${schema}`;
  } else if (item.type === "tweet") {
    useSearch = true;
    prompt = `Look up this X/Twitter post: ${item.url}\nWrite it the way a person would RECALL this tweet later, not like a news abstract. The title should be a short punchy recall hook leading with the most vivid, weird, or memorable detail ("the girl up 25 days on an adderall binge", "guy who sold his house for bitcoin at the top"). The summary is one sentence with the real substance and meaning intact, naming who posted it. Include the poster's handle as one of the tags. ${schema}`;
  } else {
    useSearch = true;
    prompt = `Look up this link and figure out what it is: ${item.url}\nIf it is a video, say what the video covers and who made it. The summary should say why it is worth coming back to. ${schema}`;
  }
  const text = await callClaude(prompt, useSearch);
  const parsed = parseJson(text);
  if (!parsed) return { title: item.title, summary: "Saved. Couldn't fetch details.", tags: [] };
  return {
    title: parsed.title || item.title,
    summary: parsed.summary || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
  };
}

// ————— Storage —————
const KEY = "credenza-items-v1";

async function loadItems() {
  try {
    const r = await window.storage.get(KEY);
    return r ? JSON.parse(r.value) : [];
  } catch (e) {
    return [];
  }
}

async function saveItems(items) {
  try {
    await window.storage.set(KEY, JSON.stringify(items));
  } catch (e) {
    console.error("save failed", e);
  }
}

// ————— Small pieces —————
function TypeChip({ active, name, onClick }) {
  const meta = TYPES[name];
  const color = meta ? meta.color : MUSTARD;
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FUTURA,
        fontSize: 11,
        letterSpacing: "0.14em",
        padding: "7px 13px",
        borderRadius: 3,
        border: `1px solid ${active ? color : LINE}`,
        background: active ? color : "transparent",
        color: active ? WALNUT : CREAM_DIM,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s",
      }}
    >
      {name === "all" ? "ALL" : meta.label}
    </button>
  );
}

function Tag({ text }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        color: CREAM_DIM,
        border: `1px solid ${LINE}`,
        borderRadius: 3,
        padding: "3px 7px",
      }}
    >
      {text}
    </span>
  );
}

function SmallBtn({ children, onClick, fill, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FUTURA,
        fontSize: 11,
        letterSpacing: "0.12em",
        fontWeight: 700,
        color: fill ? WALNUT : CREAM_DIM,
        background: fill ? color || MUSTARD : "transparent",
        border: fill ? "none" : `1px solid ${LINE}`,
        borderRadius: 3,
        padding: "8px 14px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ————— Flip card —————
function Card({ item, expanded, onToggle, onDelete, onSaveNote, highlight }) {
  const meta = TYPES[item.type] || TYPES.note;
  const [imgOk, setImgOk] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [draft, setDraft] = useState(item.note || "");

  useEffect(() => {
    if (!expanded) setFlipped(false);
  }, [expanded]);

  const front = (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 14px 12px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <span
          style={{
            fontFamily: FUTURA,
            fontSize: 10,
            letterSpacing: "0.16em",
            color: meta.color,
            fontWeight: 700,
          }}
        >
          {meta.label}
        </span>
        {item.host && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: CREAM_DIM,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.host}
          </span>
        )}
        {item.note && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUSTARD, flexShrink: 0 }}>
            ✎
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontFamily: MONO,
            fontSize: 10,
            color: CREAM_DIM,
            flexShrink: 0,
          }}
        >
          {new Date(item.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>

      {item.videoId && imgOk && (
        <img
          src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
          alt=""
          onError={() => setImgOk(false)}
          style={{
            width: "100%",
            aspectRatio: "16/9",
            objectFit: "cover",
            borderRadius: 4,
            marginBottom: 8,
            display: "block",
          }}
        />
      )}

      <div
        style={{
          fontFamily: FUTURA,
          fontSize: 15,
          fontWeight: 600,
          color: CREAM,
          lineHeight: 1.35,
          marginBottom: item.summary ? 4 : 0,
        }}
      >
        {item.pending ? "Filing this away…" : item.title}
      </div>

      {item.summary && (
        <div
          style={{
            fontSize: 13,
            color: CREAM_DIM,
            lineHeight: 1.5,
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.summary}
        </div>
      )}

      {expanded && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
          {item.tags && item.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {item.tags.map((t, i) => (
                <Tag key={i} text={t} />
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: FUTURA,
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: WALNUT,
                  background: meta.color,
                  borderRadius: 3,
                  padding: "8px 14px",
                  textDecoration: "none",
                }}
              >
                OPEN
              </a>
            )}
            <SmallBtn onClick={() => setFlipped(true)}>FLIP ↻</SmallBtn>
            <SmallBtn onClick={() => onDelete(item.id)}>REMOVE</SmallBtn>
          </div>
        </div>
      )}
    </div>
  );

  const back = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ flex: 1, minWidth: 0, padding: "12px 14px", transform: "rotateY(180deg)" }}
    >
      <div
        style={{
          fontFamily: FUTURA,
          fontSize: 10,
          letterSpacing: "0.16em",
          fontWeight: 700,
          color: meta.color,
          marginBottom: 8,
        }}
      >
        BACK OF THE CARD
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Why'd you keep this? What's it for?"
        rows={3}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${LINE}`,
          outline: "none",
          resize: "none",
          color: CREAM,
          fontSize: 13.5,
          lineHeight: 1.6,
          fontFamily: "inherit",
          padding: "2px 0 8px",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <SmallBtn
          fill
          color={meta.color}
          onClick={() => {
            onSaveNote(item.id, draft.trim());
            setFlipped(false);
          }}
        >
          SAVE
        </SmallBtn>
        <SmallBtn onClick={() => setFlipped(false)}>FLIP BACK</SmallBtn>
      </div>
    </div>
  );

  return (
    <div style={{ perspective: 1200 }}>
      <div
        onClick={() => !flipped && onToggle()}
        style={{
          display: "flex",
          background: PANEL,
          borderRadius: 6,
          overflow: "hidden",
          border: `1px solid ${highlight ? MUSTARD : expanded ? meta.color : LINE}`,
          cursor: flipped ? "default" : "pointer",
          transition: "transform .5s, border-color .15s",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div style={{ width: 6, flexShrink: 0, background: meta.color }} />
        {flipped ? back : front}
      </div>
    </div>
  );
}

// ————— Digest deck (cream index cards) —————
function DigestDeck({ slides, onClose }) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const next = () => setI((v) => Math.min(v + 1, slides.length - 1));
  const prev = () => setI((v) => Math.max(v - 1, 0));
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,11,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={i < slides.length - 1 ? next : undefined}
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 260,
          background: CREAM,
          borderRadius: 6,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 2px 0 #DDD1B8",
          padding: "18px 20px 20px",
          color: WALNUT,
          cursor: i < slides.length - 1 ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* index-card red rule */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 46,
            height: 1.5,
            background: CARD_RULE,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            fontFamily: FUTURA,
            fontSize: 10,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "#8A6B2E",
            marginBottom: 24,
          }}
        >
          {slide.eyebrow}
        </div>
        <div
          style={{
            fontFamily: FUTURA,
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 10,
          }}
        >
          {slide.title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#4A3B2C" }}>{slide.body}</div>
        {slide.url && (
          <a
            href={slide.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-block",
              marginTop: 14,
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.12em",
              fontWeight: 700,
              color: CREAM,
              background: WALNUT,
              borderRadius: 3,
              padding: "8px 14px",
              textDecoration: "none",
            }}
          >
            OPEN
          </a>
        )}
      </div>

      {/* deck controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
        <button
          onClick={prev}
          disabled={i === 0}
          style={{
            background: "none",
            border: "none",
            color: i === 0 ? "#5A4A38" : CREAM,
            fontSize: 22,
            cursor: i === 0 ? "default" : "pointer",
          }}
        >
          ‹
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {slides.map((_, d) => (
            <div
              key={d}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: d === i ? MUSTARD : "#5A4A38",
              }}
            />
          ))}
        </div>
        <button
          onClick={next}
          disabled={i === slides.length - 1}
          style={{
            background: "none",
            border: "none",
            color: i === slides.length - 1 ? "#5A4A38" : CREAM,
            fontSize: 22,
            cursor: i === slides.length - 1 ? "default" : "pointer",
          }}
        >
          ›
        </button>
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 14,
          fontFamily: FUTURA,
          fontSize: 11,
          letterSpacing: "0.14em",
          fontWeight: 700,
          background: "transparent",
          border: `1px solid #5A4A38`,
          color: CREAM_DIM,
          borderRadius: 4,
          padding: "9px 18px",
          cursor: "pointer",
        }}
      >
        CLOSE
      </button>
    </div>
  );
}

// ————— App —————
export default function Credenza() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [dupe, setDupe] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [resurfaced, setResurfaced] = useState(null);
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const itemsRef = useRef(items);
  const recRef = useRef(null);
  itemsRef.current = items;

  useEffect(() => {
    loadItems().then((it) => {
      setItems(it);
      setLoaded(true);
      // resurface: one random item older than 14 days
      const old = it.filter((x) => Date.now() - x.ts > 14 * 864e5);
      if (old.length > 0) setResurfaced(old[Math.floor(Math.random() * old.length)].id);
    });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) setVoiceOk(true);
  }, []);

  const update = (next) => {
    setItems(next);
    saveItems(next);
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      try {
        recRef.current && recRef.current.stop();
      } catch (e) {}
      setListening(false);
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let final = "";
      for (let r = 0; r < ev.results.length; r++) final += ev.results[r][0].transcript;
      setInput(final);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setListening(false);
    }
  };

  const capture = async () => {
    const raw = input.trim();
    if (!raw || capturing) return;
    const base = classify(raw);
    // duplicate catch
    if (base.url) {
      const norm = normalizeUrl(base.url);
      const existing = itemsRef.current.find((x) => x.url && normalizeUrl(x.url) === norm);
      if (existing) {
        setDupe(existing.title);
        setExpandedId(existing.id);
        setInput("");
        setTimeout(() => setDupe(null), 3500);
        return;
      }
    }
    setCapturing(true);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const item = {
      id,
      ts: Date.now(),
      type: base.type,
      url: base.url,
      host: base.host || null,
      videoId: base.videoId || null,
      title: base.url ? base.url : raw.slice(0, 80),
      summary: base.type === "note" ? raw : "",
      text: base.type === "note" ? raw : null,
      tags: [],
      note: "",
      pending: true,
    };
    update([item, ...itemsRef.current]);
    setInput("");
    try {
      const info = await enrich(item);
      update(itemsRef.current.map((x) => (x.id === id ? { ...x, ...info, pending: false } : x)));
    } catch (e) {
      update(
        itemsRef.current.map((x) =>
          x.id === id
            ? { ...x, pending: false, summary: x.summary || "Saved. Details unavailable." }
            : x
        )
      );
    }
    setCapturing(false);
  };

  const buildDigest = async () => {
    if (digestLoading) return;
    const all = itemsRef.current;
    if (all.length === 0) return;
    setDigestLoading(true);
    const week = all.filter((x) => Date.now() - x.ts < 7 * 864e5);
    const older = all.filter((x) => Date.now() - x.ts > 30 * 864e5);
    const compact = all.map((x) => ({
      id: x.id,
      type: x.type,
      title: x.title,
      summary: x.summary,
      tags: x.tags,
      note: x.note || "",
      daysAgo: Math.floor((Date.now() - x.ts) / 864e5),
    }));
    try {
      const text = await callClaude(
        `Here is my saved-links vault as JSON:\n${JSON.stringify(
          compact
        )}\n\nBuild me a weekly digest. Pick up to 3 items actually worth my time this week (prefer items from the last 7 days; use older ones if the week is thin), and 1 "forgotten gem" older than 30 days if any exist. For each pick write one short punchy line on why it's worth it, in a warm, dry voice. Also write a one-sentence intro capturing the week's theme.\nRespond ONLY with minified JSON: {"intro":"...","picks":[{"id":"...","reason":"..."}],"forgotten":{"id":"...","reason":"..."} or null}`,
        false
      );
      const parsed = parseJson(text);
      const find = (id) => all.find((x) => x.id === id);
      const slides = [
        {
          eyebrow: "THIS WEEK ON THE SHELF",
          title: `${week.length} new ${week.length === 1 ? "thing" : "things"} stashed`,
          body: (parsed && parsed.intro) || "Here's what deserves a second look.",
        },
      ];
      ((parsed && parsed.picks) || []).forEach((p, idx) => {
        const it = find(p.id);
        if (it)
          slides.push({
            eyebrow: `WORTH YOUR TIME · ${idx + 1}`,
            title: it.title,
            body: p.reason || it.summary,
            url: it.url,
          });
      });
      if (parsed && parsed.forgotten && parsed.forgotten.id) {
        const it = find(parsed.forgotten.id);
        if (it)
          slides.push({
            eyebrow: "FROM THE BACK OF THE SHELF",
            title: it.title,
            body: parsed.forgotten.reason || it.summary,
            url: it.url,
          });
      } else if (older.length > 0) {
        const it = older[Math.floor(Math.random() * older.length)];
        slides.push({
          eyebrow: "FROM THE BACK OF THE SHELF",
          title: it.title,
          body: it.summary,
          url: it.url,
        });
      }
      slides.push({
        eyebrow: "THAT'S THE DECK",
        title: "Shelf's in good shape.",
        body: "Come back next week — or stash something worth digesting.",
      });
      setDigest(slides);
    } catch (e) {
      setDigest([
        {
          eyebrow: "DIGEST",
          title: "Couldn't build the deck",
          body: "The assistant didn't answer. Try again in a moment.",
        },
      ]);
    }
    setDigestLoading(false);
  };

  const ask = async () => {
    const q = search.trim();
    if (!q || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const compact = itemsRef.current.map((x) => ({
        type: x.type,
        title: x.title,
        summary: x.summary,
        tags: x.tags,
        note: x.note || "",
        date: new Date(x.ts).toISOString().slice(0, 10),
      }));
      const text = await callClaude(
        `Here is everything in my personal saved-links vault as JSON:\n${JSON.stringify(
          compact
        )}\n\nQuestion: ${q}\n\nAnswer briefly and conversationally in plain text (no markdown), referencing item titles where relevant. The "note" field is what I wrote on the back of the card — weigh it heavily. If nothing matches, say so.`,
        false
      );
      setAnswer(text || "No answer came back — try rephrasing.");
    } catch (e) {
      setAnswer("Couldn't reach the assistant. Try again in a moment.");
    }
    setAsking(false);
  };

  const remove = (id) => {
    update(itemsRef.current.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (resurfaced === id) setResurfaced(null);
  };

  const saveNote = (id, note) => {
    update(itemsRef.current.map((x) => (x.id === id ? { ...x, note } : x)));
  };

  const q = search.trim().toLowerCase();
  const visible = items.filter((x) => {
    if (filter !== "all" && x.type !== filter) return false;
    if (!q) return true;
    const hay = [x.title, x.summary, x.host, x.note, ...(x.tags || [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
  const resurfacedItem =
    resurfaced && filter === "all" && !q ? items.find((x) => x.id === resurfaced) : null;
  const shelfItems = resurfacedItem ? visible.filter((x) => x.id !== resurfaced) : visible;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: WALNUT,
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 7px)",
        color: CREAM,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "0 0 60px",
      }}
    >
      {digest && <DigestDeck slides={digest} onClose={() => setDigest(null)} />}

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "26px 16px 0" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FUTURA,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: MUSTARD,
              }}
            >
              CREDENZA
            </div>
            <div style={{ fontSize: 12.5, color: CREAM_DIM, marginTop: 3 }}>
              Everything you meant to come back to.
              {loaded && items.length > 0 && (
                <span style={{ fontFamily: MONO }}> · {items.length} saved</span>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={buildDigest}
              style={{
                fontFamily: FUTURA,
                fontSize: 11,
                letterSpacing: "0.14em",
                fontWeight: 700,
                background: "transparent",
                border: `1px solid ${MUSTARD}`,
                color: MUSTARD,
                borderRadius: 4,
                padding: "9px 14px",
                cursor: "pointer",
                marginTop: 4,
                flexShrink: 0,
              }}
            >
              {digestLoading ? "DEALING…" : "DIGEST"}
            </button>
          )}
        </div>

        {/* Capture bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: PANEL_LT,
            border: `1px solid ${listening ? MUSTARD : LINE}`,
            borderRadius: 6,
            padding: 8,
            marginBottom: 10,
            transition: "border-color .2s",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                capture();
              }
            }}
            placeholder={listening ? "Listening…" : "Paste a link, or jot a note…"}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: CREAM,
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: "inherit",
              padding: "6px 4px",
            }}
          />
          {voiceOk && (
            <button
              onClick={toggleVoice}
              title="Dictate a note"
              style={{
                fontSize: 15,
                alignSelf: "stretch",
                background: listening ? MUSTARD : "transparent",
                color: listening ? WALNUT : CREAM_DIM,
                border: `1px solid ${listening ? MUSTARD : LINE}`,
                borderRadius: 4,
                padding: "0 11px",
                cursor: "pointer",
              }}
            >
              ●
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) setInput(text.trim());
              } catch (e) {}
            }}
            title="Paste from clipboard"
            style={{
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.12em",
              fontWeight: 700,
              alignSelf: "stretch",
              background: "transparent",
              color: CREAM_DIM,
              border: `1px solid ${LINE}`,
              borderRadius: 4,
              padding: "0 12px",
              cursor: "pointer",
            }}
          >
            PASTE
          </button>
          <button
            onClick={capture}
            disabled={capturing || !input.trim()}
            style={{
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.14em",
              fontWeight: 700,
              alignSelf: "stretch",
              background: input.trim() && !capturing ? MUSTARD : LINE,
              color: input.trim() && !capturing ? WALNUT : CREAM_DIM,
              border: "none",
              borderRadius: 4,
              padding: "0 16px",
              cursor: input.trim() && !capturing ? "pointer" : "default",
              transition: "background .15s",
            }}
          >
            {capturing ? "…" : "STASH"}
          </button>
        </div>

        {dupe && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              color: MUSTARD,
              border: `1px solid ${MUSTARD}`,
              borderRadius: 5,
              padding: "8px 12px",
              marginBottom: 10,
            }}
          >
            Already on the shelf: "{dupe}" — opened it below.
          </div>
        )}

        {/* Search / Ask */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (answer) setAnswer(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            placeholder="Search, or ask a question…"
            style={{
              flex: 1,
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 5,
              outline: "none",
              color: CREAM,
              fontSize: 13.5,
              padding: "10px 12px",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={ask}
            disabled={asking || !search.trim()}
            style={{
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.14em",
              fontWeight: 700,
              background: "transparent",
              color: search.trim() ? MUSTARD : CREAM_DIM,
              border: `1px solid ${search.trim() ? MUSTARD : LINE}`,
              borderRadius: 5,
              padding: "0 14px",
              cursor: search.trim() ? "pointer" : "default",
            }}
          >
            {asking ? "…" : "ASK"}
          </button>
        </div>

        {/* Answer panel */}
        {answer && (
          <div
            style={{
              background: PANEL_LT,
              border: `1px solid ${MUSTARD}`,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: FUTURA,
                fontSize: 10,
                letterSpacing: "0.16em",
                fontWeight: 700,
                color: MUSTARD,
                marginBottom: 6,
              }}
            >
              FROM THE SHELF
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {answer}
            </div>
            <button
              onClick={() => setAnswer(null)}
              style={{
                marginTop: 10,
                fontFamily: FUTURA,
                fontSize: 10,
                letterSpacing: "0.14em",
                fontWeight: 700,
                background: "transparent",
                border: "none",
                color: CREAM_DIM,
                cursor: "pointer",
                padding: 0,
              }}
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 7,
            overflowX: "auto",
            paddingBottom: 4,
            marginBottom: 14,
          }}
        >
          {FILTERS.map((f) => (
            <TypeChip key={f} name={f} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>

        {/* Resurfaced */}
        {resurfacedItem && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 7,
              }}
            >
              <span
                style={{
                  fontFamily: FUTURA,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  color: MUSTARD,
                }}
              >
                FROM THE BACK OF THE SHELF
              </span>
              <button
                onClick={() => setResurfaced(null)}
                style={{
                  marginLeft: "auto",
                  fontFamily: MONO,
                  fontSize: 10.5,
                  background: "none",
                  border: "none",
                  color: CREAM_DIM,
                  cursor: "pointer",
                }}
              >
                dismiss
              </button>
            </div>
            <Card
              item={resurfacedItem}
              highlight
              expanded={expandedId === resurfacedItem.id}
              onToggle={() =>
                setExpandedId(expandedId === resurfacedItem.id ? null : resurfacedItem.id)
              }
              onDelete={remove}
              onSaveNote={saveNote}
            />
          </div>
        )}

        {/* Shelf */}
        {!loaded ? (
          <div style={{ color: CREAM_DIM, fontSize: 13, padding: "30px 0", textAlign: "center" }}>
            Opening the credenza…
          </div>
        ) : shelfItems.length === 0 && !resurfacedItem ? (
          <div
            style={{
              border: `1px dashed ${LINE}`,
              borderRadius: 6,
              padding: "36px 20px",
              textAlign: "center",
              color: CREAM_DIM,
              fontSize: 13.5,
              lineHeight: 1.6,
            }}
          >
            {items.length === 0
              ? "Empty shelf. Paste your first link above — a YouTube video, a tweet, an article — and it gets titled, summarized, and tagged automatically. Flip any card over to write on the back."
              : "Nothing matches. Clear the search or switch shelves."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shelfItems.map((item) => (
              <Card
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onDelete={remove}
                onSaveNote={saveNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
