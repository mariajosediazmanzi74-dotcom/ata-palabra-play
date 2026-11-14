import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cleanupOrphanLineAudio, createGame, fetchGame, rowToCloudGame, saveGame, type CloudGame } from "@/lib/game/cloud";
import { DEFAULT_DATA } from "@/lib/game/defaults";
import { uid } from "@/lib/game/logic";
import { uploadLegacyAudio } from "@/lib/game/migrate";
import { loadLegacyData } from "@/lib/game/storage";
import { mergeGameData, normalizeGameData, referencedAudioIds } from "@/lib/game/sync";
import type { GameData } from "@/lib/game/types";

export type SyncStatus = "loading" | "saved" | "saving" | "offline" | "error";

const SAVE_DELAY_MS = 800;
const RETRY_MS = 5000;

/**
 * Keeps the game data in the cloud: loads it on start, auto-saves every change (debounced),
 * listens for changes from the user's other devices and merges simultaneous edits.
 */
export function useCloudSync(data: GameData, setData: Dispatch<SetStateAction<GameData>>) {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [clientId] = useState(() => uid("device"));

  const userRef = useRef<string | null>(null);
  const revRef = useRef(0);
  const syncedRef = useRef<GameData>(DEFAULT_DATA);
  const syncedJsonRef = useRef("");
  const dataRef = useRef(data);
  dataRef.current = data;
  const savingRef = useRef<Promise<void> | null>(null);
  const retryRef = useRef<number | null>(null);

  const isDirty = () => JSON.stringify(dataRef.current) !== syncedJsonRef.current;

  const markSynced = useCallback((game: GameData, rev: number) => {
    revRef.current = rev;
    syncedRef.current = game;
    syncedJsonRef.current = JSON.stringify(game);
  }, []);

  const applyRemote = useCallback(
    (remote: CloudGame) => {
      markSynced(remote.data, remote.rev);
      setData(remote.data);
    },
    [markSynced, setData],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (savingRef.current) await savingRef.current.catch(() => undefined);
    const userId = userRef.current;
    if (!userId || !isDirty()) {
      if (userId) setStatus("saved");
      return;
    }
    const run = (async () => {
      const snapshot = dataRef.current;
      setStatus("saving");
      let res = await saveGame(userId, snapshot, revRef.current, clientId);
      let toSave = snapshot;
      if (!res.ok) {
        // Another device saved first: merge both versions instead of overwriting.
        if (!res.remote) throw new Error("No encontramos tus datos en la nube.");
        toSave = mergeGameData(syncedRef.current, snapshot, res.remote.data);
        res = await saveGame(userId, toSave, res.remote.rev, clientId);
        if (!res.ok) throw new Error("Hubo cambios simultáneos; reintentando.");
        const merged = toSave;
        setData((cur) => (cur === snapshot ? merged : mergeGameData(snapshot, cur, merged)));
        toast("Cambios combinados", { description: "Otro dispositivo también editó; se guardaron ambos cambios." });
      }
      markSynced(toSave, res.rev);
      setStatus(isDirty() ? "saving" : "saved");
    })();
    savingRef.current = run;
    try {
      await run;
    } catch (err) {
      console.error("[cloud-sync]", err);
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setStatus(offline ? "offline" : "error");
      if (retryRef.current) window.clearTimeout(retryRef.current);
      retryRef.current = window.setTimeout(() => void flush(), RETRY_MS);
    } finally {
      if (savingRef.current === run) savingRef.current = null;
    }
  }, [clientId, markSynced, setData]);

  // Initial load + realtime listener.
  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    setStatus("loading");
    setLoadError(null);

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoadError("Inicia sesión para cargar tus conversaciones.");
        return;
      }
      userRef.current = user.id;
      let game = await fetchGame(user.id);
      const legacy = loadLegacyData();
      if (!game) {
        game = (await createGame(user.id, legacy ?? structuredClone(DEFAULT_DATA), clientId)).game;
      } else if (legacy) {
        const merged = mergeGameData(DEFAULT_DATA, legacy, game.data);
        const res = await saveGame(user.id, merged, game.rev, clientId);
        if (res.ok) game = { ...game, data: merged, rev: res.rev };
      }
      if (legacy) {
        const moved = await uploadLegacyAudio(game.data).catch(() => 0);
        toast.success("Tus datos de este dispositivo se subieron a la nube", {
          description: moved ? `${moved} audio(s) movidos a tu cuenta.` : undefined,
        });
      }
      if (!alive) return;
      applyRemote(game);
      setHydrated(true);
      setStatus("saved");
      void cleanupOrphanLineAudio(referencedAudioIds(game.data)).catch(() => undefined);

      channel = supabase
        .channel(`game-data-${user.id}-${clientId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "game_data", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Parameters<typeof rowToCloudGame>[0] | undefined;
            if (!row || !("rev" in row)) return;
            const remote = rowToCloudGame(row);
            if (remote.clientId === clientId || remote.rev <= revRef.current) return;
            if (isDirty() || savingRef.current) return; // our pending save will merge it
            applyRemote(remote);
            toast("Actualizado desde otro dispositivo", { duration: 2500 });
          },
        )
        .subscribe();
    })().catch((err: unknown) => {
      console.error("[cloud-sync] load", err);
      if (!alive) return;
      setStatus("error");
      setLoadError("No pudimos conectar con la nube. Revisa tu internet e inténtalo de nuevo.");
    });

    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
      if (retryRef.current) window.clearTimeout(retryRef.current);
    };
  }, [attempt, applyRemote, clientId]);

  // Auto-save every change.
  useEffect(() => {
    if (!hydrated || !isDirty()) return;
    setStatus("saving");
    const t = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [data, hydrated, flush]);

  // Save before leaving, retry when back online, catch up when returning to the tab.
  useEffect(() => {
    if (!hydrated) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
      else void catchUp();
    };
    const onOnline = () => void flush();
    const onOffline = () => setStatus("offline");
    const catchUp = async () => {
      const userId = userRef.current;
      if (!userId || isDirty() || savingRef.current) return;
      const remote = await fetchGame(userId).catch(() => null);
      if (remote && remote.rev > revRef.current && !isDirty()) applyRemote(remote);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hydrated, flush, applyRemote]);

  return {
    status,
    hydrated,
    loadError,
    retry: () => setAttempt((a) => a + 1),
    flush,
    normalize: normalizeGameData,
  };
}
