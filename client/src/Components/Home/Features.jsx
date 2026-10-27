import { Globe2, Lock, Share2 } from "lucide-react";

export default function Features() {
  const items = [
    {
      icon: Lock,
      title: "End-to-end encryption",
      desc: "Files are encrypted before they leave your device. Only you hold the key.",
    },
    {
      icon: Share2,
      title: "Easy sharing",
      desc: "Share files and folders with a link or invite people by email, and choose who can open them.",
    },
    {
      icon: Globe2,
      title: "Access anywhere",
      desc: "Upload from your phone, open it on your laptop. Your files are always a login away.",
    },
  ];

  return (
    <section id="features" className="relative border-t border-white/5">
         <div>
        <img className="max-w-1xl md:max-w-6xl pt-20 mx-auto" src="./homepage.png" />
      </div>
      <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-8">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="cc-card rounded-2xl p-6">
            <div className="w-10 h-10 rounded-lg bg-[#152452] flex items-center justify-center mb-5 border border-[#38bdf8]/25">
              <Icon size={18} className="text-[#38bdf8]" strokeWidth={2} />
            </div>
            <h3 className="cc-display text-white text-lg font-semibold mb-2">
              {title}
            </h3>
            <p className="text-sm text-[#a9bbdc] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
