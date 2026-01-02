// CommunityTalkMobile/app/dm/[id].tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
} from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActionSheetIOS,
  Linking,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

import { api } from "@/src/api/api";
import { useSocket } from "@/src/context/SocketContext";
import { AuthContext } from "@/src/context/AuthContext";
import DMHeader from "@/components/dm/DMHeader";
import { checkMessageToxicity } from '@/constants/safety';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme as useAppColorScheme } from '@/hooks/use-color-scheme';

// 🔐 E2EE imports
import { encryptMessage, decryptMessage, getPublicKey, ensureKeyPair } from "@/src/utils/e2ee";
import { fetchPublicKey, uploadPublicKey } from "@/src/api/e2eeApi";

/* ───────────────── Types & helpers ───────────────── */
type DMMessage = {
  _id?: string;
  from: string;
  to: string;
  content: string;
  createdAt: string | Date;
  type?: "text" | "photo" | "video" | "audio" | "file";
  clientMessageId?: string;
  timestamp?: string | Date;
  fileName?: string;
};

type PartnerMeta = {
  partnerId?: string;
  partnerName?: string;
  fullName?: string;
  name?: string;
  avatar?: string;
  photoUrl?: string;
  image?: string;
  online?: boolean;
  lastSeen?: string | Date;
  updatedAt?: string | Date;
};

const asId = (v: any) => (v ? String(v) : "");
const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dayLabel = (d: Date) => {
  const t = new Date();
  const y = new Date(t);
  y.setDate(t.getDate() - 1);
  if (isSameDay(d, t)) return "Today";
  if (isSameDay(d, y)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== t.getFullYear() ? "numeric" : undefined,
  }).format(d);
};

type UpsertOpts = { prefer?: "server" | "local" };

function upsertMessages(
  list: DMMessage[],
  incoming: DMMessage | DMMessage[],
  opts: UpsertOpts = {}
) {
  const preferServer = (opts.prefer ?? "server") === "server";
  const arr = Array.isArray(incoming) ? incoming : [incoming];

  const byId = new Map<string, DMMessage>();
  const byClient = new Map<string, DMMessage>();

  for (const m of list) {
    const sid = asId(m._id);
    const cid = asId(m.clientMessageId);
    if (sid) byId.set(sid, m);
    if (cid) byClient.set(cid, m);
  }

  for (const inc0 of arr) {
    const inc: DMMessage = {
      ...inc0,
      createdAt: inc0.timestamp ?? inc0.createdAt ?? new Date(),
    };

    const sid = asId(inc._id);
    const cid = asId(inc.clientMessageId);

    if (sid && byId.has(sid)) {
      const prev = byId.get(sid)!;
      const merged = preferServer ? { ...prev, ...inc } : { ...inc, ...prev };
      byId.set(sid, merged);
      if (cid && byClient.has(cid)) byClient.set(cid, merged);
      continue;
    }

    if (cid && byClient.has(cid)) {
      const prev = byClient.get(cid)!;
      const merged: DMMessage =
        preferServer ? { ...prev, ...inc } : { ...inc, ...prev };

      if (sid) {
        merged._id = sid;
        byId.set(sid, merged);
      }
      byClient.set(cid, merged);
      continue;
    }

    if (sid) byId.set(sid, inc);
    else if (cid) byClient.set(cid, inc);
    else byClient.set(`__noid_${Math.random()}`, inc);
  }

  const seen = new Set<string>();
  const out: DMMessage[] = [];

  for (const m of list) {
    const sid = asId(m._id);
    const cid = asId(m.clientMessageId);
    const cur = (sid && byId.get(sid)) || (cid && byClient.get(cid)) || m;
    const key = asId(cur._id) || (cid ? `c:${cid}` : "");
    if (!key) continue;
    if (!seen.has(key)) {
      out.push(cur);
      seen.add(key);
    }
  }
  for (const [sid, v] of byId) {
    if (!seen.has(sid)) {
      out.push(v);
      seen.add(sid);
    }
  }
  for (const [cid, v] of byClient) {
    const key = `c:${cid}`;
    if (!seen.has(key)) {
      out.push(v);
      seen.add(key);
    }
  }

  return out;
}

function finalizeUnique(list: DMMessage[]) {
  const added = new Set<string>();
  const out: DMMessage[] = [];
  for (const m of list) {
    const sid = asId(m._id);
    const cid = asId(m.clientMessageId);
    const key = sid || (cid ? `c:${cid}` : "");
    if (!key) continue;
    if (!added.has(key)) {
      out.push(m);
      added.add(key);
    }
  }
  return out.sort(
    (a, b) => asDate(a.createdAt).getTime() - asDate(b.createdAt).getTime()
  );
}

const msgKey = (m: DMMessage, idx: number) => {
  const sid = asId(m._id);
  const cid = asId(m.clientMessageId);
  return sid || (cid ? `c:${cid}` : `i:${idx}`);
};

/* ───────────────── Component ───────────────── */
export default function DMThreadScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string; type?: string }>();
  const partnerId = String(params?.id || "");
  const paramName = params?.name ? String(params.name) : undefined;
  const paramAvatar = params?.avatar ? String(params.avatar) : undefined;

  const { user } = useContext(AuthContext) as any;
  const myId = String(user?._id || "");
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { socket } = useSocket() as any;

  // 🟢 CONTEXT: Determine if this is Dating or Community
  const context = params.type === 'dating' ? 'dating' : 'community';

  const [meta, setMeta] = useState<PartnerMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");

  // ✅ Recording State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Typing indicator state
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  // 🔐 E2EE: Recipient's public key for encryption
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);

  const resolvedClientIdsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<FlatList<DMMessage>>(null);

  // Adapter for existing code to work with new theme
  const colors = {
    bg: theme.background,
    text: theme.text,
    textSecondary: theme.textMuted,
    surface: theme.surface,
    border: theme.border,
    primaryStart: theme.primary,
    primaryEnd: theme.primary,
    headerBg: theme.surface,
  };

  /* ─────── Partner header fetch ─────── */
  const USER_ENDPOINTS = useMemo(
    () => [
      `/api/person/${partnerId}`,
      `/api/people/${partnerId}`,
      `/api/users/${partnerId}`,
      `/api/user/${partnerId}`,
    ],
    [partnerId]
  );

  const fetchPartnerMeta = useCallback(async (): Promise<PartnerMeta> => {
    const tryGet = async (path: string) => {
      try {
        const { data } = await api.get(path);
        return data;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    };

    for (const path of USER_ENDPOINTS) {
      const got = await tryGet(path);
      if (got) {
        return {
          partnerId,
          partnerName:
            got.partnerName ||
            got.fullName ||
            got.name ||
            `${got.firstName ?? ""} ${got.lastName ?? ""}`.trim() ||
            "Direct Message",
          avatar: got.avatar || got.photoUrl || got.image,
          online: got.online,
          lastSeen: got.lastSeen,
          updatedAt: got.updatedAt,
          ...got,
        };
      }
    }
    return {
      partnerId,
      partnerName: paramName || "Direct Message",
      avatar: paramAvatar || undefined,
    };
  }, [USER_ENDPOINTS, partnerId, paramName, paramAvatar]);

  /* ─────── Initial load ─────── */
  const loadInitial = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    try {
      // 🔐 E2EE: Ensure we have a keypair (regenerates if missing)
      try {
        const { publicKey } = await ensureKeyPair();
        // Upload the public key to ensure server is in sync
        await uploadPublicKey(publicKey);
      } catch (keyErr) {
        console.warn('🔐 [E2EE] Key setup failed (non-fatal):', keyErr);
      }

      // Fetch metadata and recipient's public key in parallel
      const [metaData, partnerPubKey] = await Promise.all([
        fetchPartnerMeta(),
        fetchPublicKey(partnerId).catch(() => null),
      ]);

      // 🔐 Store recipient's public key for encryption
      if (partnerPubKey) {
        setRecipientPublicKey(partnerPubKey);
        console.log('🔐 [E2EE] Loaded recipient public key');
      }

      const finalMeta = {
        ...metaData,
        partnerName: metaData.partnerName || paramName,
        avatar: metaData.avatar || paramAvatar,
      };
      setMeta(finalMeta);

      let msgs: any[] = [];
      try {
        const { data } = await api.get(
          `/api/direct-messages/${partnerId}?limit=50&context=${context}`
        );
        msgs = Array.isArray(data) ? data : data?.items ?? [];
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
      }

      // 🔐 Decrypt encrypted messages
      // NOTE: In NaCl box, the shared key is ALWAYS computed as:
      //   box.before(partner_public_key, my_secret_key)
      // This is symmetric - works for both sent and received messages.
      const decryptedMsgs = await Promise.all(
        msgs.map(async (m: any) => {
          if (m.isEncrypted && m.content && partnerPubKey) {
            try {
              // ALWAYS use partner's public key - shared key is symmetric!
              const decrypted = await decryptMessage(m.content, partnerPubKey);
              return { ...m, content: decrypted, _decrypted: true };
            } catch (err) {
              console.warn('🔐 [E2EE] Decryption failed for message:', m._id, err);
              return { ...m, content: '[Encrypted]' };
            }
          }
          return m;
        })
      );

      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, decryptedMsgs, { prefer: "server" }))
      );
      setHasMore((msgs?.length ?? 0) >= 50);

      try {
        await api.patch(`/api/direct-messages/${partnerId}/read`);
      } catch (e: any) {
        if (e?.response?.status !== 404) console.log("[dm] read failed");
      }

      socket?.emit?.("room:join", { room: `dm:${partnerId}` });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 300);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error || "Failed to open chat");
    } finally {
      setLoading(false);
    }
  }, [partnerId, fetchPartnerMeta, socket, paramName, paramAvatar, myId]);

  useEffect(() => {
    loadInitial();
    return () => {
      socket?.emit?.("room:leave", { room: `dm:${partnerId}` });
    };
  }, [loadInitial, partnerId]);

  /* ─────── Pagination (older) ─────── */
  /* ─────── Pagination (older) ─────── */

  const loadOlder = useCallback(async () => {
    if (!messages.length || !hasMore) return;
    try {
      const oldest = messages[0];
      const before = encodeURIComponent(asDate(oldest.createdAt).toISOString());
      const { data } = await api.get(
        `/api/direct-messages/${partnerId}?limit=50&before=${before}&context=${context}`
      );
      const older: DMMessage[] = Array.isArray(data) ? data : data?.items ?? [];
      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, older, { prefer: "server" }))
      );
      setHasMore(older.length >= 50);
    } catch {
      // ignore
    }
  }, [messages, hasMore, partnerId]);

  /* ─────── Socket real-time ─────── */
  useEffect(() => {
    if (!socket) return;

    const onDM = async (p: any) => {
      const from = String(p?.from || p?.senderId || "");
      const to = String(p?.to || "");
      if (![from, to].includes(partnerId)) return;

      const cid = asId(p.clientMessageId);
      if (cid && resolvedClientIdsRef.current.has(cid)) return;

      let content = String(p.content ?? "");

      // 🔐 E2EE: Decrypt incoming encrypted messages
      // ALWAYS use partner's public key - shared key is symmetric!
      if (p.isEncrypted && content && recipientPublicKey) {
        try {
          content = await decryptMessage(content, recipientPublicKey);
          console.log('🔐 [E2EE] Real-time message decrypted');
        } catch (err) {
          console.warn('🔐 [E2EE] Real-time decryption failed:', err);
          content = '[Encrypted]';
        }
      }

      const serverMsg: DMMessage = {
        _id: p?._id ? String(p._id) : undefined,
        from,
        to,
        content,
        createdAt: p.timestamp || p.createdAt || new Date(),
        type: p.type || "text",
        clientMessageId: p.clientMessageId,
        fileName: p.attachments?.[0]?.name, // Support receiving filenames
      };

      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, serverMsg, { prefer: "server" }))
      );
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    };

    const onTyping = (payload: any) => {
      if (String(payload?.userId) !== partnerId) return;
      setPartnerTyping(payload?.isTyping === true);
    };

    socket.on?.("dm:message", onDM);
    socket.on?.("dm:typing", onTyping);
    return () => {
      socket.off?.("dm:message", onDM);
      socket.off?.("dm:typing", onTyping);
    };
  }, [socket, partnerId, recipientPublicKey, myId]);

  /* ─────── Consolidated Upload & Send Logic ─────── */
  const uploadAndSend = async (
    fileUri: string,
    fileType: string,
    fileName: string,
    msgType: "photo" | "video" | "audio" | "file"
  ) => {
    setSending(true);
    const clientMessageId = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Optimistic Update
    const optimistic: DMMessage = {
      from: myId,
      to: partnerId,
      content: fileUri, // Show local URI temporarily
      createdAt: new Date(),
      type: msgType,
      clientMessageId,
      fileName: fileName
    };

    setMessages((prev) =>
      finalizeUnique(upsertMessages(prev, optimistic, { prefer: "local" }))
    );

    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: fileType,
      } as any);

      const uploadRes = await api.post(`/api/upload?context=${context}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const secureUrl = uploadRes.data?.url || fileUri;

      const payload = {
        content: secureUrl,
        type: msgType,
        clientMessageId,
        attachments: [{ url: secureUrl, type: msgType, name: fileName }]
      };

      // Try specific ID route first
      try {
        await api.post(`/api/direct-messages/${partnerId}`, payload);
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
        // Fallback to body-only route
        await api.post(`/api/direct-messages`, { ...payload, to: partnerId });
      }

      if (clientMessageId) resolvedClientIdsRef.current.add(clientMessageId);

    } catch (err) {
      console.error("Send failed", err);
      Alert.alert("Upload Failed", "Could not send file.");
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, content: "[failed to send]" }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  /* ─────── Handlers ─────── */

  // 1. Pick Image or Video
  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // ✅ Images AND Videos
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'photo';
      const mime = asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg');
      const name = asset.fileName || `media_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;

      uploadAndSend(asset.uri, mime, name, type);
    }
  };

  // 2. Pick Document (PDF)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'], // ✅ Only PDFs
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        uploadAndSend(doc.uri, doc.mimeType || 'application/pdf', doc.name, 'file');
      }
    } catch (e) {
      console.log("Document picker error", e);
    }
  };

  // 3. Audio Recording
  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert("Permission needed", "Audio permission is required to record voice notes.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      uploadAndSend(uri, 'audio/m4a', `audio_${Date.now()}.m4a`, 'audio');
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    try { await recording.stopAndUnloadAsync(); } catch { }
    setRecording(null);
  };

  // 4. The "Plus" Menu
  const showAttachmentOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Photo & Video", "Document (PDF)", "Record Audio"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handlePickMedia();
          if (buttonIndex === 2) handlePickDocument();
          if (buttonIndex === 3) startRecording();
        }
      );
    } else {
      Alert.alert("Add Attachment", "Choose an option", [
        { text: "Photo & Video", onPress: handlePickMedia },
        { text: "Document (PDF)", onPress: handlePickDocument },
        { text: "Record Audio", onPress: startRecording },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  /* ─────── Typing indicator emission ─────── */
  const emitTyping = useCallback((isTyping: boolean) => {
    socket?.emit?.("dm:typing", { recipientId: partnerId, isTyping });
  }, [socket, partnerId]);

  const handleTextChange = useCallback((text: string) => {
    setInput(text);

    if (text.trim()) {
      emitTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2000);
    } else {
      emitTyping(false);
    }
  }, [emitTyping]);



  /* ─────── Send Text ─────── */
  const performSend = useCallback(async (text: string) => {
    setSending(true);

    const clientMessageId = `dm_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const optimistic: DMMessage = {
      from: myId,
      to: partnerId,
      content: text, // Show plaintext locally
      createdAt: new Date(),
      type: "text",
      clientMessageId,
    };

    setMessages((prev) =>
      finalizeUnique(upsertMessages(prev, optimistic, { prefer: "local" }))
    );
    setInput("");
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );

    try {
      let data: any;

      // 🔐 E2EE: Encrypt message if recipient has a public key
      let contentToSend = text;
      let isEncrypted = false;

      if (recipientPublicKey) {
        try {
          const encrypted = await encryptMessage(text, recipientPublicKey);
          if (encrypted) {
            contentToSend = encrypted;
            isEncrypted = true;
            console.log('🔐 [E2EE] Message encrypted successfully');
          }
        } catch (encErr) {
          console.warn('🔐 [E2EE] Encryption failed, sending unencrypted:', encErr);
        }
      }

      const payload = {
        content: contentToSend,
        type: 'text',
        clientMessageId,
        context,
        isEncrypted, // 🔐 Tell server this is encrypted
      };

      try {
        ({ data } = await api.post(`/api/direct-messages/${partnerId}`, payload));
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
        // Fallback
        ({ data } = await api.post(`/api/direct-messages`, { ...payload, to: partnerId }));
      }

      const serverMsg: DMMessage = {
        _id: data?._id ? String(data._id) : undefined,
        from: String(data.from || myId),
        to: String(data.to || partnerId),
        content: text, // Store plaintext locally (we encrypted only for server)
        createdAt: data.timestamp || data.createdAt || optimistic.createdAt,
        type: data.type || "text",
        clientMessageId,
      };

      if (clientMessageId) resolvedClientIdsRef.current.add(clientMessageId);

      setMessages((prev) =>
        finalizeUnique(upsertMessages(prev, serverMsg, { prefer: "server" }))
      );
    } catch (e: any) {
      console.error("[dm] send text error:", e);
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, content: "[failed to send]" }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [myId, partnerId, recipientPublicKey]);

  const sendText = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    // 🛡️ SAFETY CHECK: Frontend Strict Blocking
    if (checkMessageToxicity(text)) {
      Alert.alert(
        "Message Blocked",
        "Your message contains inappropriate language that violates our Community Guidelines. Please allow us to keep this platform professional and safe.",
        [
          { text: "OK", style: "default" }
        ]
      );
      return;
    }

    performSend(text);
  }, [input, sending, performSend]);

  /* ─────── Discord-Style Profile Header ─────── */
  const renderProfileHeader = () => {
    console.log('🎨 [DM] Rendering Discord-style profile header for:', headerName);

    // Generate avatar color based on partner name
    const hueFrom = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
      return `hsl(${h} 85% 55%)`;
    };

    const initials = (name?: string) => {
      const base = (name || headerName || "DM").trim();
      const parts = base.split(/\s+/).filter(Boolean);
      const s = (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : "");
      return (s || "U").toUpperCase();
    };

    const avatarColor = hueFrom(headerName || "User");
    const isOnline = meta?.online;

    return (
      <View style={{ backgroundColor: theme.surface, marginBottom: 16 }}>
        {/* Banner - Make it VERY visible */}
        <View style={{ height: 150, backgroundColor: avatarColor }} />

        {/* Content Section */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          {/* Floating Avatar */}
          <View style={{ marginTop: -50, marginBottom: 16 }}>
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: avatarColor,
                borderWidth: 6,
                borderColor: theme.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {headerAvatar ? (
                <Image
                  source={{ uri: headerAvatar }}
                  style={{ width: 88, height: 88, borderRadius: 44 }}
                />
              ) : (
                <Text style={{ color: "#fff", fontSize: 42, fontFamily: Fonts.bold }}>
                  {initials(headerName)}
                </Text>
              )}

              {/* Online Status Indicator */}
              <View
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: isOnline ? "#43B581" : "#747F8D",
                  borderWidth: 5,
                  borderColor: theme.background,
                }}
              />
            </View>
          </View>

          {/* User Name */}
          <Text style={{ color: theme.text, fontSize: 24, fontFamily: Fonts.bold, marginBottom: 4 }}>
            {headerName}
          </Text>

          {/* User Bio/Email */}
          {(meta as any)?.bio && (
            <Text style={{ color: theme.textMuted, fontSize: 14, marginBottom: 8, fontFamily: Fonts.regular }}>
              {(meta as any).bio}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            {/* Message Button */}
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 8,
                padding: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <Ionicons name="chatbubble" size={20} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontFamily: Fonts.bold, marginTop: 4 }}>
                Message
              </Text>
            </TouchableOpacity>

            {/* Voice Call Button */}
            <TouchableOpacity
              onPress={() => Alert.alert("Voice Call", "Voice calls  coming soon!")}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 8,
                padding: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <Ionicons name="call" size={20} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontFamily: Fonts.bold, marginTop: 4 }}>
                Voice Call
              </Text>
            </TouchableOpacity>

            {/* Video Call Button */}
            <TouchableOpacity
              onPress={() => Alert.alert("Video Call", "Video calls coming soon!")}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 8,
                padding: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <Ionicons name="videocam" size={20} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontFamily: Fonts.bold, marginTop: 4 }}>
                Video Call
              </Text>
            </TouchableOpacity>
          </View>

          {/* About Me Section */}
          {(meta as any)?.bio && (
            <View style={{ marginTop: 20 }}>
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.border
                }}
              >
                <Text style={{ color: theme.text, fontSize: 13, fontFamily: Fonts.bold, marginBottom: 8 }}>
                  ABOUT ME
                </Text>
                <Text style={{ color: theme.text, fontSize: 15, lineHeight: 20, fontFamily: Fonts.regular }}>
                  {(meta as any).bio}
                </Text>
              </View>
            </View>
          )}

          {/* Member Since */}
          <View style={{ marginTop: 20 }}>
            <View
              style={{
                backgroundColor: isDark ? "#2F3136" : "#F2F3F5",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
                MEMBER SINCE
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {meta?.updatedAt
                    ? new Date(meta.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                    : "November 20, 2025"}
                </Text>
              </View>
            </View>
          </View>

          {/* Messages Divider */}
          <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>
              MESSAGES
            </Text>
          </View>
        </View>
      </View>
    );
  };

  /* ─────── Render Item Update ─────── */
  const renderItem = ({ item, index }: { item: DMMessage; index: number }) => {
    const mine = String(item.from) === myId;
    const prev = messages[index - 1];
    const curD = asDate(item.createdAt);
    const showDate = !prev || !isSameDay(curD, asDate(prev.createdAt));

    // ✅ FIX: Auto-detect old images (URL in Chat issue)
    const looksLikeImage = item.content?.match(/\.(jpeg|jpg|gif|png|webp)/i) || item.content?.includes('cloudinary.com');
    const currentType = (!item.type && looksLikeImage) ? 'photo' : (item.type || 'text');

    let contentNode;
    if (currentType === 'photo') {
      contentNode = (
        <TouchableOpacity activeOpacity={0.9} onPress={() => {
          if (item.content.startsWith('http')) Linking.openURL(item.content);
        }}>
          <Image
            source={{ uri: item.content }}
            style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: '#eee' }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    } else if (currentType === 'video') {
      contentNode = (
        <TouchableOpacity onPress={() => Linking.openURL(item.content)} style={{ width: 220, height: 150, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={48} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Tap to Play Video</Text>
        </TouchableOpacity>
      );
    } else if (currentType === 'file') {
      contentNode = (
        <TouchableOpacity onPress={() => Linking.openURL(item.content)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="document-text" size={28} color={mine ? '#fff' : colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: mine ? '#fff' : colors.text, textDecorationLine: 'underline', fontWeight: '600' }}>
              {item.fileName || "Document.pdf"}
            </Text>
            <Text style={{ color: mine ? '#rgba(255,255,255,0.7)' : colors.textSecondary, fontSize: 10 }}>Tap to open</Text>
          </View>
        </TouchableOpacity>
      );
    } else if (currentType === 'audio') {
      contentNode = (
        <TouchableOpacity onPress={() => Linking.openURL(item.content)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="mic-circle" size={32} color={mine ? '#fff' : colors.text} />
          <View>
            <Text style={{ color: mine ? '#fff' : colors.text, fontWeight: '600' }}>Voice Note</Text>
            <Text style={{ color: mine ? '#rgba(255,255,255,0.7)' : colors.textSecondary, fontSize: 10 }}>Tap to listen</Text>
          </View>
        </TouchableOpacity>
      );
    } else {
      contentNode = <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 16, lineHeight: 22 }}>{item.content}</Text>;
    }

    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 3 }}>
        {showDate && (
          <View style={{ alignItems: "center", marginVertical: 12 }}>
            <View style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 0.5, borderColor: theme.border }}>
              <Text style={{ color: theme.textMuted, fontFamily: Fonts.sans }}>{dayLabel(curD)}</Text>
            </View>
          </View>
        )}
        <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: 6 }}>
          <View style={{ maxWidth: "75%" }}>
            <View style={{
              backgroundColor: mine ? undefined : theme.surface,
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: mine ? 0 : 0.5,
              borderColor: theme.border
            }}>
              {mine && currentType === 'text' ? (
                <LinearGradient colors={[theme.primary, theme.primary]} style={{ padding: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 16, lineHeight: 22, fontFamily: Fonts.regular }}>{item.content}</Text>
                </LinearGradient>
              ) : (
                <View style={{ padding: currentType === 'text' ? 12 : 8 }}>
                  {currentType === 'text' ? (
                    <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22, fontFamily: Fonts.regular }}>{item.content}</Text>
                  ) : contentNode}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const data = useMemo(() => finalizeUnique(messages), [messages]);

  /* ─────── Render ─────── */
  const headerName = meta?.partnerName || meta?.fullName || meta?.name || paramName || "Direct Message";
  const headerAvatar = meta?.avatar || paramAvatar || undefined;
  const status = meta?.online ? "online" : "";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ✅ FIXED: Header is OUTSIDE KeyboardAvoidingView so it never moves */}
      <View style={{ backgroundColor: colors.headerBg, zIndex: 10 }}>
        <DMHeader
          name={headerName}
          avatar={headerAvatar}
          status={status}
          onPressBack={() => router.back()}
          onPressProfile={() => router.push({ pathname: "/profile/[id]", params: { id: partnerId } } as never)}
          onPressMore={() => { }}
          themeBg={colors.headerBg}
          themeBorder={colors.border}
          dark={isDark}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primaryEnd} />
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={data}
              keyExtractor={msgKey}
              renderItem={renderItem}
              ListHeaderComponent={undefined}
              onEndReachedThreshold={0.2}
              onEndReached={loadOlder}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              contentContainerStyle={{ paddingBottom: Math.max(92, insets.bottom + 60) }}
              showsVerticalScrollIndicator={false}
            />

            {/* Typing Indicator */}
            {partnerTyping && (
              <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
                  {headerName} is typing...
                </Text>
              </View>
            )}

            {/* Composer - Toggle between Recording and Normal */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                paddingBottom: Platform.OS === "ios" ? Math.max(16, insets.bottom) + 8 : 12,
                borderTopWidth: 0.5,
                borderTopColor: colors.border,
                backgroundColor: colors.bg,
              }}
            >
              {isRecording ? (
                // 🔴 Recording UI
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', marginRight: 8 }} />
                    <Text style={{ color: 'red', fontWeight: '600' }}>Recording Audio...</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={cancelRecording}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={stopRecordingAndSend}>
                      <Ionicons name="send" size={24} color={colors.primaryEnd} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // 🔵 Standard UI with Plus Button
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <TouchableOpacity
                    onPress={showAttachmentOptions}
                    disabled={sending}
                    style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center", marginRight: 8, marginBottom: 2, opacity: sending ? 0.5 : 1 }}
                  >
                    <Ionicons name="add-circle" size={34} color={colors.primaryEnd} />
                  </TouchableOpacity>

                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.surface,
                      borderRadius: 24,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      minHeight: 40,
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: theme.border
                    }}
                  >
                    <TextInput
                      value={input}
                      onChangeText={handleTextChange}
                      placeholder="Message"
                      placeholderTextColor={theme.textMuted}
                      style={{
                        color: theme.text,
                        fontSize: 17,
                        maxHeight: 120,
                        paddingTop: 8,
                        paddingBottom: 8,
                        fontFamily: Fonts.regular
                      }}
                      multiline
                      editable={!sending}
                    />
                  </View>

                  {input.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={sendText}
                      disabled={sending}
                      style={{ marginLeft: 8, width: 40, height: 40, borderRadius: 20, overflow: "hidden", opacity: sending ? 0.4 : 1, marginBottom: 2 }}
                    >
                      <LinearGradient
                        colors={[theme.primary, theme.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                      >
                        {sending ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Ionicons name="arrow-up" size={24} color="#fff" />
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}