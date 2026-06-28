"use client";
import { useEffect, useRef, useState } from "react";
import { generateIdentity, seal, open, fingerprint, type Identity, type Sealed } from "@/lib/crypto";
import { Shield, Eye, EyeOff, Send, Lock } from "lucide-react";

type Msg = { from: "me" | "aria"; sealed: Sealed; text: string };

export default function Messenger() {
  const [me, setMe] = useState<Identity | null>(null);
  const [aria, setAria] = useState<Identity | null>(null);
  const [meFp, setMeFp] = useState(""); const [ariaFp, setAriaFp] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [speaker, setSpeaker] = useState<"me" | "aria">("me");
  const [peek, setPeek] = useState(false);
  const [ready, setReady] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const a = await generateIdentity(); const b = await generateIdentity();
      setMe(a); setAria(b);
      setMeFp(await fingerprint(a.publicKey)); setAriaFp(await fingerprint(b.publicKey));
      setReady(true);
    })();
  }, []);
  useEffect(() => { if (msgs.length) threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  async function send() {
    if (!draft.trim() || !me || !aria) return;
    const sender = speaker === "me" ? me : aria;
    const recipient = speaker === "me" ? aria : me;
    // encrypt with sender's private + recipient's public...
    const sealed = await seal(sender.privateKey, recipient.publicKey, draft.trim());
    // ...and prove it decrypts back on the recipient side
    const decrypted = await open(recipient.privateKey, sender.publicKey, sealed);
    setMsgs((m) => [...m, { from: speaker, sealed, text: decrypted }]);
    setDraft("");
  }

  return (
    <div className="max-w-[680px] mx-auto rounded-[18px] border border-line bg-surf/60 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-surf">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent/15 grid place-items-center"><Shield size={15} className="text-accent" /></div>
          <div>
            <div className="text-[14px] font-semibold leading-tight">You &harr; Aria</div>
            <div className="font-mono text-[10.5px] text-faint leading-tight flex items-center gap-1"><Lock size={9} /> end-to-end encrypted</div>
          </div>
        </div>
        <button onClick={() => setPeek(p => !p)}
          className={`flex items-center gap-1.5 text-[12px] font-mono px-2.5 py-1.5 rounded-lg border transition ${peek ? "border-warn/50 text-warn bg-warn/10" : "border-line text-muted hover:text-ink"}`}>
          {peek ? <EyeOff size={13} /> : <Eye size={13} />}{peek ? "server view" : "peek"}
        </button>
      </div>

      {/* fingerprints */}
      <div className="px-5 py-2 border-b border-line flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] text-faint">
        <span>you: {ready ? meFp : "…"}</span>
        <span>aria: {ready ? ariaFp : "…"}</span>
      </div>

      {/* thread */}
      <div ref={threadRef} className="h-[360px] overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
        {msgs.length === 0 && (
          <div className="m-auto text-center text-faint text-[13px] max-w-[42ch] leading-relaxed">
            Type a message below. It gets encrypted on this device before it would ever touch a server.
            Hit <span className="text-warn font-mono">peek</span> to see exactly what a server would store: nothing readable.
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.from === "me";
          return (
            <div key={i} className={`max-w-[78%] ${mine ? "self-end" : "self-start"}`}>
              <div className={`px-3.5 py-2.5 rounded-[14px] text-[14px] leading-[1.45] break-words ${mine ? "bg-accent text-bg rounded-br-[4px]" : "bg-surf2 text-ink rounded-bl-[4px]"}`}>
                {peek
                  ? <span className="font-mono text-[11px] opacity-90 break-all">{m.sealed.ciphertext.slice(0, 88)}…</span>
                  : m.text}
              </div>
              <div className={`mt-0.5 text-[10px] text-faint font-mono ${mine ? "text-right" : ""}`}>{mine ? "you" : "aria"}{peek ? " · AES-GCM" : ""}</div>
            </div>
          );
        })}
      </div>

      {/* composer */}
      <div className="border-t border-line p-3 bg-surf">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[11px] text-faint mr-1">speaking as</span>
          {(["me", "aria"] as const).map(s => (
            <button key={s} onClick={() => setSpeaker(s)}
              className={`text-[12px] px-2.5 py-1 rounded-md transition ${speaker === s ? "bg-accent text-bg font-medium" : "text-muted hover:text-ink"}`}>
              {s === "me" ? "you" : "aria"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            disabled={!ready} placeholder={ready ? "type an encrypted message…" : "generating keys…"}
            className="flex-1 bg-bg border border-line rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-accent transition disabled:opacity-50" />
          <button onClick={send} disabled={!ready || !draft.trim()}
            className="grid place-items-center w-[44px] rounded-[10px] bg-accent text-bg transition hover:brightness-110 disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}