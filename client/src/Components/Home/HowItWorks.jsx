import { UserPlus, UploadCloud, Share2, FileText, ImageIcon, Link2 } from "lucide-react";

/* Small UI sketches so each step shows what the user will actually see. */
function SignupMock() {
  return (
    <div className="space-y-2 rounded-lg border border-[#5a78be]/25 bg-[#0a1330] p-3">
      <div className="flex h-8 items-center rounded-md border border-[#5a78be]/20 bg-[#0f1a3d] px-2.5 text-[11px] text-[#6d84ae]">
        you@email.com
      </div>
      <div className="flex h-8 items-center rounded-md border border-[#5a78be]/20 bg-[#0f1a3d] px-2.5 text-[11px] tracking-widest text-[#6d84ae]">
        ••••••••
      </div>
      <div className="flex h-8 items-center justify-center rounded-md bg-linear-to-r from-[#3b6bf6] to-[#38bdf8] text-[11px] font-medium text-white">
        Verify with OTP
      </div>
    </div>
  );
}

function UploadMock() {
  return (
    <div className="rounded-lg border border-[#5a78be]/25 bg-[#0a1330] p-3">
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-[#38bdf8]/40 bg-[#0f1a3d]/60 py-4">
        <UploadCloud size={20} className="text-[#38bdf8]" />
        <span className="text-[11px] text-[#a9bbdc]">Drop files here</span>
      </div>
      <div className="mt-2 flex gap-2">
        <span className="flex items-center gap-1.5 rounded-md bg-[#152452] px-2 py-1 text-[10px] text-[#c3d2ef]">
          <FileText size={11} className="text-[#38bdf8]" /> report.pdf
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-[#152452] px-2 py-1 text-[10px] text-[#c3d2ef]">
          <ImageIcon size={11} className="text-[#38bdf8]" /> trip.jpg
        </span>
      </div>
    </div>
  );
}

function ShareMock() {
  return (
    <div className="space-y-2 rounded-lg border border-[#5a78be]/25 bg-[#0a1330] p-3">
      <div className="flex items-center justify-between rounded-md bg-[#0f1a3d] px-2.5 py-2">
        <span className="flex items-center gap-1.5 text-[11px] text-[#c3d2ef]">
          <FileText size={12} className="text-[#38bdf8]" /> report.pdf
        </span>
        <div className="flex -space-x-1.5">
          <span className="h-5 w-5 rounded-full border border-[#0a1330] bg-[#2f5cf5]" />
          <span className="h-5 w-5 rounded-full border border-[#0a1330] bg-[#38bdf8]" />
          <span className="h-5 w-5 rounded-full border border-[#0a1330] bg-[#8fa3c8]" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md border border-[#5a78be]/20 px-2.5 py-2">
        <span className="text-[11px] text-[#8fa3c8]">Anyone with the link</span>
        <span className="flex items-center gap-1 rounded bg-[#152452] px-2 py-0.5 text-[10px] text-[#9fd8fb]">
          <Link2 size={10} /> Copy link
        </span>
      </div>
    </div>
  );
}

const steps = [
  {
    icon: UserPlus,
    title: "Create your account",
    desc: "Sign up with your email or Google/GitHub, confirm with a one-time code, and your free storage is ready in under two minutes.",
    mock: <SignupMock />,
  },
  {
    icon: UploadCloud,
    title: "Drag and drop your files",
    desc: "Drop in photos, documents, or whole folders. They upload, encrypt, and sync to all your devices automatically.",
    mock: <UploadMock />,
  },
  {
    icon: Share2,
    title: "Share and access anywhere",
    desc: "Send a link or invite people with view or edit access. Open your files from any device, whenever you need them.",
    mock: <ShareMock />,
  },
];

export default function HowItWorks() {
  return (
    <section id="howitworks" className="relative border-t border-white/5">
     
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#38bdf8]">
            How it works
          </p>
          <h2 className="cc-display mb-3 text-3xl font-semibold text-white md:text-4xl">
            Up and running in three steps
          </h2>
          <p className="text-base text-[#a9bbdc]">
            No setup, no installs required. Go from sign-up to sharing in
            minutes.
          </p>
        </div>

        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {/* dashed connector running through the step numbers (desktop only) */}
          <div
            aria-hidden="true"
            className="absolute left-[16.66%] right-[16.66%] top-6 hidden border-t border-dashed border-[#38bdf8]/30 md:block"
          />

          {steps.map(({ icon: Icon, title, desc, mock }, i) => (
            <li key={title} className="relative flex flex-col items-center">
              <span className="cc-display relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#38bdf8] to-[#2f5cf5] text-lg font-semibold text-white shadow-[0_0_0_6px_#050b1f]">
                {i + 1}
              </span>

              <div className="cc-card w-full flex-1 rounded-2xl p-6">
                <div className="mb-5">{mock}</div>
                <div className="mb-2 flex items-center gap-2">
                  <Icon size={16} className="text-[#38bdf8]" />
                  <h3 className="cc-display text-lg font-semibold text-white">
                    {title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-[#a9bbdc]">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
        
      </div>
    </section>
  );
}