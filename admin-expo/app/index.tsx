import { Redirect } from "expo-router";

export default function Index() {
  // Route guard in _layout.tsx will replace this with /login or /(tabs)/queue
  // depending on session. This file just gives expo-router a root index entry.
  return <Redirect href="/(tabs)/queue" />;
}
