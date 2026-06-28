import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
const sans = Hanken_Grotesk({ subsets:["latin"], variable:"--font-sans" });
const mono = JetBrains_Mono({ subsets:["latin"], variable:"--font-mono" });
export const metadata: Metadata = {
  title: "Wisp · end-to-end encrypted messenger",
  description: "Open-source, end-to-end encrypted social messenger. The server never sees your messages.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body className="font-sans">{children}</body></html>;
}
