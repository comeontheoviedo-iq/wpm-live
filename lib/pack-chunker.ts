/** Air-ready pack note chunker — League / Table&form cards ≤ maxChars. */

/** Soft strip markdown heading markers for card bodies / titles. */
export function stripMdHeading(line: string): string {
  return (line || "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** Prefer a section heading inside a chunk as the card title. */
export function cardTitleForChunk(
  baseTitle: string,
  body: string,
  index: number,
  total: number
): string {
  const firstLine =
    (body || "")
      .split(/\n/)
      .map((l) => l.trim())
      .find(Boolean) || "";
  const heading =
    stripMdHeading(firstLine).replace(/^SECTION\s*\d+\s*:\s*/i, "").trim() ||
    null;
  const short =
    heading &&
    heading.length >= 8 &&
    heading.length <= 72 &&
    !/^[-*•]/.test(heading)
      ? heading
      : null;
  if (short) return short.slice(0, 80);
  if (total > 1) return `${baseTitle} · ${index + 1}/${total}`;
  return baseTitle;
}

/** Body without a leading ## heading line (title already carries it). */
export function bodyWithoutLeadingHeading(body: string): string {
  const lines = (body || "").split(/\n/);
  if (!lines.length) return body;
  if (/^#{1,6}\s/.test(lines[0].trim())) {
    const rest = lines.slice(1).join("\n").replace(/^\s+/, "");
    return rest.trim() || body.trim();
  }
  return body.trim();
}

/**
 * Split pack text into air-ready chunks (League / Table&form ≤ maxChars).
 * Prefers ## headings and --- separators, then paragraphs / sentences / bullets.
 */
export function chunkPackBody(text: string, maxChars = 280): string[] {
  const raw = (text || "").trim();
  if (!raw) return [];
  if (raw.length <= maxChars) return [raw];

  const sectionParts = raw
    .split(/(?:\n|^)(?=#{1,3}\s)|(?:\n|^)---+\s*(?:\n|$)/)
    .map((p) => p.trim())
    .filter(Boolean);
  const sections = sectionParts.length > 1 ? sectionParts : [raw];

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };

  const pushPiece = (piece: string) => {
    const p = piece.trim();
    if (!p) return;
    if (p.length > maxChars) {
      let rest = p;
      while (rest.length > maxChars) {
        let cut = rest.lastIndexOf(" ", maxChars);
        if (cut < maxChars * 0.5) cut = maxChars;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) {
        if (buf && buf.length + 1 + rest.length <= maxChars) {
          buf = `${buf} ${rest}`.trim();
        } else {
          flush();
          buf = rest;
        }
      }
      return;
    }
    if (!buf) {
      buf = p;
      return;
    }
    if (buf.length + 2 + p.length <= maxChars) {
      buf = `${buf}\n\n${p}`;
    } else {
      flush();
      buf = p;
    }
  };

  const chunkOneBlock = (block: string) => {
    if (block.length <= maxChars) {
      pushPiece(block);
      return;
    }
    const paras = block
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const para of paras.length ? paras : [block]) {
      if (para.length <= maxChars) {
        pushPiece(para);
        continue;
      }
      if (/^\s*[-*•]/.test(para) || /\n\s*[-*•]/.test(para)) {
        const bullets = para
          .split(/\n(?=\s*[-*•])/)
          .map((b) => b.trim())
          .filter(Boolean);
        for (const b of bullets) {
          if (b.length <= maxChars) pushPiece(b);
          else {
            const sentences = b.split(/(?<=[.!?])\s+/);
            for (const s of sentences) pushPiece(s);
          }
        }
        continue;
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const s of sentences) pushPiece(s);
    }
  };

  for (const sec of sections) {
    if (buf) flush();
    chunkOneBlock(sec);
  }
  flush();
  return chunks.filter(Boolean);
}

/** Build titled air cards from a long pack body. */
export function packBodyToCards(
  baseTitle: string,
  text: string,
  maxChars = 280
): { title: string; body: string }[] {
  const parts = chunkPackBody(text, maxChars);
  if (!parts.length) return [];
  return parts.map((rawBody, i) => {
    const title = cardTitleForChunk(baseTitle, rawBody, i, parts.length);
    let body = bodyWithoutLeadingHeading(rawBody);
    if (body.length > maxChars) {
      let cut = body.lastIndexOf(" ", maxChars);
      if (cut < maxChars * 0.5) cut = maxChars;
      body = body.slice(0, cut).trim();
    }
    return { title, body };
  });
}

/** Notes that must stay short in the League bucket. */
export function isLeagueBucketFatNote(n: {
  title?: string | null;
  entityType?: string | null;
  body?: string | null;
}): boolean {
  const title = String(n.title || "");
  if (n.entityType === "league") return true;
  return /league|table\s*&?\s*form|standings|season context|divisional|competition\b/i.test(
    title
  );
}

export const LEAGUE_NOTE_MAX_CHARS = 280;
