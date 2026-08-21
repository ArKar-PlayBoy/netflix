"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";

const IMG = "https://image.tmdb.org/t/p/w185";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function PosterMarquee({ posters }: { posters: string[] }) {
  if (posters.length === 0) return null;
  const doubled = [...posters, ...posters];
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute top-1/2 w-full" style={{ transform: "translateY(-50%) rotate(-6deg) scale(1.15)" }}>
        {[0, 1].map((row) => (
          <div key={row} className="overflow-hidden">
            <div
              className={`flex gap-4 w-max ${row === 0 ? "animate-marquee" : "animate-marquee-reverse"}`}
              style={{ opacity: row === 0 ? 0.32 : 0.16 }}
            >
              {doubled.map((path, i) => (
                <div key={`${row}-${i}`} className="flex-none w-[110px] h-[165px] rounded-lg overflow-hidden ring-1 ring-white/10 shadow-2xl bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}${path}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90" />
      <div className="absolute inset-0 bg-radial-fade" />
    </div>
  );
}

export default function LoginForm({
  posters,
  authError,
}: {
  posters: string[];
  authError: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const errorMessages: Record<string, string> = {
    not_configured: "Google sign-in is not configured yet.",
    invalid_state: "Sign-in session expired. Please try again.",
    token_exchange: "Could not complete sign-in with Google.",
    userinfo: "Could not read your Google profile.",
    no_profile: "Your Google account did not return a profile.",
    rate_limited: "Too many attempts. Please wait a moment.",
    server: "Something went wrong during sign-in. Please try again.",
  };
  const errorMsg =
    formError || (authError ? (errorMessages[authError] ?? "Sign-in failed. Please try again.") : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "signin" ? { email, password } : { email, password, name };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/");
        router.refresh();
      } else {
        setFormError(data.error || "Something went wrong.");
        setBusy(false);
      }
    } catch {
      setFormError("Connection error. Please try again.");
      setBusy(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-netflix/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-netflix/20 transition-all duration-200";

  return (
    <div className="relative min-h-dvh bg-black text-white overflow-hidden flex flex-col">
      <PosterMarquee posters={posters} />

      {/* Brand */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 pt-7 pb-2 animate-fade-up">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-black tracking-tight">
            vionix<span className="text-netflix">.</span>
          </span>
        </div>
        <span className="hidden sm:inline-flex items-center h-6 px-3 rounded-full border border-netflix/40 bg-netflix/10 text-[11px] font-semibold tracking-widest uppercase text-netflix">
          Streaming
        </span>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[400px]">
          {/* Headline */}
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] tracking-tight mb-3">
              Your movies.
              <br />
              <span className="text-netflix drop-shadow-[0_0_35px_rgba(229,9,20,0.4)]">Everywhere.</span>
            </h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
              One account. Your favorites synced on every device.
            </p>
          </div>

          {/* Glass auth card */}
          <div
            className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-6 shadow-2xl shadow-black/50 animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            {/* Segmented tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.06] mb-5">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setFormError("");
                  }}
                  className={`py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    mode === m ? "bg-netflix text-white shadow-lg shadow-netflix/25" : "text-white/50 hover:text-white"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={60}
                  required
                  className={inputClass}
                />
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  required
                  className={`${inputClass} pl-11`}
                />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Password (8+ chars)" : "Password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                className={inputClass}
              />

              {errorMsg && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300 leading-snug">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-netflix font-semibold text-sm transition-all duration-200 hover:bg-netflix-hover hover:shadow-[0_8px_30px_rgba(229,9,20,0.35)] active:scale-[0.99] disabled:opacity-50 mt-1"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] text-white/30 uppercase tracking-wider">or continue with</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Google */}
            <a
              href="/api/auth/google"
              className="group flex items-center justify-center gap-3 w-full py-2.5 rounded-xl bg-white text-black font-semibold text-sm transition-all duration-200 hover:bg-white/90 active:scale-[0.99]"
            >
              <GoogleIcon />
              Continue with Google
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center animate-fade-up"
        style={{ animationDelay: "0.35s" }}
      >
        <p className="text-[13px] text-white/60">
          Developed by{" "}
          <span className="font-semibold text-white border-b border-netflix/60 pb-px">
            Ar Kar Moe Myint
          </span>
        </p>
        <p className="text-[11px] text-white/25 mt-1.5">
          © {new Date().getFullYear()} Vionix · Terms of Use · Privacy
        </p>
      </footer>
    </div>
  );
}
