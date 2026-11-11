import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Info,
  Languages,
  Pause,
  PencilLine,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import bg from "@/assets/pinateria-bg.webp";
import { Character, type Mood } from "@/components/game/Character";
import { SpeechBubble } from "@/components/game/SpeechBubble";
import { GameButton } from "@/components/game/GameButton";
import { AmbientConfetti, ConfettiBurst } from "@/components/game/Confetti";
import { RecordingStudio } from "@/components/game/RecordingStudio";
import { ConversationEditor } from "@/components/game/ConversationEditor";
import { useGame } from "@/components/game/useGame";
import type { Speaker } from "@/lib/game/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Piñata Talk — Juego de conversación en inglés" },
      {
        name: "description",
        content:
          "Juego interactivo en una piñatería: dos personajes animados conversan en inglés con traducción al español, audio y grabación de tu voz.",
      },
      { property: "og:title", content: "Piñata Talk — Juego de conversación en inglés" },
      {
        property: "og:description",
        content: "Escucha, practica, graba tu voz y traduce conversaciones en una piñatería muy colorida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const game = useGame();
  const [editorOpen, setEditorOpen] = useState(false);
  const { data, current, started, finished, running, speakingId, lines, lineIndex } = game;
  const prev = lineIndex > 0 ? lines[lineIndex - 1] : undefined;

  const moodFor = (who: Speaker): Mood => {
    if (finished) return "celebrate";
    if (!started) return "wave";
    if (current?.speaker === who) return current.expression;
    return "listen";
  };
  const isSpeaking = (who: Speaker) => !!current && current.speaker === who && speakingId === current.id;
  const active = (who: Speaker) => !started || finished || current?.speaker === who;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 md:gap-5 md:px-6 md:py-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="title-outline font-display text-4xl font-bold leading-none tracking-tight text-sun md:text-5xl">
            Piñata <span className="text-pink">Talk</span>
          </h1>
          <p className="mt-1 font-display text-sm font-semibold text-muted-foreground md:text-base">
            Escucha, practica y traduce en la piñatería 🪅
          </p>
        </div>
        <GameButton tone="lilac" size="md" icon={<PencilLine />} onClick={() => setEditorOpen(true)}>
          Panel de conversaciones
        </GameButton>
      </header>

      {/* Conversation chips */}
      <nav aria-label="Conversaciones" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {data.conversations.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={cn("chip-game shrink-0 text-sm", ["tone-pink", "tone-sky", "tone-sun", "tone-mint", "tone-lilac"][i % 5])}
            aria-pressed={started && i === game.convIndex}
            onClick={() => game.actions.chooseConversation(i)}
          >
            {i + 1}. {c.title}
          </button>
        ))}
      </nav>

      {/* Stage */}
      <section
        aria-label="Escenario de la piñatería"
        className="relative h-[clamp(560px,82vh,760px)] overflow-hidden rounded-[2rem] border-4 border-plum shadow-[var(--shadow-pop)] md:h-[clamp(560px,72vh,740px)]"
      >
        <img
          src={bg}
          alt="Piñatería llena de piñatas, globos, dulces y guirnaldas"
          width={1920}
          height={1088}
          className="anim-ken-burns absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-plum/30 to-transparent" />
        <AmbientConfetti />
        <ConfettiBurst burstKey={game.burstKey} />

        {/* Characters */}
        <div className="absolute bottom-[4.2rem] left-[1%] h-[54%] w-[48%] md:bottom-[4.5rem] md:left-[6%] md:h-[66%] md:w-[38%]">
          <Character who="him" name={data.names.him} mood={moodFor("him")} speaking={isSpeaking("him")} active={active("him")} />
        </div>
        <div className="absolute bottom-[4.2rem] right-[1%] h-[54%] w-[48%] md:bottom-[4.5rem] md:right-[6%] md:h-[66%] md:w-[38%]">
          <Character who="her" name={data.names.her} mood={moodFor("her")} speaking={isSpeaking("her")} active={active("her")} />
        </div>

        {/* Bubbles */}
        {started && !finished && current && (
          <div className="absolute inset-x-3 top-3 z-30 md:inset-x-6 md:top-5">
            {prev && prev.speaker !== current.speaker && (
              <div className={cn("pointer-events-none absolute top-0 hidden w-[40%] lg:block", prev.speaker === "him" ? "left-0" : "right-0")}>
                <SpeechBubble
                  line={prev}
                  name={data.names[prev.speaker]}
                  showTranslation={game.isRevealed(prev.id)}
                  speaking={false}
                  faded
                  onPlay={() => {}}
                  onRepeat={() => {}}
                  onToggleTranslation={() => {}}
                />
              </div>
            )}
            <div className={cn("relative md:w-[56%] lg:w-[50%]", current.speaker === "him" ? "md:mr-auto" : "md:ml-auto")}>
              <SpeechBubble
                line={current}
                name={data.names[current.speaker]}
                showTranslation={game.isRevealed(current.id)}
                speaking={speakingId === current.id}
                onPlay={() => game.actions.playLineById(current.id)}
                onRepeat={() => game.actions.playLineById(current.id, 0.8)}
                onToggleTranslation={() => game.actions.toggleLine(current.id)}
              />
            </div>
          </div>
        )}

        {/* Finished banner */}
        {finished && (
          <div className="absolute inset-x-3 top-4 z-30 flex justify-center">
            <div className="bubble-game tone-sun anim-bubble-in max-w-lg px-6 py-4 text-center">
              <p className="font-display text-2xl font-bold text-foreground md:text-3xl">¡Conversación completada! 🎉</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Repite la conversación, graba tu voz o pasa a la siguiente.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <GameButton tone="tangerine" size="sm" icon={<RefreshCw />} onClick={game.actions.restart}>
                  Repetir
                </GameButton>
                <GameButton tone="sky" size="sm" icon={<SkipForward />} onClick={game.actions.nextConversation}>
                  Siguiente conversación
                </GameButton>
              </div>
            </div>
          </div>
        )}

        {/* Step controls */}
        {started && (
          <div className="absolute inset-x-0 bottom-3 z-30 flex items-center justify-center gap-3">
            <GameButton tone="plum" size="icon" aria-label="Frase anterior" onClick={() => game.actions.step(-1)} disabled={lineIndex === 0}>
              <ChevronLeft />
            </GameButton>
            <div className="flex items-center gap-1.5 rounded-full border-[3px] border-plum bg-card/90 px-3 py-2">
              {lines.map((l, i) => (
                <span
                  key={l.id}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    i === lineIndex ? "w-6 bg-pink" : i < lineIndex ? "w-2.5 bg-lilac" : "w-2.5 bg-border",
                  )}
                />
              ))}
              <span className="ml-1 font-display text-xs font-bold text-foreground">
                {Math.min(lineIndex + 1, lines.length)}/{lines.length}
              </span>
            </div>
            <GameButton tone="plum" size="icon" aria-label="Frase siguiente" onClick={() => game.actions.step(1)}>
              <ChevronRight />
            </GameButton>
          </div>
        )}

        {/* Start screen */}
        {!started && (
          <div className="absolute inset-0 z-40 flex items-start justify-center bg-gradient-to-b from-plum/40 via-transparent to-transparent px-4 pt-6 md:pt-10">
            <div className="bubble-game tone-pink anim-bubble-in w-full max-w-xl px-5 py-5 text-center md:px-8 md:py-7">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-pink-deep">¡Bienvenidos a la piñatería!</p>
              <h2 className="mt-1 font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
                {data.names.him} y {data.names.her} quieren conversar contigo
              </h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground md:text-base">
                Escucha cada frase en inglés, mira su traducción y graba tu voz para practicar.
              </p>
              <GameButton tone="sun" size="xl" icon={<Play />} className="mt-4" onClick={game.actions.start}>
                Iniciar juego
              </GameButton>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Volume2 className="size-4" /> Sube el volumen. Para grabar te pediremos permiso al micrófono.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Main controls */}
      <section aria-label="Controles del juego" className="panel-game p-3 md:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <GameButton tone="mint" icon={<Play />} onClick={game.actions.play} disabled={!current}>
            Reproducir audio
          </GameButton>
          <GameButton tone="sun" icon={<RotateCcw />} onClick={game.actions.repeat} disabled={!current}>
            Repetir audio
          </GameButton>
          <GameButton tone="pink" icon={<Languages />} onClick={game.actions.translate} disabled={!current}>
            Traducir
          </GameButton>
          <GameButton tone="plum" icon={game.showAll ? <EyeOff /> : <Eye />} onClick={game.actions.toggleShowAll}>
            {game.showAll ? "Ocultar traducción" : "Mostrar traducción"}
          </GameButton>
          <GameButton tone="lilac" icon={running ? <Pause /> : <Play />} onClick={game.actions.togglePause} disabled={!current}>
            {running ? "Pausar" : started ? "Continuar" : "Iniciar"}
          </GameButton>
          <GameButton tone="sky" icon={<SkipForward />} onClick={game.actions.nextConversation}>
            Siguiente conversación
          </GameButton>
          <GameButton tone="tangerine" icon={<RefreshCw />} onClick={game.actions.restart} className="col-span-2 sm:col-span-1">
            Reiniciar
          </GameButton>
        </div>
      </section>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* Transcript */}
        <section className="panel-game p-4 md:p-5" aria-labelledby="dialog-title">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 id="dialog-title" className="mr-auto font-display text-2xl font-bold text-foreground">
              💬 {game.conversation?.title ?? "Conversación"}
            </h2>
            <button type="button" className="chip-game tone-lilac" onClick={() => setEditorOpen(true)}>
              <PencilLine className="size-4" /> Editar
            </button>
          </div>
          <ol className="space-y-2">
            {lines.map((l, i) => {
              const isCurrent = started && i === lineIndex;
              return (
                <li
                  key={l.id}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border-[3px] p-3 transition-colors",
                    l.speaker === "him" ? "border-sky/60" : "border-pink/60",
                    isCurrent ? (l.speaker === "him" ? "bg-sky/20" : "bg-pink/15") : "bg-card",
                  )}
                >
                  <button
                    type="button"
                    className={cn("btn-game size-10 shrink-0 p-0 [&_svg]:size-4", l.speaker === "him" ? "tone-sky" : "tone-pink")}
                    aria-label={`Escuchar: ${l.text}`}
                    onClick={() => game.actions.playLineById(l.id)}
                  >
                    {speakingId === l.id ? <Volume2 className="anim-wiggle" /> : <Play />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{data.names[l.speaker]}</p>
                    <p className="font-display text-lg font-semibold leading-snug text-foreground">{l.text}</p>
                    {game.isRevealed(l.id) && <p className="text-sm font-semibold italic text-secondary-foreground">{l.translation}</p>}
                  </div>
                  <button
                    type="button"
                    className="chip-game tone-lilac shrink-0 px-2"
                    aria-pressed={game.isRevealed(l.id)}
                    aria-label="Mostrar u ocultar traducción"
                    onClick={() => game.actions.toggleLine(l.id)}
                  >
                    <Languages className="size-4" />
                  </button>
                </li>
              );
            })}
            {lines.length === 0 && (
              <li className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Esta conversación está vacía. Ábrela en el panel para escribir frases.
              </li>
            )}
          </ol>
          <p className="mt-4 flex gap-2 rounded-2xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            {game.ttsReady
              ? "Las voces automáticas las genera tu navegador; algunas necesitan internet. Si una frase no suena, grábala o inserta un audio en el panel."
              : "Tu navegador no tiene voz automática. Graba o inserta un audio para cada frase en el panel de conversaciones."}
          </p>
        </section>

        <RecordingStudio game={game} />
      </div>

      <ConversationEditor game={game} open={editorOpen} onOpenChange={setEditorOpen} />
    </main>
  );
}
