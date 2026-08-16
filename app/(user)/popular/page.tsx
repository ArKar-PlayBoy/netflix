import Movie from "@/components/movie";
import Pagination from "@/components/pagination";
import { MovieType } from "@/types/global";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_TOKEN;
const MAX_PAGES = 20;

async function fetchPopular(page: number): Promise<{ movies: MovieType[]; totalPages: number }> {
  try {
    const res = await fetch(`${TMDB_BASE}/movie/popular?page=${page}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { movies: [], totalPages: 0 };
    const data = await res.json();
    return {
      movies: data.results ?? [],
      totalPages: Math.min(data.total_pages ?? 0, MAX_PAGES),
    };
  } catch {
    return { movies: [], totalPages: 0 };
  }
}

export default async function PopularPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);

  const { movies, totalPages } = await fetchPopular(page);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Popular Movies</h1>
      {movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {movies.map((movie) => (
            <Movie key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-10 text-center">No popular movies found.</p>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl="/popular?page="
        />
      )}
    </div>
  );
}
