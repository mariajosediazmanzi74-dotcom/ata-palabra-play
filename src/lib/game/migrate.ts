import { uploadAudio } from "./cloud";
import { cacheGet, loadLegacyRecordings, markLegacyMigrated } from "./storage";
import type { GameData } from "./types";

/** Uploads audios that were saved only on this device before cloud saving existed. */
export async function uploadLegacyAudio(data: GameData) {
  let moved = 0;
  for (const c of data.conversations) {
    for (const l of c.lines) {
      if (!l.audioId) continue;
      const blob = await cacheGet(l.audioId);
      if (!blob) continue;
      await uploadAudio({ id: l.audioId, kind: "line", blob, name: l.audioName ?? "Audio", lineId: l.id, lineText: l.text });
      moved++;
    }
  }
  for (const r of loadLegacyRecordings()) {
    const blob = await cacheGet(r.id);
    if (!blob) continue;
    await uploadAudio({ id: r.id, kind: "recording", blob, name: r.name, durationMs: r.durationMs, lineText: r.lineText, createdAt: r.createdAt });
    moved++;
  }
  markLegacyMigrated();
  return moved;
}
