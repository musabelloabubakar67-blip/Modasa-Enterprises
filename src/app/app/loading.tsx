// Shown instantly while a staff page loads, so a click responds straight away. Also lets Next.js prefetch
// staff pages up to this point.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="bg-border h-7 w-48 rounded" />
      <div className="bg-border h-4 w-72 max-w-full rounded" />
      <div className="card space-y-3 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-border h-4 rounded" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
