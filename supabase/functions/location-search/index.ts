import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

function clean(value: unknown): string {
  return String(value || "").trim().replace(/\\s+/g, " ");
}
function dedupe(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter(x => {
    if (!Number.isFinite(Number(x.latitude)) || !Number.isFinite(Number(x.longitude)) || !clean(x.label)) return false;
    const key = Number(x.latitude).toFixed(4) + ":" + Number(x.longitude).toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
async function openStreetMapSearch(query: string) {
  const variants = [
    query + ", Gomti Nagar, Lucknow, Uttar Pradesh, India",
    query + ", Lucknow, Uttar Pradesh, India",
    query + ", Uttar Pradesh, India",
    query + ", India"
  ];
  const output: any[] = [];
  // Photon is fast and supports neighbourhood-level search. Bias results to
  // the Lucknow/Raebareli region without restricting users elsewhere in India.
  for (const q of variants.slice(0, 3)) {
    try {
      const url = "https://photon.komoot.io/api/?limit=10&lang=en&lat=26.8467&lon=80.9462&zoom=5&q=" + encodeURIComponent(q);
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const data = await response.json();
      for (const feature of data?.features || []) {
        const coords = feature?.geometry?.coordinates;
        const p = feature?.properties || {};
        if (!Array.isArray(coords)) continue;
        const locality = clean(p.locality || p.name || p.district || p.city || p.county || query);
        const state = clean(p.state);
        const city = clean(p.city || p.district);
        const label = [locality, city && city !== locality ? city : "", state, "India"].filter(Boolean).join(", ");
        const detail = [p.name, p.street, p.district, p.city, p.state, "India"].map(clean).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(", ");
        output.push({ latitude: Number(coords[1]), longitude: Number(coords[0]), label, detail: detail || label, manual: true });
      }
      if (output.length >= 3) break;
    } catch {}
  }
  // Nominatim fallback, called sequentially to respect its public rate limits.
  if (output.length < 2) {
    for (const q of variants) {
      try {
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=in&accept-language=en&q=" + encodeURIComponent(q);
        const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "KAMPRO/1.0 location search" }, signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const data = await response.json();
        for (const item of Array.isArray(data) ? data : []) {
          const a = item.address || {};
          const locality = clean(a.neighbourhood || a.suburb || a.quarter || a.city_district || a.city || a.town || a.village || item.name || query);
          const city = clean(a.city || a.town || a.county);
          const state = clean(a.state);
          const label = [locality, city && city !== locality ? city : "", state, "India"].filter(Boolean).join(", ");
          output.push({ latitude: Number(item.lat), longitude: Number(item.lon), label, detail: clean(item.display_name) || label, manual: true });
        }
        if (output.length) break;
      } catch {}
    }
  }
  return dedupe(output);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const query = clean(body?.query);
    if (query.length < 2 || query.length > 160) return json({ suggestions: [] });

    if (googleKey) {
      try {
        const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey,
            "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text" },
          body: JSON.stringify({ input: query, includedRegionCodes: ["in"], languageCode: "en", regionCode: "IN", includeQueryPredictions: false }),
          signal: AbortSignal.timeout(6500)
        });
        if (response.ok) {
          const data = await response.json();
          const predictions = (data?.suggestions || []).map((x: any) => x?.placePrediction).filter((x: any) => x?.placeId).slice(0, 6);
          const rows = await Promise.all(predictions.map(async (p: any) => {
            try {
              const detail = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(p.placeId), {
                headers: { "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "location,displayName,formattedAddress" },
                signal: AbortSignal.timeout(5000)
              });
              if (!detail.ok) return null;
              const d = await detail.json();
              return { latitude: Number(d?.location?.latitude), longitude: Number(d?.location?.longitude),
                label: clean(p?.structuredFormat?.mainText?.text || d?.displayName?.text || p?.text?.text),
                detail: clean(p?.structuredFormat?.secondaryText?.text || d?.formattedAddress), manual: true };
            } catch { return null; }
          }));
          const result = dedupe(rows.filter(Boolean));
          if (result.length) return json({ suggestions: result, provider: "google" });
        }
      } catch {}
    }
    const suggestions = await openStreetMapSearch(query);
    return json({ suggestions, provider: "openstreetmap" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Location search failed", suggestions: [] }, 500);
  }
});
