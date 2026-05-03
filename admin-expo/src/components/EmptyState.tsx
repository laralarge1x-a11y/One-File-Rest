import { View, Text } from "react-native";
import { colors } from "@/theme/colors";

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ padding: 32, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16, marginBottom: 4 }}>
        {title}
      </Text>
      {hint && (
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{hint}</Text>
      )}
    </View>
  );
}
