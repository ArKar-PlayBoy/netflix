"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Movie from "@/components/movie";
import { MovieType } from "@/types/global";

export default function MovieRow({
  title,
  movies,
}: {
  title: string;
  movies: MovieType[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!movies.length) return null;

  return (
    <div className="group/row relative mb-8">
      <h2 className="flex items-center gap-2.5 text-lg md:text-xl font-bold mb-3 px-4 md:px-8">
        <span className="h-5 w-1 rounded-full bg-netflix" />
        {title}
      </h2>

      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-1 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"
        >
          <ChevronLeft className="h-8 w-8 text-foreground/80" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2 snap-x snap-mandatory scroll-pl-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="flex-none w-[130px] sm:w-[160px] md:w-[180px] lg:w-[200px] snap-start"
            >
              <Movie movie={movie} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-1 opacity-0 group-hover/row:opacity-100 transition-opacity cursor-pointer"
        >
          <ChevronRight className="h-8 w-8 text-foreground/80" />
        </button>
      </div>
    </div>
  );
}
