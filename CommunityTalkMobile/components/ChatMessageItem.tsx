// CommunityTalkMobile/components/ChatMessageItem.tsx
import React from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Fonts } from "@/constants/theme";

interface ChatMessage {
  _id: string;
  sender: string;
  senderId: string;
  content: string;
  timestamp: string | Date;
  communityId: string;
  status?: "sent" | "edited" | "deleted";
  isDeleted?: boolean;
  clientMessageId?: string;
}

interface User {
  _id?: string;
  id?: string;
}

interface ChatMessageItemProps {
  item: ChatMessage;
  index: number;
  messages: ChatMessage[];
  user: User | null;
  colors: any; // Accept colors from parent
}

const asDate = (v: any): Date => {
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v);
  return new Date();
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayLabel = (d: Date | string | undefined | null): string => {
  if (!d) return "";
  const date = asDate(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const showGap15min = (prev?: ChatMessage, cur?: ChatMessage): boolean => {
  if (!prev || !cur) return false;
  const a = asDate(prev.timestamp).getTime();
  const b = asDate(cur.timestamp).getTime();
  return Math.abs(b - a) > 15 * 60 * 1000;
};

export const ChatMessageItem = React.memo(
  ({ item, index, messages, user, colors }: ChatMessageItemProps) => {
    const myIds = [String(user?._id || ""), String(user?.id || ""), "me"];
    const mine = myIds.includes(String(item.senderId || ""));
    const prev = messages[index - 1];
    const next = messages[index + 1];

    const curDate = asDate(item.timestamp);
    const prevDate = prev ? asDate(prev.timestamp) : undefined;
    const showDateDivider = !prev || !prevDate || !isSameDay(curDate, prevDate);

    const isFirstOfGroup = !prev || prev.senderId !== item.senderId || showGap15min(prev, item);
    const isLastOfGroup = !next || next.senderId !== item.senderId || showGap15min(item, next);

    const deleted = item.isDeleted || item.status === "deleted";

    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 3 }}>
        {showDateDivider && (
          <View style={{ alignItems: "center", marginVertical: 16 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 12,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.sans }}>{dayLabel(curDate)}</Text>
            </View>
          </View>
        )}
        <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: isLastOfGroup ? 12 : 2 }}>
          {!mine && isFirstOfGroup && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4, marginLeft: 12, fontFamily: Fonts.sans }}>
              {item.sender}
            </Text>
          )}
          <View style={{ maxWidth: "75%" }}>
            {mine ? (
              <LinearGradient
                colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderTopRightRadius: isFirstOfGroup ? 20 : 6,
                  borderBottomRightRadius: isLastOfGroup ? 20 : 6,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 6,
                }}
              >
                {deleted ? (
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic" }}>Message deleted</Text>
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontFamily: Fonts.regular }}>{item.content}</Text>
                )}
              </LinearGradient>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surfaceElevated,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderTopLeftRadius: isFirstOfGroup ? 20 : 6,
                  borderBottomLeftRadius: isLastOfGroup ? 20 : 6,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                }}
              >
                {deleted ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: "italic" }}>Message deleted</Text>
                ) : (
                  <Text style={{ color: colors.text, fontSize: 16, lineHeight: 22, fontFamily: Fonts.regular }}>{item.content}</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    return (
      prevProps.item._id === nextProps.item._id &&
      prevProps.item.content === nextProps.item.content &&
      prevProps.item.status === nextProps.item.status &&
      prevProps.item.isDeleted === nextProps.item.isDeleted &&
      prevProps.index === nextProps.index &&
      prevProps.messages.length === nextProps.messages.length
    );
  }
);

ChatMessageItem.displayName = "ChatMessageItem";
