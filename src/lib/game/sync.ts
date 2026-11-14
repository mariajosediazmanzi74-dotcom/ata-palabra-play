import { DEFAULT_DATA } from "./defaults";
import type { Conversation, GameData, Speaker } from "./types";

export type AudioKind = "recording" | "line";

/** Every file lives inside the owner's own folder: `<userId>/<kind>/<id>.<ext>`. */
export function audioStoragePath(userId: string, kind: AudioKind, id: string, ext: string) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${userId}/${kind}/${safeId}.${ext}`;
}

/** Turns whatever is stored in the cloud into valid game data (never crashes on bad rows). */
export function normalizeGameData(raw: { version?: unknown; names?: unknown; conversations?: unknown } | null | undefined): GameData {
  const convs = Array.isArray(raw?.conversations) ? (raw.conversations as Conversation[]) : null;
  if (!convs || convs.length === 0) return structuredClone(DEFAULT_DATA);
  const names = (raw?.names && typeof raw.names === "object" ? raw.names : {}) as Partial<Record<Speaker, string>>;
  return {
    version: 1,
    names: { ...DEFAULT_DATA.names, ...names },
    conversations: convs.filter((c) => c && typeof c.id === "string" && Array.isArray(c.lines)),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Three-way merge used when two devices saved at the same time.
 * `base` is the last version both agreed on. Whatever this device changed wins for that
 * conversation/name; everything the other device changed is kept.
 */
export function mergeGameData(base: GameData, local: GameData, remote: GameData): GameData {
  const baseConv = new Map(base.conversations.map((c) => [c.id, c]));
  const localConv = new Map(local.conversations.map((c) => [c.id, c]));
  const remoteIds = new Set(remote.conversations.map((c) => c.id));

  const conversations: Conversation[] = [];
  for (const r of remote.conversations) {
    const l = localConv.get(r.id);
    const b = baseConv.get(r.id);
    if (l) conversations.push(b && same(l, b) ? r : l);
    else if (!b) conversations.push(r); // added on the other device
    else if (!same(r, b)) conversations.push(r); // deleted here but edited there: keep their edits
    // else: deleted here, untouched there → stays deleted
  }
  for (const l of local.conversations) {
    if (remoteIds.has(l.id)) continue;
    const b = baseConv.get(l.id);
    if (!b) conversations.push(l); // added on this device
    else if (!same(l, b)) conversations.push(l); // deleted there but edited here: keep ours
  }

  const names = { ...remote.names };
  for (const s of ["him", "her"] as Speaker[]) {
    if (local.names[s] !== base.names[s]) names[s] = local.names[s];
  }
  return { version: 1, names, conversations: conversations.length ? conversations : local.conversations };
}

/** Line audio ids still used by some conversation. */
export function referencedAudioIds(data: GameData): Set<string> {
  const ids = new Set<string>();
  for (const c of data.conversations) for (const l of c.lines) if (l.audioId) ids.add(l.audioId);
  return ids;
}
