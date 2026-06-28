# wisp

An open-source social messenger with **end-to-end encryption** built in from the first commit. Keys are generated on your device and never leave it. The server stores ciphertext and learns nothing.

> Status: early. The encryption core and a local demo work today. Networked messaging and the social layer are on the roadmap below.

## Why

Most "private" chat apps ask you to trust their servers. Wisp is built so you don't have to. The math guarantees it: a passive server, or anyone on the wire, only ever sees ciphertext.

## How the encryption works

1. Every user generates an **ECDH (P-256)** identity keypair in the browser. The private key never leaves the device.
2. Only **public keys** are shared.
3. To message someone, both sides derive the **same shared secret** from `(my private key + their public key)` using ECDH. The secret itself is never transmitted.
4. That secret becomes an **AES-GCM** key, which gives confidentiality and tamper-detection.
5. Every message uses a fresh random IV. The server stores `{ iv, ciphertext }`.

The whole core is ~85 lines of dependency-free code in [`src/lib/crypto.ts`](src/lib/crypto.ts), using only the native Web Crypto API. Read it. That's the point.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo generates two identities and lets you send encrypted messages between them. Hit **peek** to see what a server would actually store.

## Roadmap

- [x] **Phase 1** — E2E encryption core + local demo
- [ ] **Phase 2** — Supabase auth, a public-key directory, realtime 1:1 messaging over the network
- [ ] **Phase 3** — Social layer: profiles, posts, a feed, follows
- [ ] **Phase 4** — Group chats, media, a mobile client

The Phase 2 database schema is already in [`supabase/schema.sql`](supabase/schema.sql).

## Stack

Next.js · React · Tailwind · Web Crypto API · Supabase (Phase 2+)

## License

MIT
