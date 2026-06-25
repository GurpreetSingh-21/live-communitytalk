"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";
import {
    Users2,
    MessageSquare,
    HeartHandshake,
    Building2,
    TrendingUp,
    Activity,
    Layers,
    UserPlus,
} from "lucide-react";

type AnalyticsData = {
    users: {
        total: number;
        today: number;
        growth: { date: string; count: number }[];
    };
    engagement: {
        totalMessages: number;
        messagesToday: number;
    };
    dating: {
        activeProfiles: number;
        matches: number;
    };
    infrastructure: {
        colleges: number;
        communities: number;
    };
};

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const { data } = await adminApi.get("/api/admin/analytics/overview");
            setData(data);
        } catch (error: any) {
            console.error("Failed to fetch analytics:", error);
            toast.error(error.response?.data?.error || "Failed to load analytics");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-8 h-8 border-4 border-[#2D5A47] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[#6B6B6B] font-medium">Loading metrics...</p>
            </div>
        );
    }

    if (!data) return null;

    // Helper for cards
    const MetricCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
        <div className="bg-white rounded-3xl p-6 border border-[#E5E5E5] shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div>
                <h3 className="text-[#6B6B6B] font-medium mb-1">{title}</h3>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-[#1A1A1A]">{value.toLocaleString()}</span>
                    {subtext && <span className="text-sm font-semibold text-[#2D5A47]">{subtext}</span>}
                </div>
            </div>
        </div>
    );

    // Calculate max value for the bar chart
    const maxGrowth = Math.max(...(data.users.growth.map(g => g.count).length > 0 ? data.users.growth.map(g => g.count) : [1]));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Row: Core Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Users"
                    value={data.users.total}
                    subtext={`+${data.users.today} today`}
                    icon={Users2}
                    colorClass="bg-blue-50 text-blue-600"
                />
                <MetricCard
                    title="Total Messages"
                    value={data.engagement.totalMessages}
                    subtext={`+${data.engagement.messagesToday} today`}
                    icon={MessageSquare}
                    colorClass="bg-green-50 text-green-600"
                />
                <MetricCard
                    title="Dating Matches"
                    value={data.dating.matches}
                    subtext={`${data.dating.activeProfiles} active profiles`}
                    icon={HeartHandshake}
                    colorClass="bg-pink-50 text-pink-600"
                />
                <MetricCard
                    title="Colleges"
                    value={data.infrastructure.colleges}
                    subtext={`${data.infrastructure.communities} communities`}
                    icon={Building2}
                    colorClass="bg-purple-50 text-purple-600"
                />
            </div>

            {/* Growth Chart */}
            <div className="bg-white rounded-3xl p-8 border border-[#E5E5E5] shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-[#2D5A47]/10 rounded-xl text-[#2D5A47]">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#1A1A1A]">User Growth (Last 7 Days)</h2>
                        <p className="text-sm text-[#6B6B6B]">New account creations per day</p>
                    </div>
                </div>

                <div className="h-64 flex items-end gap-2 sm:gap-4 md:gap-8 pt-4 border-b border-[#E5E5E5]">
                    {data.users.growth.map((day, i) => {
                        const heightPercent = Math.max((day.count / maxGrowth) * 100, 2); // At least 2% height for visibility
                        const dateObj = new Date(day.date);
                        const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                {/* Tooltip (Hover) */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A1A1A] text-white text-xs font-bold py-1 px-2 rounded-lg -translate-y-2 pointer-events-none">
                                    {day.count}
                                </div>
                                {/* Bar */}
                                <div className="w-full relative flex justify-center">
                                    <div 
                                        className="w-full max-w-[40px] bg-gradient-to-t from-[#2D5A47]/40 to-[#2D5A47] rounded-t-xl transition-all duration-500 hover:opacity-80"
                                        style={{ height: `${heightPercent}%` }}
                                    ></div>
                                </div>
                                {/* Label */}
                                <span className="text-xs font-semibold text-[#6B6B6B]">{dayLabel}</span>
                            </div>
                        );
                    })}
                    {data.users.growth.length === 0 && (
                        <div className="w-full text-center text-[#6B6B6B] pb-8">
                            No growth data available for the last 7 days.
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row: Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-[#E5E5E5] shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                        <Activity className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#1A1A1A]">Platform Activity</h3>
                        <p className="text-sm text-[#6B6B6B] mt-1">
                            An average of <strong className="text-[#1A1A1A]">{data.users.total > 0 ? Math.round(data.engagement.totalMessages / data.users.total) : 0} messages</strong> are sent per user.
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-[#E5E5E5] shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                        <Layers className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#1A1A1A]">Community Density</h3>
                        <p className="text-sm text-[#6B6B6B] mt-1">
                            There are currently <strong className="text-[#1A1A1A]">{data.infrastructure.colleges} colleges</strong> hosting <strong className="text-[#1A1A1A]">{data.infrastructure.communities} separate communities</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
