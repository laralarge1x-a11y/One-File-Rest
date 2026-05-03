import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { CaseRow } from "@/components/CaseRow";
import { EmptyState } from "@/components/EmptyState";
import { useQueue, type QueueCase } from "@/api/queries";
import { api } from "@/api/client";
import { getSocket } from "@/realtime/socket";
import { colors } from "@/theme/colors";

const LANES = [
  { key: "hot", label: "Hot", icon: "flame" as const, color: colors.danger },
  { key: "stalled", label: "Stalled", icon: "time" as const, color: colors.warn },
  { key: "in_flight", label: "In-Flight", icon: "rocket" as const, color: colors.accent },
  { key: "my_queue", label: "Mine", icon: "person" as const, color: colors.ok },
  { key: "snoozed", label: "Snoozed", icon: "moon" as const, color: colors.muted },
];

export default function QueueScreen() {
  const [lane, setLane] = useState<string>("hot");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { data, isLoading, refetch, isRefetching } = useQueue();
  const qc = useQueryClient();

  // Live updates via socket — invalidate queue on case/message events.
  useEffect(() => {
    let s: any;
    let cancelled = false;
    (async () => {
      s = await getSocket();
      if (cancelled) return;
      const refreshAll = () => qc.invalidateQueries({ queryKey: ["admin", "queue"] });
      s.on("case:status_changed", refreshAll);
      s.on("case:created", refreshAll);
      s.on("message:new", refreshAll);
    })();
    return () => {
      cancelled = true;
      if (s) {
        s.off("case:status_changed");
        s.off("case:created");
        s.off("message:new");
      }
    };
  }, [qc]);

  const cases: QueueCase[] = useMemo(
    () => ((data as any)?.[lane] ?? []) as QueueCase[],
    [data, lane]
  );
  const counts = data?.counts || ({} as Record<string, number>);
  const selecting = selected.size > 0;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulk = async (action: string, value: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await api("/api/admin/cases/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: [...selected], action, value }),
    });
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin", "queue"] });
  };

  return (
    <Screen edges={[]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
        style={{ backgroundColor: colors.bgDeep, flexGrow: 0 }}
      >
        {LANES.map((l) => {
          const active = lane === l.key;
          const count = counts[l.key] ?? 0;
          return (
            <Pressable
              key={l.key}
              onPress={() => {
                Haptics.selectionAsync();
                setLane(l.key);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? colors.accent : colors.bgPanel,
              }}
            >
              <Ionicons name={l.icon} size={14} color={active ? "#fff" : l.color} />
              <Text
                style={{
                  color: active ? "#fff" : colors.text,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {l.label}
              </Text>
              {count > 0 && (
                <View
                  style={{
                    backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.bgInput,
                    paddingHorizontal: 6,
                    borderRadius: 999,
                    minWidth: 18,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : colors.text,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : cases.length === 0 ? (
        <EmptyState
          title="All clear"
          hint="No cases in this lane right now. Pull down to refresh."
        />
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <CaseRow
              c={item}
              selected={selected.has(item.id)}
              selecting={selecting}
              onLongPress={() => toggle(item.id)}
              onToggleSelect={() => toggle(item.id)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={{ paddingBottom: selecting ? 80 : 16 }}
        />
      )}

      {selecting && (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            backgroundColor: colors.bgDeep,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: colors.accent,
          }}
        >
          <Text style={{ color: colors.textBright, fontWeight: "700" }}>
            {selected.size} selected
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() =>
              bulk("snooze", new Date(Date.now() + 24 * 3600 * 1000).toISOString())
            }
            style={{
              backgroundColor: colors.bgInput,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600" }}>Snooze 24h</Text>
          </Pressable>
          <Pressable
            onPress={() => bulk("priority", "critical")}
            style={{
              backgroundColor: colors.danger,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Critical</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(new Set())}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
