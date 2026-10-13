import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import { JournalMotion } from "@/components/motion-provider";
import "./globals.css";

const sans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-journal-sans",
  display: "swap",
});
const display = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-journal-display",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "our shelf · a shared media journal",
  description:
    "A private place for the things you watch, read, learn from, and remember together.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f5f0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
        <JournalMotion>{children}</JournalMotion>
      </body>
    </html>
  );
}
