import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/EmptyState";
import { useNotifications } from "@/api/queries";
import { api } from "@/api/client";
import { colors } from "@/theme/colors";

export default function NotificationsScreen() {
  const { data, refetch } = useNotifications();
  const qc = useQueryClient();
  const items = data?.notifications || [];

  return (
    <Screen edges={[]}>
      <View
        style={{
          flexDirection: "row",
          padding: 12,
          backgroundColor: colors.bgDeep,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.textBright, fontWeight: "700", fontSize: 18, flex: 1 }}>
          Inbox {data?.unread ? `· ${data.unread}` : ""}
        </Text>
        <Pressable
          onPress={async () => {
            await api("/api/notifications/read-all", { method: "POST" });
            qc.invalidateQueries({ queryKey: ["notifications"] });
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: "600" }}>Mark all read</Text>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" hint="No notifications right now." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          onRefresh={refetch}
          refreshing={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={async () => {
                await api(`/api/notifications/${item.id}/read`, { method: "PATCH" });
                qc.invalidateQueries({ queryKey: ["notifications"] });
                if (item.case_id) router.push(`/case/${item.case_id}`);
              }}
              style={({ pressed }) => ({
                padding: 14,
                backgroundColor: pressed ? colors.bgPanel : "transparent",
                borderBottomWidth: 1,
                borderBottomColor: colors.bgDeep,
                opacity: item.is_read ? 0.6 : 1,
              })}
            >
              <Text style={{ color: colors.textBright, fontWeight: "600", marginBottom: 2 }}>
                {item.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={2}>
                {item.message}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
