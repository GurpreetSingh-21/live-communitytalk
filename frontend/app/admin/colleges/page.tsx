"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";
import { Building2, Plus, Loader2 } from "lucide-react";

export default function CollegesPage() {
    const [name, setName] = useState("");
    const [key, setKey] = useState("");
    const [emailDomains, setEmailDomains] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreateCollege = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim() || !key.trim() || !emailDomains.trim()) {
            toast.error("All fields are required");
            return;
        }

        setIsSubmitting(true);
        try {
            const domainsArray = emailDomains.split(",").map(d => d.trim()).filter(Boolean);

            const { data } = await adminApi.post("/api/admin/colleges", {
                name: name.trim(),
                key: key.trim().toLowerCase(),
                emailDomains: domainsArray
            });

            toast.success(`College created! Auto-seeded ${data.autoSeededCount} templates.`);
            setName("");
            setKey("");
            setEmailDomains("");
        } catch (error: any) {
            console.error("Failed to create college:", error);
            toast.error(error.response?.data?.error || "Failed to create college");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                    <Building2 className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-[#1A1A1A]">Manage Colleges</h2>
                    <p className="text-sm text-[#6B6B6B]">Add new colleges and auto-seed custom communities</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-[#E5E5E5] shadow-sm max-w-2xl">
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-6">Add New College</h3>
                
                <form onSubmit={handleCreateCollege} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1A1A1A]">College Name</label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                // Auto-generate key
                                if (!key || key === name.slice(0, -1).toLowerCase().replace(/[^a-z0-9]/g, '')) {
                                    setKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                                }
                            }}
                            placeholder="e.g. Queens College"
                            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#2D5A47]/20 focus:border-[#2D5A47]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1A1A1A]">College Key</label>
                        <input 
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="e.g. qc"
                            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#2D5A47]/20 focus:border-[#2D5A47] font-mono text-sm"
                        />
                        <p className="text-xs text-[#6B6B6B]">Used in URLs and community keys (e.g. qc-india)</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1A1A1A]">Email Domains</label>
                        <input 
                            type="text"
                            value={emailDomains}
                            onChange={(e) => setEmailDomains(e.target.value)}
                            placeholder="e.g. qc.cuny.edu, myqc.cuny.edu"
                            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#2D5A47]/20 focus:border-[#2D5A47]"
                        />
                        <p className="text-xs text-[#6B6B6B]">Comma-separated list of allowed email domains</p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#2D5A47] text-white rounded-xl font-bold hover:bg-[#234738] transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Plus className="w-5 h-5" />
                                Add College & Auto-Seed Communities
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
