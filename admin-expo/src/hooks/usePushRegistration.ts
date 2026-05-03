import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import { api } from "@/api/client";
import { useSession } from "@/auth/session";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushRegistration() {
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Cases",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#5865F2",
          });
        }

        const perm = await Notifications.getPermissionsAsync();
        let status = perm.status;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted") return;

        const tokenResp = await Notifications.getExpoPushTokenAsync().catch(() => null);
        const token = tokenResp?.data;
        if (!token || cancelled) return;

        await api("/api/devices/register", {
          method: "POST",
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            deviceLabel: Device?.deviceName || `${Platform.OS} device`,
            appVersion: "1.0.0",
          }),
        });
      } catch (err) {
        console.warn("[push] registration failed", err);
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data: any = resp.notification.request.content.data || {};
      const url: string | undefined = data.url;
      const caseId = data.caseId || data.case_id;
      if (caseId) router.push(`/case/${caseId}`);
      else if (url && url.startsWith("/")) router.push(url as any);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [user?.discord_id]);
}
