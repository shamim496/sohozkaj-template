import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// AsyncStorage is async, so every persisted store rehydrates on a later tick —
// read `useStore.persist.hasHydrated()` before gating navigation on it,
// otherwise a logged-in user flashes the login screen on cold start.
export const nativeStorage = createJSONStorage(() => AsyncStorage);

export default AsyncStorage;
