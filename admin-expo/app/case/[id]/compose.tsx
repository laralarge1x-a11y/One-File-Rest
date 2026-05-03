import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { useTemplates } from "@/api/queries";
import { api } from "@/api/client";
import { colors } from "@/theme/colors";

export default function Compose() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = Number(id);
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const { data: templates } = useTemplates();
  const qc = useQueryClient();

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ case_id: caseId, content: text, template_id: templateId }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["case", caseId, "messages"] });
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  const aiSuggest = async () => {
    setAiBusy(true);
    try {
      const r = await api<{ reply?: string; text?: string }>("/api/ai/generate-appeal", {
        method: "POST",
        body: JSON.stringify({ case_id: caseId }),
      });
      const suggestion = r.reply || r.text || "";
      if (suggestion) setText(suggestion);
    } catch {}
    setAiBusy(false);
  };

  const attach = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    try {
      await api("/api/evidence", {
        method: "POST",
        body: JSON.stringify({
          case_id: caseId,
          file_name: a.fileName || "photo.jpg",
          file_type: a.mimeType || "image/jpeg",
          base64: a.base64,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["case", caseId, "evidence"] });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await api("/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        case_id: caseId,
        file_name: a.fileName || "camera.jpg",
        file_type: "image/jpeg",
        base64: a.base64,
      }),
    });
    qc.invalidateQueries({ queryKey: ["case", caseId, "evidence"] });
  };

  return (
    <Screen edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            backgroundColor: colors.bgDeep,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              color: colors.textBright,
              fontWeight: "700",
              fontSize: 17,
              marginLeft: 12,
            }}
          >
            Reply
          </Text>
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={{
              backgroundColor: text.trim() ? colors.accent : colors.bgInput,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 8,
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={aiSuggest}
          style={{
            margin: 12,
            padding: 12,
            backgroundColor: "rgba(254,231,92,0.12)",
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          {aiBusy ? (
            <ActivityIndicator color={colors.warn} />
          ) : (
            <Ionicons name="sparkles" size={16} color={colors.warn} />
          )}
          <Text style={{ color: colors.warn, fontWeight: "600" }}>
            {aiBusy ? "Generating…" : "AI: suggest a reply"}
          </Text>
        </Pressable>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type your reply…"
          placeholderTextColor={colors.muted}
          multiline
          autoFocus
          style={{
            flex: 1,
            color: colors.textBright,
            padding: 14,
            fontSize: 15,
            textAlignVertical: "top",
          }}
        />

        {templates && templates.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, paddingVertical: 8 }}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          >
            {templates.map((t: any) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTemplateId(t.id);
                  setText(t.content || t.body || "");
                  Haptics.selectionAsync();
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor:
                    templateId === t.id ? colors.accent : colors.bgPanel,
                }}
              >
                <Text
                  style={{
                    color: templateId === t.id ? "#fff" : colors.text,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {t.name || t.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View
          style={{
            flexDirection: "row",
            gap: 16,
            padding: 12,
            backgroundColor: colors.bgDeep,
          }}
        >
          <Pressable onPress={attach}>
            <Ionicons name="image" size={24} color={colors.muted} />
          </Pressable>
          <Pressable onPress={fromCamera}>
            <Ionicons name="camera" size={24} color={colors.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
