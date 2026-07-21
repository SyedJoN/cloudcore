import React from "react";
import { Link, useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#050b1f] px-5 py-8 font-sans text-[#eaf2ff]">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 -top-56 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-[#2f5cf5] opacity-20 blur-[130px]" />
      {/* dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative z-10 w-full max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#38bdf8] to-[#2f5cf5]">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            CloudCore
          </span>
        </Link>

        <div className="mx-auto mt-2 mb-1 max-w-[300px]" aria-hidden="true">
          <svg viewBox="0 0 400 300" className="h-auto w-full">
            <defs>
              <radialGradient id="nfGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#2f5cf5" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#2f5cf5" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="nfRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#2f5cf5" />
              </linearGradient>
            </defs>

            <circle
              cx="200"
              cy="150"
              r="95"
              fill="url(#nfGlow)"
              className="motion-safe:animate-[nf-pulse_4s_ease-in-out_infinite]"
            />

            <g
              className="motion-safe:animate-[spin_26s_linear_infinite]"
              style={{ transformOrigin: "200px 150px" }}
            >
              <ellipse
                cx="200"
                cy="150"
                rx="120"
                ry="120"
                fill="none"
                stroke="url(#nfRing)"
                strokeOpacity="0.35"
                strokeWidth="1"
                strokeDasharray="4 7"
              />
              <circle cx="320" cy="150" r="5" fill="#38bdf8" />
            </g>

            <g
              className="motion-safe:animate-[spin_40s_linear_infinite_reverse]"
              style={{ transformOrigin: "200px 150px" }}
            >
              <ellipse
                cx="200"
                cy="150"
                rx="150"
                ry="150"
                fill="none"
                stroke="url(#nfRing)"
                strokeOpacity="0.22"
                strokeWidth="1"
              />
              <circle cx="200" cy="0" r="4" fill="#8fa3c8" />
            </g>

            {/* broken-link core mark */}
            <circle cx="200" cy="150" r="42" fill="#0a1330" stroke="url(#nfRing)" strokeWidth="2" />
            <g transform="translate(178,128)" stroke="#eaf2ff" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M8 22 a8 8 0 0 1 0-16 h6" />
              <path d="M36 22 a8 8 0 0 0 0-16 h-6" />
              <line x1="16" y1="14" x2="20" y2="14" strokeDasharray="2 3" />
            </g>
          </svg>
        </div>

        <p className="font-display my-1 bg-gradient-to-r from-[#38bdf8] to-[#3b6bf6] bg-clip-text text-6xl font-bold leading-none tracking-tight text-transparent sm:text-7xl">
          404
        </p>
        <h1 className="font-display mb-2.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          This file drifted out of the core.
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[#8fa3c8]">
          The page you're looking for doesn't exist, was moved, or never synced
          here in the first place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#3b6bf6] to-[#38bdf8] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center rounded-lg border border-[#5a78be]/30 bg-[#0f1a3d] px-5 py-3 text-sm font-semibold text-[#eaf2ff] transition-colors hover:border-[#38bdf8]"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;