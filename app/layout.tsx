import type { Metadata, Viewport } from "next";
import PwaStatus from '../components/pwa-status';
import "./globals.css";

export const metadata: Metadata = {
  title: "Parkly — Find. Reserve. Park.",
  description: "Educational parking prototype with fictional data and simulated reservations. No real payments or parking access.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Parkly' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0066FF' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" /></head>
      <body className="antialiased"><PwaStatus /><aside className="educational-notice" aria-label="Educational prototype">Educational prototype · All accounts, parking listings and reservations are fictional. No real payments or physical parking access.</aside>{children}</body>
    </html>
  );
}
