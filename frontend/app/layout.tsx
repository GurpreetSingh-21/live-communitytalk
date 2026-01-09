import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import KeepAlive from "@/components/KeepAlive";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Campustry - Connect, Learn, Thrive",
  description:
    "The verified student platform connecting campus communities. Join 10,000+ students across 50+ universities.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jakartaSans.variable} font-sans antialiased bg-[#FAF9F7] text-[#1A1A1A]`}
      >
        <KeepAlive />
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  );
}