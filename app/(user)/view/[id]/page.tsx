import type { Metadata } from "next";
import { MovieType, CastType, VideoType, WatchProvidersResult } from "@/types/global";
import { getVideoByTmdbId } from "@/lib/videos";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Movie from "@/components/movie";
import MoviePlayer from "@/components/movie-player";
import FavoriteButton from "@/components/favorite-button";
import WatchlistButton from "@/components/watchlist-button";
import RatingStars from "@/components/rating-stars";
import CommentsSection from "@/components/comments-section";

const IMG = "https://image.tmdb.org/t/p";
const PROVIDER_IMG = "https://image.tmdb.org/t/p/w92";

async function fetchMovie(id: string): Promise<MovieType> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Failed to fetch movie");
  return res.json();
}

async function fetchCredits(id: string): Promise<{ cast: CastType[]; directors: string[] }> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/credits?language=en-US`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Failed to fetch credits");
  const data = await res.json();
  return {
    cast: data.cast?.slice(0, 20) || [],
    directors: data.crew?.filter((c: any) => c.job === "Director").map((c: any) => c.name) || [],
  };
}

async function fetchVideos(id: string): Promise<VideoType[]> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?language=en-US`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const videos = (data.results ?? []) as VideoType[];
  const youtube = videos.filter(v => v.site === "YouTube");
  return [
    ...youtube.filter(v => v.type === "Full Movie" || v.type === "Feature"),
    ...youtube.filter(v => v.type === "Trailer" && v.official),
    ...youtube.filter(v => v.type === "Trailer" && !v.official),
    ...youtube.filter(v => v.type === "Teaser"),
    ...youtube.filter(v => v.type === "Clip"),
  ];
}

async function fetchSimilar(id: string): Promise<MovieType[]> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/similar?language=en-US&page=1`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results?.slice(0, 10) || [];
}

async function fetchWatchProviders(id: string): Promise<{ us: WatchProvidersResult | null }> {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return { us: null };
  const data = await res.json();
  return { us: data.results?.US ?? null };
}

async function getLocalVideoData(id: string): Promise<{
  hasLocalVideo: boolean;
  qualities: { quality: string; file: string }[];
  subtitles: { lang: string; label: string; file: string }[];
}> {
  try {
    const video = await getVideoByTmdbId(parseInt(id));
    if (!video) return { hasLocalVideo: false, qualities: [], subtitles: [] };
    return {
      hasLocalVideo: true,
      qualities: video.qualities.map((q) => ({ quality: q.quality, file: q.file })),
      subtitles: video.subtitles ?? [],
    };
  } catch {
    return { hasLocalVideo: false, qualities: [], subtitles: [] };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const movie = await fetchMovie(id);
    return {
      title: `${movie.title} — Movie App`,
      description: movie.overview?.slice(0, 160) || "View movie details.",
    };
  } catch {
    return { title: "Movie — Movie App" };
  }
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [movie, credits, videos, similar, watchProviders, localVideoData] = await Promise.all([
    fetchMovie(id).catch(() => null),
    fetchCredits(id).catch(() => ({ cast: [], directors: [] })),
    fetchVideos(id).catch(() => []),
    fetchSimilar(id).catch(() => []),
    fetchWatchProviders(id).catch(() => ({ us: null })),
    getLocalVideoData(id),
  ]);

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Movie not found</h1>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const trailer = videos[0];

  return (
    <div className="min-h-screen">
      <div className="relative h-[50vh] md:h-[65vh]">
        {movie.backdrop_path && (
          <Image
            src={`${IMG}/w1280${movie.backdrop_path}`}
            alt={movie.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        <div className="absolute top-4 left-4 z-10">
          <Button variant="outline" size="sm" asChild className="bg-background/60 backdrop-blur-md border-white/10 hover:bg-background/80">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative -mt-48 px-4 md:px-8 pb-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-72 flex-shrink-0">
            {movie.poster_path && (
              <div className="relative w-48 md:w-72 aspect-[2/3] rounded-xl shadow-2xl border border-white/10 mx-auto md:mx-0 overflow-hidden ring-1 ring-white/5">
                <Image
                  src={`${IMG}/w500${movie.poster_path}`}
                  alt={movie.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 192px, 288px"
                />
              </div>
            )}

            <div className="mt-6 space-y-3 text-sm">
              {movie.production_countries && movie.production_countries.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Country</p>
                  <p>{movie.production_countries.map(c => c.name).join(", ")}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Genres</p>
                <p>{movie.genres?.map(g => g.name).join(", ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Released</p>
                <p>{movie.release_date}</p>
              </div>
              {credits.directors.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Director</p>
                  <p>{credits.directors.join(", ")}</p>
                </div>
              )}
              {movie.production_companies && movie.production_companies.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Productions</p>
                  <p>{movie.production_companies.slice(0, 3).map(c => c.name).join(", ")}</p>
                </div>
              )}
              {credits.cast.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Casts</p>
                  <p>{credits.cast.slice(0, 6).map(c => c.name).join(", ")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-5xl font-bold mb-3">{movie.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-bold text-lg">{movie.vote_average.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">/ 10</span>
              </div>
              {movie.runtime > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{formatRuntime(movie.runtime)}</span>
                </div>
              )}
              {movie.release_date && (
                <span className="text-sm text-muted-foreground">{movie.release_date?.split("-")[0]}</span>
              )}
              <span className="text-sm text-muted-foreground">{movie.original_language?.toUpperCase()}</span>
            </div>
            {movie.tagline && (
              <p className="text-lg text-muted-foreground italic mb-4">&ldquo;{movie.tagline}&rdquo;</p>
            )}
            <p className="text-muted-foreground leading-relaxed text-base mb-6">
              {movie.overview || "No overview available."}
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <MoviePlayer
                movieId={movie.id}
                title={movie.title}
                hasLocalVideo={localVideoData.hasLocalVideo}
                trailerKey={trailer?.key ?? null}
                qualities={localVideoData.qualities}
                subtitles={localVideoData.subtitles}
              />
              <FavoriteButton movieId={movie.id} />
              <WatchlistButton movieId={movie.id} />
            </div>

            <div className="mb-6">
              <RatingStars movieId={movie.id} />
            </div>

            {watchProviders.us && (
              <div className="mb-8">
                {watchProviders.us.flatrate && watchProviders.us.flatrate.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Stream</p>
                    <div className="flex flex-wrap gap-2">
                      {watchProviders.us.flatrate.map((provider) => (
                        <a key={provider.provider_id} href={watchProviders.us!.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border rounded-lg hover:border-primary transition">
                          <img src={`${PROVIDER_IMG}${provider.logo_path}`} alt={provider.provider_name} className="w-6 h-6 rounded" />
                          <span className="text-sm font-medium">{provider.provider_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {watchProviders.us.rent && watchProviders.us.rent.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Rent</p>
                    <div className="flex flex-wrap gap-2">
                      {watchProviders.us.rent.map((provider) => (
                        <a key={provider.provider_id} href={watchProviders.us!.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border rounded-lg hover:border-primary transition">
                          <img src={`${PROVIDER_IMG}${provider.logo_path}`} alt={provider.provider_name} className="w-6 h-6 rounded" />
                          <span className="text-sm font-medium">{provider.provider_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {watchProviders.us.buy && watchProviders.us.buy.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Buy</p>
                    <div className="flex flex-wrap gap-2">
                      {watchProviders.us.buy.map((provider) => (
                        <a key={provider.provider_id} href={watchProviders.us!.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-card border rounded-lg hover:border-primary transition">
                          <img src={`${PROVIDER_IMG}${provider.logo_path}`} alt={provider.provider_name} className="w-6 h-6 rounded" />
                          <span className="text-sm font-medium">{provider.provider_name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {credits.cast.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-4">Cast</h2>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {credits.cast.slice(0, 12).map((cast) => (
                    <Link key={cast.id} href={`/person/${cast.id}`} className="flex-shrink-0 w-24 text-center group">
                      {cast.profile_path ? (
                        <div className="relative w-20 h-20 rounded-full overflow-hidden mx-auto border-2 border-transparent group-hover:border-netflix transition-colors duration-300">
                          <Image src={`${IMG}/w185${cast.profile_path}`} alt={cast.name} fill className="object-cover" sizes="80px" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto border-2 border-transparent group-hover:border-netflix transition-colors duration-300">
                          <span className="text-2xl">?</span>
                        </div>
                      )}
                      <p className="text-xs font-semibold mt-2 truncate group-hover:text-netflix transition-colors">{cast.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{cast.character}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 border-t border-border">
        <CommentsSection movieId={movie.id} />
      </div>

      {similar.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">You may also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {similar.map((m) => (
              <Movie key={m.id} movie={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
