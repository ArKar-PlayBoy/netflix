"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Mail, Loader2 } from "lucide-react";

const IMG = "https://image.tmdb.org/t/p/w185";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function PosterMarquee({ posters }: { posters: string[] }) {
  if (posters.length === 0) return null;
  const doubled = [...posters, ...posters];
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
      <div
        className="absolute top-1/2 w-full"
        style={{ transform: "translateY(-50%) rotate(-6deg) scale(1.15)" }}
      >
        {[0, 1].map((row) => (
          <div key={row} className="overflow-hidden">
            <div
              className={`flex gap-4 w-max ${row === 0 ? "animate-marquee" : "animate-marquee-reverse"}`}
              style={{ opacity: row === 0 ? 0.35 : 0.18 }}
            >
              {doubled.map((path, i) => (
                <div
                  key={`${row}-${i}`}
                  className="flex-none w-[110px] h-[165px] rounded-lg overflow-hidden ring-1 ring-white/10 shadow-2xl bg-muted"
                >
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

function EmailForm({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    onError("");
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
        onError(data.error || "Something went wrong.");
      }
    } catch {
      onError("Connection error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            maxLength={60}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/35 text-sm focus:outline-none focus:border-netflix focus:ring-2 focus:ring-netflix/30 transition-colors"
          />
        )}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/35 text-sm focus:outline-none focus:border-netflix focus:ring-2 focus:ring-netflix/30 transition-colors"
          />
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Password (8+ chars, letter + number)" : "Password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/35 text-sm focus:outline-none focus:border-netflix focus:ring-2 focus:ring-netflix/30 transition-colors"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-netflix font-semibold text-base transition-all duration-200 hover:bg-netflix-hover hover:shadow-[0_0_40px_rgba(229,9,20,0.35)] active:scale-[0.99] disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-white/45">
        {mode === "signin" ? "New to MovieApp? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            onError("");
          }}
          className="text-white font-medium hover:text-netflix transition-colors"
        >
          {mode === "signin" ? "Sign up now" : "Sign in"}
        </button>
      </p>
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
  const [pageError, setPageError] = useState("");

  const errorMessages: Record<string, string> = {
    not_configured: "Google sign-in is not configured yet. Please try again later.",
    invalid_state: "Sign-in session expired. Please try again.",
    token_exchange: "Could not complete sign-in with Google. Please try again.",
    userinfo: "Could not read your Google profile. Please try again.",
    no_profile: "Your Google account did not return a profile.",
    rate_limited: "Too many attempts. Please wait a moment and try again.",
    server: "Something went wrong during sign-in. Please try again.",
  };
  const errorMsg = pageError || (authError ? (errorMessages[authError] ?? "Sign-in failed. Please try again.") : "");

  return (
    <div className="relative min-h-dvh bg-black text-white overflow-hidden flex flex-col">
      {/* Background stays glued to the viewport — never scrolls below content */}
      <PosterMarquee posters={posters} />

      {/* Top bar */}
      <header className="relative z-10 flex items-center gap-2 px-6 md:px-12 py-6 animate-fade-up">
        <Clapperboard className="h-7 w-7 text-netflix" />
        <span className="text-xl font-bold tracking-tight">MovieApp</span>
      </header>

      {/* Hero copy — sits directly on the scene */}
      <main className="relative z-10 flex-1 flex items-center px-6 md:px-12 lg:px-20 py-10">
        <div className="max-w-md w-full">
          {errorMsg && (
            <p className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 animate-fade-up">
              {errorMsg}
            </p>
          )}

          <p
            className="text-netflix text-sm font-semibold tracking-[0.25em] uppercase mb-4 animate-fade-up"
            style={{ animationDelay: "0.05s" }}
          >
            Unlimited movies
          </p>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-5 animate-fade-up"
            style={{ animationDelay: "0.12s" }}
          >
            Your movies.
            <br />
            <span className="text-netflix drop-shadow-[0_0_30px_rgba(229,9,20,0.35)]">
              Everywhere.
            </span>
          </h1>

          <p
            className="text-white/60 text-base leading-relaxed mb-8 max-w-sm animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            One account. Your favorites synced across every device — phone, tablet, TV.
          </p>

          <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <EmailForm onError={setPageError} />

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-xs text-white/40 uppercase tracking-wider">or</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            <a
              href="/api/auth/google"
              className="group flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-white/10 border border-white/15 font-semibold text-sm transition-all duration-200 hover:bg-white/15 active:scale-[0.99]"
            >
              <GoogleIcon />
              Continue with Google
            </a>

            <p className="mt-6 text-xs text-white/35 flex items-center gap-2 flex-wrap">
              <span>HD–4K streaming</span>
              <span className="text-netflix">•</span>
              <span>Synced favorites</span>
              <span className="text-netflix">•</span>
              <span>Free forever</span>
            </p>
          </div>
        </div>
      </main>

      {/* Legal */}
      <footer className="relative z-10 px-6 md:px-12 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-fade-up" style={{ animationDelay: "0.4s" }}>
        <p className="text-xs text-white/35">
          By continuing, you agree to our Terms of Use and Privacy Policy.
        </p>
      </footer>
    </div>
  );
}
