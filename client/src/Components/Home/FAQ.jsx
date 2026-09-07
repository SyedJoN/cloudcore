import { useState } from "react";
import { ChevronRight } from "lucide-react";

export default function FAQ() {
  const faqs = [
    {
      q: "Can I change plans later?",
      a: "Yes. Upgrade or downgrade anytime from your account settings — storage adjusts immediately and billing is prorated.",
    },
    {
      q: "What happens if I go over my storage limit?",
      a: "Uploads pause and you'll get a notification, but nothing already stored is ever deleted or locked.",
    },
    {
      q: "Is the 10GB plan really free forever?",
      a: "Yes, no trial period or expiry. Upgrade only when you actually need more room.",
    },
  ];
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section id="faq" className="relative border-t border-white/5">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="cc-display text-3xl font-semibold text-white text-center mb-10">
          Common questions
        </h2>
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <div key={f.q} className="cc-card rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between text-left px-5 py-4 cc-focus"
                onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
                aria-expanded={openIdx === i}
              >
                <span className="text-sm font-medium text-white">{f.q}</span>
                <ChevronRight
                  size={16}
                  className={`text-[#38bdf8] transition-transform shrink-0 ml-4 ${openIdx === i ? "rotate-90" : ""}`}
                />
              </button>
              {openIdx === i && (
                <p className="px-5 pb-4 text-sm text-[#a9bbdc] leading-relaxed">
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
