// frontend/app/admin/communities/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  Building2,
  Globe2,
  Layers,
  Plus,
  Filter,
  Shield,
  Trash2,
  Pencil,
  RefreshCw,
} from "lucide-react";

type CommunityType = "college" | "religion" | "custom";

type Community = {
  _id: string;
  name: string;
  type: CommunityType;
  communityKey: string;  // renamed from 'key' to avoid React conflicts
  slug?: string;
  isPrivate?: boolean;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type ApiListResponse = {
  items: Community[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const typeLabels: Record<CommunityType, string> = {
  college: "College",
  religion: "Religion",
  custom: "Custom",
};

export default function AdminCommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CommunityType>("all");
  const [privacyFilter, setPrivacyFilter] = useState<"all" | "public" | "private">(
    "all"
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Community | null>(null);

  // create form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CommunityType>("college");
  const [newKey, setNewKey] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [newTags, setNewTags] = useState("");

  // edit form state
  const [editName, setEditName] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [editTags, setEditTags] = useState("");

  const [meta, setMeta] = useState<{ total: number; colleges: number; religions: number; customs: number }>({
    total: 0,
    colleges: 0,
    religions: 0,
    customs: 0,
  });

  const resetCreateForm = () => {
    setNewName("");
    setNewType("college");
    setNewKey("");
    setNewPrivate(false);
    setNewTags("");
  };

  const prepareEditForm = (c: Community) => {
    setEditName(c.name || "");
    setEditKey(c.communityKey || "");
    setEditPrivate(!!c.isPrivate);
    setEditTags((c.tags || []).join(", "));
  };

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get<ApiListResponse>("/api/admin/communities", {
        params: {
          q: search || undefined,
          type: typeFilter === "all" ? undefined : typeFilter,
          // always include private, we'll filter client-side
          includePrivate: "true",
          limit: 400,
        },
      });

      const items = Array.isArray(data.items) ? data.items : [];

      // basic stats
      const colleges = items.filter((c) => c.type === "college").length;
      const religions = items.filter((c) => c.type === "religion").length;
      const customs = items.filter((c) => c.type === "custom").length;

      setMeta({
        total: data.total ?? items.length,
        colleges,
        religions,
        customs,
      });

      setCommunities(items);
    } catch (err: any) {
      console.error("[admin-communities] load error", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to load communities";
      toast.error(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCommunities = useMemo(() => {
    let list = [...communities];

    if (typeFilter !== "all") {
      list = list.filter((c) => c.type === typeFilter);
    }

    if (privacyFilter === "public") {
      list = list.filter((c) => !c.isPrivate);
    } else if (privacyFilter === "private") {
      list = list.filter((c) => c.isPrivate);
    }

    if (search.trim()) {
      const rx = new RegExp(search.trim(), "i");
      list = list.filter(
        (c) =>
          rx.test(c.name || "") ||
          rx.test(c.communityKey || "") ||
          (c.tags || []).some((t) => rx.test(t))
      );
    }

    return list;
  }, [communities, search, typeFilter, privacyFilter]);

  const handleCreateCommunity = async () => {
    if (!newName.trim()) {
      toast.error("Community name is required");
      return;
    }

    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await adminApi.post("/api/admin/communities", {
        name: newName.trim(),
        type: newType,
        key: newKey.trim() || undefined,
        isPrivate: newPrivate,
        tags,
      });

      toast.success("Community created");
      setCreating(false);
      resetCreateForm();
      await loadCommunities();
    } catch (err: any) {
      console.error("[admin-communities] create error", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to create community";
      toast.error(String(msg));
    }
  };

  const handleOpenEdit = (c: Community) => {
    setEditing(c);
    prepareEditForm(c);
  };

  const handleSaveEdit = async () => {
    if (!editing?._id) return;
    if (!editName.trim()) {
      toast.error("Community name is required");
      return;
    }

    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await adminApi.patch(`/api/admin/communities/${editing._id}`, {
        name: editName.trim(),
        key: editKey.trim() || undefined,
        isPrivate: editPrivate,
        tags,
      });

      toast.success("Community updated");
      setEditing(null);
      await loadCommunities();
    } catch (err: any) {
      console.error("[admin-communities] edit error", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to update community";
      toast.error(String(msg));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this community? This cannot be undone.")) return;

    try {
      await adminApi.delete(`/api/admin/communities/${id}`);
      toast.success("Community deleted");
      await loadCommunities();
    } catch (err: any) {
      console.error("[admin-communities] delete error", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to delete community";
      toast.error(String(msg));
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-5">
      {/* Top metrics row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 bg-slate-900 text-slate-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.16em] text-slate-400">
              Total communities
            </CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-2xl font-semibold">
              {meta.total}
              <span className="text-xs font-normal text-slate-400">
                across all types
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-xs text-slate-300">
            <Shield className="h-3.5 w-3.5 text-emerald-300" />
            <span>Managed and audited from this panel only.</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Colleges
            </CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-xl">
              {meta.colleges}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            <span>College-wide communities students join on sign-up.</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Religion communities
            </CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-xl">
              {meta.religions}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-xs text-slate-500">
            <Globe2 className="h-3.5 w-3.5" />
            <span>Faith-based groups tied to specific campuses.</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Custom spaces
            </CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-xl">
              {meta.customs}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-3.5 w-3.5" />
            <span>Extra communities added by admins as needed.</span>
          </CardContent>
        </Card>
      </div>

      {/* Directory + filters */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                Communities · Directory
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Browse all communities, filter by type / privacy, and create new
                ones without touching seed scripts.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={loadCommunities}
                disabled={loading}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 text-xs text-slate-50 hover:bg-slate-800"
                onClick={() => {
                  resetCreateForm();
                  setCreating(true);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New community
              </Button>
            </div>
          </div>

          {/* filter row */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                Filters:
              </span>

              {/* Type filter pills */}
              <div className="inline-flex gap-1 rounded-full bg-slate-50 p-1">
                {[
                  { id: "all", label: "All" },
                  { id: "college", label: "Colleges" },
                  { id: "religion", label: "Religion" },
                  { id: "custom", label: "Custom" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setTypeFilter(
                        opt.id === "all" ? "all" : (opt.id as CommunityType)
                      )
                    }
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      typeFilter === opt.id
                        ? "bg-slate-900 text-slate-50"
                        : opt.id === "all" && typeFilter === "all"
                          ? "bg-slate-900 text-slate-50"
                          : "bg-transparent text-slate-600 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Privacy filter pills */}
              <div className="inline-flex gap-1 rounded-full bg-slate-50 p-1">
                {[
                  { id: "all", label: "All" },
                  { id: "public", label: "Public only" },
                  { id: "private", label: "Private only" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setPrivacyFilter(opt.id as "all" | "public" | "private")
                    }
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      privacyFilter === opt.id
                        ? "bg-slate-900 text-slate-50"
                        : "bg-transparent text-slate-600 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M15.5 15.5 20 20"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="11"
                  cy="11"
                  r="5.25"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              </svg>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, key, or tag…"
                className="h-6 border-0 bg-transparent p-0 text-xs focus-visible:ring-0"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading communities…
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-500">
              <p>No communities match the current filters.</p>
              <p className="text-xs text-slate-400">
                Adjust the type / privacy filters or clear the search term to see
                more.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100">
                  <TableHead className="text-xs font-semibold text-slate-500">
                    Community
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">
                    Type / Key
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">
                    Tags
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">
                    Created
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-500">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommunities.map((c, idx) => (
                  <TableRow
                    key={c._id || `community-${idx}`}
                    className="border-slate-100 hover:bg-slate-50/80"
                  >
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-900">
                          {c.name}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Shield className="h-3 w-3" />
                          {c.isPrivate ? "Private" : "Public"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-xs text-slate-600">
                      <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="border-slate-300 bg-slate-50 text-[10px]"
                          >
                            {typeLabels[c.type] || c.type}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          key: <span className="font-mono">{c.communityKey}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).length === 0 ? (
                          <span className="text-[11px] text-slate-400">—</span>
                        ) : (
                          c.tags!.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-slate-200 bg-slate-50 text-[10px]"
                            >
                              {tag}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-[11px] text-slate-500">
                      {formatDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-200 text-[11px]"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-[11px] text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(c._id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
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

      {/* Create community dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Create new community
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Use this panel to add a college, religion group, or custom
              community. Students will see it instantly in their app.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Name<span className="text-red-500">*</span>
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Queens College, Sikh Society @ Queens, Film Club"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Type
                </label>
                <Select
                  value={newType}
                  onValueChange={(val) => setNewType(val as CommunityType)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="religion">Religion</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Key (optional)
                </label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Auto-slugged from name if left blank"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-slate-700">Private</p>
                <p className="text-[11px] text-slate-500">
                  Private communities are hidden from public listings and
                  invite-only.
                </p>
              </div>
              <Switch
                checked={newPrivate}
                onCheckedChange={(v) => setNewPrivate(v)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Tags (optional)
              </label>
              <Textarea
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Comma-separated, e.g. queens, commuter, international"
                className="min-h-[60px] text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Tags help search and analytics; they are not shown directly to
                students.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 text-xs text-slate-50 hover:bg-slate-800"
                onClick={handleCreateCommunity}
              >
                Create community
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit community dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit community
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update the name, key, privacy and tags. Existing members will
              keep their access.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Name<span className="text-red-500">*</span>
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Type
                  </label>
                  <Input
                    value={typeLabels[editing.type] || editing.type}
                    disabled
                    className="bg-slate-50 text-xs text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Key
                  </label>
                  <Input
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-slate-700">Private</p>
                  <p className="text-[11px] text-slate-500">
                    Toggle to hide or show this community in student-facing
                    discovery.
                  </p>
                </div>
                <Switch
                  checked={editPrivate}
                  onCheckedChange={(v) => setEditPrivate(v)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Tags
                </label>
                <Textarea
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  Comma-separated. Existing tags will be replaced with this
                  list.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-slate-900 text-xs text-slate-50 hover:bg-slate-800"
                  onClick={handleSaveEdit}
                >
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}