const TMDB_BASE = "https://api.themoviedb.org/3";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
  };
}

export async function tmdbFetch<T>(
  endpoint: string,
  options?: { revalidate?: number }
): Promise<T> {
  const res = await fetch(`${TMDB_BASE}${endpoint}`, {
    headers: getHeaders(),
    next: { revalidate: options?.revalidate ?? 3600 },
  });
  if (!res.ok) throw new Error(`TMDB fetch failed: ${res.status}`);
  return res.json();
}

export const tmdbImage = (path: string, size: string = "w500") =>
  `https://image.tmdb.org/t/p/${size}${path}`;
