const SEARCH_STOPWORDS = new Set(
  "the a an and or but for with from this that these those what when where how why your you our its his her they them was were are is be been i we of in on at to it as by not no so if do did save saved about remember show find watch video status shorts index html www com".split(" ")
);

const FIELD_LIMITS = {
  title: 160,
  summary: 360,
  note: 500,
  extractedIntent: 240,
  project: 120,
  useCase: 240,
  host: 160,
  type: 40,
  tags: 8,
  people: 8,
};

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return value == null ? "" : String(value);
}

function clamp(value, max) {
  return text(value).trim().slice(0, max);
}

export function tokenizeQuery(query) {
  return (text(query).toLowerCase().match(/[a-z0-9']{2,}/g) || []).filter(
    (token) => !SEARCH_STOPWORDS.has(token)
  );
}

export function buildSearchDocument(item) {
  const links = Array.isArray(item.links)
    ? item.links.flatMap((link) => [link && link.role, link && link.url]).filter(Boolean)
    : [];

  return [
    item.title,
    item.summary,
    item.rawText,
    item.url,
    item.host,
    item.type,
    item.note,
    item.extractedIntent,
    item.project,
    item.useCase,
    item.tags,
    item.people,
    links,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map(text)
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function scoreSearchCandidate(item, query, tokens = tokenizeQuery(query)) {
  const normalizedQuery = text(query).trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const document = buildSearchDocument(item);
  let score = document.includes(normalizedQuery) ? 40 : 0;
  const fields = [
    [item.note, 6],
    [item.extractedIntent, 5],
    [item.project, 5],
    [item.useCase, 5],
    [item.people, 4],
    [item.title, 4],
    [item.tags, 4],
    [item.rawText, 3],
    [item.url, 3],
    [item.links && item.links.flatMap((link) => [link && link.role, link && link.url]), 3],
    [item.summary, 2],
    [item.host, 2],
    [item.type, 1],
  ];

  for (const [field, weight] of fields) {
    const haystack = text(field).toLowerCase();
    if (!haystack) continue;
    for (const token of tokens) {
      if (haystack.includes(token)) score += weight;
    }
  }

  return score;
}

export function searchItems(items, query) {
  const normalizedQuery = text(query).trim();
  if (!normalizedQuery) return items;
  const tokens = tokenizeQuery(normalizedQuery);

  return items
    .map((item, index) => ({ item, index, score: scoreSearchCandidate(item, normalizedQuery, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

export function selectAskCandidates(query, items, limit = 25) {
  const tokens = tokenizeQuery(query);
  const ranked = items
    .map((item, index) => ({ item, index, score: scoreSearchCandidate(item, query, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);

  if (ranked.length) return ranked;
  return [...items]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

export function serializeAskCandidates(query, items, { limit = 25, now = Date.now() } = {}) {
  return selectAskCandidates(query, items, limit).map((item) => ({
    id: text(item.id),
    title: clamp(item.title, FIELD_LIMITS.title),
    summary: clamp(item.summary, FIELD_LIMITS.summary),
    tags: (Array.isArray(item.tags) ? item.tags : [])
      .slice(0, FIELD_LIMITS.tags)
      .map((tag) => clamp(tag, 48)),
    note: clamp(item.note, FIELD_LIMITS.note),
    extractedIntent: clamp(item.extractedIntent, FIELD_LIMITS.extractedIntent),
    project: clamp(item.project, FIELD_LIMITS.project),
    people: (Array.isArray(item.people) ? item.people : [])
      .slice(0, FIELD_LIMITS.people)
      .map((person) => clamp(person, 80)),
    useCase: clamp(item.useCase, FIELD_LIMITS.useCase),
    host: clamp(item.host, FIELD_LIMITS.host),
    type: clamp(item.type, FIELD_LIMITS.type),
    ageDays: Number.isFinite(item.createdAt)
      ? Math.max(0, Math.floor((now - item.createdAt) / 864e5))
      : null,
    importance: ["low", "medium", "high"].includes(item.importance)
      ? item.importance
      : "medium",
  }));
}
