import { View, Text, Pressable } from "react-native";
import { useSession } from "@/auth/session";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";

export default function Blocked() {
  const { user, signOut } = useSession();
  return (
    <Screen edges={["top", "bottom"]}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          backgroundColor: colors.bgDeep,
        }}
      >
        <Text style={{ fontSize: 56, marginBottom: 12 }}>🚫</Text>
        <Text
          style={{ color: colors.textBright, fontSize: 22, fontWeight: "700", marginBottom: 8 }}
        >
          Staff access only
        </Text>
        <Text style={{ color: colors.muted, textAlign: "center", marginBottom: 24 }}>
          {user?.discord_username
            ? `Hi ${user.discord_username}, your Discord account isn't on the staff list.`
            : "Your account isn't on the staff list."}
          {"\n"}Ask an owner to grant you a role.
        </Text>
        <Pressable
          onPress={signOut}
          style={{
            backgroundColor: colors.bgInput,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.textBright, fontWeight: "600" }}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
