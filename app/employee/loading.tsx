export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-slate-800" />
        <div className="h-4 w-96 rounded bg-slate-800" />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-3.5 w-24 rounded bg-slate-800" />
              <div className="h-4 w-4 rounded-full bg-slate-800" />
            </div>
            <div className="h-7 w-32 rounded bg-slate-800" />
            <div className="h-3 w-40 rounded bg-slate-800" />
          </div>
        ))}
      </div>

      {/* List/Table Block */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-6 space-y-4">
        <div className="h-4 w-32 rounded bg-slate-800" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-slate-800">
              <div className="space-y-2">
                <div className="h-3.5 w-48 rounded bg-slate-800" />
                <div className="h-2.5 w-32 rounded bg-slate-800" />
              </div>
              <div className="h-7 w-20 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
