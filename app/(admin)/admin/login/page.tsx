"use client";

import { useState } from "react";
import { Clapperboard, Loader2, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [noAdmin, setNoAdmin] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success && data.needsSetup) {
        setNoAdmin(true);
        setError("");
      } else if (data.success) {
        window.location.href = "/admin/dashboard";
      } else {
        setError(data.error || "Invalid password");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Clapperboard className="h-12 w-12 text-netflix mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter password to continue
          </p>
        </div>

        {noAdmin ? (
          <div className="rounded-xl border bg-card p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              No admin account found. Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ADMIN_PASSWORD</code> in your <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env</code> file and restart the server.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-left font-mono">
              ADMIN_PASSWORD=&quot;your-password&quot;
            </div>
            <button
              onClick={() => setNoAdmin(false)}
              className="px-4 py-2 bg-netflix text-white rounded-lg text-sm font-medium hover:bg-netflix-hover transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 pr-10 rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-netflix/50 focus:border-netflix"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-netflix hover:bg-netflix-hover text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
