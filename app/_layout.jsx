import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Toaster } from '../src/components/Toast';
import { COLOR } from '../src/constants/theme';
import { useLangStore } from '../src/i18n';
import { setCurrentPath } from '../src/lib/navigation';
import { useAuthStore } from '../src/store/authStore';
import { useSettingsStore } from '../src/store/settingsStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Every persisted store the first paint depends on. */
const GATES = [useAuthStore, useSettingsStore, useLangStore];

export default function RootLayout() {
  const pathname = usePathname();

  // The session, the "has this person seen onboarding" flag and the chosen
  // language all live in AsyncStorage, so they arrive a tick after the first
  // render. Holding the splash until every one has landed is what stops a
  // returning user seeing the login screen — or the onboarding they already
  // dismissed, or a screen of Bengali they switched away from — flash past on
  // every cold start.
  const [hydrated, setHydrated] = useState(() => GATES.every((s) => s.persist.hasHydrated()));

  useEffect(() => {
    if (hydrated) return undefined;
    const check = () => {
      if (GATES.every((s) => s.persist.hasHydrated())) setHydrated(true);
    };
    const unsubscribers = GATES.map((store) => store.persist.onFinishHydration(check));
    // Rehydration can finish between the initial read above and this subscribe.
    check();
    return () => unsubscribers.forEach((off) => off?.());
  }, [hydrated]);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  // The API client redirects an expired session to the login screen and needs to
  // know where the user was; it cannot use a hook, so the path is pushed to it.
  useEffect(() => setCurrentPath(pathname), [pathname]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLOR.page },
          }}
        />
        <Toaster />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
