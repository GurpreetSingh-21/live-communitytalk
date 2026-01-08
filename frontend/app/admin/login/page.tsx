"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) {
      console.warn("[admin-login] NEXT_PUBLIC_API_BASE_URL is missing. Set it in .env.local");
    }

    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("adminToken");
      if (token) {
        router.push("/admin/dating");
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/login`, {
        email,
        password,
      });

      const { token } = response.data;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("adminToken", token);
      }

      toast.success("Login successful!");
      router.push("/admin/dating");
    } catch (error: any) {
      console.error("[admin-login] error:", error);
      toast.error(error.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF9F7] to-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(45,90,71,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(45,90,71,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

      {/* Decorative Elements */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-[#2D5A47]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#FF7F6E]/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative w-16 h-16">
              <Image
                src="/logo.png"
                alt="Campustry"
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
          </div>
          <h1 className="text-3xl font-black text-[#1A1A1A] mb-2">
            Campustry Admin
          </h1>
          <p className="text-[#6B6B6B]">
            Platform management & moderation
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-[#E5E5E5] p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#1A1A1A] font-semibold">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@campustry.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-12 bg-[#FAF9F7] border-[#E5E5E5] focus:border-[#2D5A47] focus:ring-[#2D5A47]/20 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#1A1A1A] font-semibold">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12 bg-[#FAF9F7] border-[#E5E5E5] focus:border-[#2D5A47] focus:ring-[#2D5A47]/20 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#2D5A47] hover:bg-[#234537] text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#E5E5E5] text-center">
            <p className="text-sm text-[#6B6B6B]">
              Authorized personnel only
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-[#6B6B6B]">
          &copy; {new Date().getFullYear()} Campustry. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}