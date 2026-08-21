import Link from "next/link";
import Image from "next/image";
import { Play, Info } from "lucide-react";
import { MovieType } from "@/types/global";

const IMG = "https://image.tmdb.org/t/p";

export default function HeroBanner({ movie }: { movie: MovieType }) {
  if (!movie?.backdrop_path) return null;

  return (
    <div className="relative w-full h-[55vh] sm:h-[60vh] md:h-[70vh] mb-6 md:mb-10">
      <Image
        src={`${IMG}/w1280${movie.backdrop_path}`}
        alt={movie.title}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 md:px-12 md:pb-12">
        <p className="text-xs md:text-sm font-semibold text-netflix mb-2 uppercase tracking-wider">
          Featured
        </p>
        <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black mb-3 max-w-2xl leading-tight">
          {movie.title}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl mb-4 line-clamp-3 hidden sm:block">
          {movie.overview}
        </p>
        <div className="flex items-center gap-2.5 md:gap-3">
          <Link
            href={`/view/${movie.id}`}
            className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-netflix hover:bg-netflix-hover text-white rounded-lg font-semibold transition-colors text-sm md:text-base"
          >
            <Play className="h-5 w-5 fill-current" />
            Watch Now
          </Link>
          <Link
            href={`/view/${movie.id}`}
            className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium backdrop-blur-sm transition-colors text-sm md:text-base"
          >
            <Info className="h-5 w-5" />
            More Info
          </Link>
        </div>
      </div>
    </div>
  );
}
