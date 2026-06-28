import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
const sans = Hanken_Grotesk({ subsets:["latin"], variable:"--font-sans" });
const mono = JetBrains_Mono({ subsets:["latin"], variable:"--font-mono" });
export const metadata: Metadata = {
  title: "Wisp · end-to-end encrypted messenger",
  description: "An open-source messenger that is actually private. Your messages are encrypted on your device, so the server never sees a word.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body className="font-sans">{children}</body></html>;
}