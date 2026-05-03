import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/auth/session";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";

export default function Login() {
  const { signIn, loading, error } = useSession();
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
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800" }}>ET</Text>
        </View>
        <Text
          style={{ color: colors.textBright, fontSize: 26, fontWeight: "800", marginBottom: 6 }}
        >
          Elite Tok Admin
        </Text>
        <Text
          style={{ color: colors.muted, marginBottom: 36, textAlign: "center", fontSize: 14 }}
        >
          Sign in with your Discord account.{"\n"}Staff access only.
        </Text>

        {error && (
          <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>
        )}

        <Pressable
          onPress={signIn}
          disabled={loading}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            backgroundColor: pressed ? colors.accentHover : colors.accent,
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 10,
            opacity: loading ? 0.7 : 1,
          })}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="logo-discord" size={22} color="#fff" />
          )}
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            Continue with Discord
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
