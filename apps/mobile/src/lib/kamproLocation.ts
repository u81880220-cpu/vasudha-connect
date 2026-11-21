import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

export type KamproLocation = {
  latitude: number;
  longitude: number;
  label: string;
  manual: boolean;
};
export type LocationSuggestion = KamproLocation & { detail: string };

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
  } catch { return null; }
}

export async function setKamproLocation(value: KamproLocation): Promise<void> {
  cachedLocation = value;
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
}

export function peekKamproLocation(): KamproLocation | null { return cachedLocation; }

function cleanLabel(parts: unknown[]): string {
  return [...new Set(parts.map(x => String(x || "").trim()).filter(Boolean))].join(", ");
}

function fromPhoton(feature: any, fallback: string): LocationSuggestion | null {
  const coords = feature?.geometry?.coordinates;
  const p = feature?.properties || {};
  if (!Array.isArray(coords) || !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return null;
  const locality = p.locality || p.name || p.district || p.city || p.county || fallback;
  const label = cleanLabel([locality, p.district !== locality ? p.district : "", p.city !== locality ? p.city : "", p.state, p.country || "India"]);
  return { latitude: Number(coords[1]), longitude: Number(coords[0]), label: label || fallback, detail: cleanLabel([p.name, p.street, p.district, p.city, p.state, p.country]) || fallback, manual: true };
}

function fromNominatim(p: any, fallback: string): LocationSuggestion | null {
  if (!Number.isFinite(Number(p?.lat)) || !Number.isFinite(Number(p?.lon))) return null;
  const a = p.address || {};
  const locality = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.city || a.town || a.village || a.county || p.name || fallback;
  const label = cleanLabel([locality, a.city && a.city !== locality ? a.city : "", a.state, a.country || "India"]);
  return { latitude: Number(p.lat), longitude: Number(p.lon), label: label || fallback, detail: String(p.display_name || label || fallback), manual: true };
}

const searchCache = new Map<string, { at: number; rows: LocationSuggestion[] }>();
const searchInFlight = new Map<string, Promise<LocationSuggestion[]>>();
const SEARCH_CACHE_MS = 5 * 60 * 1000;

async function fetchJson(url: string, timeoutMs = 3500): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error("Location search unavailable");
    return await response.json();
  } finally { clearTimeout(timer); }
}

function rankSuggestions(rows: LocationSuggestion[], query: string): LocationSuggestion[] {
  const tokens = query.toLocaleLowerCase().split(/[\\s,]+/).filter(Boolean);
  return dedupe(rows).sort((a, b) => {
    const score = (x: LocationSuggestion) => {
      const label = (x.label + " " + x.detail).toLocaleLowerCase();
      const exact = label.includes(query.toLocaleLowerCase()) ? 100 : 0;
      const matched = tokens.filter(token => label.includes(token)).length * 12;
      const locality = /khand|nagar|colony|sector|vihar|puram|marg|road|locality/i.test(x.label) ? 5 : 0;
      const india = /india/i.test(label) ? 2 : 0;
      return exact + matched + locality + india;
    };
    return score(b) - score(a);
  }).slice(0, 8);
}

export async function searchKamproLocations(query: string): Promise<LocationSuggestion[]> {
  const q = query.trim().replace(/\\s+/g, " ");
  if (q.length < 3) return [];
  const key = q.toLocaleLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_MS) return cached.rows;
  const pending = searchInFlight.get(key);
  if (pending) return pending;

  const request = (async (): Promise<LocationSuggestion[]> => {
    const photonUrl = "https://photon.komoot.io/api/?limit=12&lang=en&q=" + encodeURIComponent(q + ", India");
    try {
      const data = await fetchJson(photonUrl);
      const rows = rankSuggestions((data?.features || []).map((x: any) => fromPhoton(x, q)).filter(Boolean) as LocationSuggestion[], q);
      if (rows.length) {
        searchCache.set(key, { at: Date.now(), rows });
        return rows;
      }
    } catch {}

    // Secondary providers are used only when the fast primary search has no results.
    // This avoids serial network waits on every keystroke.
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=12&countrycodes=in&q=" + encodeURIComponent(q);
      const data = await fetchJson(url, 4000);
      const rows = rankSuggestions((Array.isArray(data) ? data : []).map((x: any) => fromNominatim(x, q)).filter(Boolean) as LocationSuggestion[], q);
      if (rows.length) {
        searchCache.set(key, { at: Date.now(), rows });
        return rows;
      }
    } catch {}

    try {
      const places = await Location.geocodeAsync(q + ", India");
      const rows = rankSuggestions((places || []).slice(0, 8).map(p => ({
        latitude: p.latitude, longitude: p.longitude, label: q, detail: q + ", India", manual: true
      })), q);
      searchCache.set(key, { at: Date.now(), rows });
      return rows;
    } catch {
      searchCache.set(key, { at: Date.now(), rows: [] });
      return [];
    }
  })();
  searchInFlight.set(key, request);
  try { return await request; }
  finally { searchInFlight.delete(key); }
}

function dedupe(rows: LocationSuggestion[]): LocationSuggestion[] {
  const seen = new Set<string>();
  return rows.filter(x => {
    const key = x.latitude.toFixed(4) + ":" + x.longitude.toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 12);
}

export async function resolveKamproLocation(query: string, suggestions: LocationSuggestion[] = []): Promise<LocationSuggestion> {
  const q = query.trim();
  if (!q) throw new Error("Enter a city, locality or full address.");
  if (suggestions.length) {
    const exact = suggestions.find(x => x.label.toLowerCase() === q.toLowerCase() || x.detail.toLowerCase() === q.toLowerCase());
    return exact || suggestions[0];
  }
  const rows = await searchKamproLocations(q);
  if (rows.length) return rows[0];
  throw new Error("We could not find that place. Check the spelling or try a nearby locality.");
}

export async function getCurrentKamproLocation(): Promise<{ latitude: number; longitude: number; label: string }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Allow location permission in Android settings, or search for your area manually.");
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) throw new Error("Turn on your phone's Location/GPS setting and try again.");
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 1500 }).catch(() => null);
  const position = last || await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GPS is taking too long. Try again or search for your area manually.")), 12000))
  ]);
  const latitude = position.coords.latitude, longitude = position.coords.longitude;
  let label = "Current location";
  try {
    const places = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Reverse geocoding timed out")), 5000))
    ]);
    const p = places?.[0];
    label = cleanLabel([p?.district || p?.subregion || p?.city || p?.region, p?.region, p?.country]) || label;
  } catch {}
  return { latitude, longitude, label };
}
