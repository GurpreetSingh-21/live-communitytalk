// frontend/app/admin/layout.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HeartHandshake,
  ShieldCheck,
  Shield,
  LogOut,
  Users2,
  LayoutDashboard,
  Layers,
  ShieldAlert, // ⭐ NEW: Import for Reports Icon
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  // ⭐ NEW: Reports Section Added
  {
    href: "/admin/reports",
    label: "Reports",
    description: "Review and manage user blocks/reports & high-risk accounts",
    icon: ShieldAlert, 
  },
  {
    href: "/admin/dating",
    label: "Dating Review",
    description: "Approve or suspend dating profiles",
    icon: HeartHandshake,
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Browse all verified student accounts",
    icon: Users2,
  },
  {
    href: "/admin/communities",
    label: "Communities",
    description: "Manage college, religion, and custom communities",
    icon: Layers, // or Globe2 / Building2 depending on your vibe
  },
];

function getPageSubtitle(pathname: string): string {
  // ⭐ NEW: Subtitle for Reports Page
  if (pathname.startsWith("/admin/reports")) {
    return "Investigate multi-reported users and handle auto-deletion risk accounts.";
  }
  if (pathname.startsWith("/admin/dating")) {
    return "Moderate student dating profiles and keep the space safe.";
  }
  if (pathname.startsWith("/admin/users")) {
    return "Browse verified accounts across colleges and manage roles.";
  }
  if (pathname.startsWith("/admin/communities")) {
    return "Create, edit, or remove college, religion, and custom communities.";
  }
  return "Manage CommunityTalk settings, safety, and platform operations.";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminToken");
    }
    router.push("/admin/login");
  };

  const currentItem =
    navItems.find((item) => pathname.startsWith(item.href)) ?? null;

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* ───────── LEFT SIDEBAR ───────── */}
      <aside className="hidden w-68 flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-md md:flex">
        {/* Brand */}
        <div className="mb-6 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-xs font-semibold text-white shadow-sm">
              CT
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold tracking-tight">
                CommunityTalk · Admin
              </p>
              <p className="text-[11px] text-slate-500">
                Internal tools · Not visible to students
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-2 py-1 text-[10px] font-medium text-slate-600">
            <LayoutDashboard className="h-3 w-3" />
            Console
          </span>
        </div>

        {/* Sections label */}
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Sections
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-slate-50 shadow-sm"
                    : "bg-transparent text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors",
                    active
                      ? "border-transparent bg-slate-900/80 text-slate-50"
                      : "border-slate-200 bg-white text-slate-600 group-hover:border-slate-300",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="font-medium leading-tight">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="text-[11px] text-slate-500">
                      {item.description}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="mt-6 space-y-3 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-semibold">Admin mode</span>
              <span className="text-[10px] text-emerald-700/80">
                Actions are logged and audited.
              </span>
            </div>
          </div>

          <p>
            Actions here apply instantly to student accounts. Review details
            before approving or suspending anything.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* ───────── MAIN AREA ───────── */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold tracking-tight">
                  {currentItem?.label || "Admin Dashboard"}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  <Shield className="h-3 w-3" />
                  Secure area
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {getPageSubtitle(pathname)}
              </p>
            </div>

            {/* Quick admin chip + mobile logout */}
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 md:flex">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Signed in as admin</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-slate-100 px-4 py-6 md:px-6">
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}