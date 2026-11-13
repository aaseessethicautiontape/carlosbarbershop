import type { Metadata, Viewport } from "next";
import { Inter, Oswald, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500", "700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-oswald", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Carlo's Barbershop · Barrie, Ontario", template: "%s · Carlo's Barbershop" },
  description: "Cuts and shaves on Bayfield St in Barrie. Book a chair or join the live walk-in line from your phone.",
  openGraph: { title: "Carlo's Barbershop", description: "Book a chair or join the live walk-in line.", type: "website", locale: "en_CA" },
};

export const viewport: Viewport = { themeColor: "#121010", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={`${playfair.variable} ${oswald.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
