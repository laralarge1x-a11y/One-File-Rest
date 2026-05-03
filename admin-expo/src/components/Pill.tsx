import { View, Text } from "react-native";
import { colors, priorityColor, statusLabel } from "@/theme/colors";

export function StatusPill({ status }: { status: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: colors.bgInput,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

export function PriorityDot({ priority }: { priority?: string }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: priorityColor(priority),
      }}
    />
  );
}
