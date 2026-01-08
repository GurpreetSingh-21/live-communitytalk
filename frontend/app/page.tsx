"use client";

import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Dating } from "@/components/landing/Dating";
import { Features } from "@/components/landing/Features";
import { Download } from "@/components/landing/Download";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F7]">
      <Header />
      <Hero />
      <Dating />
      <Features />
      <Download />
      <Footer />
    </main>
  );
}