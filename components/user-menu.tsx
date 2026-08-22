"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { LogIn, LogOut, Loader2, KeyRound, X } from "lucide-react";

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  picture: string | null;
};

export default function UserMenu() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Set-password panel state
  const [showPwPanel, setShowPwPanel] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data?.user ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowPwPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openPasswordPanel = async () => {
    setShowPwPanel(true);
    setPwMsg(null);
    setCurrentPw("");
    setNewPw("");
    try {
      const d = await fetch("/api/auth/set-password").then((r) => r.json());
      if (d.success) setHasPassword(!!d.data?.hasPassword);
    } catch {}
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: newPw,
          ...(hasPassword ? { currentPassword: currentPw } : {}),
        }),
      });
      const d = await res.json();
      if (d.success) {
        setPwMsg({ ok: true, text: hasPassword ? "Password changed ✓" : "Password created — email login now works ✓" });
        setHasPassword(true);
        setCurrentPw("");
        setNewPw("");
      } else {
        setPwMsg({ ok: false, text: d.error || "Failed" });
      }
    } catch {
      setPwMsg({ ok: false, text: "Connection error" });
    } finally {
      setPwBusy(false);
    }
  };

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-netflix text-white text-sm font-medium hover:bg-netflix-hover transition-colors"
      >
        <LogIn className="h-4 w-4" />
        Sign in
      </a>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-netflix/50 transition-all"
        aria-label="Account menu"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-netflix/20 flex items-center justify-center text-sm font-bold text-netflix">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {open && !showPwPanel && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card shadow-lg p-2 z-50">
          <div className="px-3 py-2 border-b mb-1">
            <p className="font-medium text-sm truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Link
            href="/favorites"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
          >
            My List
          </Link>
          <button
            onClick={openPasswordPanel}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
          >
            <KeyRound className="h-4 w-4" />
            Set Password
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out
          </button>
        </div>
      )}

      {/* Set password sub-panel */}
      {open && showPwPanel && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-card shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-netflix" />
              {hasPassword ? "Change Password" : "Create Password"}
            </h3>
            <button onClick={() => setShowPwPanel(false)} className="p-1 hover:bg-muted rounded" aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {hasPassword === false && (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Your account uses Google sign-in. Create a password to also log in with your email.
            </p>
          )}

          <form onSubmit={submitPassword} className="space-y-2.5">
            {hasPassword && (
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/40"
              />
            )}
            <input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (8+ chars)"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full px-3 py-2 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/40"
            />
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={() => setShowNew(!showNew)} className="text-xs text-muted-foreground hover:text-foreground">
                {showNew ? "Hide" : "Show"}
              </button>
            </div>

            {pwMsg && (
              <p className={`text-xs ${pwMsg.ok ? "text-green-600" : "text-red-500"}`}>{pwMsg.text}</p>
            )}

            <button
              type="submit"
              disabled={pwBusy || newPw.length < 8}
              className="w-full py-2 bg-netflix text-white rounded-lg text-sm font-medium hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pwBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Password
            </button>
          </form>
        </div>
      )}
    </div>
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
    }
  }
}
