"use client";

import { useEffect } from "react";

/** Shown instead of a raw error when a page fails to load, e.g. the connection dropped. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted text-sm">
          This page couldn&apos;t load. Check the internet connection, then try again. If it keeps happening, tell the
          owner{error.digest ? ` and quote code ${error.digest}` : ""}.
        </p>
        <div className="flex justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <a href="/app" className="btn btn-secondary">
            Go to home
          </a>
        </div>
      </div>
    </main>
  );
}
