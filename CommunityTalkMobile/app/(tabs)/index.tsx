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
  Animated,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";




/* ----------------------------- THEME HOOK ----------------------------- */
const useTheme = () => {
  const isDark = useColorScheme() === "dark";
  return {
    isDark,
    colors: {
      // brand (kept familiar but softened)
      primary: "#4C5FD5",
      primarySoft: "rgba(76,95,213,0.12)",
      secondary: "#8B9DF7",
      accent: "#F4B400",

      // system
      bg: isDark ? "#0A0A0A" : "#F8F9FC",
      surface: isDark ? "#141414" : "#FFFFFF",
      surfaceElevated: isDark ? "#1A1A1A" : "#FFFFFF",
      border: isDark ? "#272727" : "#E7E9EE",

      // text
      text: isDark ? "#FFFFFF" : "#0A0A0A",
      textSecondary: isDark ? "#9CA3AF" : "#6B7280",
      textMuted: isDark ? "#707070" : "#9CA3AF",

      // utilities
      success: "#10B981",
      warning: "#FBBF24",
      danger: "#EF4444",
      info: "#3B82F6",
      purple: "#A855F7",
      cyan: "#06B6D4",
      pink: "#EC4899",

      shadow: isDark ? "rgba(0,0,0,0.7)" : "rgba(16,24,40,0.06)",
      cardGlow: isDark ? "rgba(76,95,213,0.28)" : "rgba(76,95,213,0.14)",
    },
  };
};

/* --------------------------- MICRO-ANIM HELPERS --------------------------- */
const Floating = ({ children, delay = 0, range = 8 }: any) => {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2200, delay, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -range] });
  return <Animated.View style={{ transform: [{ translateY }] }}>{children}</Animated.View>;
};

/* ------------------------------ BACKDROP MESH ------------------------------ */
const MeshBackground = () => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const a = React.useRef(new Animated.Value(0)).current;
  const b = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(a, { toValue: 1, duration: 16000, useNativeDriver: true }),
        Animated.timing(b, { toValue: 1, duration: 20000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const x1 = a.interpolate({ inputRange: [0, 1], outputRange: [0, 46] });
  const x2 = b.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });

  return (
    <View style={{ position: "absolute", width: "100%", height: 520, overflow: "hidden" }}>
      <Animated.View
        style={{
          position: "absolute",
          top: -120,
          left: -120,
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: colors.secondary,
          opacity: isDark ? 0.08 : 0.05,
          transform: [{ translateX: x1 }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: 180,
          right: -140,
          width: 440,
          height: 440,
          borderRadius: 220,
          backgroundColor: colors.primary,
          opacity: isDark ? 0.06 : 0.04,
          transform: [{ translateX: x2 }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: 360,
          left: width * 0.32,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: colors.accent,
          opacity: isDark ? 0.05 : 0.03,
          transform: [{ translateX: x1 }],
        }}
      />
    </View>
  );
};

/* --------------------------- TYPES & CARD LOGIC --------------------------- */
type Community = {
  _id: string;
  id?: string;
  name: string;
  type?: string;
  tags?: string[];
  isPrivate?: boolean;
  createdAt?: string;
};

const CommunityCard = ({ community, index }: { community: Community; index: number }) => {
  const { colors, isDark } = useTheme();
  const scale = React.useRef(new Animated.Value(0.94)).current;

  React.useEffect(() => {
    Animated.spring(scale, { toValue: 1, delay: index * 60, useNativeDriver: true }).start();
  }, []);

  const initials = (community.name || "CT").slice(0, 2).toUpperCase();

  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 18 }}>
      <Pressable
        onPress={() => router.push(`/community/${community._id}`)}
        style={{
          width: 300,
          height: 190,
          borderRadius: 22,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 76 }}
        />
        <View
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.primary }}>{initials}</Text>
        </View>

        <View style={{ flex: 1, padding: 16, justifyContent: "flex-end" }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 18,
              fontWeight: "800",
              letterSpacing: -0.25,
              color: colors.text,
              marginBottom: 6,
            }}
          >
            {community.name}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                {(community.type || "community").toLowerCase()}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: community.isPrivate
                  ? "rgba(239, 68, 68, 0.14)"
                  : "rgba(16, 185, 129, 0.16)",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name={community.isPrivate ? "lock-closed" : "globe"}
                size={12}
                color={community.isPrivate ? colors.danger : colors.success}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: community.isPrivate ? colors.danger : colors.success,
                }}
              >
                {community.isPrivate ? "PRIVATE" : "PUBLIC"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

/* ---------------------------- CLEAN BENTO CARDS ---------------------------- */
type BentoProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent?: "primary" | "success" | "warning" | "info" | "purple" | "pink";
  onPress?: () => void;
  delay?: number;
  tall?: boolean;
};

const BentoCard = ({
  icon,
  title,
  subtitle,
  accent = "primary",
  onPress,
  delay = 0,
  tall = false,
}: BentoProps) => {
  const { colors, isDark } = useTheme();
  const scale = React.useRef(new Animated.Value(0.96)).current;
  React.useEffect(() => {
    Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true }).start();
  }, []);

  const accentColor =
    accent === "success"
      ? colors.success
      : accent === "warning"
        ? colors.warning
        : accent === "info"
          ? colors.info
          : accent === "purple"
            ? colors.purple
            : accent === "pink"
              ? colors.pink
              : colors.primary;

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        style={{
          minHeight: tall ? 160 : 132,
          borderRadius: 20,
          padding: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        {/* Soft accent halo */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: accentColor,
            opacity: isDark ? 0.08 : 0.06,
          }}
        />
        {/* Icon Badge */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: `${accentColor}22`,
            borderWidth: 1,
            borderColor: `${accentColor}55`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          <Ionicons name={icon} size={20} color={accentColor} />
        </View>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            letterSpacing: -0.2,
            color: colors.text,
            marginBottom: 6,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 18,
            color: colors.textSecondary,
            fontWeight: "600",
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const SectionHeader = ({
  title,
  subtitle,
  emoji,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
}) => {
  const { colors } = useTheme();
  const o = React.useRef(new Animated.Value(0)).current;
  const tx = React.useRef(new Animated.Value(-18)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        paddingHorizontal: 20,
        marginBottom: 20,
        opacity: o,
        transform: [{ translateX: tx }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
        {!!emoji && <Text style={{ fontSize: 32 }}>{emoji}</Text>}
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            letterSpacing: -0.4,
            color: colors.text,
          }}
        >
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            fontWeight: "600",
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  );
};

/* --------------------------------- SCREEN --------------------------------- */
function UpdatesScreenLegacy() {
  const { colors, isDark } = useTheme();
  const { unreadDMs = 0, socket } = useSocket() ?? {};
  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.user;

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [communities, setCommunities] = React.useState<Community[]>([]);

  const fadeIn = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

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
        if (typeof auth?.refreshBootstrap === "function") {
          await auth.refreshBootstrap();
        } else {
          const { data } = await api.get("/api/bootstrap");
          setCommunities(Array.isArray(data?.communities) ? data.communities : []);
        }
      } else {
        const { data } = await api.get("/api/public/communities", { params: { paginated: false } });
        const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setCommunities(list);
      }
    } catch (e: any) {
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

  React.useEffect(() => {
    if (!socket) return;
    const refresh = async () => {
      try {
        if (isAuthed && typeof auth?.refreshBootstrap === "function") {
          await auth.refreshBootstrap();
        } else {
          await fetchCommunities();
        }
      } catch { }
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
        <MeshBackground />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 112 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Header */}
          <Animated.View style={{ opacity: fadeIn, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    fontWeight: "800",
                    letterSpacing: 1.4,
                  }}
                >
                  UPDATES
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "900",
                      color: colors.text,
                      letterSpacing: -0.6,
                    }}
                  >
                    Hey {firstName}
                  </Text>
                  <Text style={{ fontSize: 26 }}>👋</Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    fontWeight: "600",
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  Quick actions & community highlights
                </Text>
              </View>

              <Floating>
                <Pressable
                  onPress={() => router.push("/(tabs)/dms")}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="notifications-outline" size={22} color={colors.text} />
                  {unreadDMs > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        backgroundColor: colors.danger,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "900", color: "#FFF" }}>
                        {unreadDMs > 9 ? "9+" : unreadDMs}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Floating>
            </View>
          </Animated.View>

          {/* Bento Grid */}
          <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 6, marginBottom: 28 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: "row", gap: 14 }}>
              <BentoCard
                icon="flash"
                title="Quick Post"
                subtitle="Share an update with your groups"
                accent="primary"
                onPress={() => router.push("/(tabs)/add-modal")}
                delay={80}
              />
              <BentoCard
                icon="chatbubbles"
                title="Jump to DMs"
                subtitle="Pick up your conversations"
                accent="info"
                onPress={() => router.push("/(tabs)/dms")}
                delay={140}
              />
            </View>
            {/* Row 2 */}
            <View style={{ flexDirection: "row", gap: 14 }}>
              <BentoCard
                icon="sparkles"
                title="Trending"
                subtitle="Popular threads right now"
                accent="purple"
                onPress={() => router.push("/(tabs)/communities")}
                delay={220}
                tall
              />
              <BentoCard
                icon="calendar"
                title="Events"
                subtitle="See what’s happening this week"
                accent="warning"
                onPress={() => router.push("/(tabs)/explore")}
                delay={260}
                tall
              />
            </View>
            {/* Row 3 */}
            <View style={{ flexDirection: "row", gap: 14 }}>
              <BentoCard
                icon="shield-checkmark"
                title="Safe & Private"
                subtitle="Moderation & reports center"
                accent="success"
                onPress={() => router.push("/(tabs)/profile")}
                delay={320}
              />
              <BentoCard
                icon="people"
                title="Discover"
                subtitle="Find new communities to join"
                accent="pink"
                onPress={() => router.push("/(tabs)/communities")}
                delay={360}
              />
            </View>
          </View>

          {/* Communities Section */}
          <SectionHeader
            emoji="🌐"
            title={isAuthed ? "Your Communities" : "Discover Communities"}
            subtitle={
              isAuthed ? "Groups you’re part of at a glance" : "Browse public communities and get started"
            }
          />

          {loading ? (
            <View style={{ paddingVertical: 80, alignItems: "center" }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  borderWidth: 2,
                  borderColor: `${colors.primary}55`,
                }}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
              <Text style={{ fontSize: 16, color: colors.text, fontWeight: "800" }}>
                Loading Communities
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600", marginTop: 6 }}>
                One moment…
              </Text>
            </View>
          ) : error ? (
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: isAuthed ? "rgba(239,68,68,0.06)" : "#FFF",
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.danger,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={{ fontSize: 16, fontWeight: "900", color: colors.danger }}>Error</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: "600" }}>
                {error}
              </Text>
              <Pressable
                onPress={fetchCommunities}
                style={{
                  marginTop: 14,
                  alignSelf: "flex-start",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.danger,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFF" }}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : communities.length === 0 ? (
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: colors.surface,
                borderRadius: 22,
                padding: 28,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  borderWidth: 2,
                  borderColor: `${colors.primary}40`,
                }}
              >
                <Ionicons name="people" size={56} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 8 }}>
                {isAuthed ? "No Communities Yet" : "No Public Communities"}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 20,
                  fontWeight: "600",
                }}
              >
                {isAuthed
                  ? "Explore and join communities that match your interests."
                  : "Sign in to see communities tailored to you."}
              </Text>
              <Pressable
                onPress={() => (isAuthed ? router.push("/(tabs)/explore") : router.push("/profile"))}
                style={{
                  marginTop: 18,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "900", color: "#FFF", letterSpacing: 0.3 }}>
                  {isAuthed ? "EXPLORE NOW" : "SIGN IN"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={communities}
                keyExtractor={(c) => c._id || (c as any).id}
                renderItem={({ item, index }) => <CommunityCard community={item} index={index} />}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}
                snapToInterval={318}
                decelerationRate="fast"
              />

              {communities.length > 2 && (
                <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
                  <Pressable
                    onPress={() => router.push("/(tabs)/communities")}
                    style={{
                      paddingVertical: 14,
                      borderRadius: 14,
                      backgroundColor: colors.surface,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                      View All Communities
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </Pressable>
                </View>
              )}
            </>
          )}

          {/* Spacer for tab bar */}
          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default function Index() {
  return <Redirect href="/(tabs)/communities" />;
}