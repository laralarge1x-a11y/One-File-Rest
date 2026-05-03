import { View, Text, Pressable } from "react-native";
import { Screen } from "@/components/Screen";
import { useSession } from "@/auth/session";
import { Avatar } from "@/components/Avatar";
import { api } from "@/api/client";
import { colors } from "@/theme/colors";

export default function SettingsScreen() {
  const { user, signOut } = useSession();
  return (
    <Screen edges={[]}>
      <View style={{ padding: 20, alignItems: "center" }}>
        <Avatar
          discordId={user?.discord_id}
          avatar={user?.discord_avatar}
          username={user?.discord_username}
          size={80}
        />
        <Text
          style={{
            color: colors.textBright,
            fontWeight: "700",
            fontSize: 20,
            marginTop: 12,
          }}
        >
          {user?.discord_username}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {user?.role?.replace(/_/g, " ").toUpperCase()}
        </Text>
      </View>

      <View style={{ padding: 16, gap: 8 }}>
        <Pressable
          onPress={async () => {
            try {
              await api("/api/devices/test", { method: "POST" });
            } catch {}
          }}
          style={{
            padding: 14,
            backgroundColor: colors.bgPanel,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: colors.textBright, fontWeight: "600" }}>
            Send test push notification
          </Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={{
            padding: 14,
            backgroundColor: colors.danger,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
