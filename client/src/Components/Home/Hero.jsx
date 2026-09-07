import { ChevronRight } from "lucide-react";
import CoreVisual from "./CoreVisual.jsx";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 cc-grain opacity-40" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#2f5cf5] opacity-20 blur-[140px]" />

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#9fd8fb] bg-[#0f1a3d] border border-[#38bdf8]/30 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
            Now with automatic version history
          </div>

          <h1 className="cc-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-[1.08] mb-6">
            Your files, held at the core.
          </h1>

          <p className="text-base md:text-lg text-[#a9bbdc] max-w-md mb-9 leading-relaxed">
            CloudCore keeps every photo, document, and project synced across
            your devices and encrypted end to end — so it's always where you
            left it, and nowhere anyone else can reach.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#pricing"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-gradient-to-r from-[#3b6bf6] to-[#38bdf8] hover:brightness-110 transition-all px-5 py-3 rounded-lg cc-focus"
            >
              Start free with 2GB
              <ChevronRight size={16} />
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-[#c3d2ef] hover:text-white transition-colors px-5 py-3 cc-focus rounded-lg"
            >
              See how it works
            </a>
          </div>

          <p className="text-xs text-[#6d84ae] mt-8">
            No card required · Cancel anytime · 2 minute setup
          </p>
        </div>

        <CoreVisual />
      </div>
    </section>
  );
}
