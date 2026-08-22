"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Shield, ShieldAlert, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type SecEvent = {
  id: number;
  ip: string;
  type: string;
  detail: string;
  hits: number;
  first_seen: string;
  last_seen: string;
  blocked_until: string | null;
};

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  bruteforce: { label: "Brute Force", cls: "text-red-500 bg-red-500/10 border-red-500/30" },
  rate_limit: { label: "Rate Limit Abuse", cls: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30" },
};

export default function SecurityPage() {
  const router = useRouter();
  const [events, setEvents] = useState<SecEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // Live alert modal state
  const [alertEvents, setAlertEvents] = useState<SecEvent[] | null>(null);
  const dismissedIdRef = useRef<number>(0);
  const [pollPaused, setPollPaused] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security");
      const d = await res.json();
      if (d.success) {
        setEvents(d.data?.events || []);
        setTotal(d.data?.total || 0);
        if (d.data?.events?.length) {
          dismissedIdRef.current = Math.max(dismissedIdRef.current, d.data.events[0].id);
        }
      } else setError(d.error || "Failed to load");
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for NEW events since last seen → trigger modal alert
  useEffect(() => {
    if (pollPaused) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/security?since=${dismissedIdRef.current}`);
        const d = await res.json();
        const fresh: SecEvent[] = d.data?.events ?? [];
        if (fresh.length > 0) {
          // Only attacks worth waking the admin for
          const serious = fresh.filter(
            (e) => e.blocked_until || (e.type === "bruteforce" && e.hits >= 10) || e.hits >= 10
          );
          if (serious.length > 0) setAlertEvents(serious);
          if (fresh[0]) dismissedIdRef.current = Math.max(dismissedIdRef.current, fresh[0].id);
          load();
        }
      } catch {}
    }, 20000);
    return () => clearInterval(id);
  }, [load, pollPaused]);

  const clearAll = async () => {
    if (!confirm("Clear all security events? Active bans are also lifted.")) return;
    setClearing(true);
    try {
      await fetch("/api/admin/security", { method: "DELETE" });
      setPage1();
    } catch {} finally {
      setClearing(false);
    }
  };

  const setPage1 = () => {
    dismissedIdRef.current = 0;
    fetch("/api/admin/security")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setEvents([]); setTotal(0); }
      })
      .catch(() => {});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-netflix" />
            Security
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Attack detection &amp; auto-bans. Escalation: 10 brute-force hits → 24h ban. Below 10 is ignored.
          </p>
        </div>
        {total > 0 && (
          <button onClick={clearAll} disabled={clearing} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50">
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear All
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={load} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : total === 0 ? (
        <div className="text-center py-20 rounded-xl border">
          <Shield className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <p className="font-medium">No threats detected</p>
          <p className="text-muted-foreground text-sm mt-1">Attack attempts will appear here automatically.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">IP Address</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Detail</th>
                <th className="text-left px-4 py-3 font-medium">Hits</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => {
                const meta = TYPE_LABELS[e.type] ?? { label: e.type, cls: "text-muted-foreground bg-muted border-border" };
                const banned = e.blocked_until && new Date(e.blocked_until) > new Date();
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono">{e.ip}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[240px] truncate">{e.detail}</td>
                    <td className="px-4 py-3 font-bold">{e.hits}</td>
                    <td className="px-4 py-3">
                      {banned ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-medium text-xs">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Banned
                        </span>
                      ) : (
                        <span className="text-green-500 text-xs font-medium">Watching</span>
                      )}
                      {banned && e.blocked_until && (
                        <p className="text-[10px] text-muted-foreground">until {new Date(e.blocked_until).toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(e.last_seen).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ⚠️ Live attack alert modal */}
      {alertEvents && alertEvents.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70">
          <div className="relative w-full max-w-md rounded-2xl border border-red-500/40 bg-card shadow-2xl p-6 animate-fade-up">
            <button
              onClick={() => { setAlertEvents(null); setPollPaused(false); }}
              className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-500/15">
                <ShieldAlert className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-500">⚠️ Attack Detected</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Suspicious activity was blocked automatically.</p>
              </div>
            </div>
            {/* Message to the attacker */}
            <div className="rounded-xl border border-netflix/30 bg-netflix/5 p-3.5 mb-4">
              <p className="text-[11px] uppercase tracking-widest text-netflix font-semibold mb-1.5">Message to attacker</p>
              <p className="text-[14px] leading-relaxed text-foreground">
                မင်းတို့ကလေးကလားအထာလေးတွေနဲ့ အနည်းဆုံးတော့ Java လောက်တော့ တတ်ထားသင့်တာပေါ့။
                မင်းရဲ့ IP Address ကိုတော့ သိမ်းထားလိုက်ပြီ။
                သနားလို့ နားလည်ပေးလိုက်မယ် —{" "}
                <span className="text-netflix font-bold">နောက်နောင် မလုပ်နဲ့။</span>
              </p>
            </div>

            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
              {alertEvents.map((e) => (
                <div key={`${e.ip}-${e.type}`} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{e.ip}</span>
                    <span className="text-red-500 font-bold">{e.hits} hits</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{e.detail}</p>
                  {e.blocked_until && (
                    <p className="text-xs text-red-500 mt-1 font-medium">
                      🚫 Banned until {new Date(e.blocked_until).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setAlertEvents(null); router.push("/admin/security"); }}>
                View Details
              </Button>
              <Button variant="outline" onClick={() => setAlertEvents(null)}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
