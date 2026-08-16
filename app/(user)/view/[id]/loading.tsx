export default function ViewLoading() {
  return (
    <div className="animate-pulse">
      <div className="relative h-[40vh] md:h-[50vh] bg-muted" />
      <div className="relative -mt-40 px-4 md:px-8 pb-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-72 flex-shrink-0">
            <div className="w-48 md:w-72 h-72 bg-muted rounded-lg mx-auto md:mx-0" />
          </div>
          <div className="flex-1 min-w-0 pt-40">
            <div className="h-10 bg-muted rounded w-2/3 mb-4" />
            <div className="h-4 bg-muted rounded w-1/3 mb-4" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
