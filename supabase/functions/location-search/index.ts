import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || "").trim().replace(/\s+/g, " ");
    if (query.length < 2 || query.length > 160) return json({ suggestions: [] });
    if (!googleKey) return json({ error: "Google Places is not configured", suggestions: [] }, 503);

    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text"
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["in"],
        languageCode: "en",
        regionCode: "IN",
        includeQueryPredictions: false
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "Places autocomplete request failed", suggestions: [] }, 502);

    const predictions = (data?.suggestions || []).map((item: any) => item?.placePrediction).filter((p: any) => p?.placeId);
    const details = await Promise.all(predictions.slice(0, 8).map(async (p: any) => {
      try {
        const detailResponse = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(p.placeId), {
          headers: {
            "X-Goog-Api-Key": googleKey,
            "X-Goog-FieldMask": "id,location,displayName,formattedAddress"
          }
        });
        if (!detailResponse.ok) return null;
        const detail = await detailResponse.json();
        const latitude = Number(detail?.location?.latitude);
        const longitude = Number(detail?.location?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const label = String(p?.structuredFormat?.mainText?.text || detail?.displayName?.text || p?.text?.text || "").trim();
        const address = String(p?.structuredFormat?.secondaryText?.text || detail?.formattedAddress || "").trim();
        return { latitude, longitude, label, detail: address || label, manual: true };
      } catch { return null; }
    }));
    const seen = new Set<string>();
    const suggestions = details.filter((x: any) => {
      if (!x?.label) return false;
      const key = x.latitude.toFixed(5) + ":" + x.longitude.toFixed(5);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return json({ suggestions });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Location search failed", suggestions: [] }, 500);
  }
});
