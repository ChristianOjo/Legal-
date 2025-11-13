import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MainLayout, { Providers } from "@/components/layout/MainLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Manus Legal AI Advisor",
  description: "Your personal AI-powered legal document analysis and chat advisor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}

