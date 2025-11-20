// frontend/app/admin/reports/page.tsx
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
  ShieldAlert,
  User,
  Trash2,
  AlertTriangle,
  Mail,
  RefreshCw,
  Ban, 
  CheckCircle, // New icon for resolution
} from "lucide-react";
import { toast } from "sonner";

// 🚨 TYPE DEFINITIONS (Correctly placed outside the component export)
type ReportedUser = {
    _id: string;
    fullName: string;
    email: string;
    role: "user" | "mod" | "admin";
    reportsReceivedCount: number;
    isPermanentlyDeleted: boolean;
    isActive: boolean;
};

type ReportItem = {
    _id: string;
    reportCount: number;
    reportedUser: ReportedUser;
    reasons: string[];
    lastReportedAt: string;
};


export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const AUTO_DELETE_THRESHOLD = 7; 

  // Guard: require adminToken
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("adminToken");
    if (!token) router.push("/admin/login");
  }, [router]);

  // ----------------------------------------------------------------------
  // ⭐ API CALLS AND DATA MANIPULATION
  // ----------------------------------------------------------------------

  const loadReports = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get<{ items: ReportItem[] }>(
        "/api/admin/reports"
      );
      setReports(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      console.error("[admin-reports] load error", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to load reports";
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleUserAction = async (userId: string, action: 'ban' | 'deactivate' | 'unban') => {
    const verb = action === 'ban' ? 'permanently ban' : action === 'deactivate' ? 'mute/deactivate' : 'unban/reactivate';
    if (!window.confirm(`Are you sure you want to ${verb} user ${userId}?`)) return;

    setActionLoadingId(userId);
    try {
      const endpoint = `/api/admin/people/${userId}/${action}`;
      await adminApi.patch(endpoint);
      
      toast.success(`User successfully ${verb}d.`);
      await loadReports();
      // No need to close the dialog if the user is still in the queue after a ban
    } catch (err: any) {
      console.error(`[admin-reports] ${action} error`, err);
      toast.error(err?.response?.data?.error || `Failed to ${verb} user.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // ⭐ NEW: Action to mark reports as resolved and clear the queue entry
  const handleResolveReports = async (userId: string) => {
    if (!window.confirm("Mark ALL pending reports for this user as RESOLVED and remove them from the queue?")) return;

    setActionLoadingId(userId);
    try {
      // Calls the new resolution route
      const endpoint = `/api/reports/admin/${userId}/resolve`; 
      await adminApi.patch(endpoint);
      
      toast.success("Reports marked as resolved. Queue refreshing...");
      await loadReports();
      setSelectedReport(null); // Close the dialog after successful resolution
    } catch (err: any) {
      console.error("[admin-reports] resolve error", err);
      toast.error(err?.response?.data?.error || "Failed to resolve reports.");
    } finally {
      setActionLoadingId(null);
    }
  };


  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (!q) return true;
      const u = r.reportedUser;
      const haystack = [u.fullName, u.email, u.role].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [reports, search]);

  const totals = useMemo(() => {
    const highRisk = reports.filter(r => r.reportedUser.reportsReceivedCount >= AUTO_DELETE_THRESHOLD).length;
    const pendingReview = reports.length;
    const permanentlyDeleted = reports.filter(r => r.reportedUser.isPermanentlyDeleted).length;
    return { pendingReview, highRisk, permanentlyDeleted };
  }, [reports, AUTO_DELETE_THRESHOLD]);

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
  // ⭐ RENDER LOGIC HELPERS (Defined inside component for state access)
  // ----------------------------------------------------------------------
  
  const renderStatusBadge = (user: ReportedUser) => {
    if (user.isPermanentlyDeleted) {
        return <Badge variant="destructive" className="text-[10px] font-bold">BANNED</Badge>;
    }
    // This is the MUTE/FREEZE status
    if (!user.isActive) {
        return <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 text-[10px]">MUTED (INACTIVE)</Badge>;
    }
    const isHighRisk = user.reportsReceivedCount >= AUTO_DELETE_THRESHOLD;
    if (isHighRisk) {
        return <Badge className="bg-red-500 text-white text-[10px] hover:bg-red-600">HIGH RISK</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Active</Badge>;
  }

  const renderActionButtons = (user: ReportedUser) => {
    const isWorking = actionLoadingId === user._id;
    const canUnban = user.isPermanentlyDeleted || !user.isActive;

    if (canUnban) {
        return (
            <Button
                size="sm"
                variant="default"
                className="text-[11px] h-8 bg-sky-500 text-white hover:bg-sky-600"
                onClick={(e) => { e.stopPropagation(); handleUserAction(user._id, 'unban'); }}
                disabled={isWorking}
            >
                {isWorking ? 'WORKING...' : 'ACTIVATE'}
            </Button>
        );
    }

    // Default state: User is active and not permanently banned
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
  }

  return (
    <div className="space-y-6">
      {/* Bento overview row (Matching Users Page style) */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-rose-50/90 px-4 py-4 shadow-lg">
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/70">
              <ShieldAlert className="h-3.5 w-3.5" />
              Pending Review
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {totals.pendingReview}
              </p>
              <span className="text-xs text-slate-600">
                unique users reported
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              These are users with recent blocks or reports needing attention.
            </p>
          </CardHeader>
        </Card>
        
        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-red-100/90 px-4 py-4 shadow-lg">
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-red-800 ring-1 ring-red-300/70">
              <AlertTriangle className="h-3.5 w-3.5" />
              Auto-Delete Risk
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {totals.highRisk}
              </p>
              <span className="text-xs text-slate-600">
                users over {AUTO_DELETE_THRESHOLD} reports
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              These users should be reviewed immediately.
            </p>
          </CardHeader>
        </Card>
        
        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-4 shadow-lg">
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
              <Trash2 className="h-3.5 w-3.5" />
              Deleted Accounts
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {totals.permanentlyDeleted}
              </p>
              <span className="text-xs text-slate-600">
                permanently banned users
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              These accounts were removed due to severe violations.
            </p>
          </CardHeader>
        </Card>

        {/* Safety Notes Card */}
        <Card className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-lg">
          <CardHeader className="p-0 space-y-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
              <ShieldAlert className="h-3.5 w-3.5" />
              Safety Notes
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              The reporting system auto-flags users once they receive 
              **{AUTO_DELETE_THRESHOLD}** reports, initiating the permanent 
              deletion process.
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Reports table panel */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg">
        <CardHeader className="border-b border-slate-100/90 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                User Reports · Review Queue
              </CardTitle>
              <p className="text-xs text-slate-500">
                Users are grouped by reported account. Use this panel to investigate and ban problematic users.
              </p>
            </div>

            {/* Search and Refresh */}
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={loadReports}
                disabled={loading}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Refreshing..." : "Refresh Reports"}
              </Button>
              <div className="relative w-full min-w-[220px] lg:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search reported name or email…"
                  className="h-9 rounded-full border-slate-200 bg-slate-50 pl-8 text-xs focus-visible:ring-slate-300"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading report queue...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-500">
              <p className="font-medium">The report queue is clear! 🎉</p>
              <p className="max-w-sm text-xs text-slate-500">
                All users with multiple reports have been reviewed or automatically deleted.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Reported User
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Report Details
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Risk Status
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredReports.map((r) => {
                  const user = r.reportedUser;
                  
                  return (
                    <TableRow
                      key={user._id} // Use user._id as the key, since this is grouped by user
                      className="cursor-pointer border-slate-100 hover:bg-rose-50/30"
                      onClick={() => setSelectedReport(r)}
                    >
                      {/* Reported User Identity */}
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {user.fullName || "Unknown"}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Mail className="h-3 w-3" />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Report Details */}
                      <TableCell className="align-top text-xs text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900">
                            {r.reportCount} total unique reports
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Last reported: {formatDate(r.lastReportedAt)}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.reasons.slice(0, 2).map((reason, idx) => (
                                <Badge key={idx} variant="default" className="bg-amber-500/10 text-amber-700 border-amber-300 text-[10px]">
                                    {reason.substring(0, 20)}...
                                </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>

                      {/* Risk Status */}
                      <TableCell className="align-top text-xs">
                        <div className="flex flex-col gap-1">
                            {renderStatusBadge(user)}
                            <span className="text-[11px] text-slate-500">
                                Lifetime reports: {user.reportsReceivedCount}
                            </span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-top text-right">
                        <div className="flex justify-end gap-2">
                           {renderActionButtons(user)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-lg">
          {selectedReport && (
            <>
              <DialogHeader className="border-b border-slate-100 pb-3">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  Report Details for {selectedReport.reportedUser.fullName}
                </DialogTitle>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  {selectedReport.reportedUser.email} · Total Reports: {selectedReport.reportedUser.reportsReceivedCount}
                </p>
              </DialogHeader>

              <div className="mt-3 space-y-4 text-sm">
                <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Recent Report Reasons ({selectedReport.reportCount} unique reports)
                    </p>
                    <ul className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
                        {selectedReport.reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-slate-400">#{(i+1)}</span>
                                <span className="flex-1">{r}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    {/* Resolve button needs to be here */}
                    <Button
                        size="sm"
                        variant="default"
                        className="text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                        onClick={() => handleResolveReports(selectedReport.reportedUser._id)}
                        disabled={actionLoadingId === selectedReport.reportedUser._id}
                    >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Resolve Reports
                    </Button>
                    
                    {/* Manual Actions in Detail Dialog */}
                    {renderActionButtons(selectedReport.reportedUser)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}