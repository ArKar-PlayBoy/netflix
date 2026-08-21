import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import LoginForm from "./login-form";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function getTrendingPosters(): Promise<string[]> {
  try {
    const res = await fetch(`${TMDB_BASE}/trending/movie/day`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? [])
      .map((m: { poster_path?: string | null }) => m.poster_path)
      .filter(Boolean)
      .slice(0, 14);
  } catch {
    return [];
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const [{ auth_error }, posters] = await Promise.all([
    searchParams,
    getTrendingPosters(),
  ]);

  return <LoginForm posters={posters} authError={auth_error ?? null} />;
}
