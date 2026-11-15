import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GameButton } from "@/components/game/GameButton";
import bg from "@/assets/pinateria-bg.webp";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Piñata Talk" },
      { name: "description", content: "Crea una contraseña nueva para tu cuenta de Piñata Talk." },
      { property: "og:title", content: "Nueva contraseña — Piñata Talk" },
      { property: "og:description", content: "Crea una contraseña nueva para tu cuenta de Piñata Talk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const inputClass =
  "w-full rounded-2xl border-[3px] border-plum/40 bg-card px-4 py-3 font-display text-base font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:border-pink focus:outline-none";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // The recovery link arrives with type=recovery in the URL hash; Supabase
  // turns it into a recovery session and fires PASSWORD_RECOVERY.
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden", { description: "Escríbelas igual en los dos campos." });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("No se pudo cambiar la contraseña", { description: error.message });
      return;
    }
    toast.success("¡Contraseña actualizada! 🎉");
    void navigate({ to: "/" });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <img src={bg} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-plum/45" />

      <div className="bubble-game tone-sun anim-bubble-in relative z-10 w-full max-w-md px-6 py-7 md:px-8">
        <h1 className="text-center font-display text-3xl font-bold text-foreground">Contraseña nueva 🔑</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Contraseña nueva (mínimo 6 letras)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Repítela para confirmar"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
            <GameButton type="submit" tone="mint" size="lg" className="w-full justify-center" disabled={busy} icon={<KeyRound />}>
              {busy ? "Guardando…" : "Guardar contraseña"}
            </GameButton>
          </form>
        ) : (
          <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
            Este enlace no es válido o ya se usó. Pide uno nuevo desde la pantalla de entrada, en «Olvidé mi
            contraseña».
          </p>
        )}
      </div>
    </main>
  );
}
