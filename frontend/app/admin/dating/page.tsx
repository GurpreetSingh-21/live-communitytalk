// frontend/app/admin/dating/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  RefreshCw,
  User,
  Heart,
  GraduationCap,
  Calendar,
  Ruler,
  BookOpen,

  Instagram,
  Shield,
  Clock,
  AlertTriangle,
  ImageOff,
  ChevronLeft,
  X,
  Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DatingPhoto = {
  id: string;
  url: string;
  order: number;
  isMain: boolean;
  status: string;
};

type DatingPreference = {
  ageMin: number;
  ageMax: number;
  maxDistance: number;
  interestedInGender: string[];
  showToPeopleOnCampusOnly: boolean;
};

type DatingUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  collegeSlug: string;
  createdAt: string;
  isVerified: boolean;
};

type DatingProfile = {
  id: string;
  _id: string;
  firstName: string;
  bio: string | null;
  gender: string;
  birthDate: string;
  height: number | null;
  major: string | null;
  year: string | null;
  gradYear: string | null;
  greekLife: string | null;
  collegeSlug: string;
  hobbies: string[];
  interests: string[];
  prompts: Array<{ question: string; answer: string }> | null;
  spotifyTopArtists: string[];
  instagramHandle: string | null;
  isProfileVisible: boolean;
  isPaused: boolean;
  approvalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  photos: DatingPhoto[];
  preference: DatingPreference | null;
  user: DatingUser;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()))
    age--;
  return age;
}

function fmt(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalize(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "red" | "amber";
}) {
  const cls = {
    neutral: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
  }[tone];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-slate-800 break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Photo Gallery ────────────────────────────────────────────────────────────

function PhotoGallery({ photos }: { photos: DatingPhoto[] }) {
  const [current, setCurrent] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl bg-slate-100">
        <ImageOff className="h-8 w-8 text-slate-300" />
        <p className="text-xs text-slate-400">No photos uploaded</p>
      </div>
    );
  }

  const sorted = [...photos].sort((a, b) => a.order - b.order);
  const photo = sorted[current];

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-xl bg-slate-100"
        style={{ aspectRatio: "4/5" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={`Photo ${current + 1}`}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            photo.status === "APPROVED"
              ? "bg-emerald-500 text-white"
              : photo.status === "REJECTED"
              ? "bg-red-500 text-white"
              : "bg-amber-400 text-white"
          }`}
        >
          {photo.status}
        </span>

        {sorted.length > 1 && current > 0 && (
          <button
            onClick={() => setCurrent((c) => c - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {sorted.length > 1 && current < sorted.length - 1 && (
          <button
            onClick={() => setCurrent((c) => c + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {sorted.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {current + 1} / {sorted.length}
          </div>
        )}
      </div>

      {sorted.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {sorted.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setCurrent(i)}
              className={`relative h-14 w-10 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                i === current
                  ? "border-slate-700 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-75"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const presets = [
    "Fake or stock photos",
    "Inappropriate content",
    "Incomplete profile",
    "Suspected spam account",
    "Underage user",
    "Offensive bio or prompts",
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Reject Profile
            </h3>
            <p className="text-xs text-slate-500">
              Select or write a reason for rejection.
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-all ${
                reason === p
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Or write a custom reason…"
          className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          rows={3}
        />

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            Reject Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Detail Panel ─────────────────────────────────────────────────────

function ProfilePanel({
  profile,
  onClose,
  onApprove,
  onReject,
}: {
  profile: DatingProfile;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const age = calcAge(profile.birthDate);
  const prompts: Array<{ question: string; answer: string }> = Array.isArray(
    profile.prompts
  )
    ? (profile.prompts as Array<{ question: string; answer: string }>)
    : [];

  return (
    <>
      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          setRejectOpen(false);
          onReject(profile.id, reason);
        }}
      />

      <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm">
        <div className="flex-1 cursor-pointer" onClick={onClose} />

        <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {profile.firstName}, {age}
              </h2>
              <p className="text-xs text-slate-500">{profile.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Pending Review
              </span>
              <button
                onClick={onClose}
                className="ml-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr]">
              {/* LEFT: Photos */}
              <div>
                <SectionLabel>
                  Photos ({profile.photos.length})
                </SectionLabel>
                <PhotoGallery photos={profile.photos} />
              </div>

              {/* RIGHT: Details */}
              <div className="space-y-5">
                {/* Personal Info */}
                <div>
                  <SectionLabel>Personal Info</SectionLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InfoRow
                      icon={User}
                      label="First Name"
                      value={profile.firstName}
                    />
                    <InfoRow
                      icon={Calendar}
                      label="Age / DOB"
                      value={`${age} yrs — ${new Date(
                        profile.birthDate
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`}
                    />
                    <InfoRow
                      icon={Heart}
                      label="Gender"
                      value={capitalize(profile.gender)}
                    />
                    <InfoRow
                      icon={Ruler}
                      label="Height"
                      value={profile.height ? `${profile.height} cm` : null}
                    />
                    <InfoRow
                      icon={GraduationCap}
                      label="College"
                      value={profile.collegeSlug}
                    />
                    <InfoRow
                      icon={BookOpen}
                      label="Major"
                      value={profile.major}
                    />
                    <InfoRow
                      icon={GraduationCap}
                      label="Year"
                      value={profile.year ? capitalize(profile.year) : null}
                    />
                    <InfoRow
                      icon={GraduationCap}
                      label="Grad Year"
                      value={profile.gradYear}
                    />
                    <InfoRow
                      icon={Shield}
                      label="Greek Life"
                      value={profile.greekLife}
                    />
                    <InfoRow
                      icon={Instagram}
                      label="Instagram"
                      value={profile.instagramHandle}
                    />
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div>
                    <SectionLabel>Bio</SectionLabel>
                    <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
                      {profile.bio}
                    </p>
                  </div>
                )}

                {/* Prompts */}
                {prompts.length > 0 && (
                  <div>
                    <SectionLabel>Prompts</SectionLabel>
                    <div className="space-y-2">
                      {prompts.map((pr, i) => (
                        <div key={i} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {pr.question}
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {pr.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hobbies & Interests */}
                {(profile.hobbies.length > 0 ||
                  profile.interests.length > 0) && (
                  <div>
                    <SectionLabel>Hobbies &amp; Interests</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {[...profile.hobbies, ...profile.interests].map(
                        (tag, i) => (
                          <Chip key={i} label={tag} />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Spotify */}
                {profile.spotifyTopArtists.length > 0 && (
                  <div>
                    <SectionLabel>Spotify Top Artists</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.spotifyTopArtists.map((a, i) => (
                        <Chip key={i} label={a} tone="green" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferences */}
                {profile.preference && (
                  <div>
                    <SectionLabel>Matching Preferences</SectionLabel>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <InfoRow
                        icon={Heart}
                        label="Interested In"
                        value={
                          profile.preference.interestedInGender.length > 0
                            ? profile.preference.interestedInGender
                                .map(capitalize)
                                .join(", ")
                            : "Any"
                        }
                      />
                      <InfoRow
                        icon={Calendar}
                        label="Age Range"
                        value={`${profile.preference.ageMin} – ${profile.preference.ageMax} yrs`}
                      />
                      <InfoRow
                        icon={Shield}
                        label="Campus Only"
                        value={
                          profile.preference.showToPeopleOnCampusOnly
                            ? "Yes"
                            : "No"
                        }
                      />
                      <InfoRow
                        icon={Info}
                        label="Max Distance"
                        value={`${profile.preference.maxDistance} miles`}
                      />
                    </div>
                  </div>
                )}

                {/* Account Info */}
                <div>
                  <SectionLabel>Account Info</SectionLabel>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InfoRow
                      icon={User}
                      label="Full Name (Account)"
                      value={profile.user.name}
                    />
                    <InfoRow
                      icon={Shield}
                      label="Email Verified"
                      value={profile.user.isVerified ? "Yes ✓" : "No"}
                    />
                    <InfoRow
                      icon={Clock}
                      label="Account Created"
                      value={fmt(profile.user.createdAt)}
                    />
                    <InfoRow
                      icon={Clock}
                      label="Profile Submitted"
                      value={fmt(profile.createdAt)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-slate-100 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400 font-mono truncate">
                {profile.id}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={() => onApprove(profile.id)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDatingPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<DatingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DatingProfile | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem("adminToken")) {
      router.push("/admin/login");
    }
  }, [router]);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get<{ items: DatingProfile[] }>(
        "/api/admin/dating/profiles/pending"
      );
      setProfiles(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      toast.error(e?.response?.data?.error || e?.message || "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const approveProfile = async (id: string) => {
    try {
      await adminApi.patch(`/api/admin/dating/profiles/${id}/approve`);
      toast.success("Profile approved — they can now appear in the dating pool.");
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => (prev?.id === id ? null : prev));
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      toast.error(e?.response?.data?.error || e?.message || "Failed to approve");
    }
  };

  const rejectProfile = async (id: string, reason: string) => {
    try {
      await adminApi.patch(`/api/admin/dating/profiles/${id}/suspend`, {
        reason,
      });
      toast.success("Profile rejected.");
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => (prev?.id === id ? null : prev));
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      toast.error(e?.response?.data?.error || e?.message || "Failed to reject");
    }
  };

  return (
    <>
      {selected && (
        <ProfilePanel
          profile={selected}
          onClose={() => setSelected(null)}
          onApprove={approveProfile}
          onReject={rejectProfile}
        />
      )}

      <div className="space-y-6">
        {/* Stats strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Pending Review
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {profiles.length}
              </span>
              <span className="text-xs text-slate-500">
                profiles awaiting approval
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Safety Policy
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Only approve profiles with clear, real photos. Reject anything
              inappropriate, spammy, or suspicious.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              How to Review
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Click any row to open the full profile — every photo, bio, prompt,
              and preference is shown. Approve or reject with reason.
            </p>
          </div>
        </div>

        {/* Queue */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Dating Profiles · Pending Review
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Approve or reject profiles submitted from the CommunityTalk
                mobile app.
              </p>
            </div>
            <button
              onClick={loadPending}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading pending profiles…
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <CheckCircle2 className="h-7 w-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-700">Queue is clear</p>
              <p className="max-w-xs text-xs text-slate-500">
                No profiles pending review right now. Once users submit dating
                profiles they will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {profiles.map((p) => {
                const age = calcAge(p.birthDate);
                const mainPhoto =
                  p.photos.find((ph) => ph.isMain) || p.photos[0];

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {mainPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mainPhoto.url}
                          alt={p.firstName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageOff className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Row data */}
                    <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {p.firstName}, {age}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {p.user.email}
                        </p>
                      </div>

                      <div className="hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          Gender
                        </p>
                        <p className="text-xs font-medium text-slate-700">
                          {capitalize(p.gender)}
                        </p>
                      </div>

                      <div className="hidden md:block">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          College
                        </p>
                        <p className="text-xs font-medium text-slate-700">
                          {p.collegeSlug}
                        </p>
                      </div>

                      <div className="hidden lg:block">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          Photos
                        </p>
                        <p className="text-xs font-medium text-slate-700">
                          {p.photos.length}
                        </p>
                      </div>

                      <div className="hidden xl:block">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          Submitted
                        </p>
                        <p className="text-xs font-medium text-slate-700">
                          {new Date(p.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <Chip label="Pending" tone="amber" />
                        {p.user.isVerified && (
                          <Chip label="Verified" tone="green" />
                        )}
                        {p.photos.length === 0 && (
                          <Chip label="No Photos" tone="red" />
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Quick reject with default reason; full reason via panel
                          rejectProfile(p.id, "Rejected by moderator");
                        }}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 transition-all hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approveProfile(p.id);
                        }}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-emerald-600"
                      >
                        Approve
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

