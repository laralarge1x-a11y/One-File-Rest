import { Image } from "expo-image";
import { View, Text } from "react-native";
import { colors } from "@/theme/colors";

interface Props {
  discordId?: string | null;
  avatar?: string | null;
  username?: string | null;
  size?: number;
  online?: boolean;
}

export function Avatar({ discordId, avatar, username, size = 36, online }: Props) {
  const url =
    avatar && discordId
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`
      : null;
  const letter = (username || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <View style={{ width: size, height: size }}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{letter}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: online ? colors.ok : colors.muted,
            borderWidth: 2,
            borderColor: colors.bgDeep,
          }}
        />
      )}
    </View>
  );
}
