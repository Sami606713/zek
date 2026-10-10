// Mirrors the ProductBrowser layout so the page does not jump when it loads.
export function ProductGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading products"
      className="mx-auto max-w-[1400px] animate-pulse px-4 pb-24 pt-24 md:px-8 md:pt-28"
    >
      <div className="h-10 w-56 rounded-full bg-surface-2 md:h-14 md:w-80" />
      <div className="mt-4 h-4 w-72 rounded-full bg-surface-2" />
      <div className="mt-8 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-full bg-surface-2" />
        ))}
      </div>
      <div className="mt-6 flex gap-3 border-b border-line pb-6">
        <div className="h-11 flex-1 rounded-full bg-surface-2 sm:max-w-sm" />
        <div className="ml-auto h-11 w-40 rounded-full bg-surface-2" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="hidden flex-col gap-4 lg:col-span-3 lg:flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-5 w-3/4 rounded-full bg-surface-2" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-4 lg:col-span-9 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[4/5] rounded-panel bg-surface-2" />
              <div className="mt-4 h-3 w-1/3 rounded-full bg-surface-2" />
              <div className="mt-2 h-4 w-3/4 rounded-full bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
