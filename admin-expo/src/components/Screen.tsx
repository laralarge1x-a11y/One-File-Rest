import { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/theme/colors";

export function Screen({
  children,
  style,
  edges = ["top"],
}: {
  children: ReactNode;
  style?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
}) {
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>
    </SafeAreaView>
  );
}
