import { useState } from "react";
import { Cloud, Zap, Check, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../../apis/userApi";
import { useToast } from "../../Contexts/ToastContext";
import { createSubscription } from "../../../apis/subscriptionApi";

export default function Pricing() {
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(true);
  const { toast } = useToast();

  const plans = [
    {
      name: "Starter",
      storage: "2GB",
      icon: Cloud,
      monthly: 0,
      tagline: "For getting your files organized",
      features: [
        "2GB secure storage",
        "500MB Upload Limit",
        "2 device sync",
        "30-day version history",
        "Community support",
      ],
      cta: "Start for free",
      highlight: false,
    },
    {
      priceId: yearly
        ? "price_1TtncARL7rNPLOLucMjv9R6d"
        : "price_1TtnbPRL7rNPLOLunioCBs9P",
      name: "Pro",
      storage: "1TB",
      icon: Zap,
      monthly: 30,
      tagline: "For individuals with growing libraries",
      features: [
        "1TB secure storage",
        "10GB Upload Limit",
        "Unlimited device sync",
        "1-year version history",
        "Priority email support",
        "Offline access & smart caching",
      ],
      cta: "Start 14-day trial",
      highlight: true,
    },
    {
      priceId: yearly
        ? "price_1TtndkRL7rNPLOLuA8ySaRjq"
        : "price_1TtncwRL7rNPLOLu1m5O9sAy",
      name: "Business",
      storage: "10TB",
      icon: Users,
      monthly: 50,
      tagline: "For teams that share a lot of files",
      features: [
        "10TB pooled storage",
        "50GB Upload Limit",
        "Unlimited device sync",
        "Unlimited version history",
        "Admin & team permissions",
        "24/5 priority support",
      ],
      cta: "Talk to sales",
      highlight: false,
    },
  ];

  // Yearly billing = 10x monthly rate, i.e. 2 months free.
  const YEARLY_MULTIPLIER = 10;

  async function handlePlanClick(plan) {
    if (plan.monthly === 0) {
      window.open("/", "_blank");
      return;
    }
    try {
      const data = await createSubscription({ priceId: plan.priceId });
      if (data.message) {
        toast({ message: data.message, type: "warning" });
        return;
      }
      window.open(data.url, "_blank");
    } catch (error) {
      navigate("/login", {
        state: {
          priceId: plan.priceId,
        },
      });
    }
  }
  return (
    <section id="pricing" className="relative border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-4">
          <h2 className="cc-display text-3xl md:text-4xl font-semibold text-white mb-3">
            Storage that scales with you
          </h2>
          <p className="text-[#a9bbdc] text-base">
            Start free, upgrade when your files outgrow the plan. No surprise
            fees, cancel whenever.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8 mb-12">
          <span
            className={`text-sm ${!yearly ? "text-white" : "text-[#6d84ae]"}`}
          >
            Monthly
          </span>
          <button
            role="switch"
            aria-checked={yearly}
            aria-label="Toggle yearly billing"
            onClick={() => setYearly((y) => !y)}
            className="cc-focus relative w-12 h-6 rounded-full bg-[#152452] border border-[#38bdf8]/30 transition-colors"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-[#38bdf8] to-[#2f5cf5] transition-transform ${
                yearly ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm ${yearly ? "text-white" : "text-[#6d84ae]"}`}
          >
            Yearly <span className="text-[#38bdf8]">· 2 months free</span>
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((p) => {
            const Icon = p.icon;
            const price = yearly ? p.monthly * YEARLY_MULTIPLIER : p.monthly;
            const perMonthEquivalent = (p.monthly * YEARLY_MULTIPLIER) / 12;
            return (
              <div
                key={p.name}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  p.highlight
                    ? "cc-card-pop md:-translate-y-3 shadow-[0_0_60px_-15px_rgba(56,189,248,0.35)]"
                    : "cc-card"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-7 text-[11px] font-semibold tracking-wide uppercase text-[#050b1f] bg-[#38bdf8] px-2.5 py-1 rounded-full">
                    Most popular
                  </span>
                )}

                <div className="w-10 h-10 rounded-lg bg-[#152452] flex items-center justify-center mb-5 border border-[#38bdf8]/25">
                  <Icon size={18} className="text-[#38bdf8]" strokeWidth={2} />
                </div>

                <h3 className="cc-display text-white text-xl font-semibold">
                  {p.name}
                </h3>
                <p className="text-sm text-[#8fa3c8] mb-5">{p.tagline}</p>

                <div className="flex items-end gap-1 mb-1">
                  <span className="cc-display text-4xl font-semibold text-white">
                    {price === 0 ? "Free" : `$${price}`}
                  </span>
                  {price !== 0 && (
                    <span className="text-sm text-[#6d84ae] mb-1">
                      {yearly ? "/yr" : "/mo"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6d84ae] mb-6">
                  {p.storage} storage
                  {price !== 0 &&
                    yearly &&
                    ` · billed yearly (~$${perMonthEquivalent.toFixed(2)}/mo)`}
                </p>

                <ul className="flex flex-col gap-3 mb-8">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-[#c3d2ef]"
                    >
                      <Check
                        size={16}
                        className="text-[#38bdf8] mt-0.5 shrink-0"
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanClick(p)}
                  className={`mt-auto text-center text-sm font-medium px-4 py-3 rounded-lg transition-all cc-focus cursor-pointer ${
                    p.highlight
                      ? "text-white bg-linear-to-r from-[#3b6bf6] to-[#38bdf8] hover:brightness-110"
                      : "text-[#eaf2ff] bg-[#152452] border border-[#38bdf8]/25 hover:border-[#38bdf8]/60"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
