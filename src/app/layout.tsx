import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import AgeGate from "@/components/AgeGate";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "AroundU — Anonymous Chat & Hookups Near You",
  description: "Get instantly matched with anonymous strangers for real-time chat and hookups. Select your region, find someone nearby, and start talking. 18+ only. All chats auto-delete in 24 hours.",
  keywords: ["anonymous chat", "stranger chat", "hookup app", "sexting", "nearby chat", "omegle alternative", "adult chat", "anonymous hookup"],
  openGraph: {
    title: "AroundU — Anonymous Chat & Hookups",
    description: "Meet strangers nearby. Chat anonymously. No profiles needed. 18+ only.",
    type: "website",
    siteName: "AroundU",
  },
  twitter: {
    card: "summary_large_image",
    title: "AroundU — Anonymous Chat & Hookups",
    description: "Meet strangers nearby. Chat anonymously. 18+ only.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#060608",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AgeGate />
        <AuthProvider>{children}</AuthProvider>
        <Footer />
      </body>
    </html>
  );
}
