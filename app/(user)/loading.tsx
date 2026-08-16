function MovieSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] bg-muted rounded-lg" />
      <div className="mt-2 h-4 bg-muted rounded w-3/4 mx-auto" />
      <div className="h-3 bg-muted rounded w-1/2 mx-auto mt-1" />
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <div className="h-6 bg-muted rounded w-40 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <MovieSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function HomeLoading() {
  return (
    <div>
      <SectionSkeleton title="Now Playing" />
      <SectionSkeleton title="Top Rated" />
      <SectionSkeleton title="Upcoming" />
      <SectionSkeleton title="Popular" />
    </div>
  );
}
