"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setSettings(data.data?.settings || {});
      } else {
        setError(data.error || "Failed to load settings");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg("Settings saved");
      } else {
        setSaveMsg(data.error || "Failed to save");
      }
    } catch {
      setSaveMsg("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

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
        <Button onClick={fetchSettings} variant="outline" size="sm">Try Again</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-netflix text-white rounded-lg text-sm font-medium hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
        {saveMsg && (
          <span className={`text-sm ${saveMsg.includes("error") || saveMsg.includes("Error") ? "text-destructive" : "text-green-500"}`}>
            {saveMsg}
          </span>
        )}
      </div>

      <div className="space-y-6 max-w-xl">
        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-bold mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">App Name</label>
              <input
                type="text"
                value={settings.app_name || ""}
                onChange={(e) => update("app_name", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">TMDB Region</label>
              <input
                type="text"
                value={settings.tmdb_region || ""}
                onChange={(e) => update("tmdb_region", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-bold mb-4">Video Quality</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Default Quality</label>
              <select
                value={settings.default_quality || "auto"}
                onChange={(e) => update("default_quality", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              >
                <option value="auto">Auto (network-based)</option>
                <option value="4k">4K</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Video Extensions</label>
              <input
                type="text"
                value={settings.video_extensions || ""}
                onChange={(e) => update("video_extensions", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated list</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-5 bg-card">
          <h2 className="font-bold mb-4">Network Thresholds (Auto Quality)</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">WiFi</label>
              <select
                value={settings.network_threshold_wifi || "4k"}
                onChange={(e) => update("network_threshold_wifi", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              >
                <option value="4k">4K</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">4G</label>
              <select
                value={settings.network_threshold_4g || "1080p"}
                onChange={(e) => update("network_threshold_4g", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              >
                <option value="4k">4K</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">3G</label>
              <select
                value={settings.network_threshold_3g || "720p"}
                onChange={(e) => update("network_threshold_3g", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/50"
              >
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
