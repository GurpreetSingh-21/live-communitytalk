// CommunityTalkMobile/app/(tabs)/index.tsx
import React from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

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

const useTheme = () => {
  const isDark = useColorScheme() === "dark";
  return {
    isDark,
    colors: {
      bg: isDark ? "#000000" : "#F8FAFC",
      surface: isDark ? "#1C1C1E" : "#FFFFFF",
      surfaceElevated: isDark ? "#2C2C2E" : "#FFFFFF",
      text: isDark ? "#FFFFFF" : "#000000",
      textSecondary: isDark ? "#EBEBF599" : "#3C3C4399",
      textTertiary: isDark ? "#EBEBF54D" : "#3C3C434D",
      border: isDark ? "#38383A" : "#E5E5EA",
      primary: "#007AFF",
      success: "#34C759",
      warning: "#FF9500",
      destructive: "#FF3B30",
      shadow: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.08)",
    },
  };
};

const CommunityCard = ({
  community,
}: {
  community: Community;
  index: number;
}) => {
  const { colors, isDark } = useTheme();

  // Unique gradient based on name
  const hash = Array.from(community.name || "").reduce(
    (a, c) => a + c.charCodeAt(0),
    0
  );
  const gradients = [
    ["#FF6B6B", "#FF8E53"],
    ["#4E54C8", "#8F94FB"],
    ["#00C9FF", "#92FE9D"],
    ["#FC466B", "#3F5EFB"],
    ["#FDBB2D", "#22C1C3"],
    ["#A8EDEA", "#FED6E3"],
    ["#FF9A9E", "#FAD0C4"],
    ["#667EEA", "#764BA2"],
  ];
  const [gradStart, gradEnd] = gradients[hash % gradients.length];

  const tagCount = Array.isArray(community.tags) ? community.tags.length : 0;
  const initials = (community.name || "CT").slice(0, 2).toUpperCase();

  return (
    <Pressable
      onPress={() => router.push(`/community/${community._id}`)}
      style={{
        width: 300,
        height: 200,
        marginRight: 16,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: colors.surfaceElevated,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${community.name}`}
    >
      {/* Gradient Background */}
      <LinearGradient
        colors={[gradStart, gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 100,
          opacity: 0.9,
        }}
      />

      {/* Decorative circles */}
      <View
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(255,255,255,0.1)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 50,
          right: 20,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />

      <View style={{ flex: 1, padding: 20, justifyContent: "space-between" }}>
        {/* Top Section */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: "900", color: gradStart }}>
              {initials}
            </Text>
          </View>

          {community.isPrivate ? (
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.5)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="lock-closed"
                size={12}
                color="#FFF"
                style={{ marginRight: 5 }}
              />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFF" }}>
                Private
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "rgba(52, 199, 89, 1)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="globe"
                size={12}
                color="#FFF"
                style={{ marginRight: 5 }}
              />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFF" }}>
                Public
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Section */}
        <View
          style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: 16,
            padding: 12,
          }}
        >
          <Text
            style={{
              fontSize: 19,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 8,
              letterSpacing: -0.4,
            }}
            numberOfLines={2}
          >
            {community.name}
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}
          >
            <View
              style={{
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(0,0,0,0.06)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                marginRight: 8,
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.textSecondary,
                }}
              >
                {community.type || "community"}
              </Text>
            </View>
            {Array.isArray(community.tags) && community.tags.length > 0 && (
              <View
                style={{
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(0,0,0,0.06)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.textSecondary,
                  }}
                >
                  {community.tags.length}{" "}
                  {community.tags.length === 1 ? "tag" : "tags"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const SectionHeader = ({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 24, paddingHorizontal: 20 }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <Text style={{ fontSize: 36, marginRight: 10 }}>{emoji}</Text>
        <Text
          style={{
            fontSize: 30,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.8,
          }}
        >
          {title}
        </Text>
      </View>
      {subtitle && (
        <Text
          style={{
            fontSize: 16,
            color: colors.textSecondary,
            marginTop: 4,
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
};

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { unreadDMs = 0, socket } = useSocket() ?? {}; // ⬅️ also take socket
  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.user;

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [communities, setCommunities] = React.useState<Community[]>([]);

  // ⬇️ NEW: mirror AuthContext.communities so Home updates instantly after a bootstrap elsewhere
  React.useEffect(() => {
    if (isAuthed && Array.isArray(auth?.communities)) {
      setCommunities(auth.communities as Community[]);
      setLoading(false);
    }
  }, [isAuthed, auth?.communities]);

  const fetchCommunities = React.useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      if (isAuthed) {
        // Ask server for fresh bootstrap; AuthContext should update and the effect above mirrors it.
        if (typeof auth?.refreshBootstrap === "function") {
          await auth.refreshBootstrap();
        } else {
          const { data } = await api.get("/api/bootstrap");
          const list = Array.isArray(data?.communities) ? data.communities : [];
          setCommunities(list);
        }
      } else {
        const { data } = await api.get("/api/public/communities", {
          params: { paginated: false },
        });
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setCommunities(list);
      }
    } catch (e: any) {
      console.error("Community fetch error:", e);
      const msg =
        e?.response?.data?.error ||
        (e?.message?.includes("404") ? "Endpoint not found" : "") ||
        "Failed to load communities";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthed, auth?.refreshBootstrap]);

  React.useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  // ⬇️ NEW: realtime—when server emits membership changes, refresh bootstrap so Home reflects them
  React.useEffect(() => {
    if (!socket) return;
    const refresh = async () => {
      try {
        if (isAuthed && typeof auth?.refreshBootstrap === "function") {
          await auth.refreshBootstrap();
        } else {
          await fetchCommunities();
        }
      } catch {}
    };
    socket.on?.("membership:joined", refresh);
    socket.on?.("membership:left", refresh);
    return () => {
      socket.off?.("membership:joined", refresh);
      socket.off?.("membership:left", refresh);
    };
  }, [socket, isAuthed, auth?.refreshBootstrap, fetchCommunities]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchCommunities();
    setRefreshing(false);
  }, [fetchCommunities]);

  const firstName = isAuthed ? auth.user?.fullName?.split(" ")[0] : "Guest";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.textSecondary,
                    marginBottom: 6,
                    fontWeight: "500",
                  }}
                >
                  Welcome back,
                </Text>
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: "900",
                    color: colors.text,
                    letterSpacing: -0.8,
                  }}
                >
                  {firstName} 👋
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable
                  onPress={() => router.push("/(tabs)/explore")}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.06)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="search" size={22} color={colors.text} />
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(tabs)/dms")}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.06)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="notifications" size={22} color={colors.text} />
                  {unreadDMs > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.destructive,
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {/* Info Banner */}
          <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
            <View
              style={{
                borderRadius: 24,
                padding: 24,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.primary + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name="chatbubbles" size={22} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
                  CommunityTalk
                </Text>
              </View>
              <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
                Stay connected with your college groups and faith communities. Share
                stories, join conversations, and make real connections that matter.
              </Text>
            </View>
          </View>

          {/* Communities Section */}
          <View>
            <SectionHeader
              emoji="✨"
              title={isAuthed ? "Your Communities" : "Public Communities"}
              subtitle={
                isAuthed
                  ? "Connect with people who share your campus and faith"
                  : "Browse open communities and find your place"
              }
            />

            {loading ? (
              <View style={{ paddingVertical: 60, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={{
                    marginTop: 18,
                    fontSize: 16,
                    color: colors.textSecondary,
                    fontWeight: "500",
                  }}
                >
                  Loading your communities...
                </Text>
              </View>
            ) : error ? (
              <View
                style={{
                  marginHorizontal: 20,
                  backgroundColor: isDark
                    ? "rgba(255, 59, 48, 0.15)"
                    : "#FFEBEE",
                  borderLeftWidth: 4,
                  borderLeftColor: colors.destructive,
                  borderRadius: 20,
                  padding: 20,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
                >
                  <Ionicons name="alert-circle" size={24} color={colors.destructive} />
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: colors.destructive,
                      marginLeft: 10,
                    }}
                  >
                    Something went wrong
                  </Text>
                </View>
                <Text style={{ fontSize: 15, color: colors.destructive, lineHeight: 21 }}>
                  {error}
                </Text>
              </View>
            ) : communities.length === 0 ? (
              <View
                style={{
                  marginHorizontal: 20,
                  backgroundColor: colors.surface,
                  borderRadius: 24,
                  padding: 32,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                }}
              >
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                </View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.text,
                    marginBottom: 10,
                  }}
                >
                  {isAuthed ? "No communities yet" : "No public communities"}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    color: colors.textSecondary,
                    textAlign: "center",
                    lineHeight: 22,
                    paddingHorizontal: 10,
                  }}
                >
                  {isAuthed
                    ? "You haven't joined any communities yet. Check out what's available and find groups that match your college or faith background."
                    : "No public communities are available right now. Sign in to see communities for your college and faith group."}
                </Text>
                <Pressable
                  onPress={() =>
                    isAuthed ? router.push("/(tabs)/explore") : router.push("/profile")
                  }
                  style={{
                    marginTop: 24,
                    paddingHorizontal: 28,
                    paddingVertical: 14,
                    borderRadius: 16,
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
                    {isAuthed ? "Browse Communities" : "Sign In"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={communities}
                  keyExtractor={(c) => c._id}
                  renderItem={({ item, index }) => (
                    <CommunityCard community={item} index={index} />
                  )}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
                />

                {communities.length > 2 && (
                  <Pressable
                    onPress={() => router.push("/(tabs)/explore")}
                    style={{
                      marginHorizontal: 20,
                      marginTop: 24,
                      paddingVertical: 16,
                      borderRadius: 18,
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.04)",
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: colors.primary,
                      }}
                    >
                      View All Communities →
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Bottom Spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}