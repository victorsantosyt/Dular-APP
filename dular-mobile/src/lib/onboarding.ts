import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONBOARDING_KEY = "@dular:onboarding_seen";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function getOnboardingSeenValue(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ONBOARDING_KEY);
  } catch {
    return null;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  } catch {}
}

export async function resetOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {}
}

export function shouldResetOnboardingInDev(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_RESET_ONBOARDING === "true";
}
