import { LockKeyhole, Share2, ShieldAlert, ShieldCheck } from "lucide-react";

export default function SecurityBand() {
  const securityFeatures = [
    {
      icon: LockKeyhole,
      title: "Two-Factor Authentication",
      description:
        "Add an extra layer of account security with two-factor authentication.",
      label: "Account Security",
    },
    {
      icon: ShieldAlert,
      title: "Rate Limiting",
      description:
        "Help prevent abuse by limiting excessive requests to protected endpoints.",
      label: "Abuse Prevention",
    },
    {
      icon: Share2,
      title: "File Sharing",
      description:
        "Share files with others through CloudCore's file-sharing functionality.",
      label: "Easy Collaboration",
    },
  ];

  return (
    <section
      id="security"
      className="relative overflow-hidden border-t border-white/5"
    >
      <div className="absolute inset-0 bg-linear-to-b from-[#0c1730]/40 to-transparent pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/20 bg-[#152452]/60 px-4 py-2 mb-6">
            <ShieldCheck size={16} className="text-[#38bdf8]" />
            <span className="text-xs font-medium tracking-wide text-[#a9bbdc]">
              SECURITY BY DESIGN
            </span>
          </div>

          <h3 className="cc-display text-white text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Your files deserve{" "}
            <span className="text-[#38bdf8]">better protection.</span>
          </h3>

          <p className="text-sm md:text-base text-[#a9bbdc] leading-relaxed max-w-2xl mx-auto">
            Built with account security, responsible access controls, and abuse
            prevention in mind, so you can manage and share your files with
            confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {securityFeatures.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-white/8 bg-[#0b1530]/70 p-6 transition-all duration-300 hover:border-[#38bdf8]/30 hover:bg-[#101d3b]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#38bdf8]/20 bg-[#152452] transition-colors group-hover:border-[#38bdf8]/40">
                    <Icon
                      size={22}
                      strokeWidth={1.8}
                      className="text-[#38bdf8]"
                    />
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#38bdf8]/80">
                      {feature.label}
                    </span>

                    <h4 className="text-base font-semibold text-white mt-1 mb-2">
                      {feature.title}
                    </h4>

                    <p className="text-sm leading-6 text-[#a9bbdc]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-center">
          <ShieldCheck size={16} className="shrink-0 text-[#38bdf8]" />
          <p className="text-xs text-[#8297bd]">
            Security features depend on your account and the protections enabled
            in CloudCore.
          </p>
        </div>
      </div>
    </section>
  );
}
