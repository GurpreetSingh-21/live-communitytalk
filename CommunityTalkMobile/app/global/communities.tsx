// CommunityTalkMobile/app/global/communities.tsx

import React from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { api } from "@/src/api/api";
import { AuthContext } from "@/src/context/AuthContext";
import { useSocket } from "@/src/context/SocketContext";

type Community = {
  _id: string;
  name: string;
  type?: "college" | "religion" | "custom";
  key?: string;
  isPrivate?: boolean;
  tags?: string[];
  createdAt?: string;
};

const useTheme = () => {
  const isDark = useColorScheme() === "dark";
  return {
    isDark,
    colors: {
      bg: isDark ? "#0B0B0F" : "#F9FAFB",
      surface: isDark ? "#151518" : "#FFFFFF",
      border: isDark ? "#2B2B33" : "#E5E7EB",
      text: isDark ? "#FFFFFF" : "#111827",
      textSecondary: isDark ? "#E5E7EB99" : "#37415199",
      primary: "#6366F1",
      destructive: "#EF4444",
      success: "#10B981",
      chip: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
      shadow: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.08)",
    },
  };
};

export default function GlobalCommunitiesScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.user;
  const joinedFromAuth: string[] =
    (auth?.communities || []).map((c: any) => String(c?._id)) || [];

  // realtime (optional — we optimistically update below regardless)
  const { socket } = useSocket() ?? {};

  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allPublic, setAllPublic] = React.useState<Community[]>([]);
  const [joinedSet, setJoinedSet] = React.useState<Set<string>>(
    new Set(joinedFromAuth)
  );

  const fetchData = React.useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // Only PUBLIC & GLOBAL (custom) communities from the public endpoint
      // Backend already filters isPrivate !== true; we also request type=custom explicitly.
      const res = await api.get("/api/public/communities", {
        params: { paginated: false, type: "custom", sort: "name" },
      });

      const items: Community[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

      // Safety: ensure non-private & custom only (in case server config changes)
      const openCustom = items.filter(
        (c) => c.type === "custom" && c.isPrivate !== true
      );
      setAllPublic(openCustom);

      // ensure our joined set reflects AuthContext
      setJoinedSet(new Set(joinedFromAuth));
    } catch (e: any) {
      setError(
        e?.response?.data?.error || "Failed to load global communities."
      );
    } finally {
      setLoading(false);
    }
  }, [joinedFromAuth.join(",")]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // optional realtime: if backend ever emits a membership event, we’ll reflect it
  React.useEffect(() => {
    if (!socket) return;
    const onSelfJoined = (payload: any) => {
      const cid = String(payload?.communityId || payload?.community || "");
      if (cid) {
        setJoinedSet((prev) => new Set(prev).add(cid));
      }
    };
    socket.on?.("membership:joined", onSelfJoined);
    return () => {
      socket.off?.("membership:joined", onSelfJoined);
    };
  }, [socket]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // We now show ALL global public communities, but indicate when one is already joined (disabled "Joined" button)
  const list = allPublic;

  const joinCommunity = async (communityId: string) => {
    if (!isAuthed) {
      Alert.alert("Sign in required", "Please log in to join communities.", [
        { text: "Cancel", style: "cancel" },
        { text: "Log in", onPress: () => router.push("/modal?context=auth") },
      ]);
      return;
    }

    if (joinedSet.has(communityId)) {
      // Already joined — just ignore tap
      return;
    }

    try {
      setJoining(communityId);
      setError(null);

      // POST /api/communities/:id/join (auth required)
      const res = await api.post(`/api/communities/${communityId}/join`);

      // If backend returns 200 with "Already a member", treat as joined
      if (res?.status === 200 || res?.status === 201) {
        setJoinedSet((prev) => {
          const next = new Set(prev);
          next.add(communityId);
          return next;
        });
        // refresh app-wide bootstrap so other tabs update
        await auth?.refreshBootstrap?.();
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.error ||
        (typeof e?.message === "string" ? e.message : "Failed to join");

      // Common cases:
      // 404: community not found
      // 401: unauthorized (token issue)
      // 500: server error (surfaced from your logs)
      if (status === 404) {
        setError("Community not found.");
      } else if (status === 401) {
        setError("Your session expired. Please sign in again.");
      } else if (status === 409) {
        // in case server ever changes to 409 for already member
        setJoinedSet((prev) => new Set(prev).add(communityId));
        await auth?.refreshBootstrap?.();
        setError(null);
      } else if (status === 500) {
        setError("Server error while joining. Please try again.");
      } else {
        setError(msg);
      }
    } finally {
      setJoining(null);
    }
  };

  const Header = () => (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.bg,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        }}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
        Global Communities
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );

  const Item = ({ item }: { item: Community }) => {
    const hash = Array.from(item.name || "").reduce(
      (a, c) => a + c.charCodeAt(0),
      0
    );
    const palettes = [
      ["#4F46E5", "#8B5CF6"],
      ["#0EA5E9", "#22D3EE"],
      ["#F59E0B", "#F97316"],
      ["#10B981", "#14B8A6"],
      ["#EF4444", "#F43F5E"],
    ] as const;
    const [start, end] = palettes[hash % palettes.length];

    const isJoined = joinedSet.has(String(item._id));
    const isBusy = joining === item._id;

    return (
      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 14,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        }}
      >
        <LinearGradient
          colors={[start, end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 14, flexDirection: "row", alignItems: "center" }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="people" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "white",
                fontWeight: "800",
                fontSize: 16,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", marginRight: 8 }}>
                {item.type || "community"}
              </Text>
              {isJoined && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.25)",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                    Joined
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Join / Joined button */}
          <Pressable
            onPress={() => (!isJoined ? joinCommunity(item._id) : undefined)}
            disabled={isBusy || isJoined}
            style={{
              borderRadius: 12,
              overflow: "hidden",
              opacity: isBusy ? 0.7 : 1,
            }}
          >
            <LinearGradient
              colors={isJoined ? ["#E5E7EB", "#E5E7EB"] : ["#ffffff", "#F3F4F6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 14, paddingVertical: 8 }}
            >
              {isBusy ? (
                <ActivityIndicator />
              ) : (
                <Text
                  style={{
                    fontWeight: "800",
                    color: isJoined ? "#6B7280" : "#111827",
                  }}
                >
                  {isJoined ? "Joined" : "Join"}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Header />

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12, color: colors.textSecondary }}>
            Loading communities…
          </Text>
        </View>
      ) : (
        <>
          {error && (
            <View
              style={{
                marginHorizontal: 20,
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.destructive + "66",
                backgroundColor: isDark ? "#7f1d1d33" : "#fee2e2",
              }}
            >
              <Text style={{ color: colors.destructive, fontWeight: "700" }}>
                {error}
              </Text>
            </View>
          )}

          <FlatList
            data={list}
            keyExtractor={(i) => i._id}
            renderItem={Item}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "900",
                    color: colors.text,
                    letterSpacing: -0.6,
                  }}
                >
                  Open to Join
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    color: colors.textSecondary,
                    fontSize: 14,
                  }}
                >
                  Public global communities you can join. Already-joined ones are
                  marked so you don’t try again.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View
                style={{
                  alignItems: "center",
                  marginTop: 40,
                  paddingHorizontal: 20,
                }}
              >
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={42}
                  color={colors.success}
                />
                <Text
                  style={{
                    marginTop: 10,
                    fontWeight: "800",
                    color: colors.text,
                    fontSize: 16,
                  }}
                >
                  No global communities available right now 🎉
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </>
      )}
    </View>
  );
}