"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Trash2, Loader2, Send } from "lucide-react";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  user_name: string;
  user_picture: string | null;
  user_id: number;
};

export default function CommentsSection({ movieId }: { movieId: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetch(`/api/comments?movieId=${movieId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setComments(d.data?.comments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, body: text.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        setComments(d.data?.comments ?? []);
        setText("");
      } else {
        setError(d.error || "Failed to post");
      }
    } catch {
      setError("Connection error");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    try {
      const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  };

  return (
    <div className="mb-8">
      <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
        <MessageSquare className="h-5 w-5" />
        Comments ({comments.length})
      </h2>

      <form onSubmit={submit} className="flex gap-2 mb-5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your thoughts..."
          maxLength={1000}
          className="flex-1 px-4 py-2.5 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-netflix/40 focus:border-netflix/50"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-4 py-2.5 bg-netflix text-white rounded-lg text-sm font-medium hover:bg-netflix-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 p-3 rounded-xl border bg-card">
              {c.user_picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.user_picture} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-netflix/20 flex items-center justify-center text-sm font-bold text-netflix flex-shrink-0">
                  {c.user_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.user_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 mt-0.5 break-words whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
