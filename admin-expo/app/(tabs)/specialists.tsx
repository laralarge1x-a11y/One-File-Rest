import { FlatList, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/Avatar";
import { useSpecialists } from "@/api/queries";
import { colors } from "@/theme/colors";

export default function SpecialistsScreen() {
  const { data } = useSpecialists();
  const specialists = data || [];
  return (
    <Screen edges={[]}>
      {specialists.length === 0 ? (
        <EmptyState title="No team members" />
      ) : (
        <FlatList
          data={specialists}
          keyExtractor={(s) => s.discord_id}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.bgDeep,
              }}
            >
              <Avatar
                discordId={item.discord_id}
                avatar={item.discord_avatar}
                username={item.name}
                online={item.online}
                size={44}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textBright, fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.role} {item.timezone ? `· ${item.timezone}` : ""}
                </Text>
              </View>
              {item.win_rate != null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.ok, fontWeight: "700" }}>{item.win_rate}%</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>win rate</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </Screen>
  );
}
