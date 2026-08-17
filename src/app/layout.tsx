import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FlyBaze Admin",
  description: "Back-office FlyBaze Express",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-brand-mist text-ink">{children}</body>
    </html>
  );
}
