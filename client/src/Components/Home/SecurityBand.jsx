import { ShieldCheck } from "lucide-react";

export default function SecurityBand() {
  return (
    <section id="security" className="relative border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center gap-8 md:gap-14">
        <div className="w-14 h-14 rounded-xl bg-[#152452] border border-[#38bdf8]/25 flex items-center justify-center shrink-0">
          <ShieldCheck size={26} className="text-[#38bdf8]" />
        </div>
        <div>
          <h3 className="cc-display text-white text-xl font-semibold mb-2">
            Security isn't a feature. It's the foundation.
          </h3>
          <p className="text-sm text-[#a9bbdc] max-w-2xl leading-relaxed">
            Every file is encrypted with AES-256 before it leaves your device,
            and again in transit and at rest. CloudCore never holds a copy of
            your encryption key — not even we can read your files.
          </p>
        </div>
      </div>
    </section>
  );
}
