"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ensureIdentity } from "@/lib/keys";
import { seal, open as openMsg, fingerprint, type Identity, type Jwk } from "@/lib/crypto";
import { Lock, Send, LogOut, Search, Shield, RotateCw } from "lucide-react";

type Profile = { id: string; handle: string; display_name: string | null; public_key: Jwk };
type Row = { id: string; sender_id: string; iv: string; ciphertext: string; created_at: string };
type Shown = { id: string; mine: boolean; text: string; at: string };

const fmtTime = (at: string) => { try { return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

function Avatar({ handle, size = 32 }: { handle: string; size?: number }) {
  const ch = (handle?.[0] || "?").toUpperCase();
  return <span style={{ width: size, height: size }} className="shrink-0 rounded-full bg-accent/20 text-accent grid place-items-center text-[13px] font-semibold">{ch}</span>;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [authErr, setAuthErr] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [me, setMe] = useState<Profile | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [needHandle, setNeedHandle] = useState(false); const [handle, setHandle] = useState(""); const [handleErr, setHandleErr] = useState("");
  const [people, setPeople] = useState<Profile[]>([]); const [q, setQ] = useState("");
  const [peer, setPeer] = useState<Profile | null>(null); const [peerFp, setPeerFp] = useState("");
  const [shown, setShown] = useState<Shown[]>([]); const [draft, setDraft] = useState("");
  const [loadingChat, setLoadingChat] = useState(false); const [sendErr, setSendErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // --- session ---
  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setUserId(data.session?.user.id ?? null); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- bootstrap identity + profile ---
  useEffect(() => {
    if (!supabase || !userId) return;
    (async () => {
      const id = await ensureIdentity(userId); setIdentity(id);
      const { data: prof } = await supabase!.from("wisp_profiles").select("*").eq("id", userId).maybeSingle();
      if (!prof) { setNeedHandle(true); return; }
      if (JSON.stringify(prof.public_key) !== JSON.stringify(id.publicKey)) {
        await supabase!.from("wisp_profiles").update({ public_key: id.publicKey }).eq("id", userId);
      }
      setMe({ ...prof, public_key: id.publicKey });
    })();
  }, [userId]);

  // --- clean up realtime on unmount ---
  useEffect(() => () => { if (channelRef.current && supabase) supabase.removeChannel(channelRef.current); }, []);

  async function claimHandle() {
    if (!supabase || !userId || !identity) return;
    const h = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (h.length < 3) { setHandleErr("Handle needs at least 3 letters or numbers."); return; }
    setHandleErr("");
    const { error } = await supabase.from("wisp_profiles").insert({ id: userId, handle: h, public_key: identity.publicKey });
    if (error) { setHandleErr(error.code === "23505" ? "That handle is taken. Try another one." : error.message); return; }
    setMe({ id: userId, handle: h, display_name: null, public_key: identity.publicKey }); setNeedHandle(false);
  }

  const loadPeople = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("wisp_profiles").select("*").neq("id", userId).order("created_at", { ascending: false }).limit(100);
    setPeople((data as Profile[]) ?? []);
  }, [userId]);
  useEffect(() => { if (me) loadPeople(); }, [me, loadPeople]);
  // refresh the directory when the tab regains focus, so new signups appear
  useEffect(() => {
    const onFocus = () => loadPeople();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPeople]);

  // conversation creation is handled server-side by a SECURITY DEFINER function,
  // so a user can never add themselves to someone else's conversation.
  async function convoId(peerId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("get_or_create_dm", { peer_id: peerId });
    if (error) { console.error("dm:", error); return null; }
    return data as string;
  }

  async function decryptRow(r: Row, peerPub: Jwk): Promise<Shown> {
    let text = "[unable to decrypt]";
    try { text = await openMsg(identity!.privateKey, peerPub, { iv: r.iv, ciphertext: r.ciphertext }); } catch {}
    return { id: r.id, mine: r.sender_id === userId, text, at: r.created_at };
  }

  async function openChat(p: Profile) {
    if (!supabase) return;
    setPeer(p); setShown([]); setSendErr(""); setLoadingChat(true);
    setPeerFp(await fingerprint(p.public_key));
    const cid = await convoId(p.id);
    if (!cid) { setLoadingChat(false); return; }
    const { data: rows } = await supabase.from("wisp_messages").select("*").eq("conversation_id", cid).order("created_at");
    const dec = await Promise.all(((rows as Row[]) ?? []).map((r) => decryptRow(r, p.public_key)));
    setShown(dec); setLoadingChat(false);
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase.channel(`msgs:${cid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wisp_messages", filter: `conversation_id=eq.${cid}` },
        async (payload) => { const s = await decryptRow(payload.new as Row, p.public_key); setShown((m) => m.some(x => x.id === s.id) ? m : [...m, s]); })
      .subscribe();
  }

  async function send() {
    if (!supabase || !draft.trim() || !peer || !identity || !userId) return;
    const text = draft.trim(); setDraft(""); setSendErr("");
    const cid = await convoId(peer.id);
    if (!cid) { setSendErr("Couldn't start the conversation. Try again."); setDraft(text); return; }
    const sealed = await seal(identity.privateKey, peer.public_key, text);
    const { data: inserted, error } = await supabase.from("wisp_messages")
      .insert({ conversation_id: cid, sender_id: userId, iv: sealed.iv, ciphertext: sealed.ciphertext }).select().single();
    if (error) { console.error("send:", error); setSendErr("Message didn't send. Try again."); setDraft(text); return; }
    if (inserted) {
      const s = await decryptRow(inserted as Row, peer.public_key);
      setShown((m) => m.some((x) => x.id === s.id) ? m : [...m, s]);
    }
  }
  useEffect(() => { if (shown.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [shown]);

  async function logIn() {
    if (!supabase || !email.trim() || !password) { setAuthErr("Enter your email and password."); return; }
    setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthErr(error.message);
  }
  async function signUp() {
    if (!supabase || !email.trim() || !password) { setAuthErr("Enter an email and a password."); return; }
    if (password.length < 6) { setAuthErr("Your password needs at least 6 characters."); return; }
    setAuthErr("");
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) setAuthErr(error.message);
  }
  async function signOut() { await supabase?.auth.signOut(); setMe(null); setPeer(null); setShown([]); setPeople([]); }

  // --- render ---
  if (!ready) return <Shell><p className="text-muted">loading…</p></Shell>;
  if (!supabase) return <Shell><Configure /></Shell>;

  if (!userId) {
    const isSignup = mode === "signup";
    const submit = () => (isSignup ? signUp() : logIn());
    const swap = () => { setMode(isSignup ? "login" : "signup"); setAuthErr(""); };
    return (
      <Shell>
        <div className="max-w-[360px] mx-auto text-center">
          <Lock className="mx-auto text-accent mb-4" />
          <h1 className="text-[22px] font-bold mb-2">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="text-muted text-[14px] mb-6">
            {isSignup ? "One account, private from the very first message. It only takes a few seconds." : "Log in and pick up right where you left off."}
          </p>
          <div className="grid gap-2.5">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
              className="bg-surf border border-line rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />
            <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} type="password"
              placeholder={isSignup ? "choose a password" : "password"} autoComplete={isSignup ? "new-password" : "current-password"}
              className="bg-surf border border-line rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />
            <button onClick={submit} className="bg-accent text-bg font-medium py-2.5 rounded-[10px] text-[14px] mt-1 hover:brightness-110 transition">
              {isSignup ? "Create account" : "Log in"}
            </button>
            {authErr && <p className="text-[13px] text-[#e0667f] mt-1">{authErr}</p>}
          </div>
          <button onClick={swap} className="mt-6 text-[13px] text-muted hover:text-ink transition">
            {isSignup ? "Already have an account? Log in" : "New here? Create an account"}
          </button>
        </div>
      </Shell>
    );
  }

  if (needHandle) return (
    <Shell>
      <div className="max-w-[360px] mx-auto text-center">
        <h1 className="text-[22px] font-bold mb-2">Pick a handle</h1>
        <p className="text-muted text-[14px] mb-6">This is the name people use to find you. Lowercase letters and numbers, keep it short.</p>
        <div className="flex gap-2">
          <input value={handle} onChange={e => setHandle(e.target.value)} onKeyDown={e => e.key === "Enter" && claimHandle()} placeholder="yourhandle"
            className="flex-1 bg-surf border border-line rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />
          <button onClick={claimHandle} className="bg-accent text-bg font-medium px-4 rounded-[10px] text-[14px]">claim</button>
        </div>
        {handleErr && <p className="text-[13px] text-[#e0667f] mt-2.5">{handleErr}</p>}
      </div>
    </Shell>
  );

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-line">
        <span className="font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-md bg-accent/20 grid place-items-center"><Lock size={13} className="text-accent" /></span>wisp</span>
        <div className="flex items-center gap-3 text-[13px] text-muted">
          {me && <span className="font-mono">@{me.handle}</span>}
          <button onClick={signOut} title="sign out" className="hover:text-ink transition"><LogOut size={15} /></button>
        </div>
      </header>
      <div className="flex-1 flex min-h-0">
        {/* directory */}
        <aside className="w-[280px] border-r border-line flex flex-col">
          <div className="p-3 border-b border-line flex items-center gap-2 bg-surf">
            <Search size={14} className="text-faint" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="find people" className="bg-transparent text-[13.5px] outline-none flex-1 min-w-0" />
            <button onClick={loadPeople} title="refresh" className="text-faint hover:text-ink transition"><RotateCw size={13} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {people.filter(p => p.handle.includes(q.toLowerCase())).map(p => (
              <button key={p.id} onClick={() => openChat(p)}
                className={`w-full text-left px-4 py-3 border-b border-line/60 transition hover:bg-surf flex items-center gap-2.5 ${peer?.id === p.id ? "bg-surf" : ""}`}>
                <Avatar handle={p.handle} size={30} />
                <div className="text-[14px] font-medium truncate">@{p.handle}</div>
              </button>
            ))}
            {people.length === 0 && <p className="text-faint text-[12.5px] p-4 leading-relaxed">Pretty quiet in here. Get a friend to sign up and they will show up.</p>}
          </div>
        </aside>
        {/* chat */}
        <section className="flex-1 flex flex-col min-w-0">
          {!peer ? (
            <div className="m-auto text-center text-faint text-[14px] px-6"><Shield className="mx-auto mb-3 opacity-50" />Pick someone on the left and say hi. It is encrypted the second you hit send.</div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-line flex items-center gap-3">
                <Avatar handle={peer.handle} />
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">@{peer.handle}</div>
                  <div className="font-mono text-[10.5px] text-faint flex items-center gap-1.5 truncate">
                    <Lock size={9} /> e2e{peerFp && <span className="opacity-70 truncate">· {peerFp}</span>}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
                {loadingChat ? (
                  <div className="m-auto text-faint text-[13px]">decrypting…</div>
                ) : shown.length === 0 ? (
                  <div className="m-auto text-faint text-[13px]">No messages yet. Say something.</div>
                ) : shown.map(m => (
                  <div key={m.id} className={`flex flex-col max-w-[72%] ${m.mine ? "self-end items-end" : "self-start items-start"}`}>
                    <div className={`px-3.5 py-2.5 rounded-[14px] text-[14px] break-words ${m.mine ? "bg-accent text-bg rounded-br-[4px]" : "bg-surf2 rounded-bl-[4px]"}`}>{m.text}</div>
                    <span className="text-[10px] text-faint mt-0.5 px-1">{fmtTime(m.at)}</span>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="border-t border-line p-3">
                {sendErr && <p className="text-[12px] text-[#e0667f] mb-2 px-1">{sendErr}</p>}
                <div className="flex gap-2">
                  <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="encrypted message…"
                    className="flex-1 bg-bg border border-line rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />
                  <button onClick={send} disabled={!draft.trim()} className="grid place-items-center w-[44px] rounded-[10px] bg-accent text-bg transition hover:brightness-110 disabled:opacity-40"><Send size={16} /></button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen grid place-items-center px-6">{children}</main>;
}
function Configure() {
  return (
    <div className="max-w-[440px] text-center">
      <h1 className="text-[20px] font-bold mb-3">Supabase not configured</h1>
      <p className="text-muted text-[14px] leading-relaxed">Add <code className="font-mono text-accent">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-accent">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>, run the SQL in <code className="font-mono">supabase/schema.sql</code>, and restart.</p>
    </div>
  );
}