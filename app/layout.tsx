import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Beckett — For brains that work differently",
  description:
    "Beckett decodes what people really mean, helps you practice hard conversations, and meets you in the apps you use — built for brains that work differently.",
  openGraph: {
    title: "Beckett — For brains that work differently",
    description:
      "Beckett decodes what people really mean, helps you practice hard conversations, and meets you in the apps you use — built for brains that work differently.",
    siteName: "Beckett",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="bg-bg text-ink antialiased" style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
