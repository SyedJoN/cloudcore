import { ChevronRight } from "lucide-react";

export default function CTABand() {
  return (
    <section className="relative border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="cc-display text-3xl md:text-4xl font-semibold text-white mb-4">
          Bring your files back to the core.
        </h2>
        <p className="text-[#a9bbdc] mb-8">
          Set up in under two minutes. No credit card needed to start.
        </p>
        <a
          href="#pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-gradient-to-r from-[#3b6bf6] to-[#38bdf8] hover:brightness-110 transition-all px-6 py-3 rounded-lg cc-focus"
        >
          Get started free
          <ChevronRight size={16} />
        </a>
      </div>
    </section>
  );
}
