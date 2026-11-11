import { HelpCircle, Music2, PartyPopper, Volume2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Expression, Speaker } from "@/lib/game/types";

import himTalk from "@/assets/chars/him-talk.webp";
import himWave from "@/assets/chars/him-wave.webp";
import himThink from "@/assets/chars/him-think.webp";
import himCelebrate from "@/assets/chars/him-celebrate.webp";
import himSurprised from "@/assets/chars/him-surprised.webp";
import himPoint from "@/assets/chars/him-point.webp";
import herTalk from "@/assets/chars/her-talk.webp";
import herWave from "@/assets/chars/her-wave.webp";
import herThink from "@/assets/chars/her-think.webp";
import herCelebrate from "@/assets/chars/her-celebrate.webp";
import herSurprised from "@/assets/chars/her-surprised.webp";
import herPoint from "@/assets/chars/her-point.webp";


export type Mood = Expression | "listen";

type Pose = "talk" | "wave" | "think" | "celebrate" | "surprised" | "point";

const POSES: Record<Speaker, Record<Pose, string>> = {
  him: { talk: himTalk, wave: himWave, think: himThink, celebrate: himCelebrate, surprised: himSurprised, point: himPoint },
  her: { talk: herTalk, wave: herWave, think: herThink, celebrate: herCelebrate, surprised: herSurprised, point: herPoint },
};

function poseFor(mood: Mood): Pose {
  if (mood === "laugh") return "celebrate";
  if (mood === "listen") return "talk";
  return mood;
}

function motionFor(mood: Mood, who: Speaker, speaking: boolean) {
  switch (mood) {
    case "wave":
      return "anim-wave";
    case "laugh":
      return "anim-laugh";
    case "surprised":
      return "anim-surprise";
    case "think":
      return "anim-think";
    case "celebrate":
      return "anim-celebrate";
    case "point":
      return who === "him" ? "anim-point-right" : "anim-point-left";
    case "talk":
      return speaking ? "anim-talk" : "anim-breathe";
    default:
      return "anim-listen";
  }
}

function Emote({ mood, speaking }: { mood: Mood; speaking: boolean }) {
  const base = "flex size-11 items-center justify-center rounded-full border-[3px] shadow-lg md:size-14";
  if (mood === "think")
    return (
      <span className={cn(base, "anim-emote bg-sky text-plum border-sky-deep")}>
        <HelpCircle className="size-6 md:size-8" />
      </span>
    );
  if (mood === "surprised")
    return (
      <span className={cn(base, "anim-emote bg-sun text-plum border-sun-deep")}>
        <Zap className="size-6 md:size-8" />
      </span>
    );
  if (mood === "laugh")
    return (
      <span className="anim-emote rounded-full border-[3px] border-tangerine-deep bg-tangerine px-3 py-1 font-display text-sm font-bold text-on-color shadow-lg md:text-lg">
        ¡Ja ja!
      </span>
    );
  if (mood === "celebrate")
    return (
      <span className={cn(base, "anim-emote bg-pink text-on-color border-pink-deep")}>
        <PartyPopper className="size-6 md:size-8" />
      </span>
    );
  if (speaking)
    return (
      <span className={cn(base, "relative bg-mint text-plum border-mint-deep")}>
        <span className="anim-sound-ring absolute inset-0 rounded-full border-[3px] border-mint" />
        <Volume2 className="size-6 md:size-7" />
      </span>
    );
  if (mood === "wave")
    return (
      <span className={cn(base, "anim-emote bg-lilac text-on-color border-lilac-deep")}>
        <Music2 className="size-6 md:size-7" />
      </span>
    );
  return null;
}

export function Character({
  who,
  name,
  mood,
  speaking,
  active,
}: {
  who: Speaker;
  name: string;
  mood: Mood;
  speaking: boolean;
  active: boolean;
}) {
  const pose = poseFor(mood);
  const motion = motionFor(mood, who, speaking);
  return (
    <figure
      className={cn(
        "relative flex h-full flex-col items-center justify-end transition-[filter,transform] duration-500",
        active ? "z-20 scale-100" : "z-10 scale-[0.94] saturate-[0.9]",
      )}
      aria-label={`${name}${speaking ? " está hablando" : ""}`}
    >
      <div className="pointer-events-none absolute -top-1 left-1/2 z-30 -translate-x-1/2 md:top-0">
        <Emote mood={mood} speaking={speaking} />
      </div>

      {/* Floor shadow */}
      <div className="absolute bottom-[1.6rem] left-1/2 h-5 w-3/5 -translate-x-1/2 rounded-[50%] bg-plum/30 blur-md md:bottom-[2.1rem]" />

      <div
        key={`${mood}-${speaking ? "s" : "q"}`}
        className={cn("relative h-[calc(100%-1.8rem)] w-auto md:h-[calc(100%-2.3rem)]", motion)}
        style={{ aspectRatio: "768 / 1130" }}
      >
        {(Object.keys(POSES[who]) as Pose[]).map((p) => (
          <img
            key={p}
            src={POSES[who][p]}
            alt=""
            draggable={false}
            width={768}
            height={1130}
            className={cn(
              "absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_10px_14px_color-mix(in_oklab,var(--plum)_35%,transparent)] transition-opacity duration-200",
              p === pose ? "anim-pose-in opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>

      <figcaption
        className={cn(
          "btn-game pointer-events-none absolute bottom-0 h-8 px-4 text-sm md:h-10 md:px-6 md:text-lg",
          who === "him" ? "tone-sky" : "tone-pink",
          active ? "" : "opacity-80",
        )}
      >
        {name}
      </figcaption>
    </figure>
  );
}
