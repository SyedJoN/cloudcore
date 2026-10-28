import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Cloud, Menu, X } from "lucide-react";

/* ------------------------------------------------------------------
   Edit these once; every legal page picks them up.
   ------------------------------------------------------------------ */
export const LEGAL_CONFIG = {
  company: "CloudCore, Inc.",
  product: "CloudCore",
  legalEmail: "contact@syedjon.dev",
  jurisdiction: "Pakistan",
  updated: "October 15, 2026",
};

const PAGES = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/cookies", label: "Cookie Policy" },
  { to: "/licenses", label: "Licenses" },
];

function Block({ block }) {
  if (typeof block === "string") {
    return (
      <p className="mb-4 text-[15px] leading-relaxed text-[#a9bbdc]">{block}</p>
    );
  }

  if (block.list) {
    return (
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[#a9bbdc] marker:text-[#38bdf8]">
        {block.list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.table) {
    const { head, rows } = block.table;
    return (
      <div className="mb-5 overflow-x-auto rounded-xl border border-[#5a78be]/25">
        <table className="w-full min-w-130 border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#152452]/70">
              {head.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8fa3c8]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[#5a78be]/15">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-4 py-3 align-top leading-relaxed ${
                      j === 0 ? "font-medium text-white" : "text-[#a9bbdc]"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.note) {
    return (
      <div className="mb-5 rounded-xl border border-[#38bdf8]/30 bg-[#0f1a3d]/80 px-4 py-3 text-sm leading-relaxed text-[#c3d2ef]">
        {block.note}
      </div>
    );
  }

  if (block.code) {
    return (
      <pre className="mb-5 overflow-x-auto whitespace-pre-wrap rounded-xl border border-[#5a78be]/25 bg-[#0a1330] p-4 text-xs leading-relaxed text-[#c3d2ef]">
        {block.code}
      </pre>
    );
  }

  return null;
}

export default function LegalLayout({ title, summary, sections }) {
  return (
    <div className="relative min-h-screen w-full bg-[#050b1f] font-sans text-[#eaf2ff]">
      {/* ambient glow + dot grid */}
      <div className="pointer-events-none absolute left-1/2 -top-56 h-140 w-140 -translate-x-1/2 rounded-full bg-[#2f5cf5] opacity-20 blur-[130px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050b1f]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-[#38bdf8] to-[#2f5cf5]">
            <Cloud
              className="w-4.5 h-4.5 text-white"
              size={18}
              strokeWidth={2.2}
            />
          </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              {LEGAL_CONFIG.product}
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm text-[#c3d2ef] transition-colors hover:text-white"
          >
            &larr; Back to home
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12">
        {/* Cross-navigation between legal pages */}
        <nav aria-label="Legal pages" className="mb-10 flex flex-wrap gap-2">
          {PAGES.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                `rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "border-[#38bdf8]/60 bg-[#152452] text-white"
                    : "border-[#5a78be]/25 text-[#8fa3c8] hover:border-[#38bdf8]/50 hover:text-white"
                }`
              }
            >
              {p.label}
            </NavLink>
          ))}
        </nav>

        <h1 className="mb-2 text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          {title}
        </h1>
        <p className="mb-8 text-sm text-[#6d84ae]">
          Last updated: {LEGAL_CONFIG.updated}
        </p>

        {/* Plain-English callout */}
        <div className="mb-12 grid gap-px overflow-hidden rounded-2xl border border-[#38bdf8]/30 bg-[#38bdf8]/20 md:grid-cols-2">
          <div className="bg-[#0f1a3d] p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#38bdf8]">
              What this page is
            </p>
            <p className="text-sm leading-relaxed text-[#c3d2ef]">
              {summary.what}
            </p>
          </div>
          <div className="bg-[#0f1a3d] p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#38bdf8]">
              Why it matters to you
            </p>
            <p className="text-sm leading-relaxed text-[#c3d2ef]">
              {summary.why}
            </p>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
          {/* Table of contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6d84ae]">
                On this page
              </p>
              <ul className="flex flex-col gap-1 border-l border-[#5a78be]/25">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-[#8fa3c8] transition-colors hover:border-[#38bdf8] hover:text-white"
                    >
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Content */}
          <article className="min-w-0">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
                <h2 className="mb-4 text-xl font-semibold tracking-tight text-white md:text-2xl">
                  <span className="mr-2 text-[#38bdf8]">{i + 1}.</span>
                  {s.title}
                </h2>
                {s.body.map((b, j) => (
                  <Block key={j} block={b} />
                ))}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#03071a]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-[#6d84ae] md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {LEGAL_CONFIG.company} All rights
            reserved.
          </p>
          <div className="flex flex-wrap gap-4">
            {PAGES.map((p) => (
              <Link
                key={p.to}
                to={p.to}
                className="transition-colors hover:text-white"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
