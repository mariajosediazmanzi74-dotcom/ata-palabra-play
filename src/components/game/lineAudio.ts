import type { Dispatch, SetStateAction } from "react";
import { deleteAudio, uploadAudio } from "@/lib/game/cloud";
import { uid } from "@/lib/game/logic";
import type { GameData } from "@/lib/game/types";

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|oga|webm|flac|opus)$/i.test(file.name);
}

/** Uploads an audio to the cloud and links it to a dialogue line (replacing any previous one). */
export async function attachAudioToLine(
  data: GameData,
  setData: Dispatch<SetStateAction<GameData>>,
  lineId: string,
  blob: Blob,
  name: string,
  durationMs = 0,
) {
  const line = data.conversations.flatMap((c) => c.lines).find((l) => l.id === lineId);
  const old = line?.audioId;
  const audioId = uid("aud");
  await uploadAudio({ id: audioId, kind: "line", blob, name, durationMs, lineId, lineText: line?.text ?? null });
  setData((d) => ({
    ...d,
    conversations: d.conversations.map((c) => ({
      ...c,
      lines: c.lines.map((l) => (l.id === lineId ? { ...l, audioId, audioName: name } : l)),
    })),
  }));
  if (old) void deleteAudio(old).catch(() => undefined);
}

export async function detachAudioFromLine(
  setData: Dispatch<SetStateAction<GameData>>,
  lineId: string,
  audioId: string,
) {
  setData((d) => ({
    ...d,
    conversations: d.conversations.map((c) => ({
      ...c,
      lines: c.lines.map((l) => (l.id === lineId ? { ...l, audioId: null, audioName: null } : l)),
    })),
  }));
  await deleteAudio(audioId).catch(() => undefined);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
