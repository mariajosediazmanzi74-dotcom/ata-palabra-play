import { Languages, Mic, Play, RotateCcw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DialogueLine } from "@/lib/game/types";

export function SpeechBubble({
  line,
  name,
  showTranslation,
  speaking,
  faded,
  onPlay,
  onRepeat,
  onToggleTranslation,
  className,
}: {
  line: DialogueLine;
  name: string;
  showTranslation: boolean;
  speaking: boolean;
  faded?: boolean;
  onPlay: () => void;
  onRepeat: () => void;
  onToggleTranslation: () => void;
  className?: string;
}) {
  const tone = line.speaker === "him" ? "tone-sky" : "tone-pink";
  return (
    <div
      key={line.id}
      className={cn(
        "bubble-game anim-bubble-in px-4 pb-3 pt-3 md:px-6 md:pb-4 md:pt-4",
        tone,
        faded && "opacity-75 saturate-75 scale-95",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="btn-game pointer-events-none h-7 px-3 text-xs">{name}</span>
        {speaking && (
          <span className="inline-flex items-center gap-1 font-display text-xs font-semibold text-mint-deep">
            <Volume2 className="size-4 anim-wiggle" /> hablando…
          </span>
        )}
        {line.audioId && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-bold text-accent-foreground">
            <Mic className="size-3" /> audio propio
          </span>
        )}
      </div>

      <p className="font-display text-xl font-semibold leading-tight text-foreground md:text-[1.7rem]">
        {line.text}
      </p>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          showTranslation ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="rounded-2xl border-2 border-dashed border-lilac/60 bg-secondary/70 px-3 py-1.5 text-base font-semibold italic text-secondary-foreground md:text-lg">
            <span className="mr-1 not-italic">🇪🇸</span>
            {line.translation || "Sin traducción todavía. Agrégala en el panel de conversaciones."}
          </p>
        </div>
      </div>

      {!faded && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="chip-game tone-mint" onClick={onPlay}>
            <Play className="size-4" /> Escuchar
          </button>
          <button type="button" className="chip-game tone-sun" onClick={onRepeat}>
            <RotateCcw className="size-4" /> Repetir
          </button>
          <button
            type="button"
            className="chip-game tone-lilac"
            aria-pressed={showTranslation}
            onClick={onToggleTranslation}
          >
            <Languages className="size-4" /> {showTranslation ? "Ocultar traducción" : "Ver traducción"}
          </button>
        </div>
      )}

      {/* Tail pointing at the speaker */}
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-[18px] size-8 rotate-45 rounded-br-lg border-b-4 border-r-4 border-[var(--tone)] bg-card",
          line.speaker === "him" ? "left-[18%]" : "right-[18%]",
        )}
      />
    </div>
  );
}
