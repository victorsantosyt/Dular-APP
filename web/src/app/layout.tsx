import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dular Admin",
  description: "Painel administrativo Dular",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans bg-[hsl(var(--bg))] text-[hsl(var(--text))]">{children}</body>
    </html>
  );
}
