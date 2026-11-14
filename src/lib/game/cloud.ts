import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { extensionFor } from "./recorder";
import { cacheDelete, cacheGet, cachePut } from "./storage";
import { audioStoragePath, normalizeGameData, type AudioKind } from "./sync";
import type { GameData, Recording } from "./types";

const BUCKET = "audio";

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Tu sesión terminó. Vuelve a iniciar sesión para guardar en la nube.");
  return id;
}

/* ---------------- Game data (one row per user) ---------------- */

export interface CloudGame {
  data: GameData;
  rev: number;
  clientId: string | null;
}

type GameRow = { names: Json; conversations: Json; version: number; rev: number; client_id: string | null };

export function rowToCloudGame(row: GameRow): CloudGame {
  return {
    data: normalizeGameData(row as { names?: unknown; conversations?: unknown }),
    rev: Number(row.rev),
    clientId: row.client_id,
  };
}

export async function fetchGame(userId: string): Promise<CloudGame | null> {
  const { data, error } = await supabase
    .from("game_data")
    .select("names, conversations, version, rev, client_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCloudGame(data) : null;
}

/** Creates the user's row. If another device created it first, returns that one instead. */
export async function createGame(userId: string, game: GameData, clientId: string): Promise<{ game: CloudGame; created: boolean }> {
  const { data, error } = await supabase
    .from("game_data")
    .insert({
      user_id: userId,
      version: 1,
      names: game.names as unknown as Json,
      conversations: game.conversations as unknown as Json,
      rev: 1,
      client_id: clientId,
    })
    .select("names, conversations, version, rev, client_id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const existing = await fetchGame(userId);
      if (existing) return { game: existing, created: false };
    }
    throw error;
  }
  return { game: rowToCloudGame(data), created: true };
}

/** Saves only if nobody else saved since `expectedRev`; otherwise reports the newer cloud version. */
export async function saveGame(
  userId: string,
  game: GameData,
  expectedRev: number,
  clientId: string,
): Promise<{ ok: true; rev: number } | { ok: false; remote: CloudGame | null }> {
  const { data, error } = await supabase
    .from("game_data")
    .update({
      names: game.names as unknown as Json,
      conversations: game.conversations as unknown as Json,
      rev: expectedRev + 1,
      client_id: clientId,
    })
    .eq("user_id", userId)
    .eq("rev", expectedRev)
    .select("rev")
    .maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, rev: Number(data.rev) };
  return { ok: false, remote: await fetchGame(userId) };
}

/* ---------------- Audio files (Storage + metadata row) ---------------- */

type AudioRow = {
  id: string;
  name: string;
  mime: string;
  duration_ms: number;
  line_text: string | null;
  created_at: string;
  storage_path: string;
  size_bytes: number;
};

const rowToRecording = (r: AudioRow): Recording => ({
  id: r.id,
  name: r.name,
  mime: r.mime,
  durationMs: r.duration_ms,
  lineText: r.line_text ?? undefined,
  createdAt: new Date(r.created_at).getTime(),
  sizeBytes: Number(r.size_bytes),
  storagePath: r.storage_path,
});

export function guessMime(blob: Blob, name = "") {
  if (blob.type) return blob.type;
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg",
    oga: "audio/ogg", webm: "audio/webm", flac: "audio/flac", opus: "audio/ogg",
  };
  return (ext && map[ext]) || "audio/mpeg";
}

export async function uploadAudio(input: {
  id: string;
  kind: AudioKind;
  blob: Blob;
  name: string;
  durationMs?: number;
  lineId?: string | null;
  lineText?: string | null;
  createdAt?: number;
}): Promise<Recording> {
  const userId = await currentUserId();
  const mime = guessMime(input.blob, input.name);
  const path = audioStoragePath(userId, input.kind, input.id, extensionFor(mime));
  const up = await supabase.storage.from(BUCKET).upload(path, input.blob, { contentType: mime, upsert: true });
  if (up.error) throw new Error(`No se pudo subir el audio a la nube: ${up.error.message}`);
  const { data, error } = await supabase
    .from("audio_files")
    .upsert(
      {
        user_id: userId,
        id: input.id,
        kind: input.kind,
        name: input.name.slice(0, 200) || "Audio",
        mime,
        size_bytes: input.blob.size,
        duration_ms: Math.round(input.durationMs ?? 0),
        line_id: input.lineId ?? null,
        line_text: input.lineText ?? null,
        storage_path: path,
        ...(input.createdAt ? { created_at: new Date(input.createdAt).toISOString() } : {}),
      },
      { onConflict: "user_id,id" },
    )
    .select("id, name, mime, duration_ms, line_text, created_at, storage_path, size_bytes")
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`No se pudo registrar el audio: ${error.message}`);
  }
  await cachePut(input.id, input.blob);
  return rowToRecording(data);
}

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const cached = await cacheGet(id);
  if (cached) return cached;
  const userId = await currentUserId();
  const { data: row } = await supabase
    .from("audio_files")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (!row) return undefined;
  const { data, error } = await supabase.storage.from(BUCKET).download(row.storage_path);
  if (error || !data) throw new Error("No se pudo descargar el audio desde la nube.");
  await cachePut(id, data);
  return data;
}

/** Temporary access link (1 hour) to the private file. */
export async function getAudioUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAudio(id: string) {
  const userId = await currentUserId();
  const { data: row } = await supabase
    .from("audio_files")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (row) {
    const rm = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (rm.error) throw new Error("No se pudo borrar el audio de la nube.");
    const { error } = await supabase.from("audio_files").delete().eq("user_id", userId).eq("id", id);
    if (error) throw error;
  }
  await cacheDelete(id);
}

export async function renameRecording(id: string, name: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from("audio_files").update({ name: name.slice(0, 200) }).eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function listRecordings(): Promise<Recording[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("audio_files")
    .select("id, name, mime, duration_ms, line_text, created_at, storage_path, size_bytes")
    .eq("user_id", userId)
    .eq("kind", "recording")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToRecording);
}

/** Removes line audios no conversation uses anymore (older than 15 min, so in-flight uploads from other devices are safe). */
export async function cleanupOrphanLineAudio(referenced: Set<string>) {
  const userId = await currentUserId();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("audio_files")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "line")
    .lt("created_at", cutoff);
  for (const r of data ?? []) {
    if (!referenced.has(r.id)) await deleteAudio(r.id).catch(() => undefined);
  }
}
