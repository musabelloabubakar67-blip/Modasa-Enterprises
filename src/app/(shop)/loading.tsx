// Shown instantly while a shop page loads, under the header and above the footer.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8" aria-busy="true" aria-label="Loading">
      <div className="bg-border h-8 w-64 max-w-full rounded" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="bg-border aspect-square rounded" />
            <div className="bg-border h-4 w-3/4 rounded" />
            <div className="bg-border h-4 w-1/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
