import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

const LOCK_AFTER_MS = 30 * 60 * 1000;

export function useBiometricLock(enabled: boolean) {
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background" || state === "inactive") {
        backgroundedAt.current = Date.now();
      } else if (state === "active") {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since && Date.now() - since > LOCK_AFTER_MS) {
          const has = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (has && enrolled) setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Elite Tok Admin",
      fallbackLabel: "Use passcode",
    });
    if (r.success) setLocked(false);
  };

  return { locked, unlock };
}
