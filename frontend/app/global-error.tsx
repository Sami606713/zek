"use client"; // Error boundaries must be Client Components

import "./globals.css";
import { ZekWordmark } from "@/components/brand/ZekLogo";

// Last resort when even the root layout fails. It replaces the whole document, so it
// brings its own <html>/<body> and styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 font-sans text-ink antialiased">
        <title>Something went wrong | ZEK</title>
        <div className="max-w-[440px]">
          <ZekWordmark className="h-7 w-auto" title="ZEK" />
          <h1 className="mt-8 text-3xl font-semibold tracking-[-0.04em]">Something went wrong</h1>
          <p className="mt-3 text-[15px] text-subtle">The store didn&apos;t load properly. Please try again in a moment.</p>
          {error.digest && <p className="mt-3 font-mono text-[12px] text-subtle">Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            className="mt-8 rounded-full bg-ink px-6 py-3.5 text-[15px] font-medium text-bg transition hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
