import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Avatar } from "./Avatar";
import { PriorityDot, StatusPill } from "./Pill";
import { colors } from "@/theme/colors";
import type { QueueCase } from "@/api/queries";

interface Props {
  c: QueueCase;
  selected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  selecting?: boolean;
}

function deadlineLabel(hrs?: number | null) {
  if (hrs == null) return null;
  if (hrs < 0) return `Overdue ${Math.round(-hrs)}h`;
  if (hrs < 24) return `${Math.round(hrs)}h left`;
  return `${Math.round(hrs / 24)}d left`;
}

export function CaseRow({ c, selected, onLongPress, onToggleSelect, selecting }: Props) {
  const dl = deadlineLabel(c.hours_to_deadline);
  return (
    <Pressable
      onPress={() => {
        if (selecting && onToggleSelect) {
          Haptics.selectionAsync();
          onToggleSelect();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/case/${c.id}`);
        }
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: selected
          ? "rgba(88,101,242,0.18)"
          : pressed
            ? colors.bgPanel
            : "transparent",
        borderBottomWidth: 1,
        borderBottomColor: colors.bgDeep,
      })}
    >
      <Avatar
        discordId={c.staff_assigned_id || undefined}
        avatar={c.discord_avatar}
        username={c.discord_username || c.account_username}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <PriorityDot priority={c.priority} />
          <Text
            style={{ color: colors.textBright, fontWeight: "600", flexShrink: 1 }}
            numberOfLines={1}
          >
            @{c.account_username}
          </Text>
          {!!c.unread_client && c.unread_client > 0 && (
            <View
              style={{
                backgroundColor: colors.danger,
                paddingHorizontal: 6,
                borderRadius: 999,
                minWidth: 18,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                {c.unread_client}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {c.violation_type} · {c.discord_username || "—"}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <StatusPill status={c.status} />
        {dl && (
          <Text
            style={{
              color: (c.hours_to_deadline ?? 99) < 24 ? colors.danger : colors.muted,
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            {dl}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
