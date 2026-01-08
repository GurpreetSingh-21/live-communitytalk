// CommunityTalkMobile/components/ChatComposer.tsx
import React, { useState, useCallback, useRef } from "react";
import { View, TextInput, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";

interface ChatComposerProps {
  onSend: (text: string) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  colors: any; // Accept colors from parent
}

export const ChatComposer = React.memo(({ onSend, onTyping, disabled = false, colors }: ChatComposerProps) => {
  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(36);
  const [sending, setSending] = useState(false);
  const typingTimerRef = useRef<any>(null);
  const lastTypingSentRef = useRef(0);

  const handleTextChange = useCallback(
    (text: string) => {
      setInput(text);

      if (onTyping) {
        const now = Date.now();

        // Throttle "typing: true" to at most once every 2s
        if (now - lastTypingSentRef.current > 2000) {
          lastTypingSentRef.current = now;
          onTyping(true);
        }

        // Send "typing: false" after 5s of no changes
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          onTyping(false);
        }, 5000);
      }
    },
    [onTyping]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    setInputHeight(36);

    try {
      await onSend(text);
      if (onTyping) onTyping(false);
    } finally {
      setSending(false);
    }
  }, [input, sending, onSend, onTyping]);

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: Platform.OS === "ios" ? 32 : 12,
        borderTopWidth: 0.5,
        borderTopColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          backgroundColor: colors.inputBg,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 8,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        }}
      >
        <TextInput
          value={input}
          onChangeText={handleTextChange}
          placeholder="Message"
          placeholderTextColor={colors.textSecondary}
          style={{
            color: colors.text,
            fontSize: 17,
            fontFamily: Fonts.regular,
            flex: 1,
            minHeight: 36,
            maxHeight: 100,
            height: Math.max(36, inputHeight),
            paddingVertical: 8,
            textAlignVertical: "top",
          }}
          onContentSizeChange={(e) => {
            const h = e.nativeEvent.contentSize.height;
            setInputHeight(Math.min(100, Math.max(36, h)));
          }}
          editable={!sending && !disabled}
          multiline
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || disabled || input.trim().length === 0}
          style={{
            marginLeft: 8,
            width: 36,
            height: 36,
            borderRadius: 18,
            overflow: "hidden",
            opacity: sending || input.trim().length === 0 ? 0.4 : 1,
          }}
        >
          <LinearGradient
            colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
});

ChatComposer.displayName = "ChatComposer";
