import "../global.css";
import { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { View, Text, Pressable } from "react-native";
import { useSession, isStaff } from "@/auth/session";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { colors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

function RouteGuard() {
  const { user, loading, refresh } = useSession();
  const segments = useSegments();

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "login" || segments[0] === "blocked";
    if (!user && !inAuth) router.replace("/login");
    else if (user && !isStaff(user) && segments[0] !== "blocked") router.replace("/blocked");
    else if (user && isStaff(user) && inAuth) router.replace("/(tabs)/queue");
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [user, loading, segments]);

  return null;
}

function BiometricGate({ children }: { children: React.ReactNode }) {
  const user = useSession((s) => s.user);
  const { locked, unlock } = useBiometricLock(!!user && isStaff(user));
  if (!locked) return <>{children}</>;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgDeep,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <Text
        style={{ color: colors.textBright, fontSize: 22, fontWeight: "700", marginBottom: 8 }}
      >
        Locked
      </Text>
      <Text style={{ color: colors.muted, marginBottom: 24, textAlign: "center" }}>
        For your security, unlock to continue.
      </Text>
      <Pressable
        onPress={unlock}
        style={{
          backgroundColor: colors.accent,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Unlock</Text>
      </Pressable>
    </View>
  );
}

function PushBoot() {
  usePushRegistration();
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RouteGuard />
          <PushBoot />
          <BiometricGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bgDeep },
                headerTintColor: colors.textBright,
                contentStyle: { backgroundColor: colors.bg },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="blocked" options={{ headerShown: false }} />
              <Stack.Screen
                name="case/[id]"
                options={{ title: "Case", presentation: "card" }}
              />
              <Stack.Screen
                name="case/[id]/compose"
                options={{ title: "Reply", presentation: "modal" }}
              />
            </Stack>
          </BiometricGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
