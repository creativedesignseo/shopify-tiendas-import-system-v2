import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { MainNav } from "@/components/main-nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shopify Import Architect",
  description: "Herramienta de importación inteligente para Shopify con enriquecimiento IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <MainNav />
        {children}
      </body>
    </html>
  );
}
