// frontend/app/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Shield,
  User2,
  HeartHandshake,
  Mail,
  School,
  Sparkles,
  Trash2,
  Ban,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

// 🚨 UPDATED TYPE: Added moderation fields
type AdminUser = {
  _id: string;
  fullName: string;
  email: string;
  role: "user" | "mod" | "admin";
  isActive: boolean; // Changed to required boolean for simplicity
  collegeSlug?: string | null;
  religionKey?: string | null;
  hasDatingProfile?: boolean;
  datingProfileId?: string | null;
  createdAt?: string;
  communitiesCount?: number;
  // ⭐ NEW MODERATION FIELDS
  reportsReceivedCount?: number;
  isPermanentlyDeleted?: boolean;
};

// --- CONSTANTS ---
const AUTO_DELETE_THRESHOLD = 7;

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "mod" | "admin">(
    "all"
  );
  const [datingFilter, setDatingFilter] = useState<"all" | "with" | "without">(
    "all"
  );

  // Guard: require adminToken
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("adminToken");
    if (!token) router.push("/admin/login");
  }, [router]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get<{ items: AdminUser[] }>(
        "/api/admin/users"
      );
      // Ensure isActive is set for the frontend logic
      const loadedUsers: AdminUser[] = Array.isArray(data.items) ? data.items.map(u => ({...u, isActive: u.isActive !== false})) : [];
      setUsers(loadedUsers);
    } catch (err: any) {
      console.error("[admin-users] load error", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to load users";
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      // 🚨 Ensure filtering handles the new isActive status correctly
      // if (u.isPermanentlyDeleted) return false; // Optionally filter out banned users by default

      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (datingFilter === "with" && !u.hasDatingProfile) return false;
      if (datingFilter === "without" && u.hasDatingProfile) return false;

      if (!q) return true;
      const haystack = [
        u.fullName,
        u.email,
        u.collegeSlug,
        u.religionKey,
        u.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [users, search, roleFilter, datingFilter]);

  const totals = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const mods = users.filter((u) => u.role === "mod").length;
    const withDating = users.filter((u) => u.hasDatingProfile).length;
    return { total, admins, mods, withDating };
  }, [users]);

  const formatDate = (iso?: string) => {
    if (!iso) return "Unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ----------------------------------------------------------------------
  // ⭐ MODERATION ACTIONS
  // ----------------------------------------------------------------------
  const handleUserAction = async (userId: string, action: 'ban' | 'deactivate' | 'unban') => {
    const verb = action === 'ban' ? 'permanently ban' : action === 'deactivate' ? 'mute/deactivate' : 'unban/reactivate';
    if (!window.confirm(`Are you sure you want to ${verb} user ${userId}?`)) return;

    setActionLoadingId(userId);
    try {
      const endpoint = `/api/admin/people/${userId}/${action}`;
      await adminApi.patch(endpoint);
      
      toast.success(`User successfully ${verb}d.`);
      await loadUsers(); // Refresh the entire list
      setSelected(null); // Close the dialog
    } catch (err: any) {
      console.error(`[admin-users] ${action} error`, err);
      toast.error(err?.response?.data?.error || `Failed to ${verb} user.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // ----------------------------------------------------------------------
  // ⭐ UI HELPERS (for dynamic button rendering)
  // ----------------------------------------------------------------------

  const renderStatusBadge = (user: AdminUser) => {
    const reportsCount = user.reportsReceivedCount || 0;
    const isHighRisk = reportsCount >= AUTO_DELETE_THRESHOLD;

    if (user.isPermanentlyDeleted) {
      return <Badge variant="destructive" className="text-[10px] font-bold">BANNED</Badge>;
    }
    if (!user.isActive) {
      return <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 text-[10px]">MUTED</Badge>;
    }
    if (isHighRisk) {
      return <Badge className="bg-red-500 text-white text-[10px] hover:bg-red-600">HIGH REPORTS ({reportsCount})</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">Active</Badge>;
  };

  const renderActionButtons = (user: AdminUser) => {
    const isWorking = actionLoadingId === user._id;

    if (user.isPermanentlyDeleted) {
        return (
            <Button
                size="sm"
                variant="default"
                className="text-[11px] h-8 bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={(e) => { e.stopPropagation(); handleUserAction(user._id, 'unban'); }}
                disabled={isWorking}
            >
                {isWorking ? 'WORKING...' : 'UNBAN'}
            </Button>
        );
    }
    
    if (!user.isActive) {
        return (
            <Button
                size="sm"
                variant="default"
                className="text-[11px] h-8"
                onClick={(e) => { e.stopPropagation(); handleUserAction(user._id, 'unban'); }}
                disabled={isWorking}
            >
                {isWorking ? 'WORKING...' : 'ACTIVATE'}
            </Button>
        );
    }

    return (
        <div className="flex justify-end gap-2">
            {/* Mute/Deactivate */}
            <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-8 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={(e) => { e.stopPropagation(); handleUserAction(user._id, 'deactivate'); }}
                disabled={isWorking}
            >
                <Ban className="h-3.5 w-3.5 mr-1" />
                Mute
            </Button>
            {/* Permanent Ban */}
            <Button
                size="sm"
                variant="destructive"
                className="text-[11px] h-8"
                onClick={(e) => { e.stopPropagation(); handleUserAction(user._id, 'ban'); }}
                disabled={isWorking}
            >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Ban
            </Button>
        </div>
    );
  };
  
  // ----------------------------------------------------------------------
  // ⭐ MAIN RENDER
  // ----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Bento overview row */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* ... (existing total cards remain here, no functional change) ... */}
        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-slate-200/40" />
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
              <User2 className="h-3.5 w-3.5" />
              User base
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {totals.total}
              </p>
              <span className="text-xs text-slate-500">
                verified across all colleges
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Every row here is a real student account. Use this view for
              high-level health checks.
            </p>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-sky-50/80 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-sky-200/60" />
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200/70">
              <Shield className="h-3.5 w-3.5" />
              Admins & Mods
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {totals.admins}
                </p>
                <p className="text-[11px] text-slate-600">Admins</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {totals.mods}
                </p>
                <p className="text-[11px] text-slate-600">Mods</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Keep at least one backup admin per college for resilience.
            </p>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-rose-50/80 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-rose-200/70" />
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/70">
              <HeartHandshake className="h-3.5 w-3.5" />
              Dating opt-in
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {totals.withDating}
              </p>
              <span className="text-xs text-slate-600">
                students with dating enabled
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Cross-check these against the dating review queue as needed.
            </p>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-emerald-100/60" />
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/70">
              <Sparkles className="h-3.5 w-3.5" />
              Directory notes
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Search across name, email, college, or religion. This panel exists
              for safety, not surveillance — keep usage minimal and purposeful.
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Filters + table in a big bento panel */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-slate-100/90 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                Students · Directory
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 rounded-full border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700"
                >
                  <Shield className="h-3 w-3" />
                  Secure area
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-500">
                Browse verified accounts across colleges, filter by role or
                dating usage, and open a profile for more detail.
              </p>
            </div>

            {/* Filters + search */}
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
              {/* Role pill group */}
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                {(["all", "user", "mod", "admin"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                      roleFilter === role
                        ? "bg-slate-900 text-slate-50 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() => setRoleFilter(role)}
                  >
                    {role === "all"
                      ? "All"
                      : role === "user"
                      ? "Users"
                      : role === "mod"
                      ? "Mods"
                      : "Admins"}
                  </button>
                ))}
              </div>

              {/* Dating pill group */}
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    datingFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setDatingFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    datingFilter === "with"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-rose-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setDatingFilter("with")}
                >
                  <HeartHandshake className="h-3 w-3 text-rose-500" />
                  Dating on
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    datingFilter === "without"
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setDatingFilter("without")}
                >
                  No dating
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full min-w-[220px] lg:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search name, college, email…"
                  className="h-9 rounded-full border-slate-200 bg-slate-50 pl-8 text-xs focus-visible:ring-slate-300"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Small sub-row: counts */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {filteredUsers.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {users.length}
              </span>{" "}
              users
            </span>
            <span className="hidden sm:inline">
              Click any row to open a lightweight detail view. No actions are
              destructive from here yet.
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading users…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-500">
              <p className="font-medium">No users match these filters.</p>
              <p className="max-w-sm text-xs text-slate-500">
                Try clearing the role or dating filters, or searching by a
                shorter part of the email/name.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    User
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    College / Religion
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Role / Features
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow
                    key={u._id}
                    className="cursor-pointer border-slate-100 hover:bg-slate-50/80"
                    onClick={() => setSelected(u)}
                  >
                    {/* User identity */}
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
                          <User2 className="h-3.5 w-3.5 text-slate-400" />
                          {u.fullName || "Unknown"}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Mail className="h-3 w-3" />
                          <span>{u.email}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Joined: {formatDate(u.createdAt)}
                        </span>
                      </div>
                    </TableCell>

                    {/* College / religion */}
                    <TableCell className="align-top text-xs text-slate-700">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1">
                          <School className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium text-slate-900">
                            {u.collegeSlug || "Unknown college"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Sparkles className="h-3 w-3 text-slate-400" />
                          <span>
                            {u.religionKey ? u.religionKey : "No religion key"}
                          </span>
                        </span>
                        {typeof u.communitiesCount === "number" && (
                          <span className="text-[11px] text-slate-500">
                            Communities: {u.communitiesCount}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Role / features */}
                    <TableCell className="align-top text-xs">
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className={`border-slate-200 bg-slate-50 text-[10px] capitalize ${
                            u.role === "admin"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : u.role === "mod"
                              ? "border-sky-300 bg-sky-50 text-sky-700"
                              : ""
                          }`}
                        >
                          {u.role}
                        </Badge>
                        {u.isActive === false && (
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-[10px] text-red-700"
                          >
                            Inactive
                          </Badge>
                        )}
                        {u.hasDatingProfile && (
                          <Badge
                            variant="outline"
                            className="border-rose-200 bg-rose-50 text-[10px] text-rose-700"
                          >
                            Dating enabled
                          </Badge>
                        )}
                        {/* Display Reports Risk */}
                        {u.reportsReceivedCount && u.reportsReceivedCount > 0 ? (
                           <Badge 
                             variant="outline"
                             className={`text-[10px] ${u.reportsReceivedCount >= AUTO_DELETE_THRESHOLD ? 'border-red-500 bg-red-100 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
                           >
                            Reports: {u.reportsReceivedCount}
                           </Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="align-top text-right">
                      {renderActionButtons(u)} 
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
          {selected && (
            <>
              <DialogHeader className="border-b border-slate-100 pb-3">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <User2 className="h-4 w-4 text-slate-400" />
                  {selected.fullName || "User details"}
                </DialogTitle>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="h-3 w-3" />
                  {selected.email}
                </p>
              </DialogHeader>

              <div className="mt-3 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Role
                    </p>
                    <p className="mt-0.5 flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium capitalize">
                        {selected.role}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </p>
                    {/* Status badges in dialog */}
                    <div className="mt-0.5">{renderStatusBadge(selected)}</div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      College
                    </p>
                    <p className="mt-0.5">
                      {selected.collegeSlug || "Unknown college"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Reports
                    </p>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {selected.reportsReceivedCount || 0} lifetime
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  {selected.hasDatingProfile && (
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-rose-50 text-[10px] text-rose-700"
                    >
                      Dating profile connected
                    </Badge>
                  )}
                  {typeof selected.communitiesCount === "number" && (
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-50 text-[10px] text-slate-700"
                    >
                      {selected.communitiesCount} communities
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-[10px] text-slate-700"
                  >
                    Joined {formatDate(selected.createdAt)}
                  </Badge>
                </div>

                {/* ⭐ NEW: Action Buttons in Dialog */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </Button>
                  {renderActionButtons(selected)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}