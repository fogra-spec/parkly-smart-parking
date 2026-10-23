import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parkly — Find. Reserve. Park.",
  description: "Explore Astana parking. A clearly labeled university reservation prototype.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
