# wisp

A messenger that is private because of how it is built, not because you flipped a setting. Your keys are made on your device and stay there. Every message is encrypted before it leaves, so the server only ever holds scrambled text it cannot read. It is open source, so you can check all of that yourself.

> Heads up: this is early. The encryption and a working messenger are live. The wider social side is still on the list below.

## Why I built this

Most apps that call themselves private are asking you to trust their servers. I did not want to build another one of those. With Wisp the math does the trusting for you. A server that gets breached, or anyone watching the wire, only ever sees gibberish.

## How the encryption actually works

1. When you sign up, your browser makes an ECDH (P-256) keypair. The private key never leaves your device.
2. The only thing that gets shared is your public key.
3. When two people chat, each side mixes their own private key with the other person's public key and lands on the exact same shared secret. That secret is never sent anywhere.
4. The shared secret becomes an AES-GCM key, which keeps messages secret and also catches tampering.
5. Every message gets a fresh random IV. The server stores `{ iv, ciphertext }` and nothing else.

The whole thing is about 85 lines with no dependencies, in [`src/lib/crypto.ts`](src/lib/crypto.ts), using the browser's built-in Web Crypto. Go read it. That is kind of the point.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The homepage has a live demo with two identities you can message between. Hit **peek** to see what a server would actually store.

For the real networked app at `/app`, you will need a Supabase project: run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor and put your URL and anon key in `.env.local`.

## Where this is going

- [x] Encryption core and a local demo
- [x] Real accounts, a key directory, and live 1:1 messaging
- [ ] The social side: profiles, posts, a feed, follows
- [ ] Group chats, media, a mobile app

## Honest limitations

This is early, and I would rather be upfront than oversell it:

- Keys live in your browser's storage, so this is as safe as the device it runs on.
- There is no forward secrecy yet. If a private key leaks, past messages for that key can be read. A future version will add a ratchet.
- You verify you are talking to the right person by comparing the key fingerprint shown in the chat header. There is no automatic protection against a malicious server swapping a key.
- One device per account for now. Logging in somewhere new makes a fresh key.

## Built with

Next.js, React, Tailwind, the Web Crypto API, and Supabase.

## License

MIT. Do what you want with it. Pull requests welcome.