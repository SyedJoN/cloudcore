
import {
  Mail,
  Globe,
  ExternalLink,
  ArrowUpRight,
  Cloud,
} from "lucide-react";

export default function Footer() {
  const columns = [
    {
      title: "Product",
      links: ["Features", "Pricing", "Security", "Changelog"],
    },
    {
      title: "Company",
      links: ["About", "Careers", "Blog", "Press"],
    },
    {
      title: "Resources",
      links: ["Help center", "API docs", "Status", "Community"],
    },
    {
      title: "Legal",
      links: ["Privacy", "Terms", "Cookie policy", "Licenses"],
    },
  ];

  return (
    <footer className="relative border-t border-white/10 bg-[#03071a]">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        <div className="grid md:grid-cols-[1.4fr_repeat(4,1fr)] gap-10 mb-14">
          <div>
            <a
              href="#top"
              className="flex items-center gap-2 mb-4 cc-focus rounded-lg w-fit"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#38bdf8] to-[#2f5cf5]">
                <Cloud size={18} className="text-white" strokeWidth={2.2} />
              </span>
              <span className="cc-display text-lg font-semibold text-white">
                CloudCore
              </span>
            </a>
            <p className="text-sm text-[#6d84ae] max-w-xs leading-relaxed mb-5">
              Encrypted cloud storage that keeps your files synced, wherever
              your day takes them.
            </p>
            <div className="flex items-center gap-3">
              {[Mail, Globe, ExternalLink, ArrowUpRight].map((Icon, i) => (
                <a
                  key={i}
                  href="#social"
                  aria-label="Social link"
                  className="w-9 h-9 rounded-lg bg-[#0f1a3d] border border-white/10 flex items-center justify-center text-[#8fa3c8] hover:text-white hover:border-[#38bdf8]/50 transition-colors cc-focus"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#6d84ae] mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-[#a9bbdc] hover:text-white transition-colors cc-focus rounded"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#6d84ae]">
            © {new Date().getFullYear()} CloudCore, Inc. All rights reserved.
          </p>
          <p className="text-xs text-[#6d84ae]">
            Built for people who don't like losing files.
          </p>
        </div>
      </div>
    </footer>
  );
}
