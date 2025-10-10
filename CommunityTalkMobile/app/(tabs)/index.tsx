// app/(tabs)/index.tsx
import React from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { Fonts } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

type Community = {
  _id: string;
  name: string;
  type?: string;
  tags?: string[];
  isPrivate?: boolean;
  createdAt?: string;
};

const CommunityCard = ({ community, index }: { community: Community; index: number }) => {
  const rotation = index % 2 === 0 ? "-2deg" : "2deg";
  const hash = Array.from(community.name || "").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = [
    ["#00D4FF", "#0099CC"],
    ["#9945FF", "#FF00FF"],
    ["#10B981", "#059669"],
    ["#F59E0B", "#EF4444"],
    ["#60A5FA", "#2563EB"],
    ["#F472B6", "#EC4899"],
  ] as const;
  const gradient = palette[hash % palette.length];
  const tagCount = Array.isArray(community.tags) ? community.tags.length : 0;

  return (
    <Pressable
      onPress={() => router.push(`/community/${community._id}`)}
      className="w-44 overflow-hidden rounded-3xl border border-white/20"
      style={{ transform: [{ rotateZ: rotation }] }}
      accessibilityRole="button"
      accessibilityLabel={`Open community ${community.name}`}
    >
      <BlurView intensity={40} tint="light" className="h-52 p-4">
        <LinearGradient colors={gradient} className="absolute left-0 right-0 top-0 h-1" />
        <View className="flex-1 justify-between">
          <View className="flex-row items-start justify-between">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10">
              <Text className="text-lg font-black text-black dark:text-white">
                {(community.name || "CT").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            {community.isPrivate ? (
              <View className="rounded-full bg-zinc-900/80 px-2 py-0.5 dark:bg-white/10">
                <Text className="text-[10px] font-bold text-white">Private</Text>
              </View>
            ) : (
              <View className="rounded-full bg-emerald-500 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-white">Public</Text>
              </View>
            )}
          </View>
          <View>
            <Text className="mb-1 text-base font-bold text-black dark:text-white" numberOfLines={2}>
              {community.name}
            </Text>
            <Text className="text-xs text-black/60 dark:text-white/60" numberOfLines={1}>
              {community.type || "community"} • {tagCount} tag{tagCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      </BlurView>
    </Pressable>
  );
};

const SectionHeader = ({
  emoji,
  title,
  actionText,
  onActionPress,
}: {
  emoji: string;
  title: string;
  actionText: string;
  onActionPress: () => void;
}) => (
  <View className="mb-4 flex-row items-center justify-between px-4">
    <Text className="text-2xl font-bold text-black dark:text-white" style={{ fontFamily: Fonts.rounded }}>
      {emoji} {title}
    </Text>
    <Pressable onPress={onActionPress} accessibilityRole="button" accessibilityLabel={actionText}>
      <Text className="font-semibold text-indigo-600 dark:text-indigo-400">{actionText}</Text>
    </Pressable>
  </View>
);

export default function HomeScreen() {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#FFFFFF" : "#000000";
  const { unreadDMs = 0 } = useSocket() ?? {};
  const auth = React.useContext(AuthContext);
  const isAuthed = !!auth?.user;

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [communities, setCommunities] = React.useState<Community[]>([]);

  const fetchCommunities = React.useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      if (isAuthed) {
        // ✅ Use the existing bootstrap endpoint which already returns the user’s communities
        const { data } = await api.get("/bootstrap");
        const list = Array.isArray(data?.communities) ? data.communities : [];
        setCommunities(list);
      } else {
        // Public catalog for guests
        const { data } = await api.get("/api/public/communities", { params: { paginated: false } });
        const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setCommunities(list);
      }
    } catch (e: any) {
      console.error("Community fetch error:", e);
      setError(e?.response?.data?.error || "Failed to load communities");
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  React.useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchCommunities();
    setRefreshing(false);
  }, [fetchCommunities]);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={scheme === "dark" ? ["#232526", "#414345"] : ["#e0eafc", "#cfdef3"]}
        className="absolute bottom-0 left-0 right-0 top-0"
      />
      <SafeAreaView className="flex-1" style={{ backgroundColor: "transparent" }}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
                <IconSymbol name="person.fill" size={20} color={iconColor} />
              </View>
              <View>
                <Text className="text-xs text-slate-500 dark:text-zinc-400">
                  Welcome {isAuthed ? auth.user?.fullName?.split(" ")[0] : "Guest"}!
                </Text>
                <Text className="text-lg font-bold text-black dark:text-white">CommunityTalk</Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable className="h-10 w-10 items-center justify-center" onPress={() => router.push("/(tabs)/explore")}>
                <IconSymbol name="magnifyingglass" size={20} color={iconColor} />
              </Pressable>

              <Pressable className="h-10 w-10 items-center justify-center" onPress={() => router.push("/(tabs)/dms")}>
                <IconSymbol name="bell.fill" size={20} color={iconColor} />
                {unreadDMs > 0 && (
                  <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 border border-white dark:border-black" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Communities */}
          <View className="mt-6">
            <SectionHeader
              emoji="✨"
              title={isAuthed ? "Your Communities" : "All Public Communities"}
              actionText="See All →"
              onActionPress={() => router.push("/(tabs)/explore")}
            />

            {loading ? (
              <View className="py-12 items-center">
                <ActivityIndicator />
                <Text className="mt-3 text-sm text-black/60 dark:text-white/70">Loading communities…</Text>
              </View>
            ) : error ? (
              <View className="mx-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : communities.length === 0 ? (
              <View className="mx-4 rounded-2xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5 p-4">
                <Text className="text-sm text-black/70 dark:text-white/70">
                  {isAuthed
                    ? "No assigned communities yet for your college or faith group."
                    : "No public communities yet. Be the first to create one!"}
                </Text>
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={communities}
                keyExtractor={(c) => c._id}
                renderItem={({ item, index }) => <CommunityCard community={item} index={index} />}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                ItemSeparatorComponent={() => <View className="w-4" />}
              />
            )}
          </View>

          {/* (Optional) Add more sections below */}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}