export default function PersonLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="flex-shrink-0">
          <div className="w-64 h-96 bg-muted rounded-lg" />
        </div>
        <div className="flex-1">
          <div className="h-10 bg-muted rounded w-64 mb-2" />
          <div className="h-4 bg-muted rounded w-32 mb-6" />
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="h-8 bg-muted rounded w-64 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] bg-muted rounded-lg" />
            <div className="mt-2 h-4 bg-muted rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
