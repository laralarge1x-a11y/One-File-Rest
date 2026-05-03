import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { StatusPill, PriorityDot } from "@/components/Pill";
import { Avatar } from "@/components/Avatar";
import { useCase, useMessages, useEvidence } from "@/api/queries";
import { api } from "@/api/client";
import { getSocket } from "@/realtime/socket";
import { colors } from "@/theme/colors";

export default function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = Number(id);
  const { data: c, isLoading } = useCase(caseId);
  const { data: messages } = useMessages(caseId);
  const { data: evidence } = useEvidence(caseId);
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Live messages
  useEffect(() => {
    if (!caseId) return;
    let s: any;
    let cancelled = false;
    (async () => {
      s = await getSocket();
      if (cancelled) return;
      s.emit?.("case:join", caseId);
      const onNew = (m: any) => {
        if (m.case_id === caseId) qc.invalidateQueries({ queryKey: ["case", caseId, "messages"] });
      };
      s.on("message:new", onNew);
    })();
    // Mark as read
    api(`/api/messages/read/${caseId}`, { method: "PATCH" }).catch(() => {});
    return () => {
      cancelled = true;
      if (s) s.off("message:new");
    };
  }, [caseId, qc]);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const r = await api<{ summary?: string }>("/api/ai/case-summary", {
        method: "POST",
        body: JSON.stringify({ case_id: caseId }),
      });
      setAiSummary(r.summary || JSON.stringify(r));
    } catch (err: any) {
      setAiSummary(err?.message || "Failed to generate");
    } finally {
      setSummaryLoading(false);
    }
  };

  if (isLoading || !c) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: `@${c.account_username}`,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable
                onPress={() => {
                  setShowSummary(true);
                  if (!aiSummary) generateSummary();
                }}
              >
                <Ionicons name="sparkles" size={22} color={colors.warn} />
              </Pressable>
              <Pressable onPress={() => setShowEvidence(true)}>
                <Ionicons name="images" size={22} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Header */}
      <View
        style={{
          padding: 12,
          backgroundColor: colors.bgDeep,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <PriorityDot priority={c.priority} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textBright, fontWeight: "700" }} numberOfLines={1}>
            {c.violation_type}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            {c.discord_username} · {c.plan || "no plan"}
          </Text>
        </View>
        <StatusPill status={c.status} />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages || []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isStaff = item.sender_type === "staff" || item.sender_type === "admin";
          const isSystem = item.sender_type === "system" || item.sender_type === "ai";
          return (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                alignSelf: isStaff ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}
            >
              {!isStaff && (
                <Avatar
                  discordId={item.sender_discord_id}
                  avatar={item.sender_avatar}
                  username={item.sender_username}
                  size={28}
                />
              )}
              <View
                style={{
                  backgroundColor: isStaff
                    ? colors.accent
                    : isSystem
                      ? colors.bgPanel
                      : colors.bgInput,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14,
                  borderTopLeftRadius: !isStaff ? 4 : 14,
                  borderTopRightRadius: isStaff ? 4 : 14,
                }}
              >
                <Text
                  style={{
                    color: isStaff ? "#fff" : colors.textBright,
                    fontSize: 11,
                    opacity: 0.7,
                    marginBottom: 2,
                  }}
                >
                  {item.sender_username || item.sender_type}
                </Text>
                <Text style={{ color: isStaff ? "#fff" : colors.text }}>{item.content}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: "center", padding: 24 }}>
            No messages yet.
          </Text>
        }
      />

      {/* Composer launcher */}
      <View
        style={{
          padding: 10,
          backgroundColor: colors.bgDeep,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: "#000",
        }}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/case/${caseId}/compose`);
          }}
          style={{
            flex: 1,
            backgroundColor: colors.bgInput,
            borderRadius: 22,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: colors.muted }}>Reply…</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await api(`/api/admin/cases/${caseId}/snooze`, {
              method: "POST",
              body: JSON.stringify({
                until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                reason: "snoozed from app",
              }),
            });
            router.back();
          }}
          style={{
            backgroundColor: colors.bgPanel,
            borderRadius: 22,
            padding: 12,
          }}
        >
          <Ionicons name="moon" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {/* AI Summary bottom sheet */}
      <Modal
        visible={showSummary}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSummary(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={() => setShowSummary(false)}
        />
        <View
          style={{
            backgroundColor: colors.bgPanel,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 18,
            maxHeight: "70%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="sparkles" size={18} color={colors.warn} />
            <Text
              style={{
                color: colors.textBright,
                fontWeight: "700",
                marginLeft: 8,
                flex: 1,
              }}
            >
              AI Summary
            </Text>
            <Pressable onPress={() => setShowSummary(false)}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView>
            {summaryLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={{ color: colors.text, lineHeight: 22 }}>
                {aiSummary || "Tap to generate"}
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Evidence bottom sheet */}
      <Modal
        visible={showEvidence}
        animationType="slide"
        onRequestClose={() => setShowEvidence(false)}
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              padding: 14,
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: colors.bgDeep,
            }}
          >
            <Text
              style={{ flex: 1, color: colors.textBright, fontSize: 17, fontWeight: "700" }}
            >
              Evidence ({evidence?.length || 0})
            </Text>
            <Pressable onPress={() => setShowEvidence(false)}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(evidence || []).map((ev: any) => (
                <Pressable
                  key={ev.id}
                  onPress={() => setLightbox(ev.file_url)}
                  style={{ width: "33%", aspectRatio: 1, padding: 4 }}
                >
                  <Image
                    source={{ uri: ev.thumbnail_url || ev.file_url }}
                    style={{ flex: 1, borderRadius: 6, backgroundColor: colors.bgInput }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
            {(!evidence || evidence.length === 0) && (
              <Text style={{ color: colors.muted, padding: 16, textAlign: "center" }}>
                No evidence uploaded yet.
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!lightbox} transparent onRequestClose={() => setLightbox(null)}>
        <Pressable
          onPress={() => setLightbox(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.95)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {lightbox && (
            <Image
              source={{ uri: lightbox }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
}
