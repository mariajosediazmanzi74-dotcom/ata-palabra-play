import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording";

export interface RecordedClip {
  blob: Blob;
  mime: string;
  durationMs: number;
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "No diste permiso al micrófono. Actívalo desde el candado de la barra de direcciones y vuelve a intentarlo.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No encontramos un micrófono en este dispositivo. Conecta uno o usa “Insertar audio”.";
  if (name === "NotReadableError")
    return "Otro programa está usando el micrófono. Ciérralo e intenta de nuevo.";
  return "No se pudo usar el micrófono en este navegador. Puedes usar “Insertar audio” para cargar un archivo.";
}

export function isRecordingSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export function extensionFor(mime: string) {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((c: RecordedClip | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  /** Asks for the microphone and starts recording. Throws a friendly Error on failure. */
  const start = useCallback(async () => {
    if (!isRecordingSupported()) {
      throw new Error(
        "Tu navegador no permite grabar audio aquí. Prueba con Chrome, Edge o Safari actualizados, o usa “Insertar audio”.",
      );
    }
    if (recRef.current) return;
    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      setState("idle");
      throw new Error(micErrorMessage(err));
    }
    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const durationMs = Date.now() - startRef.current;
      cleanup();
      setState("idle");
      resolveRef.current?.(blob.size > 0 ? { blob, mime: type, durationMs } : null);
      resolveRef.current = null;
    };
    streamRef.current = stream;
    recRef.current = rec;
    startRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startRef.current), 200);
    rec.start(250);
    setState("recording");
  }, [cleanup]);

  /** Stops the recording and resolves with the recorded clip. */
  const stop = useCallback((): Promise<RecordedClip | null> => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      rec.stop();
    });
  }, []);

  return { state, elapsedMs, start, stop };
}

export function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
