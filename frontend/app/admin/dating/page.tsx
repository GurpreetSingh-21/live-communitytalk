// frontend/app/admin/dating/page.tsx
"use client";

import { useEffect, useState } from "react";
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
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type DatingProfile = {
  _id: string;
  person: string;
  personName?: string;
  personEmail?: string;
  photos?: string[];
  bio?: string;
  gender?: string;
  seeking?: string[];
  yearOfStudy?: string;
  isPhotoApproved?: boolean;
  isProfileVisible?: boolean;
  isSuspended?: boolean;
  createdAt?: string;
};

export default function AdminDatingPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<DatingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DatingProfile | null>(null);

  // Basic guard: if no token in localStorage, bounce to login
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("adminToken");
    if (!token) {
      router.push("/admin/login");
    }
  }, [router]);

  const loadPending = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get<{ items: DatingProfile[] }>(
        "/api/admin/dating/profiles/pending"
      );

      setProfiles(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      console.error("[admin-dating] load error", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load profiles";
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const approveProfile = async (id: string) => {
    try {
      await adminApi.patch(`/api/admin/dating/profiles/${id}/approve`);
      toast.success("Profile approved");
      setProfiles((prev) => prev.filter((p) => p._id !== id));
      setSelected((prev) => (prev?._id === id ? null : prev));
    } catch (err: any) {
      console.error("[admin-dating] approve error", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to approve profile";
      toast.error(String(msg));
    }
  };

  const suspendProfile = async (id: string) => {
    try {
      await adminApi.patch(`/api/admin/dating/profiles/${id}/suspend`);
      toast.success("Profile suspended");
      setProfiles((prev) => prev.filter((p) => p._id !== id));
      setSelected((prev) => (prev?._id === id ? null : prev));
    } catch (err: any) {
      console.error("[admin-dating] suspend error", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to suspend profile";
      toast.error(String(msg));
    }
  };

  const pendingCount = profiles.length;

  const formatDate = (iso?: string) => {
    if (!iso) return "Unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-5">
      {/* Overview strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 bg-slate-50/80">
          <CardHeader className="py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Pending profiles
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-slate-900">
                {pendingCount}
              </p>
              <span className="text-xs text-slate-500">
                awaiting manual review
              </span>
            </div>
          </CardHeader>
        </Card>

        <Card className="hidden border-slate-200 bg-slate-50/80 sm:block">
          <CardHeader className="py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Safety policy
            </p>
            <p className="text-xs leading-relaxed text-slate-600">
              Only approve profiles with clear, real photos and respectful bios.
              Use suspend when something feels off or unsafe.
            </p>
          </CardHeader>
        </Card>

        <Card className="hidden border-slate-200 bg-slate-50/80 sm:block">
          <CardHeader className="flex h-full flex-col justify-between py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Review tips
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                Click a row to see full details and photos. Actions are applied
                instantly to the student’s dating profile.
              </p>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Main review table */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="flex flex-col items-start justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Dating profiles · Pending review
            </CardTitle>
            <p className="text-xs text-slate-500">
              Approve or suspend profiles submitted from the CommunityTalk
              mobile app.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100"
            onClick={loadPending}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading pending profiles…
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-500">
              <p className="font-medium">No pending profiles right now.</p>
              <p className="max-w-sm text-xs text-slate-500">
                Once students create or update dating profiles in the mobile
                app, they will appear here for manual review.
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
                    Meta
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer border-slate-100 hover:bg-slate-50/80"
                    onClick={() => setSelected(p)}
                  >
                    {/* User */}
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-900">
                          {p.personName || "Unknown"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {p.personEmail}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Submitted: {formatDate(p.createdAt)}
                        </span>
                      </div>
                    </TableCell>

                    {/* Meta */}
                    <TableCell className="align-top text-xs text-slate-700">
                      <div className="flex flex-col gap-1">
                        <span>
                          Gender:{" "}
                          <span className="font-medium text-slate-900">
                            {p.gender || "—"}
                          </span>
                        </span>
                        <span>
                          Year:{" "}
                          <span className="font-medium text-slate-900">
                            {p.yearOfStudy || "—"}
                          </span>
                        </span>
                        {p.seeking && p.seeking.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.seeking.map((s) => (
                              <Badge
                                key={s}
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-700"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="align-top text-xs">
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-[10px] text-amber-700"
                        >
                          Pending
                        </Badge>
                        {p.isSuspended && (
                          <Badge
                            variant="outline"
                            className="border-red-300 bg-red-50 text-[10px] text-red-700"
                          >
                            Suspended
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 bg-white text-[11px] text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            suspendProfile(p._id);
                          }}
                        >
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-500 text-[11px] text-emerald-950 hover:bg-emerald-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            approveProfile(p._id);
                          }}
                        >
                          Approve
                        </Button>
                      </div>
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
        <DialogContent className="max-w-xl border border-slate-200 bg-white text-slate-900">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-900">
                  {selected.personName || "Profile details"}
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  {selected.personEmail} · Submitted {formatDate(selected.createdAt)}
                </p>
              </DialogHeader>

              <div className="mt-2 space-y-4 text-sm">
                {selected.photos && selected.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto rounded-lg bg-slate-50 p-2">
                    {selected.photos.map((url, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={idx}
                        src={url}
                        alt="Profile"
                        className="h-40 w-28 flex-none rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}

                {selected.bio && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Bio
                    </p>
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                      {selected.bio}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-slate-700">
                  <span>
                    Gender:{" "}
                    <span className="font-medium text-slate-900">
                      {selected.gender || "—"}
                    </span>
                  </span>
                  <span>
                    Year:{" "}
                    <span className="font-medium text-slate-900">
                      {selected.yearOfStudy || "—"}
                    </span>
                  </span>
                  {selected.seeking && selected.seeking.length > 0 && (
                    <span>
                      Seeking:{" "}
                      <span className="font-medium text-slate-900">
                        {selected.seeking.join(", ")}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => suspendProfile(selected._id)}
                  >
                    Suspend
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                    onClick={() => approveProfile(selected._id)}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}