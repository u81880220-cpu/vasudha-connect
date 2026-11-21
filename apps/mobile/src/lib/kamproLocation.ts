import AsyncStorage from "@react-native-async-storage/async-storage";

export type KamproLocation = {
  latitude: number;
  longitude: number;
  label: string;
  manual: boolean;
};

const STORAGE_KEY = "kampro:selected-location:v1";
let cachedLocation: KamproLocation | null = null;

export async function getKamproLocation(): Promise<KamproLocation | null> {
  if (cachedLocation) return cachedLocation;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as KamproLocation;
    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || !value.label) return null;
    cachedLocation = value;
    return value;
  } catch {
    return null;
  }
}

export async function setKamproLocation(value: KamproLocation): Promise<void> {
  cachedLocation = value;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep the in-memory selection for the current app session if storage is unavailable.
  }
}

export function peekKamproLocation(): KamproLocation | null {
  return cachedLocation;
}
