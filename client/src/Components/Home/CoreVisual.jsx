import { Cloud } from "lucide-react";

export default function CoreVisual() {
  return (
    <div
      className="relative w-full max-w-md mx-auto cc-floaty"
      aria-hidden="true"
    >
      <svg viewBox="0 0 400 400" className="w-full h-auto">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#2f5cf5" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2f5cf5" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2f5cf5" />
          </linearGradient>
        </defs>

        <circle
          cx="200"
          cy="200"
          r="120"
          fill="url(#coreGlow)"
          className="cc-core-glow"
        />

        <g className="cc-orbit-a">
          <ellipse
            cx="200"
            cy="200"
            rx="150"
            ry="150"
            fill="none"
            stroke="url(#ringGrad)"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          <circle cx="350" cy="200" r="6" fill="#38bdf8" />
          <circle cx="50" cy="200" r="3.5" fill="#8fa3c8" />
        </g>

        <g className="cc-orbit-b">
          <ellipse
            cx="200"
            cy="200"
            rx="115"
            ry="115"
            fill="none"
            stroke="url(#ringGrad)"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <circle cx="200" cy="85" r="5" fill="#eaf2ff" />
        </g>

        <g className="cc-orbit-c">
          <ellipse
            cx="200"
            cy="200"
            rx="180"
            ry="180"
            fill="none"
            stroke="url(#ringGrad)"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
          <circle cx="280" cy="345" r="4.5" fill="#3b6bf6" />
        </g>

        {/* Core */}
        <circle
          cx="200"
          cy="200"
          r="46"
          fill="#0a1330"
          stroke="url(#ringGrad)"
          strokeWidth="2"
        />
        <g transform="translate(178,178)">
          <Cloud
            x="0"
            y="0"
            width="44"
            height="44"
            color="#eaf2ff"
            strokeWidth={1.6}
          />
        </g>
      </svg>
    </div>
  );
}
