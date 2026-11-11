import type { Conversation, DialogueLine, Speaker } from "./types";

export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export const oppositeSpeaker = (s: Speaker): Speaker => (s === "him" ? "her" : "him");

export function createLine(speaker: Speaker, id: string = uid("line")): DialogueLine {
  return { id, speaker, text: "", translation: "", expression: "talk", audioId: null };
}

/** Adds a reply right after `afterId`, spoken by the other character. */
export function insertReply(conv: Conversation, afterId: string, newId?: string): Conversation {
  const idx = conv.lines.findIndex((l) => l.id === afterId);
  if (idx === -1) return conv;
  const reply = createLine(oppositeSpeaker(conv.lines[idx].speaker), newId);
  const lines = [...conv.lines];
  lines.splice(idx + 1, 0, reply);
  return { ...conv, lines };
}

/** Appends a line at the end; it alternates speaker with the last line (first line: him). */
export function appendLine(conv: Conversation, newId?: string): Conversation {
  const last = conv.lines[conv.lines.length - 1];
  const speaker: Speaker = last ? oppositeSpeaker(last.speaker) : "him";
  return { ...conv, lines: [...conv.lines, createLine(speaker, newId)] };
}

export function updateLine(
  conv: Conversation,
  id: string,
  patch: Partial<Omit<DialogueLine, "id">>,
): Conversation {
  return { ...conv, lines: conv.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

export function removeLine(conv: Conversation, id: string): Conversation {
  return { ...conv, lines: conv.lines.filter((l) => l.id !== id) };
}

export function moveLine(conv: Conversation, id: string, dir: -1 | 1): Conversation {
  const idx = conv.lines.findIndex((l) => l.id === id);
  const target = idx + dir;
  if (idx === -1 || target < 0 || target >= conv.lines.length) return conv;
  const lines = [...conv.lines];
  [lines[idx], lines[target]] = [lines[target], lines[idx]];
  return { ...conv, lines };
}

/** Next line in a conversation; `finished` once the last line has been played. */
export function advance(index: number, length: number): { index: number; finished: boolean } {
  if (index + 1 < length) return { index: index + 1, finished: false };
  return { index: Math.max(0, Math.min(index, length - 1)), finished: true };
}

/** Next conversation, wrapping back to the first one. */
export function nextConversationIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

/** Lines that have real text (empty drafts are skipped while playing). */
export function playableLines(conv: Conversation | undefined): DialogueLine[] {
  return conv ? conv.lines.filter((l) => l.text.trim().length > 0) : [];
}
