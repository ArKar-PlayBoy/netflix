"use client";

import { useEffect, useState } from "react";
import { Film, HardDrive, CheckCircle, AlertCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [stats, setStats] = useState<{ total: number; withTmdbId: number; withoutTmdbId: number } | null>(null);
  const [disk, setDisk] = useState<{ movieCount: number; totalSizeGB: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, diskRes] = await Promise.all([
        fetch("/api/admin/stats").then((r) => r.json()),
        fetch("/api/admin/disk").then((r) => r.json()),
      ]);
      if (statsRes.success) setStats(statsRes.data?.stats);
      if (diskRes.success) setDisk(diskRes.data?.disk);
      if (!statsRes.success && !diskRes.success) {
        setError("Failed to load dashboard data");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchData} variant="outline">Try Again</Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-netflix/10">
              <Film className="h-5 w-5 text-netflix" />
            </div>
            <span className="text-sm text-muted-foreground">Total Videos</span>
          </div>
          <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
        </div>

        <div className="p-5 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Linked to TMDB</span>
          </div>
          <p className="text-3xl font-bold">{stats?.withTmdbId ?? 0}</p>
        </div>

        <div className="p-5 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <span className="text-sm text-muted-foreground">Unlinked</span>
          </div>
          <p className="text-3xl font-bold">{stats?.withoutTmdbId ?? 0}</p>
        </div>

        <div className="p-5 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <HardDrive className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Storage Used</span>
          </div>
          <p className="text-3xl font-bold">{disk?.totalSizeGB ?? "0"} GB</p>
          <p className="text-xs text-muted-foreground mt-1">{disk?.movieCount ?? 0} files</p>
        </div>
      </div>
    </div>
  );
}
