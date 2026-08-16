export default function GenreLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-muted rounded w-48 mb-4 py-4 border-b" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] bg-muted rounded-lg" />
            <div className="mt-2 h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-3 bg-muted rounded w-1/2 mx-auto mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
