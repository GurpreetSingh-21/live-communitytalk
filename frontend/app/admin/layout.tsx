"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  HeartHandshake,
  ShieldAlert,
  Users2,
  Layers,
  LogOut,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
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
    icon: Layers,
  },
];

function getPageSubtitle(pathname: string): string {
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
  return "Manage Campustry settings, safety, and platform operations.";
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

  const activePage = navItems.find((item) =>
    pathname.startsWith(item.href)
  );
  const pageSubtitle = getPageSubtitle(pathname);

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-[#E5E5E5] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[#E5E5E5]">
          <Link href="/admin/dating" className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/logo-new.png"
                alt="Campustry"
                fill
                sizes="40px"
                className="object-contain mix-blend-multiply"
              />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#2D5A47]">Campustry</h1>
              <p className="text-xs text-[#6B6B6B]">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                  ? "bg-[#2D5A47] text-white shadow-lg"
                  : "text-[#6B6B6B] hover:bg-[#F5F4F2] hover:text-[#1A1A1A]"
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-semibold text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#E5E5E5]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#6B6B6B] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-semibold text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-[#E5E5E5] px-8 py-6">
          <h2 className="text-2xl font-black text-[#1A1A1A] mb-1">
            {activePage?.label || "Admin Dashboard"}
          </h2>
          <p className="text-sm text-[#6B6B6B]">{pageSubtitle}</p>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
}