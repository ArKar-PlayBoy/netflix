"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, AlertTriangle, CheckCircle2, Globe, MonitorPlay, Signal, Layers, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_EMBED_SERVERS } from "@/lib/app-settings";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-netflix/40 focus:border-netflix/50 transition-colors";

type ServerRow = { name: string; movie: string; tv: string };

function parseServerRows(raw: Record<string, string>): ServerRow[] {
  if (raw.embed_servers) {
    try {
      const arr = JSON.parse(raw.embed_servers);
      if (Array.isArray(arr)) {
        return arr.slice(0, MAX_EMBED_SERVERS).map((s) => ({
          name: typeof s?.name === "string" ? s.name : "",
          movie: typeof s?.movie === "string" ? s.movie : "",
          tv: typeof s?.tv === "string" ? s.tv : "",
        }));
      }
    } catch {}
  }
  // Mirror of the server-side legacy shim so saved templates appear as an editable row
  const movie = raw.embed_movie_template ?? "";
  const tv = raw.embed_tv_template ?? "";
  return movie || tv ? [{ name: "Server 1", movie, tv }] : [];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [serverRows, setServerRows] = useState<ServerRow[]>([]);
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
        const loaded = data.data?.settings || {};
        setSettings(loaded);
        setServerRows(parseServerRows(loaded));
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
      setSaveMsg(data.success ? "Settings saved" : data.error || "Failed to save");
      if (data.success) setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateServerRows = (rows: ServerRow[]) => {
    const capped = rows.slice(0, MAX_EMBED_SERVERS);
    setServerRows(capped);
    update("embed_servers", JSON.stringify(capped));
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
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure how Vionix behaves</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-netflix text-white rounded-lg text-sm font-semibold hover:bg-netflix-hover transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-netflix/20"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {saveMsg && (
        <div
          className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
            saveMsg === "Settings saved"
              ? "border-green-500/30 bg-green-500/10 text-green-600"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {saveMsg === "Settings saved" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {saveMsg}
        </div>
      )}

      <div className="space-y-5">
        {/* General */}
        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/30">
            <Globe className="h-4 w-4 text-netflix" />
            <div>
              <h2 className="font-semibold text-sm">General</h2>
              <p className="text-xs text-muted-foreground">Branding and region</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">TMDB Region</label>
              <input
                type="text"
                value={settings.tmdb_region || ""}
                onChange={(e) => update("tmdb_region", e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="US"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1">Two-letter country code for regional content</p>
            </div>
          </div>
        </section>

        {/* Playback */}
        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/30">
            <MonitorPlay className="h-4 w-4 text-netflix" />
            <div>
              <h2 className="font-semibold text-sm">Playback</h2>
              <p className="text-xs text-muted-foreground">Default video quality for viewers</p>
            </div>
          </div>
          <div className="p-5">
            <label className="text-sm font-medium block mb-1.5">Default Quality</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: "auto", label: "Auto" },
                { value: "4k", label: "4K" },
                { value: "1080p", label: "1080p" },
                { value: "720p", label: "720p" },
                { value: "480p", label: "480p" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update("default_quality", opt.value)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    (settings.default_quality || "auto") === opt.value
                      ? "bg-netflix text-white border-netflix shadow-md shadow-netflix/25"
                      : "border-border text-muted-foreground hover:border-netflix/40 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* External sources */}
        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/30">
            <Layers className="h-4 w-4 text-netflix" />
            <div>
              <h2 className="font-semibold text-sm">External Sources</h2>
              <p className="text-xs text-muted-foreground">Embed fallback for titles without an uploaded file</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Embed Playback</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "on", label: "Enabled" },
                  { value: "off", label: "Disabled" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("embed_enabled", opt.value)}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      (settings.embed_enabled || "off") === opt.value
                        ? opt.value === "on"
                          ? "bg-netflix text-white border-netflix shadow-md shadow-netflix/25"
                          : "bg-muted text-foreground border-border"
                        : "border-border text-muted-foreground hover:border-netflix/40 hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Third-party providers are not affiliated with Vionix — content and ads come from them
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Servers</label>
                <button
                  onClick={() => updateServerRows([...serverRows, { name: `Server ${serverRows.length + 1}`, movie: "", tv: "" }])}
                  disabled={serverRows.length >= MAX_EMBED_SERVERS}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs font-medium hover:border-netflix/40 transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="h-3 w-3" /> Add Server
                </button>
              </div>
              {serverRows.length === 0 && (
                <p className="text-xs text-muted-foreground mb-2">No servers configured — embed playback stays off.</p>
              )}
              <div className="space-y-3">
                {serverRows.map((row, i) => (
                  <div key={i} className="p-3 rounded-xl border border-border bg-background/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateServerRows(serverRows.map((r, j) => (j === i ? { ...r, name: e.target.value.slice(0, 40) } : r)))}
                        placeholder={`Server ${i + 1}`}
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        onClick={() => updateServerRows(serverRows.filter((_, j) => j !== i))}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
                        aria-label={`Remove ${row.name || `server ${i + 1}`}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={row.movie}
                      onChange={(e) => updateServerRows(serverRows.map((r, j) => (j === i ? { ...r, movie: e.target.value.trim() } : r)))}
                      placeholder={`https://provider.example/embed/movie/{id}`}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={row.tv}
                      onChange={(e) => updateServerRows(serverRows.map((r, j) => (j === i ? { ...r, tv: e.target.value.trim() } : r)))}
                      placeholder={`https://provider.example/embed/tv/{id}/{s}/{e}`}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tokens per row: top = name · middle = movie URL · bottom = TV URL. URL tokens: {"{id}"} = TMDB ID, {"{s}"} = season, {"{e}"} = episode. Must start with https:// (max {MAX_EMBED_SERVERS} servers). Viewers auto-connect to the fastest reachable one.
              </p>
            </div>
          </div>
        </section>

        {/* Network thresholds */}
        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/30">
            <Signal className="h-4 w-4 text-netflix" />
            <div>
              <h2 className="font-semibold text-sm">Auto-Quality Thresholds</h2>
              <p className="text-xs text-muted-foreground">Quality picked based on viewer connection</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">WiFi</label>
              <select value={settings.network_threshold_wifi || "4k"} onChange={(e) => update("network_threshold_wifi", e.target.value)} className={inputClass}>
                <option value="4k">4K</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">4G</label>
              <select value={settings.network_threshold_4g || "1080p"} onChange={(e) => update("network_threshold_4g", e.target.value)} className={inputClass}>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">3G</label>
              <select value={settings.network_threshold_3g || "720p"} onChange={(e) => update("network_threshold_3g", e.target.value)} className={inputClass}>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
