import { getBlob } from "./storage";
import type { DialogueLine, Speaker } from "./types";

export class TtsUnavailableError extends Error {
  constructor() {
    super("La voz automática no está disponible en este navegador.");
  }
}

let currentAudio: HTMLAudioElement | null = null;
let pendingDone: (() => void) | null = null;
let playId = 0;

function finish() {
  const done = pendingDone;
  pendingDone = null;
  done?.();
}

export function isTtsAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopAllAudio() {
  playId++;
  if (isTtsAvailable()) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  finish();
}

export function playBlob(blob: Blob, rate = 1): Promise<void> {
  stopAllAudio();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = rate;
  currentAudio = audio;
  return new Promise<void>((resolve, reject) => {
    pendingDone = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = () => finish();
    audio.onerror = () => {
      pendingDone = null;
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo reproducir este archivo de audio."));
    };
    audio.play().catch((err: unknown) => {
      pendingDone = null;
      URL.revokeObjectURL(url);
      reject(err instanceof Error ? err : new Error("No se pudo reproducir el audio."));
    });
  });
}

const FEMALE = /female|woman|samantha|victoria|karen|zira|susan|aria|jenny|moira|tessa|fiona|serena|allison|ava|joanna|salli|kimberly|emma|libby|sonia|paulina|monica|helena|laura|elvira|dalia|google us english$/i;
const MALE = /\bmale\b|\bman\b|daniel|alex|fred|david|mark|guy|tom|aaron|arthur|ryan|matthew|justin|brian|eric|george|jorge|diego|pablo|alvaro|google uk english male/i;

function pickVoice(lang: string, speaker: Speaker): { voice: SpeechSynthesisVoice | null; matched: boolean } {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.slice(0, 2).toLowerCase();
  const exact = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase());
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = exact.length ? [...exact, ...sameLang.filter((v) => !exact.includes(v))] : sameLang;
  if (!pool.length) return { voice: null, matched: false };
  const isFemale = (v: SpeechSynthesisVoice) => FEMALE.test(v.name) && !/\bmale\b/i.test(v.name);
  const isMale = (v: SpeechSynthesisVoice) => MALE.test(v.name) && !FEMALE.test(v.name);
  const wanted = pool.find(speaker === "her" ? isFemale : isMale);
  if (wanted) return { voice: wanted, matched: true };
  return { voice: speaker === "him" ? (pool[1] ?? pool[0]) : pool[0], matched: false };
}

export function speak(
  text: string,
  opts: { lang?: string; speaker: Speaker; rate?: number },
): Promise<void> {
  stopAllAudio();
  if (!isTtsAvailable()) return Promise.reject(new TtsUnavailableError());
  const myId = ++playId;
  const lang = opts.lang ?? "en-US";
  const rate = opts.rate ?? 1;
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95 * rate;
  const { voice, matched } = pickVoice(lang, opts.speaker);
  if (voice) u.voice = voice;
  u.pitch = opts.speaker === "her" ? (matched ? 1.15 : 1.35) : matched ? 0.95 : 0.8;

  return new Promise<void>((resolve, reject) => {
    pendingDone = resolve;
    u.onend = () => {
      if (myId === playId) finish();
    };
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") {
        if (myId === playId) finish();
        return;
      }
      pendingDone = null;
      reject(new Error(`No se pudo usar la voz automática (${e.error}).`));
    };
    // Small delay after cancel(): Chrome drops utterances queued in the same tick.
    setTimeout(() => {
      if (myId !== playId) return;
      synth.speak(u);
    }, 60);
    // Safety net: some browsers never fire onend.
    const maxMs = Math.max(3000, (text.length * 110) / rate) + 4000;
    setTimeout(() => {
      if (myId === playId && pendingDone === resolve) finish();
    }, maxMs);
  });
}

/** Plays the line's own audio when it has one, otherwise reads it with the browser voice. */
export async function playLine(line: DialogueLine, rate = 1): Promise<"custom" | "tts"> {
  if (line.audioId) {
    const blob = await getBlob(line.audioId).catch(() => undefined);
    if (blob) {
      await playBlob(blob, rate);
      return "custom";
    }
  }
  await speak(line.text, { speaker: line.speaker, rate });
  return "tts";
}

export function warmUpVoices() {
  if (!isTtsAvailable()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
