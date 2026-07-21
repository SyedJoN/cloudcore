import { useState, useEffect, useRef } from "react";
import { Cloud, Menu, X } from "lucide-react";
import UserAccountBar from "../UserAccountBar";
import { useAuth } from "../../Contexts/AuthContext";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const {loggedIn} = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Product", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Security", href: "#security" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "bg-[#050b1f]/90 backdrop-blur-md border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 cc-focus rounded-lg">
          <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-[#38bdf8] to-[#2f5cf5]">
            <Cloud
              className="w-4.5 h-4.5 text-white"
              size={18}
              strokeWidth={2.2}
            />
          </span>
          <span className="cc-display text-lg font-semibold tracking-tight text-white">
            CloudCore
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-[#c3d2ef] hover:text-white transition-colors cc-focus rounded"
            >
              {l.label}
            </a>
          ))}
        </nav>
        {loggedIn ? (
          <UserAccountBar />
        ) : (
          <div className="hidden md:flex items-center gap-3">
            <a
              href="/login"
              className="text-sm text-[#c3d2ef] hover:text-white transition-colors cc-focus rounded px-2 py-1"
            >
              Sign in
            </a>
            <a
              href="/register"
              className="text-sm font-medium text-white bg-gradient-to-r from-[#3b6bf6] to-[#38bdf8] hover:brightness-110 transition-all px-4 py-2 rounded-lg shadow-[0_0_0_1px_rgba(56,189,248,0.3)] cc-focus"
            >
              Get started
            </a>
          </div>
        )}

        <button
          className="md:hidden text-white cc-focus rounded p-1"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#050b1f]/98 px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-[#c3d2ef]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
            <a href="#signin" className="text-sm text-[#c3d2ef]">
              Sign in
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-center text-white bg-gradient-to-r from-[#3b6bf6] to-[#38bdf8] px-4 py-2 rounded-lg"
            >
              Get started
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
