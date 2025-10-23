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
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";

const { width, height } = Dimensions.get("window");

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
      bg: isDark ? "#0A0A0A" : "#FAFAFA",
      surface: isDark ? "#1A1A1A" : "#FFFFFF",
      surfaceElevated: isDark ? "#252525" : "#FFFFFF",
      text: isDark ? "#FFFFFF" : "#0A0A0A",
      textSecondary: isDark ? "#A0A0A0" : "#666666",
      textTertiary: isDark ? "#707070" : "#999999",
      border: isDark ? "#2A2A2A" : "#E8E8E8",
      primary: "#0066FF",
      primaryLight: "#3D8BFF",
      success: "#00D68F",
      warning: "#FFB800",
      destructive: "#FF4D67",
      purple: "#B74DFF",
      cyan: "#00E5FF",
      pink: "#FF4DB8",
      shadow: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.06)",
    },
  };
};

// Advanced Floating with Rotation
const FloatingElement = ({ children, delay = 0, intensity = 15 }: any) => {
  const animValue = React.useRef(new Animated.Value(0)).current;
  const rotateValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: 4000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rotateValue, {
            toValue: 1,
            duration: 8000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(rotateValue, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -intensity],
  });

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["-2deg", "2deg"],
  });

  return (
    <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
      {children}
    </Animated.View>
  );
};

// Animated Mesh Background
const MeshBackground = () => {
  const { colors, isDark } = useTheme();
  const anim1 = React.useRef(new Animated.Value(0)).current;
  const anim2 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(anim1, { toValue: 1, duration: 15000, useNativeDriver: true }),
          Animated.timing(anim1, { toValue: 0, duration: 15000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(anim2, { toValue: 1, duration: 20000, useNativeDriver: true }),
          Animated.timing(anim2, { toValue: 0, duration: 20000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const translateX1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const translateX2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });

  return (
    <View style={{ position: "absolute", width: "100%", height: 600, overflow: "hidden" }}>
      <Animated.View
        style={{
          position: "absolute",
          top: -150,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: 200,
          backgroundColor: colors.primary,
          opacity: isDark ? 0.08 : 0.04,
          transform: [{ translateX: translateX1 }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: 200,
          right: -150,
          width: 500,
          height: 500,
          borderRadius: 250,
          backgroundColor: colors.purple,
          opacity: isDark ? 0.06 : 0.03,
          transform: [{ translateX: translateX2 }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: 400,
          left: width / 3,
          width: 350,
          height: 350,
          borderRadius: 175,
          backgroundColor: colors.cyan,
          opacity: isDark ? 0.05 : 0.025,
          transform: [{ translateX: translateX1 }],
        }}
      />
    </View>
  );
};

// Community Card with 3D Effect
const CommunityCard = ({ community, index }: { community: Community; index: number }) => {
  const { colors, isDark } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const pressAnim = React.useRef(new Animated.Value(0)).current;
  const tiltX = React.useRef(new Animated.Value(0)).current;
  const tiltY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(tiltX, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(tiltX, { toValue: -1, duration: 4000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(tiltY, { toValue: 1, duration: 5000, useNativeDriver: true }),
          Animated.timing(tiltY, { toValue: -1, duration: 5000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const scale = Animated.multiply(
    scaleAnim,
    pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] })
  );

  const rotateX = tiltX.interpolate({ inputRange: [-1, 1], outputRange: ["-2deg", "2deg"] });
  const rotateY = tiltY.interpolate({ inputRange: [-1, 1], outputRange: ["-1deg", "1deg"] });

  const hash = Array.from(community.name || "").reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradients: [string, string, ...string[]][] = [
    ["#FF6B9D", "#FF8E53", "#FFC371"],
    ["#667EEA", "#764BA2", "#A855F7"],
    ["#00F5A0", "#00D9F5", "#06B6D4"],
    ["#F857A6", "#FF5858", "#FA709A"],
    ["#FFD89B", "#19547B", "#667EEA"],
    ["#89F7FE", "#66A6FF", "#A8EDEA"],
    ["#FFA8A8", "#FCFF00", "#F093FB"],
    ["#4FACFE", "#00F2FE", "#43E97B"],
  ];
  const gradient = gradients[hash % gradients.length];
  const initials = (community.name || "CT").slice(0, 2).toUpperCase();

  return (
    <Animated.View style={{ transform: [{ scale }, { perspective: 1000 }, { rotateX }, { rotateY }] }}>
      <Pressable
        onPress={() => router.push(`/community/${community._id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: 300,
          height: 200,
          marginRight: 20,
          borderRadius: 28,
          overflow: "visible",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            right: -6,
            bottom: -6,
            borderRadius: 28,
            backgroundColor: isDark ? "#000" : "#0A0A0A",
            opacity: isDark ? 0.3 : 0.08,
          }}
        />

        <View
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 28,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: isDark ? "#2A2A2A" : "#E8E8E8",
            backgroundColor: colors.surface,
          }}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "45%",
              opacity: 0.85,
            }}
          />

          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "45%",
              backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)",
            }}
          />

          <View
            style={{
              position: "absolute",
              top: -30,
              right: -30,
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          />

          <View style={{ flex: 1, padding: 20, justifyContent: "space-between" }}>
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
                  backgroundColor: "#FFF",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: "900", color: gradient[0] }}>
                  {initials}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: community.isPrivate ? "rgba(0,0,0,0.7)" : colors.success,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name={community.isPrivate ? "lock-closed" : "globe"}
                  size={12}
                  color="#FFF"
                  style={{ marginRight: 5 }}
                />
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFF" }}>
                  {community.isPrivate ? "PRIVATE" : "PUBLIC"}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: isDark ? "#FFF" : "#0A0A0A",
                  marginBottom: 8,
                  letterSpacing: -0.3,
                }}
                numberOfLines={2}
              >
                {community.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isDark ? "#FFF" : "#0A0A0A",
                    }}
                  >
                    {(community.type || "community").toLowerCase()}
                  </Text>
                </View>
                {Array.isArray(community.tags) && community.tags.length > 0 && (
                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: isDark ? "#FFF" : "#0A0A0A",
                      }}
                    >
                      {community.tags.length} {community.tags.length > 1 ? "tags" : "tag"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Bento Grid Info Cards
const BentoInfoCard = ({ icon, title, description, color, size = "medium", delay = 0 }: any) => {
  const { colors, isDark } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const heights = { small: 110, medium: 140 };

  return (
    <Animated.View
      style={{
        flex: size === "medium" ? 0.48 : 0.32,
        height: heights[size as keyof typeof heights],
        transform: [{ scale: scaleAnim }],
      }}
    >
      <FloatingElement delay={delay} intensity={8}>
        <View
          style={{
            flex: 1,
            borderRadius: 20,
            padding: 16,
            backgroundColor: isDark ? "#1A1A1A" : "#FFF",
            borderWidth: 1,
            borderColor: isDark ? "#2A2A2A" : "#E8E8E8",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 8,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -30,
              right: -30,
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: color,
              opacity: 0.08,
            }}
          />

          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: color + "20",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Ionicons name={icon} size={20} color={color} />
          </View>

          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 4,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              lineHeight: 16,
              fontWeight: "600",
            }}
            numberOfLines={2}
          >
            {description}
          </Text>
        </View>
      </FloatingElement>
    </Animated.View>
  );
};

const SectionHeader = ({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) => {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        marginBottom: 24,
        paddingHorizontal: 20,
        transform: [{ scale: scaleAnim }, { translateX: slideAnim }],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 48, marginRight: 12 }}>{emoji}</Text>
        <Text
          style={{
            fontSize: 38,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -1.5,
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
            lineHeight: 24,
            fontWeight: "600",
          }}
        >
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );
};

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { unreadDMs = 0, socket } = useSocket() ?? {};
  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.user;

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [communities, setCommunities] = React.useState<Community[]>([]);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 2500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
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
          const list = Array.isArray(data?.communities) ? data.communities : [];
          setCommunities(list);
        }
      } else {
        const { data } = await api.get("/api/public/communities", {
          params: { paginated: false },
        });
        const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
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
        <MeshBackground />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Header */}
          <Animated.View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, opacity: fadeAnim }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <FloatingElement intensity={8}>
                  <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 8, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    WELCOME BACK
                  </Text>
                </FloatingElement>
                <Animated.Text
                  style={{
                    fontSize: 52,
                    fontWeight: "900",
                    color: colors.text,
                    letterSpacing: -2,
                    lineHeight: 56,
                    transform: [{ scale: pulseAnim }],
                  }}
                >
                  {firstName}
                </Animated.Text>
                <Text style={{ fontSize: 52, lineHeight: 56 }}>👋</Text>
              </View>

              <FloatingElement delay={150} intensity={12}>
                <Pressable
                  onPress={() => router.push("/(tabs)/dms")}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: isDark ? "#1A1A1A" : "#FFF",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 3,
                    borderColor: isDark ? "#2A2A2A" : "#E8E8E8",
                    shadowColor: "#000",
                    shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: isDark ? 0.5 : 0.1,
                    shadowRadius: 0,
                  }}
                >
                  <Ionicons name="notifications" size={28} color={colors.text} />
                  {unreadDMs > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        minWidth: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: colors.destructive,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 6,
                        borderWidth: 3,
                        borderColor: colors.bg,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "900", color: "#FFF" }}>
                        {unreadDMs > 9 ? "9+" : unreadDMs}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </FloatingElement>
            </View>
          </Animated.View>

          {/* Hero Section */}
          <FloatingElement delay={400}>
            <View style={{ paddingHorizontal: 20, marginBottom: 48 }}>
              <View
                style={{
                  borderRadius: 28,
                  padding: 28,
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: -50,
                    right: -50,
                    width: 150,
                    height: 150,
                    borderRadius: 75,
                    backgroundColor: colors.primary,
                    opacity: 0.08,
                  }}
                />

                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.primary + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 16,
                    }}
                  >
                    <Ionicons name="chatbubbles" size={26} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      fontSize: 24,
                      fontWeight: "900",
                      color: colors.text,
                      letterSpacing: -0.5,
                    }}
                  >
                    CommunityTalk
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.textSecondary,
                    lineHeight: 24,
                    fontWeight: "500",
                  }}
                >
                  Stay connected with your college groups and faith communities. Share
                  stories, join conversations, and make real connections that matter.
                </Text>
              </View>
            </View>
          </FloatingElement>

          {/* Bento Grid */}
          <View style={{ paddingHorizontal: 20, marginBottom: 48 }}>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <BentoInfoCard
                icon="flash"
                title="Real-time"
                description="Instant updates"
                color={colors.warning}
                size="medium"
                delay={100}
              />
              <BentoInfoCard
                icon="shield-checkmark"
                title="Secure"
                description="Protected chats"
                color={colors.success}
                size="medium"
                delay={200}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <BentoInfoCard
                icon="heart"
                title="Supportive"
                description="Find guidance"
                color={colors.pink}
                size="small"
                delay={300}
              />
              <BentoInfoCard
                icon="people"
                title="Community"
                description="Build bonds"
                color={colors.primary}
                size="small"
                delay={400}
              />
              <BentoInfoCard
                icon="trending-up"
                title="Growing"
                description="Join the wave"
                color={colors.cyan}
                size="small"
                delay={500}
              />
            </View>
          </View>

          {/* Communities Section */}
          <View>
            <SectionHeader
              emoji="✨"
              title={isAuthed ? "Communities" : "Discover"}
              subtitle={
                isAuthed
                  ? "Your campus and faith groups in one place"
                  : "Browse public communities and get started"
              }
            />

            {loading ? (
              <View style={{ paddingVertical: 100, alignItems: "center" }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: colors.primary + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 24,
                    borderWidth: 3,
                    borderColor: colors.primary + "40",
                  }}
                >
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    color: colors.text,
                    fontWeight: "800",
                    letterSpacing: -0.5,
                  }}
                >
                  Loading Communities
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textSecondary,
                    fontWeight: "600",
                    marginTop: 8,
                  }}
                >
                  This won't take long...
                </Text>
              </View>
            ) : error ? (
              <View
                style={{
                  marginHorizontal: 20,
                  backgroundColor: isDark ? "#2A0A0A" : "#FFF5F5",
                  borderRadius: 28,
                  padding: 28,
                  borderWidth: 3,
                  borderColor: colors.destructive,
                  shadowColor: colors.destructive,
                  shadowOffset: { width: 4, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 0,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: colors.destructive + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 16,
                      borderWidth: 2,
                      borderColor: colors.destructive,
                    }}
                  >
                    <Ionicons name="alert-circle" size={28} color={colors.destructive} />
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "900",
                      color: colors.destructive,
                      letterSpacing: -0.5,
                    }}
                  >
                    Oops!
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.text, lineHeight: 24, fontWeight: "600" }}>
                  {error}
                </Text>
                <Pressable
                  onPress={fetchCommunities}
                  style={{
                    marginTop: 20,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 16,
                    backgroundColor: colors.destructive,
                    alignItems: "center",
                    borderWidth: 3,
                    borderColor: isDark ? "#000" : "#FFF",
                    shadowColor: "#000",
                    shadowOffset: { width: 3, height: 3 },
                    shadowOpacity: 0.3,
                    shadowRadius: 0,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#FFF" }}>TRY AGAIN</Text>
                </Pressable>
              </View>
            ) : communities.length === 0 ? (
              <View
                style={{
                  marginHorizontal: 20,
                  backgroundColor: isDark ? "#1A1A1A" : "#FFF",
                  borderRadius: 32,
                  padding: 40,
                  alignItems: "center",
                  borderWidth: 3,
                  borderColor: isDark ? "#2A2A2A" : "#E8E8E8",
                  shadowColor: "#000",
                  shadowOffset: { width: 5, height: 5 },
                  shadowOpacity: isDark ? 0.5 : 0.1,
                  shadowRadius: 0,
                }}
              >
                <View
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: colors.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 28,
                    borderWidth: 4,
                    borderColor: colors.primary + "30",
                  }}
                >
                  <Ionicons name="people" size={70} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "900",
                    color: colors.text,
                    marginBottom: 12,
                    letterSpacing: -0.8,
                  }}
                >
                  {isAuthed ? "No Communities Yet" : "No Public Communities"}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.textSecondary,
                    textAlign: "center",
                    lineHeight: 26,
                    fontWeight: "600",
                    paddingHorizontal: 10,
                  }}
                >
                  {isAuthed
                    ? "Start exploring and join communities that match your interests. Your campus and faith groups are waiting!"
                    : "Sign in to discover communities tailored to your college and faith background."}
                </Text>
                <Pressable
                  onPress={() =>
                    isAuthed ? router.push("/(tabs)/explore") : router.push("/profile")
                  }
                  style={{
                    marginTop: 32,
                    paddingHorizontal: 36,
                    paddingVertical: 18,
                    borderRadius: 20,
                    backgroundColor: colors.primary,
                    borderWidth: 3,
                    borderColor: isDark ? "#000" : "#FFF",
                    shadowColor: "#000",
                    shadowOffset: { width: 4, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 0,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 }}>
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
                  keyExtractor={(c) => c._id}
                  renderItem={({ item, index }) => <CommunityCard community={item} index={index} />}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                  snapToInterval={320}
                  decelerationRate="fast"
                />

                {communities.length > 2 && (
                  <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                    <Pressable
                      onPress={() => router.push("/(tabs)/communities")}
                      style={{
                        paddingVertical: 16,
                        borderRadius: 20,
                        backgroundColor: isDark ? "#1A1A1A" : "#FFF",
                        alignItems: "center",
                        borderWidth: 2,
                        borderColor: isDark ? "#2A2A2A" : "#E8E8E8",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.3 : 0.06,
                        shadowRadius: 8,
                        flexDirection: "row",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "800",
                          color: colors.primary,
                          marginRight: 8,
                        }}
                      >
                        View All Communities
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                    </Pressable>
                  </View>
                )}

                {/* Feature Highlights */}
                <View style={{ marginTop: 48, paddingHorizontal: 20 }}>
                  <View
                    style={{
                      backgroundColor: isDark ? "#1A1A1A" : "#FFF",
                      borderRadius: 24,
                      padding: 24,
                      borderWidth: 1,
                      borderColor: isDark ? "#2A2A2A" : "#E8E8E8",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: isDark ? 0.3 : 0.06,
                      shadowRadius: 16,
                    }}
                  >
                    <FloatingElement delay={600} intensity={6}>
                      <View style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: colors.success + "20",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <Ionicons name="chatbubble-ellipses" size={18} color={colors.success} />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}>
                            Start Conversations
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontWeight: "500" }}>
                          Join communities to engage in meaningful discussions and share experiences.
                        </Text>
                      </View>
                    </FloatingElement>

                    <FloatingElement delay={800} intensity={6}>
                      <View style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: colors.purple + "20",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <Ionicons name="school" size={18} color={colors.purple} />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}>
                            Find Support
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontWeight: "500" }}>
                          Whether seeking spiritual guidance, academic help, or friendly conversation.
                        </Text>
                      </View>
                    </FloatingElement>

                    <FloatingElement delay={1000} intensity={6}>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: colors.warning + "20",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <Ionicons name="heart" size={18} color={colors.warning} />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}>
                            Build Connections
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, fontWeight: "500" }}>
                          Together, we create meaningful relationships and supportive communities. Start exploring today! 🌟
                        </Text>
                      </View>
                    </FloatingElement>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Bottom Spacer */}
          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}