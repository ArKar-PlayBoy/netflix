"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, History, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type AuditLog = {
  id: number;
  action: string;
  detail: string;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  login: "text-green-500",
  logout: "text-muted-foreground",
  setup: "text-blue-500",
  "video.delete": "text-red-500",
  "video.link": "text-netflix",
  "scan.run": "text-yellow-500",
  "settings.update": "text-blue-500",
  "featured.add": "text-green-500",
  "featured.remove": "text-red-500",
  "featured.clear": "text-red-500",
  "audit.clear": "text-red-500",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/audit?page=${p}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data?.logs || []);
        setTotal(data.data?.total || 0);
      } else {
        setError(data.error || "Failed to load audit logs");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  const handleClear = async () => {
    if (!confirm("Clear all audit logs?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/admin/audit", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setPage(1);
        fetchLogs(1);
      }
    } catch {
    } finally {
      setClearing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        {total > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
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
          <Button onClick={() => fetchLogs(page)} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 rounded-xl border">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No audit logs yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Detail</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className={`px-4 py-3 whitespace-nowrap font-medium ${ACTION_COLORS[log.action] || ""}`}>
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.detail}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} entries)
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
