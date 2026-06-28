import Messenger from "@/components/Messenger";
import { Lock, Github, KeyRound, ServerOff } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="max-w-[1000px] mx-auto px-6">
        <nav className="flex items-center justify-between py-6">
          <span className="font-bold text-[18px] tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-accent/20 grid place-items-center"><Lock size={13} className="text-accent" /></span>
            wisp
          </span>
          <a href="https://github.com/arshnah" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink transition">
            <Github size={16} /> source
          </a>
        </nav>

        <header className="pt-[60px] pb-[50px] text-center">
          <div className="inline-flex items-center gap-2 text-[12px] font-mono text-accent border border-accent/30 rounded-full px-3 py-1 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-good" /> open source · zero-knowledge
          </div>
          <h1 className="text-[clamp(34px,6vw,58px)] font-bold leading-[1.05] tracking-[-0.03em] max-w-[20ch] mx-auto">
            Messages only you and them can read.
          </h1>
          <p className="mt-6 max-w-[58ch] mx-auto text-[18px] text-muted leading-[1.6]">
            Wisp is an open-source social messenger with end-to-end encryption built in from the first commit.
            Keys are made on your device and never leave it. The server stores ciphertext and learns nothing.
          </p>
        </header>

        <section className="pb-[40px]">
          <Messenger />
          <p className="text-center text-faint text-[12.5px] mt-4 font-mono">
            this demo runs entirely in your browser · two identities, real ECDH + AES-GCM
          </p>
        </section>

        <section className="py-[60px] grid sm:grid-cols-3 gap-4">
          {[
            { icon: KeyRound, t: "Keys stay with you", d: "An ECDH keypair is generated on your device. The private half never touches the network." },
            { icon: ServerOff, t: "The server is blind", d: "Messages are encrypted before they leave. A breach leaks ciphertext, not conversations." },
            { icon: Lock, t: "Verifiable", d: "Read the code, compare key fingerprints with a friend, confirm there is no one in the middle." },
          ].map((f, i) => (
            <div key={i} className="p-5 rounded-[14px] border border-line bg-surf">
              <f.icon size={18} className="text-accent mb-3" />
              <h3 className="text-[15px] font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-[13.5px] text-muted leading-[1.55]">{f.d}</p>
            </div>
          ))}
        </section>

        <footer className="py-10 border-t border-line text-center text-[13px] text-faint">
          built by <a href="https://arshnah.vercel.app" className="text-muted hover:text-ink transition">Arshdeep Singh</a> · MIT licensed · contributions welcome
        </footer>
      </div>
    </main>
  );
}
