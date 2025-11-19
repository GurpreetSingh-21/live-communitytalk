// frontend/app/admin/login/page.tsx
"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios"; // 👈 use plain axios here, NOT adminApi
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";

if (!API_BASE) {
  console.warn(
    "[admin-login] NEXT_PUBLIC_API_BASE_URL is missing. Set it in .env.local"
  );
} else {
  console.log("[admin-login] Using API_BASE →", API_BASE);
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If token already present, go straight to dating admin
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem("adminToken");
    console.log(
      "[admin-login] useEffect → existing adminToken:",
      existing ? "present" : "missing"
    );
    if (existing) {
      console.log("[admin-login] existing token found → redirecting to /admin/dating");
      router.push("/admin/dating");
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log("========================================");
    console.log("[admin-login] handleSubmit fired");
    console.log("[admin-login] Email:", email);
    console.log("[admin-login] Password length:", password.length);
    console.log("[admin-login] API_BASE:", API_BASE || "<none>");

    const path = "/api/admin/login"; // ✅ FIXED: Use /api/admin/login
    const url = API_BASE + path;
    console.log("[admin-login] POSTing to:", url);

    try {
      const res = await axios.post(
        url,
        { email, password },
        {
          // Don't throw on 401; let us handle it manually
          validateStatus: () => true,
        }
      );

      console.log("[admin-login] Raw response status:", res.status);
      console.log("[admin-login] Raw response data:", res.data);

      if (res.status === 401) {
        const msg =
          (res.data && (res.data.error || res.data.message)) ||
          "Invalid email or password";
        console.error("[admin-login] 401 from /api/admin/login →", msg);
        toast.error(msg);
        return;
      }

      if (res.status < 200 || res.status >= 300) {
        const msg =
          (res.data && (res.data.error || res.data.message)) ||
          `Login failed with status ${res.status}`;
        console.error("[admin-login] Non-2xx status:", res.status, msg);
        toast.error(msg);
        return;
      }

      const data = res.data;

      if (!data?.token || !data?.user) {
        console.error("[admin-login] Missing token or user in response");
        toast.error("Invalid response from server");
        return;
      }

      console.log("[admin-login] Logged-in user from backend:", {
        id: data.user?._id,
        email: data.user?.email,
        role: data.user?.role,
      });

      if (data.user.role !== "admin") {
        console.error(
          "[admin-login] User is NOT admin. role =",
          data.user.role
        );
        toast.error("This account is not an admin.");
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("adminToken", data.token);
        console.log("[admin-login] Saved adminToken to localStorage");
      }

      toast.success("Logged in as admin");
      console.log("[admin-login] Navigating to /admin/dating");
      router.push("/admin/dating");
    } catch (err: any) {
      console.error("💥 [admin-login] Unexpected error in handleSubmit");
      console.error("[admin-login] Raw error object:", err);

      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to log in as admin";
      console.error("[admin-login] error message for UI:", msg);
      toast.error(String(msg));
    } finally {
      setLoading(false);
      console.log("[admin-login] handleSubmit finished, loading → false");
      console.log("========================================");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 text-slate-50">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            CommunityTalk Admin Login
          </CardTitle>
          <p className="text-sm text-slate-400">
            Use your admin email/password from the main CommunityTalk backend.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-900/60"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900/60"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-slate-100 text-slate-900 hover:bg-white"
            >
              {loading ? "Signing in..." : "Sign in as Admin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}