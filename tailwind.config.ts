import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      bg:"#0a0a0c", surf:"#121216", surf2:"#1a1a20", line:"#26262e",
      ink:"#f0f0f2", muted:"#8a8a94", faint:"#55555f",
      accent:"#7c9eff", good:"#3ecf8e", warn:"#e0a35a",
    },
    fontFamily: { sans:["var(--font-sans)","system-ui","sans-serif"], mono:["var(--font-mono)","monospace"] },
  }},
  plugins: [],
} satisfies Config;
