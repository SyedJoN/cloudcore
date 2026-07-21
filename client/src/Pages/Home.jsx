import { useState } from "react";
import {
  Header,
  Hero,
  Features,
  Pricing,
  SecurityBand,
  FAQ,
  CTABand,
  Footer,
} from "../components/Home/index.js";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext.jsx";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

:root{
  --navy-950:#050b1f;
  --navy-900:#0a1330;
  --navy-800:#0f1a3d;
  --navy-700:#152452;
  --blue-600:#2f5cf5;
  --blue-500:#3b6bf6;
  --cyan-400:#38bdf8;
  --ice-100:#eaf2ff;
  --slate-400:#8fa3c8;
  --slate-500:#6d84ae;
}
.cc-root{
  font-family:'Inter',ui-sans-serif,system-ui,sans-serif;
  background:var(--navy-950);
  color:var(--ice-100);
}
.cc-display{
  font-family:'Space Grotesk','Inter',ui-sans-serif,sans-serif;
  letter-spacing:-0.02em;
}
@keyframes cc-spin-slow{ from{ transform:rotate(0deg);} to{ transform:rotate(360deg);} }
@keyframes cc-spin-slow-rev{ from{ transform:rotate(360deg);} to{ transform:rotate(0deg);} }
@keyframes cc-pulse-glow{
  0%,100%{ opacity:.55; transform:scale(1); }
  50%{ opacity:1; transform:scale(1.06); }
}
@keyframes cc-float{
  0%,100%{ transform:translateY(0px); }
  50%{ transform:translateY(-10px); }
}
@keyframes cc-drift{
  from{ stroke-dashoffset:0; }
  to{ stroke-dashoffset:-1000; }
}
.cc-orbit-a{ animation:cc-spin-slow 40s linear infinite; transform-origin:200px 200px; }
.cc-orbit-b{ animation:cc-spin-slow-rev 30s linear infinite; transform-origin:200px 200px; }
.cc-orbit-c{ animation:cc-spin-slow 55s linear infinite; transform-origin:200px 200px; }
.cc-core-glow{ animation:cc-pulse-glow 4.5s ease-in-out infinite; }
.cc-floaty{ animation:cc-float 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce){
  .cc-orbit-a,.cc-orbit-b,.cc-orbit-c,.cc-core-glow,.cc-floaty{ animation:none !important; }
}
.cc-focus:focus-visible{
  outline:2px solid var(--cyan-400);
  outline-offset:3px;
  border-radius:8px;
}
.cc-grain{
  background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0);
  background-size:26px 26px;
}
.cc-card{
  background:linear-gradient(180deg, rgba(21,36,82,0.55) 0%, rgba(10,19,48,0.55) 100%);
  border:1px solid rgba(90,120,190,0.22);
}
.cc-card-pop{
  background:linear-gradient(180deg, rgba(47,92,245,0.16) 0%, rgba(10,19,48,0.7) 100%);
  border:1px solid rgba(56,189,248,0.45);
}
`;

export default function Home() {

  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      element?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location]);


  return (
    <div className="cc-root min-h-screen w-full">
      <style>{FONT_IMPORT}</style>
      <Header/>
      <Hero />
      <Features />
      <Pricing />
      <SecurityBand />
      <FAQ />
      <CTABand />
      <Footer />
    </div>
  );
}
