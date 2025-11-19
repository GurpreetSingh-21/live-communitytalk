//frontend/app/page.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldCheck, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50 px-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-indigo-400" />
            <CardTitle className="text-xl font-semibold">CommunityTalk Admin</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Manage profiles, communities, reports, and platform safety.
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4 flex flex-col gap-4">
          <Button
            className="w-full text-base font-medium"
            onClick={() => router.push("/admin/login")}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Go to Admin Login
          </Button>

          <p className="text-sm text-slate-500 text-center">
            Only authorized administrators may access this dashboard.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}