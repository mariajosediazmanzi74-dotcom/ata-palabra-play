import { useEffect, useRef, useState } from "react";
import { Download, Ear, Link2, Mic, Play, Save, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GameButton } from "./GameButton";
import { attachAudioToLine, downloadBlob, isAudioFile, MAX_AUDIO_BYTES } from "./lineAudio";
import { playBlob } from "@/lib/game/audio";
import { uid } from "@/lib/game/logic";
import { extensionFor, formatMs, isRecordingSupported, useRecorder, type RecordedClip } from "@/lib/game/recorder";
import { deleteBlob, getBlob, loadRecordings, putBlob, saveRecordings } from "@/lib/game/storage";
import type { Recording } from "@/lib/game/types";
import type { GameApi } from "./useGame";

function stamp(ts: number) {
  return new Date(ts).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RecordingStudio({ game }: { game: GameApi }) {
  const rec = useRecorder();
  const [last, setLast] = useState<(RecordedClip & { savedId?: string }) | null>(null);
  const [list, setList] = useState<Recording[]>([]);
  const [supported, setSupported] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setList(loadRecordings());
    setSupported(isRecordingSupported());
  }, []);

  const persist = (next: Recording[]) => {
    setList(next);
    saveRecordings(next);
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
    toast.success("¡Grabación lista!", { description: "Escúchala y guárdala si te gusta." });
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
    if (!last) return;
    if (last.savedId) {
      toast("Esta grabación ya está guardada en “Mis grabaciones”.");
      return;
    }
    const id = uid("rec");
    try {
      await putBlob(id, last.blob);
    } catch {
      toast.error("No se pudo guardar en este dispositivo", { description: "Usa “Descargar” para conservarla." });
      return;
    }
    const item: Recording = {
      id,
      name: `Mi voz ${list.length + 1}`,
      createdAt: Date.now(),
      mime: last.mime,
      durationMs: last.durationMs,
      lineText: game.current?.text,
    };
    persist([item, ...list]);
    setLast({ ...last, savedId: id });
    toast.success("Grabación guardada", { description: "La encuentras en “Mis grabaciones”." });
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
    try {
      const id = uid("rec");
      await putBlob(id, file);
      persist([
        { id, name: file.name.replace(/\.[^.]+$/, ""), createdAt: Date.now(), mime: file.type || "audio/mpeg", durationMs: 0, lineText: line?.text },
        ...list,
      ]);
      if (line) {
        await attachAudioToLine(game.data, game.setData, line.id, file, file.name);
        toast.success("Audio insertado en la conversación", {
          description: `Ahora “${line.text.slice(0, 40)}${line.text.length > 40 ? "…" : ""}” usa tu audio.`,
        });
      } else {
        toast.success("Audio agregado a “Mis grabaciones”.");
      }
    } catch {
      toast.error("No se pudo guardar el audio en este dispositivo.");
    }
  };

  const useForLine = async (r: Recording) => {
    const line = game.current;
    if (!line) {
      toast("Inicia el juego para elegir una frase primero.");
      return;
    }
    const blob = await getBlob(r.id).catch(() => undefined);
    if (!blob) return toast.error("No encontramos ese audio.");
    await attachAudioToLine(game.data, game.setData, line.id, blob, r.name);
    toast.success("Audio asociado a la frase actual", { description: line.text });
  };

  const download = async (r: Recording) => {
    const blob = await getBlob(r.id).catch(() => undefined);
    if (!blob) return toast.error("No encontramos ese audio.");
    downloadBlob(blob, `${r.name.replace(/\s+/g, "-").toLowerCase()}.${extensionFor(r.mime)}`);
  };

  const remove = async (r: Recording) => {
    persist(list.filter((x) => x.id !== r.id));
    if (last?.savedId === r.id) setLast({ ...last, savedId: undefined });
    await deleteBlob(r.id).catch(() => undefined);
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
        <GameButton tone="sun" icon={<Save />} onClick={saveLast} disabled={!last || recording}>
          {last?.savedId ? "Guardada ✓" : "Guardar grabación"}
        </GameButton>
        <GameButton
          tone="sky"
          icon={<Download />}
          onClick={() => last && downloadBlob(last.blob, `mi-grabacion-${Date.now()}.${extensionFor(last.mime)}`)}
          disabled={!last || recording}
        >
          Descargar
        </GameButton>
        <GameButton tone="tangerine" icon={<Upload />} onClick={() => fileRef.current?.click()}>
          Insertar audio
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

      <h3 className="mb-2 mt-5 font-display text-lg font-bold text-foreground">Mis grabaciones</h3>
      {list.length === 0 ? (
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
                    const b = await getBlob(r.id).catch(() => undefined);
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
