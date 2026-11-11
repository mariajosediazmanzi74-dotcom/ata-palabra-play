import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Mic, Play, Plus, RotateCcw, Square, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GameButton } from "./GameButton";
import { attachAudioToLine, detachAudioFromLine, isAudioFile, MAX_AUDIO_BYTES } from "./lineAudio";
import type { GameApi } from "./useGame";
import { playLine } from "@/lib/game/audio";
import { DEFAULT_DATA } from "@/lib/game/defaults";
import { appendLine, insertReply, moveLine, removeLine, uid, updateLine } from "@/lib/game/logic";
import { formatMs, useRecorder } from "@/lib/game/recorder";
import { EXPRESSIONS, type Conversation, type DialogueLine, type Speaker } from "@/lib/game/types";

import himFace from "@/assets/chars/him-talk.webp";
import herFace from "@/assets/chars/her-talk.webp";

const FACES: Record<Speaker, string> = { him: himFace, her: herFace };

export function ConversationEditor({
  game,
  open,
  onOpenChange,
}: {
  game: GameApi;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, setData } = game;
  const [selected, setSelected] = useState(0);
  const rec = useRecorder();
  const [recFor, setRecFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileFor = useRef<string | null>(null);

  const ci = Math.min(selected, data.conversations.length - 1);
  const conv = data.conversations[ci];

  const patchConv = (fn: (c: Conversation) => Conversation) =>
    setData((d) => ({ ...d, conversations: d.conversations.map((c, i) => (i === ci ? fn(c) : c)) }));

  const patchLine = (id: string, patch: Partial<DialogueLine>) => patchConv((c) => updateLine(c, id, patch));

  const test = async (line: DialogueLine) => {
    if (!line.text.trim() && !line.audioId) { toast("Escribe la frase primero."); return; }
    game.actions.halt();
    try {
      await playLine(line);
    } catch (err) {
      toast.error("No se pudo reproducir", {
        description: err instanceof Error ? err.message : "Graba o inserta un audio para esta frase.",
      });
    }
  };

  const startRec = async (lineId: string) => {
    game.actions.halt();
    try {
      setRecFor(lineId);
      await rec.start();
    } catch (err) {
      setRecFor(null);
      toast.error("No se pudo grabar", { description: err instanceof Error ? err.message : undefined });
    }
  };

  const stopRec = async () => {
    const lineId = recFor;
    const clip = await rec.stop();
    setRecFor(null);
    if (!clip || !lineId) { toast.error("La grabación quedó vacía."); return; }
    await attachAudioToLine(data, setData, lineId, clip.blob, `Grabación ${formatMs(clip.durationMs)}`);
    toast.success("Audio grabado y asociado a la frase.");
  };

  const onFile = async (file: File | undefined) => {
    const lineId = fileFor.current;
    if (!file || !lineId) return;
    if (!isAudioFile(file)) { toast.error("Ese archivo no es de audio."); return; }
    if (file.size > MAX_AUDIO_BYTES) { toast.error("El archivo es muy grande (máx. 15 MB)."); return; }
    await attachAudioToLine(data, setData, lineId, file, file.name);
    toast.success("Audio insertado en la frase.");
  };

  const addConversation = () => {
    const c: Conversation = {
      id: uid("conv"),
      title: `Conversación ${data.conversations.length + 1}`,
      lines: [
        { id: uid("line"), speaker: "him", text: "", translation: "", expression: "wave" },
        { id: uid("line"), speaker: "her", text: "", translation: "", expression: "talk" },
      ],
    };
    setData((d) => ({ ...d, conversations: [...d.conversations, c] }));
    setSelected(data.conversations.length);
  };

  const deleteConversation = () => {
    if (data.conversations.length <= 1) { toast("Debe quedar al menos una conversación."); return; }
    if (!window.confirm(`¿Borrar “${conv?.title ?? ""}”?`)) return;
    game.actions.halt();
    setData((d) => ({ ...d, conversations: d.conversations.filter((_, i) => i !== ci) }));
    setSelected(Math.max(0, ci - 1));
  };

  const restore = () => {
    if (!window.confirm("¿Restaurar las conversaciones de ejemplo? Se perderán tus cambios.")) return;
    game.actions.halt();
    setData(structuredClone(DEFAULT_DATA));
    setSelected(0);
    toast.success("Conversaciones de ejemplo restauradas.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l-4 border-pink bg-background p-0 sm:max-w-2xl">
        <div className="bg-fiesta px-5 pb-4 pt-6">
          <SheetHeader>
            <SheetTitle className="title-outline font-display text-3xl font-bold text-on-color">Panel de conversaciones</SheetTitle>
            <SheetDescription className="font-semibold text-plum">
              Escribe, edita, graba e inserta audios. Todo se guarda solo en este dispositivo.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="space-y-5 p-5">
          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            {(["him", "her"] as Speaker[]).map((s) => (
              <label key={s} className="flex items-center gap-2 rounded-2xl border-2 border-border bg-card p-2">
                <img src={FACES[s]} alt="" className="h-14 w-10 object-cover object-top" />
                <span className="flex-1">
                  <span className="block text-xs font-bold text-muted-foreground">{s === "him" ? "Personaje 1" : "Personaje 2"}</span>
                  <Input
                    value={data.names[s]}
                    onChange={(e) => setData((d) => ({ ...d, names: { ...d.names, [s]: e.target.value } }))}
                    className="h-8 font-display text-base"
                    aria-label="Nombre del personaje"
                  />
                </span>
              </label>
            ))}
          </div>

          {/* Conversation picker */}
          <div>
            <p className="mb-2 font-display text-lg font-bold">Conversaciones</p>
            <div className="flex flex-wrap gap-2">
              {data.conversations.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn("chip-game", i % 2 ? "tone-lilac" : "tone-pink")}
                  aria-pressed={i === ci}
                  onClick={() => setSelected(i)}
                >
                  {c.title || `Conversación ${i + 1}`}
                </button>
              ))}
              <button type="button" className="chip-game tone-mint" onClick={addConversation}>
                <Plus className="size-4" /> Nueva
              </button>
            </div>
          </div>

          {conv && (
            <div className="panel-game space-y-4 p-4">
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="text-xs font-bold text-muted-foreground">Título</span>
                  <Input value={conv.title} onChange={(e) => patchConv((c) => ({ ...c, title: e.target.value }))} className="font-display text-lg" />
                </label>
                <GameButton tone="pink" size="icon" aria-label="Borrar conversación" title="Borrar conversación" onClick={deleteConversation}>
                  <Trash2 />
                </GameButton>
              </div>

              {conv.lines.map((line, idx) => {
                const other: Speaker = line.speaker === "him" ? "her" : "him";
                const isRec = recFor === line.id && rec.state === "recording";
                return (
                  <article
                    key={line.id}
                    className={cn(
                      "rounded-3xl border-[3px] bg-card p-3",
                      line.speaker === "him" ? "border-sky" : "border-pink",
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-plum font-display text-sm font-bold text-on-color">
                        {idx + 1}
                      </span>
                      {(["him", "her"] as Speaker[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={cn("chip-game py-1", s === "him" ? "tone-sky" : "tone-pink")}
                          aria-pressed={line.speaker === s}
                          onClick={() => patchLine(line.id, { speaker: s })}
                        >
                          <img src={FACES[s]} alt="" className="h-6 w-5 object-cover object-top" />
                          {data.names[s]}
                        </button>
                      ))}
                      <select
                        value={line.expression}
                        onChange={(e) => patchLine(line.id, { expression: e.target.value as DialogueLine["expression"] })}
                        className="h-9 rounded-full border-2 border-border bg-card px-3 font-display text-sm font-semibold"
                        aria-label="Expresión del personaje"
                      >
                        {EXPRESSIONS.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.emoji} {x.label}
                          </option>
                        ))}
                      </select>
                      <div className="ml-auto flex gap-1">
                        <button type="button" className="chip-game tone-lilac px-2" aria-label="Subir" onClick={() => patchConv((c) => moveLine(c, line.id, -1))} disabled={idx === 0}>
                          <ArrowUp className="size-4" />
                        </button>
                        <button type="button" className="chip-game tone-lilac px-2" aria-label="Bajar" onClick={() => patchConv((c) => moveLine(c, line.id, 1))} disabled={idx === conv.lines.length - 1}>
                          <ArrowDown className="size-4" />
                        </button>
                        <button type="button" className="chip-game tone-pink px-2" aria-label="Borrar frase" onClick={() => patchConv((c) => removeLine(c, line.id))}>
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-bold text-muted-foreground">🇬🇧 Frase en inglés</span>
                      <Textarea
                        value={line.text}
                        rows={2}
                        placeholder="Hello! How are you?"
                        onChange={(e) => patchLine(line.id, { text: e.target.value })}
                        className="font-display text-base"
                      />
                    </label>
                    <label className="mt-2 block">
                      <span className="text-xs font-bold text-muted-foreground">🇪🇸 Traducción al español</span>
                      <Textarea
                        value={line.translation}
                        rows={2}
                        placeholder="¡Hola! ¿Cómo estás?"
                        onChange={(e) => patchLine(line.id, { translation: e.target.value })}
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold",
                          line.audioId ? "bg-mint/40 text-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {line.audioId ? `🎧 ${line.audioName ?? "Audio propio"}` : "🤖 Voz automática"}
                      </span>
                      <button type="button" className="chip-game tone-mint" onClick={() => test(line)}>
                        <Play className="size-4" /> Probar
                      </button>
                      {isRec ? (
                        <button type="button" className="chip-game tone-plum anim-rec" aria-pressed onClick={stopRec}>
                          <Square className="size-4" /> Detener {formatMs(rec.elapsedMs)}
                        </button>
                      ) : (
                        <button type="button" className="chip-game tone-pink" onClick={() => startRec(line.id)} disabled={rec.state !== "idle"}>
                          <Mic className="size-4" /> Grabar
                        </button>
                      )}
                      <button
                        type="button"
                        className="chip-game tone-tangerine"
                        onClick={() => {
                          fileFor.current = line.id;
                          fileRef.current?.click();
                        }}
                      >
                        <Upload className="size-4" /> Insertar
                      </button>
                      {line.audioId && (
                        <button type="button" className="chip-game tone-lilac" onClick={() => detachAudioFromLine(setData, line.id, line.audioId!)}>
                          <RotateCcw className="size-4" /> Usar voz automática
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 font-display text-sm font-semibold text-pink-deep hover:underline"
                      onClick={() => patchConv((c) => insertReply(c, line.id))}
                    >
                      <CornerDownRight className="size-4" /> Agregar respuesta de {data.names[other]}
                    </button>
                  </article>
                );
              })}

              <GameButton tone="mint" icon={<Plus />} className="w-full" onClick={() => patchConv((c) => appendLine(c))}>
                Agregar frase
              </GameButton>
            </div>
          )}

          <button type="button" onClick={restore} className="mx-auto block text-sm font-semibold text-muted-foreground underline">
            Restaurar conversaciones de ejemplo
          </button>
        </div>

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
      </SheetContent>
    </Sheet>
  );
}
