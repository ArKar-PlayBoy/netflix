import Link from "next/link";
import HeroBanner from "@/components/hero-banner";
import MovieRow from "@/components/movie-row";
import { Button } from "@/components/ui/button";
import { MovieType } from "@/types/global";
import { ArrowRight } from "lucide-react";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_TOKEN;
const TIMEOUT = 8000;

async function fetchWithTimeout(url: string, revalidate: number): Promise<{ movies: MovieType[]; totalPages: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { movies: [], totalPages: 0 };
    const data = await res.json();
    return { movies: data.results ?? [], totalPages: data.total_pages ?? 0 };
  } catch {
    clearTimeout(timeout);
    return { movies: [], totalPages: 0 };
  }
}

async function fetchAllSections() {
  const [nowPlaying, topRated, upcoming, popular] = await Promise.all([
    fetchWithTimeout(`${TMDB_BASE}/movie/now_playing`, 3600),
    fetchWithTimeout(`${TMDB_BASE}/movie/top_rated`, 86400),
    fetchWithTimeout(`${TMDB_BASE}/movie/upcoming`, 3600),
    fetchWithTimeout(`${TMDB_BASE}/movie/popular?page=1`, 3600),
  ]);

  return {
    nowPlaying: nowPlaying.movies,
    topRated: topRated.movies,
    upcoming: upcoming.movies,
    popular: popular.movies,
  };
}

function SectionSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-4 md:px-8 mb-8">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-none w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] animate-pulse">
          <div className="aspect-[2/3] bg-muted rounded-lg" />
          <div className="mt-2 h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2 mt-1" />
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  const data = await fetchAllSections().catch(() => ({
    nowPlaying: [],
    topRated: [],
    upcoming: [],
    popular: [],
  }));

  const featured = data.nowPlaying[0];

  return (
    <div>
      {featured && <HeroBanner movie={featured} />}

      <MovieRow title="Now Playing" movies={data.nowPlaying} />
      <MovieRow title="Top Rated" movies={data.topRated} />
      <MovieRow title="Upcoming" movies={data.upcoming} />
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 px-4 md:px-8">
          <h2 className="flex items-center gap-2.5 text-lg md:text-xl font-bold">
            <span className="h-5 w-1 rounded-full bg-netflix" />
            Popular
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/popular">
              See All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2 snap-x snap-mandatory">
          {data.popular.slice(0, 10).map((movie) => (
            <div key={movie.id} className="flex-none w-[130px] sm:w-[160px] md:w-[180px] snap-start">
              <Link href={`/view/${movie.id}`}>
                <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden">
                  {movie.poster_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                      alt={movie.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}
                </div>
                <h3 className="font-bold mt-2 line-clamp-1 text-sm">{movie.title}</h3>
                <p className="text-muted-foreground text-xs">{movie.release_date?.split("-")[0]}</p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
