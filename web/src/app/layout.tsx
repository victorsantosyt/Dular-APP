import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

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
    <html lang="pt-BR">
      <body className="font-sans bg-[hsl(var(--bg))] text-[hsl(var(--text))]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
