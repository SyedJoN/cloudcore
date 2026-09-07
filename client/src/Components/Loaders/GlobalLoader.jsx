import React from "react";

/**
 * GlobalLoader
 *
 * Full-app loading state, styled to match CloudCore (navy background,
 * blue/cyan "core" orbit animation). Two ways to use it:
 *
 * 1. App boot / route-level (e.g. Suspense fallback, initial auth check):
 *      <GlobalLoader label="Loading your files..." />
 *
 * 2. As a dimmed overlay on top of existing content mid-action
 *    (e.g. while a mutation is in flight):
 *      <GlobalLoader overlay label="Uploading..." />
 *
 * Props:
 *  - label:     string shown under the spinner (default "Loading...")
 *  - overlay:   boolean, renders as a translucent/blurred layer over
 *               existing content instead of a solid full-page background
 *  - fullScreen: boolean, set false to render inline (e.g. inside a card)
 *               instead of position:fixed across the viewport
 */
const GlobalLoader = ({ label = "Loading...", overlay = false, fullScreen = true }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        ${fullScreen ? "fixed inset-0" : "relative w-full py-16"}
        z-[999] flex flex-col items-center justify-center gap-5
        ${overlay ? "bg-[#050b1f]/70 backdrop-blur-sm" : "bg-[#050b1f]"}
      `}
    >
      {/* ambient glow, only for the solid full-screen variant */}
      {!overlay && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f5cf5] opacity-20 blur-[120px]" />
      )}

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* orbiting core mark */}
        <div className="relative h-16 w-16">
          {/* soft pulsing glow behind the core */}
          <span className="absolute inset-0 rounded-full bg-[#38bdf8] opacity-30 blur-md motion-safe:animate-[pulse_2s_ease-in-out_infinite]" />

          {/* outer ring, spinning */}
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#38bdf8] border-r-[#38bdf8]/40 motion-safe:animate-[spin_1.1s_linear_infinite]" />

          {/* middle ring, spinning opposite direction, slower */}
          <span className="absolute inset-[6px] rounded-full border-2 border-transparent border-b-[#3b6bf6] motion-safe:animate-[spin_1.8s_linear_infinite_reverse]" />

          {/* static core badge */}
          <span className="absolute inset-[14px] flex items-center justify-center rounded-full bg-gradient-to-br from-[#38bdf8] to-[#2f5cf5]">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium tracking-tight text-white">
            CloudCore
          </span>
          <span className="text-xs text-[#8fa3c8]">{label}</span>
        </div>
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
};

export default GlobalLoader;