import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, LogIn, MailCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { GameButton } from "@/components/game/GameButton";
import bg from "@/assets/pinateria-bg.webp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Piñata Talk" },
      {
        name: "description",
        content: "Inicia sesión para guardar tus conversaciones y audios en la nube y abrirlos desde cualquier dispositivo.",
      },
      { property: "og:title", content: "Entrar — Piñata Talk" },
      {
        property: "og:description",
        content: "Inicia sesión para guardar tus conversaciones y audios en la nube y abrirlos desde cualquier dispositivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const inputClass =
  "w-full rounded-2xl border-[3px] border-plum/40 bg-card px-4 py-3 font-display text-base font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:border-pink focus:outline-none";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState<"confirm" | "reset" | null>(null);

  // Already signed in? Go straight to the game.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/" });
    });
  }, [navigate]);

  const showError = (err: { message?: string } | null) => {
    toast.error("No se pudo completar", {
      description: err?.message ?? "Revisa tus datos e inténtalo de nuevo.",
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return showError(error);
        void navigate({ to: "/" });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) return showError(error);
        if (!data.session) {
          setEmailSent("confirm");
        } else {
          void navigate({ to: "/" });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) return showError(error);
        setEmailSent("reset");
      }
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "lovable") => {
    if (busy) return;
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    setBusy(false);
    if (result.error) showError(result.error);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <img
        src={bg}
        alt=""
        aria-hidden
        className="anim-ken-burns absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-plum/45" />

      <div className="bubble-game tone-pink anim-bubble-in relative z-10 w-full max-w-md px-6 py-7 md:px-8">
        <p className="text-center font-display text-sm font-bold uppercase tracking-widest text-pink-deep">
          Piñata Talk 🪅
        </p>
        <h1 className="mt-1 text-center font-display text-3xl font-bold leading-tight text-foreground">
          {mode === "signin" && "¡Hola de nuevo!"}
          {mode === "signup" && "Crea tu cuenta"}
          {mode === "forgot" && "Recuperar contraseña"}
        </h1>
        <p className="mt-2 text-center text-sm font-semibold text-muted-foreground">
          Tus conversaciones y audios se guardan en la nube: podrás abrirlos desde tu teléfono, tableta o computador.
        </p>

        {emailSent ? (
          <div className="mt-5 rounded-2xl border-[3px] border-mint bg-mint/15 p-4 text-center">
            <MailCheck className="mx-auto size-8 text-mint" />
            <p className="mt-2 font-display text-lg font-bold text-foreground">Revisa tu correo 📬</p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {emailSent === "confirm"
                ? `Te enviamos un enlace de confirmación a ${email}. Ábrelo para activar tu cuenta.`
                : `Te enviamos un enlace a ${email} para crear una contraseña nueva.`}
            </p>
            <GameButton
              tone="lilac"
              size="sm"
              className="mt-4"
              onClick={() => {
                setEmailSent(null);
                setMode("signin");
              }}
            >
              Volver a entrar
            </GameButton>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Tu correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              {mode !== "forgot" && (
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="Tu contraseña (mínimo 6 letras)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              )}
              <GameButton
                type="submit"
                tone="sun"
                size="lg"
                className="w-full justify-center"
                disabled={busy}
                icon={mode === "signup" ? <UserPlus /> : mode === "forgot" ? <KeyRound /> : <LogIn />}
              >
                {busy
                  ? "Un momento…"
                  : mode === "signin"
                    ? "Entrar"
                    : mode === "signup"
                      ? "Crear mi cuenta"
                      : "Enviarme el enlace"}
              </GameButton>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <span className="h-0.5 flex-1 rounded bg-border" /> o entra con <span className="h-0.5 flex-1 rounded bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <GameButton tone="sky" size="md" disabled={busy} onClick={() => void oauth("google")}>
                Google
              </GameButton>
              <GameButton tone="lilac" size="md" disabled={busy} onClick={() => void oauth("lovable")}>
                Lovable
              </GameButton>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold">
              {mode !== "signin" && (
                <button type="button" className="text-pink-deep underline" onClick={() => setMode("signin")}>
                  Ya tengo cuenta
                </button>
              )}
              {mode !== "signup" && (
                <button type="button" className="text-pink-deep underline" onClick={() => setMode("signup")}>
                  Crear cuenta nueva
                </button>
              )}
              {mode === "signin" && (
                <button type="button" className="text-muted-foreground underline" onClick={() => setMode("forgot")}>
                  Olvidé mi contraseña
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
