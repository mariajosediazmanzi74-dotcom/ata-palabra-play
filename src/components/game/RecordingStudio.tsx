import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Download, Ear, Link2, Loader2, Mic, Play, Save, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GameButton } from "./GameButton";
import { attachAudioToLine, downloadBlob, isAudioFile, MAX_AUDIO_BYTES } from "./lineAudio";
import { playBlob } from "@/lib/game/audio";
import { uid } from "@/lib/game/logic";
import { extensionFor, formatMs, isRecordingSupported, useRecorder, type RecordedClip } from "@/lib/game/recorder";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId, deleteAudio, getAudioBlob, listRecordings, uploadAudio } from "@/lib/game/cloud";
import type { Recording } from "@/lib/game/types";
import type { GameApi } from "./useGame";

function stamp(ts: number) {
  return new Date(ts).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RecordingStudio({ game }: { game: GameApi }) {
  const rec = useRecorder();
  const [last, setLast] = useState<(RecordedClip & { savedId?: string | undefined }) | null>(null);
  const [list, setList] = useState<Recording[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setList(await listRecordings());
      setListState("ready");
    } catch {
      setListState("error");
    }
  }, []);

  useEffect(() => {
    setSupported(isRecordingSupported());
  }, []);

  // Load from the cloud and stay in sync with the user's other devices.
  useEffect(() => {
    if (!game.hydrated) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    void refresh();
    void currentUserId()
      .then((userId) => {
        if (!alive) return;
        channel = supabase
          .channel(`recordings-${userId}-${Math.random().toString(36).slice(2)}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "audio_files", filter: `user_id=eq.${userId}` }, () => {
            void refresh();
          })
          .subscribe();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [game.hydrated, refresh]);

  const fetchBlob = async (r: Recording) => {
    try {
      return await getAudioBlob(r.id);
    } catch {
      return undefined;
    }
  };

  const startRec = async () => {
    game.actions.halt();
    try {
      await rec.start();
      toast("🎙️ Grabando…", { description: "Lee la frase en voz alta y pulsa DETENER cuando termines." });
    } catch (err) {
      toast.error("No se pudo grabar", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const stopRec = async () => {
    const clip = await rec.stop();
    if (!clip) {
      toast.error("La grabación quedó vacía", { description: "Intenta grabar de nuevo." });
      return;
    }
    setLast(clip);
    toast.success("¡Grabación lista!", { description: "Escúchala y guárdala en la nube si te gusta." });
  };

  const playClip = async (blob: Blob, id: string) => {
    game.actions.halt();
    setPlayingId(id);
    try {
      await playBlob(blob);
    } catch (err) {
      toast.error("No se pudo reproducir", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPlayingId((p) => (p === id ? null : p));
    }
  };

  const saveLast = async () => {
    if (!last || busy) return;
    if (last.savedId) {
      toast("Esta grabación ya está guardada en “Mis grabaciones”.");
      return;
    }
    const id = uid("rec");
    setBusy("save");
    try {
      const saved = await uploadAudio({
        id,
        kind: "recording",
        blob: last.blob,
        name: `Mi voz ${list.length + 1}`,
        durationMs: last.durationMs,
        lineText: game.current?.text ?? null,
      });
      setList((l) => [saved, ...l.filter((x) => x.id !== saved.id)]);
      setLast({ ...last, savedId: id });
      toast.success("Grabación guardada en la nube", { description: "Disponible en todos tus dispositivos." });
    } catch (err) {
      toast.error("No se pudo guardar en la nube", {
        description: `${err instanceof Error ? err.message : ""} Usa “Descargar” para conservarla mientras tanto.`,
      });
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAudioFile(file)) {
      toast.error("Ese archivo no es de audio", { description: "Usa MP3, WAV, M4A, OGG o WEBM." });
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error("El archivo es muy grande", { description: "El máximo es 15 MB." });
      return;
    }
    const line = game.current;
    setBusy("upload");
    const t = toast.loading("Subiendo audio a la nube…");
    try {
      const saved = await uploadAudio({
        id: uid("rec"),
        kind: "recording",
        blob: file,
        name: file.name.replace(/\.[^.]+$/, ""),
        lineText: line?.text ?? null,
      });
      setList((l) => [saved, ...l.filter((x) => x.id !== saved.id)]);
      if (line) {
        await attachAudioToLine(game.data, game.setData, line.id, file, file.name);
        toast.success("Audio insertado en la conversación", {
          id: t,
          description: `Ahora “${line.text.slice(0, 40)}${line.text.length > 40 ? "…" : ""}” usa tu audio.`,
        });
      } else {
        toast.success("Audio guardado en “Mis grabaciones”.", { id: t });
      }
    } catch (err) {
      toast.error("No se pudo subir el audio", { id: t, description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const useForLine = async (r: Recording) => {
    const line = game.current;
    if (!line) {
      toast("Inicia el juego para elegir una frase primero.");
      return;
    }
    const blob = await fetchBlob(r);
    if (!blob) { toast.error("No encontramos ese audio."); return; }
    try {
      await attachAudioToLine(game.data, game.setData, line.id, blob, r.name, r.durationMs);
      toast.success("Audio asociado a la frase actual", { description: line.text });
    } catch (err) {
      toast.error("No se pudo asociar el audio", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const download = async (r: Recording) => {
    const blob = await fetchBlob(r);
    if (!blob) { toast.error("No encontramos ese audio."); return; }
    downloadBlob(blob, `${r.name.replace(/\s+/g, "-").toLowerCase()}.${extensionFor(r.mime)}`);
  };

  const remove = async (r: Recording) => {
    if (!window.confirm(`¿Borrar “${r.name}” de la nube? Se borrará en todos tus dispositivos.`)) return;
    const prev = list;
    setList(list.filter((x) => x.id !== r.id));
    try {
      await deleteAudio(r.id);
      if (last?.savedId === r.id) setLast({ ...last, savedId: undefined });
      toast.success("Grabación borrada.");
    } catch (err) {
      setList(prev);
      toast.error("No se pudo borrar", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const recording = rec.state === "recording";

  return (
    <section className="panel-game p-4 md:p-5" aria-labelledby="studio-title">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="studio-title" className="font-display text-2xl font-bold text-foreground">
          🎙️ Mi voz
        </h2>
        {recording && (
          <span className="anim-rec inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1 font-display text-sm font-bold text-destructive-foreground">
            <span className="size-2 rounded-full bg-destructive-foreground" /> REC {formatMs(rec.elapsedMs)}
          </span>
        )}
        {rec.state === "requesting" && (
          <span className="text-sm font-semibold text-muted-foreground">Pidiendo permiso al micrófono…</span>
        )}
      </div>

      {game.current && (
        <p className="mb-3 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          Practica: <span className="font-bold text-foreground">“{game.current.text}”</span>
        </p>
      )}

      {!supported && (
        <p className="mb-3 rounded-2xl border-2 border-dashed border-tangerine bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
          Tu navegador no permite grabar aquí. Puedes usar “Insertar audio” para cargar un archivo.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GameButton tone="pink" icon={<Mic />} onClick={startRec} disabled={recording || rec.state === "requesting"} className={cn(recording && "anim-rec")}>
          Grabar mi voz
        </GameButton>
        <GameButton tone="plum" icon={<Square />} onClick={stopRec} disabled={!recording}>
          Detener grabación
        </GameButton>
        <GameButton tone="mint" icon={<Ear />} onClick={() => last && playClip(last.blob, "last")} disabled={!last || recording}>
          {playingId === "last" ? "Sonando…" : "Escuchar mi grabación"}
        </GameButton>
        <GameButton tone="sun" icon={busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} onClick={saveLast} disabled={!last || recording || busy === "save"}>
          {busy === "save" ? "Guardando…" : last?.savedId ? "Guardada ✓" : "Guardar grabación"}
        </GameButton>
        <GameButton
          tone="sky"
          icon={<Download />}
          onClick={() => last && downloadBlob(last.blob, `mi-grabacion-${Date.now()}.${extensionFor(last.mime)}`)}
          disabled={!last || recording}
        >
          Descargar
        </GameButton>
        <GameButton tone="tangerine" icon={busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />} onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
          {busy === "upload" ? "Subiendo…" : "Insertar audio"}
        </GameButton>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <h3 className="mb-2 mt-5 flex items-center gap-2 font-display text-lg font-bold text-foreground">
        Mis grabaciones
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          <Cloud className="size-3.5" /> en la nube
        </span>
      </h3>
      {listState === "loading" ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando tus grabaciones…
        </p>
      ) : listState === "error" ? (
        <p className="rounded-2xl border-2 border-dashed border-destructive px-3 py-4 text-center text-sm text-muted-foreground">
          No pudimos cargar tus grabaciones.{" "}
          <button type="button" className="font-bold text-pink-deep underline" onClick={() => void refresh()}>
            Reintentar
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Aún no hay grabaciones. ¡Graba tu voz o inserta un audio!
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-border bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {stamp(r.createdAt)}
                  {r.durationMs ? ` · ${formatMs(r.durationMs)}` : ""}
                  {r.lineText ? ` · “${r.lineText}”` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="chip-game tone-mint"
                  aria-label={`Reproducir ${r.name}`}
                  onClick={async () => {
                    const b = await fetchBlob(r);
                    if (b) void playClip(b, r.id);
                    else toast.error("No encontramos ese audio.");
                  }}
                >
                  <Play className="size-4" />
                </button>
                <button type="button" className="chip-game tone-lilac" aria-label="Usar en la frase actual" title="Usar en la frase actual" onClick={() => useForLine(r)}>
                  <Link2 className="size-4" />
                </button>
                <button type="button" className="chip-game tone-sky" aria-label="Descargar" title="Descargar" onClick={() => download(r)}>
                  <Download className="size-4" />
                </button>
                <button type="button" className="chip-game tone-pink" aria-label="Borrar" title="Borrar" onClick={() => remove(r)}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
