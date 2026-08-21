"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { LogIn, LogOut, Loader2 } from "lucide-react";

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Hard navigation: server re-checks session and serves /login immediately
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
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
          <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-netflix/20 flex items-center justify-center text-sm font-bold text-netflix">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {open && (
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
            My Favorites
          </Link>
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
    </div>
  );
}
