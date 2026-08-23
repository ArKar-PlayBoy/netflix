export type VttCue = { start: number; end: number; text: string };

function toSeconds(stamp: string): number {
  // "00:01:02.345" | "01:02.345" → seconds
  const parts = stamp.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function cleanLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, "") // strip <i>, <c.class>, timestamp tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trimEnd();
}

/** Minimal WebVTT parser: cue timing + plain text. Ignores NOTE/STYLE/regions. */
export function parseVtt(raw: string): VttCue[] {
  const cues: VttCue[] = [];
  const lines = raw.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("-->")) continue;
    const [from, to] = line.split("-->");
    if (!to) continue;
    const start = toSeconds(from);
    const end = toSeconds(to.trim().split(" ")[0]);
    const text: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === "" || lines[j].includes("-->")) break;
      text.push(cleanLine(lines[j]));
    }
    const body = text.join("\n").trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}
