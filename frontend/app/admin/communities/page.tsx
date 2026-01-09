// frontend/app/admin/communities/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Image from "next/image";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
  Shield,
  Trash2,
  Pencil,
  RefreshCw,
  Search,
  ImagePlus,
  X,
  Loader2,
  Flag,
} from "lucide-react";

type CommunityType = "college" | "religion" | "custom";

type Community = {
  _id: string;
  name: string;
  type: CommunityType;
  communityKey: string;
  slug?: string;
  isPrivate?: boolean;
  tags?: string[];
  imageUrl?: string;
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
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImagePreview, setNewImagePreview] = useState("");
  const [uploadingNew, setUploadingNew] = useState(false);

  // edit form state
  const [editName, setEditName] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [editTags, setEditTags] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImagePreview, setEditImagePreview] = useState("");
  const [uploadingEdit, setUploadingEdit] = useState(false);

  // Bulk update state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [uniqueNames, setUniqueNames] = useState<{ name: string; count: number }[]>([]);
  const [selectedBulkName, setSelectedBulkName] = useState("");
  const [bulkImageUrl, setBulkImageUrl] = useState("");
  const [bulkImagePreview, setBulkImagePreview] = useState("");
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const newImageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const bulkImageInputRef = useRef<HTMLInputElement>(null);

  const [meta, setMeta] = useState<{
    total: number;
    colleges: number;
    religions: number;
    customs: number;
  }>({
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
    setNewImageUrl("");
    setNewImagePreview("");
  };

  const prepareEditForm = (c: Community) => {
    setEditName(c.name || "");
    setEditKey(c.communityKey || "");
    setEditPrivate(!!c.isPrivate);
    setEditTags((c.tags || []).join(", "));
    setEditImageUrl(c.imageUrl || "");
    setEditImagePreview(c.imageUrl || "");
  };

  // Image upload utility
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const { data } = await adminApi.post("/api/upload/base64", {
            image: base64,
            fileName: file.name,
            folder: "community_talk_community_images",
          });
          resolve(data.url);
        } catch (err: any) {
          console.error("Image upload failed:", err);
          toast.error("Failed to upload image");
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleNewImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const previewUrl = URL.createObjectURL(file);
    setNewImagePreview(previewUrl);

    // Upload
    setUploadingNew(true);
    const url = await uploadImage(file);
    setUploadingNew(false);

    if (url) {
      setNewImageUrl(url);
      toast.success("Image uploaded");
    } else {
      setNewImagePreview("");
    }
  };

  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const previewUrl = URL.createObjectURL(file);
    setEditImagePreview(previewUrl);

    // Upload
    setUploadingEdit(true);
    const url = await uploadImage(file);
    setUploadingEdit(false);

    if (url) {
      setEditImageUrl(url);
      toast.success("Image uploaded");
    } else {
      setEditImagePreview(editImageUrl); // Revert to original
    }
  };

  const handleBulkImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setBulkImagePreview(previewUrl);

    setUploadingBulk(true);
    const url = await uploadImage(file);
    setUploadingBulk(false);

    if (url) {
      setBulkImageUrl(url);
      toast.success("Image uploaded");
    } else {
      setBulkImagePreview("");
    }
  };

  const loadUniqueNames = async () => {
    try {
      const { data } = await adminApi.get("/api/admin/communities/names");
      setUniqueNames(data.names || []);
    } catch (err) {
      console.error("Failed to load unique names", err);
    }
  };

  const handleOpenBulkDialog = async () => {
    setSelectedBulkName("");
    setBulkImageUrl("");
    setBulkImagePreview("");
    await loadUniqueNames();
    setBulkDialogOpen(true);
  };

  const handleBulkUpdate = async () => {
    if (!selectedBulkName || !bulkImageUrl) {
      toast.error("Select a community name and upload an image");
      return;
    }

    setBulkUpdating(true);
    try {
      const { data } = await adminApi.patch("/api/admin/communities/bulk/image", {
        communityName: selectedBulkName,
        imageUrl: bulkImageUrl,
      });
      toast.success(`Updated ${data.count} communities!`);
      setBulkDialogOpen(false);
      await loadCommunities();
    } catch (err: any) {
      console.error("Bulk update error", err);
      toast.error(err?.response?.data?.error || "Failed to update communities");
    } finally {
      setBulkUpdating(false);
    }
  };

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get<ApiListResponse>("/api/admin/communities", {
        params: {
          q: search || undefined,
          type: typeFilter === "all" ? undefined : typeFilter,
          includePrivate: "true",
          limit: 400,
        },
      });

      const items = Array.isArray(data.items) ? data.items : [];

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
        imageUrl: newImageUrl || undefined,
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
        imageUrl: editImageUrl || undefined,
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
    <div className="min-h-screen bg-slate-50/50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Communities
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage college, religion, and custom community spaces
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleOpenBulkDialog}
              className="h-10 gap-2 rounded-lg px-4 text-sm font-medium"
            >
              <Flag className="h-4 w-4" />
              Bulk Update Flag
            </Button>
            <Button
              onClick={() => {
                resetCreateForm();
                setCreating(true);
              }}
              className="h-10 gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Community
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Communities",
              value: meta.total,
              icon: Layers,
              color: "text-slate-700",
              bg: "bg-white",
              border: "border-slate-200",
            },
            {
              label: "Colleges",
              value: meta.colleges,
              icon: Building2,
              color: "text-blue-700",
              bg: "bg-blue-50/50",
              border: "border-blue-200/50",
            },
            {
              label: "Religion",
              value: meta.religions,
              icon: Globe2,
              color: "text-purple-700",
              bg: "bg-purple-50/50",
              border: "border-purple-200/50",
            },
            {
              label: "Custom",
              value: meta.customs,
              icon: Layers,
              color: "text-orange-700",
              bg: "bg-orange-50/50",
              border: "border-orange-200/50",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className={`border ${stat.border} ${stat.bg} shadow-sm`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">{stat.label}</p>
                      <p className={`mt-2 text-3xl font-semibold ${stat.color}`}>
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}
                    >
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <Card className="border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search communities..."
                  className="h-10 pl-10 text-sm"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                {/* Type Filter */}
                <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/50 p-1">
                  {["all", "college", "religion", "custom"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type as any)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${typeFilter === type
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      {type === "all" ? "All" : typeLabels[type as CommunityType]}
                    </button>
                  ))}
                </div>

                {/* Privacy Filter */}
                <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/50 p-1">
                  {["all", "public", "private"].map((privacy) => (
                    <button
                      key={privacy}
                      onClick={() => setPrivacyFilter(privacy as any)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${privacyFilter === privacy
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      {privacy.charAt(0).toUpperCase() + privacy.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadCommunities}
                  disabled={loading}
                  className="h-10 w-10"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Communities List */}
          <div className="divide-y divide-slate-100">
            {loading && communities.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-slate-500">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900" />
                  <p className="text-sm">Loading communities...</p>
                </div>
              </div>
            ) : filteredCommunities.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-slate-500">
                <div className="text-center">
                  <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">No communities found</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try adjusting your filters or search query
                  </p>
                </div>
              </div>
            ) : (
              filteredCommunities.map((c, idx) => (
                <motion.div
                  key={c._id || idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  className="group p-6 transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-6">
                    {/* Image or Icon */}
                    {c.imageUrl ? (
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200">
                        <Image
                          src={c.imageUrl}
                          alt={c.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${c.type === "college"
                          ? "bg-blue-100 text-blue-700"
                          : c.type === "religion"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-orange-100 text-orange-700"
                          }`}
                      >
                        {c.type === "college" && <Building2 className="h-5 w-5" />}
                        {c.type === "religion" && <Globe2 className="h-5 w-5" />}
                        {c.type === "custom" && <Layers className="h-5 w-5" />}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 items-center gap-6">
                      {/* Name & Key */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-slate-900">
                            {c.name}
                          </h3>
                          {c.isPrivate && (
                            <Badge className="h-5 gap-1 bg-slate-100 text-slate-700 hover:bg-slate-100">
                              <Shield className="h-3 w-3" />
                              Private
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={`border ${c.type === "college"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : c.type === "religion"
                                ? "border-purple-200 bg-purple-50 text-purple-700"
                                : "border-orange-200 bg-orange-50 text-orange-700"
                              }`}
                          >
                            {typeLabels[c.type]}
                          </Badge>
                          <span className="text-slate-400">•</span>
                          <code className="font-mono text-slate-500">{c.communityKey}</code>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="hidden w-64 lg:block">
                        {(c.tags || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.tags!.slice(0, 3).map((tag, i) => (
                              <Badge
                                key={`${tag}-${i}`}
                                variant="secondary"
                                className="bg-slate-100 text-xs text-slate-700"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {(c.tags?.length || 0) > 3 && (
                              <span className="text-xs text-slate-400">
                                +{(c.tags?.length || 0) - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No tags</span>
                        )}
                      </div>

                      {/* Date */}
                      <div className="hidden w-32 text-right sm:block">
                        <p className="text-xs text-slate-500">{formatDate(c.createdAt)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(c)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-900"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c._id)}
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Community</DialogTitle>
            <DialogDescription>
              Add a new community to your platform
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Image</label>
              <div className="flex items-center gap-4">
                {newImagePreview ? (
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                    <Image
                      src={newImagePreview}
                      alt="Preview"
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                    {uploadingNew && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewImagePreview("");
                        setNewImageUrl("");
                      }}
                      className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => newImageInputRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500"
                  >
                    <ImagePlus className="h-6 w-6" />
                  </button>
                )}
                <input
                  ref={newImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleNewImageSelect}
                />
                <div className="text-xs text-slate-500">
                  <p>Upload a flag or logo</p>
                  <p className="text-slate-400">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Queens College"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Type</label>
                <Select value={newType} onValueChange={(val) => setNewType(val as CommunityType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="religion">Religion</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Key</label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Auto-generated"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Private</p>
                <p className="text-xs text-slate-500">Hide from public discovery</p>
              </div>
              <Switch checked={newPrivate} onCheckedChange={setNewPrivate} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Tags</label>
              <Textarea
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Comma-separated tags..."
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCreating(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreateCommunity}
                disabled={uploadingNew}
                className="flex-1 bg-slate-900 hover:bg-slate-800"
              >
                {uploadingNew ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Community</DialogTitle>
            <DialogDescription>
              Update community details
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 pt-4">
              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Image</label>
                <div className="flex items-center gap-4">
                  {editImagePreview ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                      <Image
                        src={editImagePreview}
                        alt="Preview"
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                      {uploadingEdit && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditImagePreview("");
                          setEditImageUrl("");
                        }}
                        className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => editImageInputRef.current?.click()}
                      className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500"
                    >
                      <ImagePlus className="h-6 w-6" />
                    </button>
                  )}
                  <input
                    ref={editImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEditImageSelect}
                  />
                  <div className="text-xs text-slate-500">
                    <p>Upload a flag or logo</p>
                    <p className="text-slate-400">PNG, JPG up to 5MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Type</label>
                  <Input
                    value={typeLabels[editing.type]}
                    disabled
                    className="bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Key</label>
                  <Input
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">Private</p>
                  <p className="text-xs text-slate-500">Hide from public discovery</p>
                </div>
                <Switch checked={editPrivate} onCheckedChange={setEditPrivate} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Tags</label>
                <Textarea
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={uploadingEdit}
                  className="flex-1 bg-slate-900 hover:bg-slate-800"
                >
                  {uploadingEdit ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Update Flag Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Update Flag</DialogTitle>
            <DialogDescription>
              Update flag/logo for all communities with the same name
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Community Name Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                Community Name
              </label>
              <Select value={selectedBulkName} onValueChange={setSelectedBulkName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select community name..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueNames.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.name} ({item.count} communities)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBulkName && (
                <p className="text-xs text-slate-500">
                  This will update all communities named "{selectedBulkName}"
                </p>
              )}
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Flag/Logo</label>
              <div className="flex items-center gap-4">
                {bulkImagePreview ? (
                  <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                    <Image
                      src={bulkImagePreview}
                      alt="Preview"
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                    {uploadingBulk && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setBulkImagePreview("");
                        setBulkImageUrl("");
                      }}
                      className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => bulkImageInputRef.current?.click()}
                    className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500"
                  >
                    <ImagePlus className="h-6 w-6" />
                  </button>
                )}
                <input
                  ref={bulkImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBulkImageSelect}
                />
                <div className="text-xs text-slate-500">
                  <p>Upload a flag or logo</p>
                  <p className="text-slate-400">This will apply to all matching communities</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setBulkDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkUpdate}
                disabled={uploadingBulk || bulkUpdating || !selectedBulkName || !bulkImageUrl}
                className="flex-1 bg-slate-900 hover:bg-slate-800"
              >
                {bulkUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update All"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}