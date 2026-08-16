"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScanResult = {
  logId: number;
  status: string;
  filesFound: number;
  matched: number;
  unmatched: number;
  errors: string[];
};

type ScanLog = {
  id: number;
  status: string;
  files_found: number;
  matched: number;
  unmatched: number;
  errors: string;
  started_at: string;
  completed_at: string | null;
};

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsError(null);
    try {
      const res = await fetch("/api/admin/scan");
      const data = await res.json();
      if (data.success) {
        setLogs(data.data?.logs || []);
      } else {
        setLogsError(data.error || "Failed to load scan logs");
      }
    } catch {
      setLogsError("Connection error");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/scan", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult(data.data?.result);
        fetchLogs();
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Scanner</h1>

      <div className="rounded-xl border p-6 mb-8">
        <p className="text-muted-foreground mb-4">
          Scan the <code className="bg-muted px-1.5 py-0.5 rounded text-sm">data/movies/</code> folder to auto-detect and link video files to TMDB movies.
        </p>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-6 py-3 bg-netflix text-white rounded-lg font-semibold hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border p-6 mb-8 bg-card">
          <h2 className="font-bold mb-3">Last Scan Result</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{result.filesFound}</p>
              <p className="text-xs text-muted-foreground">Files Found</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{result.matched}</p>
              <p className="text-xs text-muted-foreground">Matched</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">{result.unmatched}</p>
              <p className="text-xs text-muted-foreground">Unmatched</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{result.status === "completed" ? "Done" : "Failed"}</p>
              <p className="text-xs text-muted-foreground">Status</p>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold mb-4">Scan History</h2>
      {loadingLogs ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logsError ? (
        <div className="flex flex-col items-center py-10">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <p className="text-muted-foreground text-sm mb-3">{logsError}</p>
          <Button onClick={fetchLogs} variant="outline" size="sm">Try Again</Button>
        </div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No scans yet.</p>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Files</th>
                <th className="text-left px-4 py-3 font-medium">Matched</th>
                <th className="text-left px-4 py-3 font-medium">Unmatched</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {log.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                  <td className="px-4 py-3">{log.files_found}</td>
                  <td className="px-4 py-3 text-green-500">{log.matched}</td>
                  <td className="px-4 py-3 text-yellow-500">{log.unmatched}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(log.started_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
