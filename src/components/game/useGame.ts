import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_DATA } from "@/lib/game/defaults";
import { loadData, saveData } from "@/lib/game/storage";
import { isTtsAvailable, playLine, speak, stopAllAudio, TtsUnavailableError, warmUpVoices } from "@/lib/game/audio";
import { nextConversationIndex, playableLines } from "@/lib/game/logic";
import type { DialogueLine, GameData } from "@/lib/game/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGame() {
  const [data, setData] = useState<GameData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [convIndex, setConvIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [burstKey, setBurstKey] = useState(0);
  const [ttsReady, setTtsReady] = useState(true);

  const token = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const warnedRef = useRef(false);

  useEffect(() => {
    setData(loadData());
    setHydrated(true);
    setTtsReady(isTtsAvailable());
    warmUpVoices();
    return () => stopAllAudio();
  }, []);

  useEffect(() => {
    if (hydrated) saveData(data);
  }, [data, hydrated]);

  const conversations = data.conversations;
  const safeConv = Math.min(convIndex, Math.max(0, conversations.length - 1));
  const conversation = conversations[safeConv];
  const lines = useMemo(() => playableLines(conversation), [conversation]);
  const safeLine = Math.min(lineIndex, Math.max(0, lines.length - 1));
  const current: DialogueLine | undefined = lines[safeLine];

  const handleAudioError = useCallback((err: unknown) => {
    if (err instanceof TtsUnavailableError || !isTtsAvailable()) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast.warning("Este navegador no tiene voz automática", {
          description: "Puedes leer las frases, o grabar / insertar un audio para cada una en el panel de conversaciones.",
        });
      }
      return;
    }
    toast.error("No se pudo reproducir el audio", {
      description: err instanceof Error ? err.message : "Inténtalo de nuevo.",
    });
  }, []);

  /** Plays a line and keeps the speaking state in sync. Resolves when audio ends or is stopped. */
  const sayLine = useCallback(
    async (line: DialogueLine, rate: number, myToken: number) => {
      setSpeakingId(line.id);
      try {
        await playLine(line, rate);
      } catch (err) {
        handleAudioError(err);
        // Still give time to read so the scene keeps its rhythm.
        await wait(Math.min(6000, 1200 + line.text.length * 55));
      } finally {
        if (token.current === myToken) setSpeakingId(null);
      }
    },
    [handleAudioError],
  );

  const run = useCallback(
    async (ci: number, from: number) => {
      const myToken = ++token.current;
      stopAllAudio();
      setStarted(true);
      setRunning(true);
      setPaused(false);
      setFinished(false);
      setConvIndex(ci);
      let i = from;
      while (token.current === myToken) {
        const list = playableLines(dataRef.current.conversations[ci]);
        if (i >= list.length) break;
        setLineIndex(i);
        await wait(250);
        if (token.current !== myToken) return;
        await sayLine(list[i], 1, myToken);
        if (token.current !== myToken) return;
        await wait(800);
        if (token.current !== myToken) return;
        i++;
      }
      if (token.current === myToken) {
        setRunning(false);
        setFinished(true);
        setBurstKey((k) => k + 1);
      }
    },
    [sayLine],
  );

  const halt = useCallback(() => {
    token.current++;
    stopAllAudio();
    setRunning(false);
    setSpeakingId(null);
  }, []);

  const playOnce = useCallback(
    async (line: DialogueLine | undefined, rate = 1) => {
      if (!line) return;
      halt();
      setStarted(true);
      const myToken = token.current;
      await sayLine(line, rate, myToken);
    },
    [halt, sayLine],
  );

  const actions = {
    start: () => {
      setRevealed(new Set());
      void run(safeConv, 0);
    },
    play: () => {
      setFinished(false);
      void playOnce(current, 1);
    },
    repeat: () => void playOnce(current, 0.8),
    playLineById: (id: string, rate = 1) => {
      const idx = lines.findIndex((l) => l.id === id);
      if (idx >= 0) setLineIndex(idx);
      setFinished(false);
      void playOnce(lines[idx], rate);
    },
    togglePause: () => {
      if (running) {
        halt();
        setPaused(true);
        toast("Juego en pausa", { description: "Pulsa CONTINUAR para seguir la conversación." });
      } else {
        void run(safeConv, finished ? 0 : safeLine);
      }
    },
    restart: () => {
      setRevealed(new Set());
      void run(safeConv, 0);
    },
    nextConversation: () => {
      setRevealed(new Set());
      void run(nextConversationIndex(safeConv, conversations.length), 0);
    },
    chooseConversation: (i: number) => {
      setRevealed(new Set());
      void run(i, 0);
    },
    step: (dir: -1 | 1) => {
      const target = safeLine + dir;
      if (target < 0 || target >= lines.length) {
        if (dir === 1) {
          halt();
          setFinished(true);
          setBurstKey((k) => k + 1);
        }
        return;
      }
      setFinished(false);
      setLineIndex(target);
      void playOnce(lines[target]);
    },
    translate: async () => {
      if (!current) return;
      setRevealed((s) => new Set(s).add(current.id));
      if (!current.translation.trim()) {
        toast("Esta frase aún no tiene traducción", { description: "Agrégala en el panel de conversaciones." });
        return;
      }
      halt();
      setSpeakingId(current.id);
      try {
        await speak(current.translation, { lang: "es-ES", speaker: current.speaker });
      } catch (err) {
        handleAudioError(err);
      } finally {
        setSpeakingId(null);
      }
    },
    toggleShowAll: () => setShowAll((v) => !v),
    toggleLine: (id: string) =>
      setRevealed((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    halt,
  };

  const isRevealed = (id: string) => showAll || revealed.has(id);

  return {
    data,
    setData,
    hydrated,
    conversation,
    convIndex: safeConv,
    lines,
    lineIndex: safeLine,
    current,
    started,
    running,
    paused,
    finished,
    speakingId,
    showAll,
    burstKey,
    ttsReady,
    isRevealed,
    actions,
  };
}

export type GameApi = ReturnType<typeof useGame>;
