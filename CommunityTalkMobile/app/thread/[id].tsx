// app/thread/[id].tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";

type ChatMessage = {
  _id: string;
  sender: string;
  senderId: string;
  avatar?: string;
  content: string;
  timestamp: string | Date;
  communityId: string;
  status?: "sent" | "edited" | "deleted";
  editedAt?: string | Date | null;
  isDeleted?: boolean;
  deletedAt?: string | Date | null;
  clientMessageId?: string;
};

const asDate = (v: any) => (v instanceof Date ? v : new Date(v));

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useColorScheme() === "dark";
  const { socket } = useSocket();

  const communityId = String(id || "");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // We keep messages oldest→newest (ascending) for FlatList (not inverted).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Cursor for older history
  const [hasMore, setHasMore] = useState(true);
  const fetchingMoreRef = useRef(false);

  // Compute a "title" from the last message / fallback
  const headerTitle = useMemo(() => `Thread`, []);
  const themedText = isDark ? "white" : "black";
  const bubbleMe = isDark ? "#4C1D95" : "#EEF2FF";
  const bubbleOther = isDark ? "#1F2937" : "#FFFFFF";
  const borderCol = isDark ? "#374151" : "#E5E7EB";
  const hint = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

  // ---------------- Initial Load ----------------
  const fetchInitial = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/messages/${communityId}?limit=50`);
      const items: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages(items);
      setHasMore(items.length >= 50); // heuristic
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // ---------------- Pagination (older) ----------------
  const fetchOlder = useCallback(async () => {
    if (!communityId || fetchingMoreRef.current || !hasMore || !messages.length) return;
    try {
      fetchingMoreRef.current = true;
      const oldest = messages[0];
      const before = encodeURIComponent(asDate(oldest.timestamp).toISOString());
      const { data } = await api.get(`/api/messages/${communityId}?limit=50&before=${before}`);
      const older: ChatMessage[] = Array.isArray(data) ? data : [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length >= 50);
    } catch (e) {
      // silent
    } finally {
      fetchingMoreRef.current = false;
    }
  }, [communityId, hasMore, messages]);

  // ---------------- Send ----------------
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !communityId) return;

    setSending(true);
    setError(null);
    const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // optimistic append
    const optimistic: ChatMessage = {
      _id: clientMessageId,
      clientMessageId,
      sender: "You",
      senderId: "me",
      content: text,
      timestamp: new Date(),
      communityId,
      status: "sent",
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const { data } = await api.post(`/api/messages`, {
        content: text,
        communityId,
        clientMessageId,
      });
      // Reconcile: find optimistic by clientMessageId and replace with server payload
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.clientMessageId === clientMessageId || m._id === clientMessageId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          ...data,
          _id: String(data._id),
          timestamp: data.timestamp || next[idx].timestamp,
          clientMessageId: data.clientMessageId ?? next[idx].clientMessageId,
        };
        return next;
      });
    } catch (e: any) {
      // On error, mark the optimistic bubble
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId || m._id === clientMessageId
            ? { ...m, status: "deleted", content: "[failed to send]" }
            : m
        )
      );
      setError(e?.response?.data?.error || "Failed to send");
    } finally {
      setSending(false);
    }
  }, [input, sending, communityId]);

  // ---------------- Realtime Socket ----------------
  useEffect(() => {
    if (!socket || !communityId) return;

    const onNew = (payload: any) => {
      // only messages for this community
      if (String(payload?.communityId) !== communityId) return;

      // If this was our optimistic send, reconcile by clientMessageId
      if (payload?.clientMessageId) {
        setMessages((prev) => {
          const i = prev.findIndex(
            (m) => m.clientMessageId === payload.clientMessageId || m._id === payload.clientMessageId
          );
          if (i === -1) return [...prev, payload];
          const next = [...prev];
          next[i] = { ...next[i], ...payload, _id: String(payload._id) };
          return next;
        });
      } else {
        setMessages((prev) => [...prev, payload]);
      }
    };

    const onEdited = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(payload._id) ? { ...m, ...payload } : m))
      );
    };

    const onDeleted = (payload: any) => {
      if (String(payload?.communityId) !== communityId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(payload._id) ||
          // some servers emit only messageId; adjust if needed
          String(m._id) === String(payload?.messageId)
            ? { ...m, isDeleted: true, status: "deleted", content: "" }
            : m
        )
      );
    };

    socket.on?.("receive_message", onNew);
    socket.on?.("message:updated", onEdited);
    socket.on?.("message:deleted", onDeleted);

    return () => {
      socket.off?.("receive_message", onNew);
      socket.off?.("message:updated", onEdited);
      socket.off?.("message:deleted", onDeleted);
    };
  }, [socket, communityId]);

  // ---------------- Render ----------------
  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.senderId === "me"; // optimistic “me” label; server messages will show your actual name
    const deleted = item.isDeleted || item.status === "deleted";
    const bubbleColor = mine ? bubbleMe : bubbleOther;
    const align = mine ? "flex-end" : "flex-start";
    const content =
      deleted ? (
        <Text className="text-xs" style={{ color: hint }}>
          message deleted
        </Text>
      ) : (
        <Text style={{ color: themedText }}>{item.content}</Text>
      );

    return (
      <View className="px-4 py-1">
        <View style={{ alignItems: align }}>
          <View
            className="max-w-[85%] rounded-2xl px-4 py-2"
            style={{
              backgroundColor: bubbleColor,
              borderWidth: 1,
              borderColor: borderCol,
            }}
          >
            {!mine && (
              <Text className="mb-1 text-[11px]" style={{ color: hint }}>
                {item.sender}
              </Text>
            )}
            {content}
            <View className="mt-1 flex-row items-center gap-2">
              {item.status === "edited" && (
                <Text className="text-[10px]" style={{ color: hint }}>
                  edited
                </Text>
              )}
              <Text className="text-[10px]" style={{ color: hint }}>
                {asDate(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const keyExtractor = (m: ChatMessage) => String(m._id);

  // Pull older when scrolled to top
  const onEndReached = () => {
    // FlatList is not inverted; reaching top requires a custom list header with a loader.
    // We'll use onRefresh instead via ListHeaderComponent’s button/loader.
  };

  // Header right: go back
  const headerRight = (
    <TouchableOpacity onPress={() => router.back()} className="mr-2">
      <Ionicons name="close" size={22} color={isDark ? "white" : "black"} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ backgroundColor: isDark ? "#0B1220" : "#F8FAFC" }}
    >
      <Stack.Screen
        options={{
          title: headerTitle,
          headerRight: () => headerRight,
        }}
      />

      {/* Top error bar */}
      {!!error && (
        <View className="mx-4 mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: "#FEE2E2", borderColor: "#FCA5A5", borderWidth: 1 }}>
          <Text style={{ color: "#B91C1C" }}>{error}</Text>
        </View>
      )}

      {/* Messages */}
      <View className="flex-1 mt-2">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={
              hasMore ? (
                <TouchableOpacity
                  onPress={fetchOlder}
                  disabled={fetchingMoreRef.current}
                  className="py-3"
                >
                  <View className="items-center">
                    {fetchingMoreRef.current ? (
                      <ActivityIndicator />
                    ) : (
                      <Text style={{ color: hint }}>Load earlier messages</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="py-2 items-center">
                  <Text style={{ color: hint, fontSize: 12 }}>Start of conversation</Text>
                </View>
              )
            }
            contentContainerStyle={{ paddingBottom: 84, paddingTop: 8 }}
          />
        )}
      </View>

      {/* Composer */}
      <View
        className="px-3 py-2"
        style={{
          borderTopWidth: 1,
          borderTopColor: borderCol,
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
        }}
      >
        <View
          className="flex-row items-center rounded-2xl px-3"
          style={{
            borderWidth: 1,
            borderColor: borderCol,
            backgroundColor: isDark ? "#111827" : "#F9FAFB",
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Write a message…"
            placeholderTextColor={hint}
            className="flex-1 py-3 text-base"
            style={{ color: isDark ? "white" : "black" }}
            editable={!sending}
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={sending || input.trim().length === 0}
            className="ml-2 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: sending || input.trim().length === 0 ? "#9CA3AF" : "#6366F1" }}
          >
            {sending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="send" size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}