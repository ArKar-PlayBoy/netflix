import { MovieType } from "@/types/global";
import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";

const IMG_URL = "https://image.tmdb.org/t/p";

export default function Movie({ movie }: { movie: MovieType }) {
  const isForeign = movie.original_language && movie.original_language !== "en";
  const rating = movie.vote_average?.toFixed(1);

  return (
    <div className="text-center group">
      <Link href={`/view/${movie.id}`} className="relative block">
        <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-muted ring-1 ring-white/5 group-hover:ring-netflix/50 transition-all duration-300">
          {movie.poster_path ? (
            <Image
              src={`${IMG_URL}/w342${movie.poster_path}`}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, (max-width: 1024px) 180px, 200px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              placeholder="blur"
              blurDataURL={`${IMG_URL}/w92${movie.poster_path}`}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <span className="text-3xl">🎬</span>
              <span className="text-xs">No Poster</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            {rating && rating !== "0.0" && (
              <div className="flex items-center gap-1 mb-1">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                <span className="text-white text-xs font-bold">{rating}</span>
              </div>
            )}
            <p className="text-white text-xs line-clamp-2 leading-snug">
              {movie.overview?.slice(0, 80)}
              {movie.overview && movie.overview.length > 80 ? "..." : ""}
            </p>
          </div>

          {isForeign && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-netflix/90 text-white text-[10px] font-bold rounded leading-none">
              SUB
            </span>
          )}
        </div>
      </Link>
      <h3 className="font-semibold mt-2 line-clamp-1 text-sm group-hover:text-netflix transition-colors">{movie.title}</h3>
      <div className="text-muted-foreground text-xs">
        {movie.release_date?.split("-")[0]}
      </div>
    </div>
  );
}
