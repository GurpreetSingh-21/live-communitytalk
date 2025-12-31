// CommunityTalkMobile/app/(tabs)/profile.tsx
import React from "react";
import {
  Pressable,
  View,
  Text,
  SectionList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useColorScheme as useDeviceColorScheme,
  type SectionListRenderItemInfo,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import {
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

// LIVE: auth + api + socket
import { AuthContext } from "@/src/context/AuthContext";
import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { Colors, Fonts } from "@/constants/theme";

/* ───────────────── types ───────────────── */
type ProfileData = {
  type: "profile";
  name: string;
  isVerified: boolean;
  avatar?: string | null;
  bio?: string | null;
  stats: { communities: number; messages: number; connections: number };
};

type SettingRowData = {
  type: "setting";
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  badge?: string;
  screen: string;
};

type QuickActionData = {
  type: "quick_action";
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  screen: string;
};

type LogoutData = {
  type: "logout";
  title: "Log Out";
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

type SectionItem = ProfileData | SettingRowData | QuickActionData | LogoutData;
type SectionData = { title: string; data: SectionItem[] };

/* ───────────────── STATIC DATA BUILDERS ───────────────── */
const buildSections = (
  profile: ProfileData,
  notificationsBadge?: string
): SectionData[] => [
    { title: "Profile", data: [profile] },
    {
      title: "Settings",
      data: [
        {
          type: "setting",
          title: "Account Settings",
          icon: "person-circle-outline",
          screen: "/profile/account",
        },
        {
          type: "setting",
          title: "Notifications",
          icon: "notifications-outline",
          badge: notificationsBadge,
          screen: "/profile/notifications",
        },
        {
          type: "setting",
          title: "Privacy & Security",
          icon: "shield-checkmark-outline",
          screen: "/profile/security",
        },
        {
          type: "setting",
          title: "Help & Support",
          icon: "help-circle-outline",
          screen: "/profile/help",
        },
      ],
    },
    {
      title: "Quick Actions",
      data: [
        {
          type: "quick_action",
          title: "Edit Profile",
          icon: "create-outline",
          color: "#8B5CF6",
          screen: "/profile/edit",
        },
        {
          type: "quick_action",
          title: "Your Activity",
          icon: "stats-chart-outline",
          color: "#10B981",
          screen: "/profile/activity",
        },
        {
          type: "quick_action",
          title: "Invite Friends",
          icon: "person-add-outline",
          color: "#3B82F6",
          screen: "/profile/invite",
        },
      ],
    },
    {
      title: "Danger Zone",
      data: [{ type: "logout", title: "Log Out", icon: "log-out-outline" }],
    },
  ];

/* ───────────────── REUSABLE COMPONENTS ───────────────── */
const ProfileHeader = ({
  item,
  scrollY,
  isDark,
  insets,
  onEditAvatar,
  isUploading,
}: {
  item: ProfileData;
  scrollY: SharedValue<number>;
  isDark: boolean;
  insets: EdgeInsets;
  onEditAvatar: () => void;
  isUploading: boolean;
}) => {
  const theme = isDark ? Colors.dark : Colors.light;

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-200, 0], [-50, 0], "clamp") },
    ],
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], "clamp"),
  }));
  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollY.value, [-200, 0], [1.5, 1], "clamp") },
    ],
  }));

  const gradientColors = [theme.muted, theme.border] as const;
  const initials = item.name.slice(0, 2).toUpperCase() || "CT";
  const avatarUri = item.avatar;
  console.log("avatarUri:", avatarUri);

  return (
    <View style={{ marginBottom: 24, overflow: 'hidden' }}>
      <Animated.View
        style={[animatedBackgroundStyle, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
      >
        <LinearGradient colors={gradientColors} style={{ width: '100%', height: '100%' }} />
      </Animated.View>

      <Animated.View
        style={[
          animatedContentStyle,
          {
            paddingTop: insets.top + 60,
            paddingBottom: 24,
            paddingHorizontal: 24,
            alignItems: 'center',
          },
        ]}
      >
        <Pressable
          onPress={onEditAvatar}
          disabled={isUploading}
          style={{
            height: 110,
            width: 110,
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 }
          }}
        >
          <View style={{
            height: '100%',
            width: '100%',
            borderRadius: 999,
            overflow: 'hidden',
            borderWidth: 4,
            borderColor: theme.surface,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {avatarUri ? (
              <Image
                key={avatarUri}
                source={{ uri: avatarUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text style={{ fontFamily: Fonts.bold, fontSize: 36, color: theme.textMuted }}>
                {initials}
              </Text>
            )}
            {isUploading && (
              <View className="absolute inset-0 bg-black/50 items-center justify-center">
                <ActivityIndicator color="white" />
              </View>
            )}
          </View>
          {!isUploading && (
            <View style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              backgroundColor: theme.primary,
              height: 34,
              width: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: theme.surface
            }}>
              <Ionicons name="pencil" size={16} color="white" />
            </View>
          )}
        </Pressable>

        <Text style={{ fontSize: 26, fontFamily: Fonts.bold, color: theme.text, marginBottom: 4, textAlign: 'center' }}>
          {item.name}
        </Text>

        {/* Bio Section */}
        {item.bio && item.bio.trim() && !item.bio.includes('@') && (
          <Text style={{
            fontSize: 15,
            color: theme.textMuted,
            fontFamily: Fonts.regular,
            textAlign: 'center',
            paddingHorizontal: 24,
            marginTop: 6,
            lineHeight: 22
          }}>
            {item.bio}
          </Text>
        )}

        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 28,
          width: '100%',
          paddingVertical: 18,
          paddingHorizontal: 16,
          borderRadius: 24,
          backgroundColor: theme.surface,
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
        }}>
          {[
            { label: 'Communities', value: item.stats.communities },
            { label: 'Messages', value: item.stats.messages },
            { label: 'Connections', value: item.stats.connections }
          ].map((stat, i) => (
            <View key={stat.label} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 20, fontFamily: Fonts.bold, color: theme.text, marginBottom: 2 }}>
                {stat.value}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textMuted, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

const SettingsRow = ({
  item,
}: {
  item: SettingRowData;
  isDark: boolean; // kept for compatibility if needed, but we use hook now or pass theme? Better to use hook inside if we want context, but parent passes isDark.
}) => {
  const isDark = useDeviceColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <Pressable
      onPress={() => router.push(item.screen as any)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        backgroundColor: theme.surface,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.muted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons
            name={item.icon}
            size={18}
            color={theme.icon}
          />
        </View>
        <Text style={{ fontSize: 16, fontFamily: Fonts.bold, color: theme.text }}>
          {item.title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {item.badge && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: item.badge === "Required" ? theme.danger + '15' : theme.primary + '15'
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: Fonts.bold,
                color: item.badge === "Required" ? theme.danger : theme.primary
              }}
            >
              {item.badge}
            </Text>
          </View>
        )}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.border}
        />
      </View>
    </Pressable>
  );
};

const QuickActionsRow = ({
  items,
}: {
  items: QuickActionData[];
  isDark: boolean;
}) => {
  const isDark = useDeviceColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 8 }}>
      {items.map((item) => (
        <Pressable
          key={item.title}
          onPress={() => router.push(item.screen as any)}
          style={{
            flex: 1,
            backgroundColor: theme.surface,
            paddingVertical: 20,
            paddingHorizontal: 8,
            borderRadius: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.03,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : item.color + '10',
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10
            }}
          >
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 13, textAlign: 'center', color: theme.text }}>
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList<SectionItem, SectionData>
);

/* ───────────────── AUTHENTICATED PROFILE VIEW ───────────────── */

const AuthedProfileView = ({
  profile,
  isDark,
  insets,
  isUploading,
  handleLogout,
  load,
  setRefreshing,
  refreshing,
  pickImage,
  scrollY,
  unreadDMs,
}: any) => {
  const theme = isDark ? Colors.dark : Colors.light;

  const animatedLargeHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [1, 0]),
    transform: [{ translateY: interpolate(scrollY.value, [0, 40], [0, -10]) }],
  }));
  const animatedSmallHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 60], [0, 1]),
  }));

  const sections = React.useMemo(
    () => buildSections(profile, unreadDMs > 0 ? String(unreadDMs) : undefined),
    [profile, unreadDMs]
  );

  const renderItem = ({
    item,
    index,
    section,
  }: SectionListRenderItemInfo<SectionItem, SectionData>) => {
    switch (item.type) {
      case "profile":
        return (
          <ProfileHeader
            item={item}
            scrollY={scrollY}
            isDark={isDark}
            insets={insets}
            onEditAvatar={pickImage}
            isUploading={isUploading}
          />
        );
      case "setting":
        return <SettingsRow item={item} isDark={isDark} />;
      case "quick_action":
        return index === 0 ? (
          <QuickActionsRow
            items={section.data as QuickActionData[]}
            isDark={isDark}
          />
        ) : null;
      case "logout":
        return (
          <Pressable
            onPress={handleLogout}
            style={{
              backgroundColor: theme.surface, // Clean surface
              padding: 18,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginHorizontal: 16,
              borderWidth: 1,
              borderColor: Colors.light.danger + '20', // Subtle red border
              shadowColor: Colors.light.danger,
              shadowOpacity: 0.05,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 }
            }}
          >
            <Ionicons name={item.icon} size={18} color={Colors.light.danger} />
            <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color: Colors.light.danger }}>
              {item.title}
            </Text>
          </Pressable>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AnimatedSectionList
        key={profile.avatar}
        sections={sections}
        keyExtractor={(item, index) =>
          (item as any).title ? (item as any).title + index : `item-${index}`
        }
        renderItem={renderItem}
        onScroll={useAnimatedScrollHandler((event) => {
          scrollY.value = event.contentOffset.y;
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderSectionHeader={({ section: { title } }) =>
          title === "Profile" || title === "Settings" ? null : (
            <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: theme.text, marginLeft: 24, marginTop: 24, marginBottom: 8 }}>
              {title}
            </Text>
          )
        }
      />

      {/* Sticky Header */}
      <View
        style={{ paddingTop: insets.top, height: insets.top + 56, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 20, justifyContent: 'flex-end', paddingBottom: 8 }}
      >
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Animated.View style={animatedLargeHeaderStyle}>
          <Text style={{ fontSize: 30, fontFamily: Fonts.bold, color: theme.text }}>
            Profile
          </Text>
        </Animated.View>
        <Animated.View
          style={[
            { position: "absolute", bottom: 12, left: 0, right: 0 },
            animatedSmallHeaderStyle,
            { alignItems: 'center' }
          ]}
        >
          <Text style={{ fontSize: 16, fontFamily: Fonts.bold, color: theme.text }}>
            {profile.name}
          </Text>
        </Animated.View>
      </View>
    </>
  );
};

/* ───────────────── MAIN SCREEN ───────────────── */
export default function ProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const deviceScheme = useDeviceColorScheme();
  const isDark = deviceScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const auth = React.useContext(AuthContext) as any;
  const isAuthed = !!auth?.user;
  const logout = auth?.signOut;
  const updateAvatar = auth?.updateAvatar;
  const { unreadDMs = 0, socket = null } = useSocket() ?? {};

  const scrollY = useSharedValue(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileData>({
    type: "profile",
    name: "Student Name",
    isVerified: true,
    stats: { communities: 0, messages: 0, connections: 0 },
  });

  // LOAD (useCallback)
  const load = React.useCallback(async () => {
    try {
      let data: any | null = null;
      try {
        const res = await api.get("/api/bootstrap");
        data = res?.data ?? null;
      } catch (e: any) {
        if (e?.response?.status === 404) {
          const res2 = await api.get("/api/profile");
          data = res2?.data ?? null;
        } else {
          throw e;
        }
      }

      const u = data?.user ?? auth?.user ?? {};
      const communities = Array.isArray(data?.communities)
        ? data.communities
        : [];
      const fullName =
        (u.fullName || "").trim() || (u.email || "Student").split("@")[0];

      console.log("=== LOAD DEBUG ===");
      console.log("API user data:", u);
      console.log("u.avatar:", u.avatar);
      console.log("auth?.user?.avatar:", auth?.user?.avatar);
      console.log("==================");

      setProfile((p) => ({
        ...p,
        name: fullName,
        avatar: u.avatar || p.avatar, // ✅ Preserve existing avatar if API returns null/undefined
        bio: u.bio || null,
        stats: {
          communities: communities.length || 0,
          messages: p.stats.messages,
          connections: 0,
        },
      }));
    } catch (error) {
      console.error("Load error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth?.user]);
  React.useEffect(() => {
    load();
  }, [load]);

  // IMAGE PICKER LOGIC
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need access to your photos to change your avatar."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        const asset = result.assets[0];
        uploadAvatar(asset.base64, asset.uri);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const uploadAvatar = async (
    base64: string | null | undefined,
    uri: string
  ) => {
    if (!base64) return;
    try {
      setIsUploading(true);
      const extension = uri.split(".").pop() || "jpg";
      const { data } = await api.post("/api/user/avatar", {
        imageData: base64,
        fileExtension: extension,
      });

      console.log("=== UPLOAD DEBUG ===");
      console.log("Full response data:", JSON.stringify(data, null, 2));
      console.log("data.avatar:", data.avatar);
      console.log("typeof data.avatar:", typeof data.avatar);
      console.log("===================");

      if (data.avatar) {
        // 1. Update Context
        console.log("Updating AuthContext with:", data.avatar);
        if (updateAvatar) {
          updateAvatar(data.avatar);
          console.log("AuthContext updated");
        }

        // 2. Update Local State with timestamp to FORCE refresh
        const newUrl = `${data.avatar}?t=${Date.now()}`;
        console.log("Setting local profile state with:", newUrl);
        setProfile((prevProfile) => {
          console.log("Previous profile:", prevProfile);
          const updated = { ...prevProfile, avatar: newUrl };
          console.log("Updated profile:", updated);
          return updated;
        });

        Alert.alert("Success", "Profile picture updated!");
      } else {
        console.log("❌ No avatar in response");
        Alert.alert("Notice", "Upload finished but no URL returned.");
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      console.error("Error response:", error.response?.data);
      Alert.alert("Upload Failed", "Could not update profile picture.");
    } finally {
      setIsUploading(false);
    }
  };
  const handleLogout = () => {
    logout?.();
    router.replace("/landing");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!isAuthed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}
        >
          <Text style={{ fontSize: 24, fontFamily: Fonts.bold, color: theme.text }}>
            You’re not signed in
          </Text>
          <Pressable
            onPress={() => router.push("/modal?context=auth")}
            style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: theme.primary }}
          >
            <Text style={{ color: '#FFF', fontFamily: Fonts.bold }}>Log in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthedProfileView
        profile={profile}
        isDark={isDark}
        insets={insets}
        scrollY={scrollY}
        isUploading={isUploading}
        handleLogout={handleLogout}
        load={load}
        setRefreshing={setRefreshing}
        refreshing={refreshing}
        pickImage={pickImage}
        unreadDMs={unreadDMs}
      />
    </View>
  );
}
