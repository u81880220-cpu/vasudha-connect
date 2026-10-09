import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    if (!googleKey) return Response.json({ error: "Google Maps routing is not configured on the server." }, { status: 503 });
    const body = await req.json();
    const origin = body?.origin;
    const destination = body?.destination;
    const valid = (p: any) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) &&
      Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180;
    if (!valid(origin) || !valid(destination)) return Response.json({ error: "Valid origin and destination coordinates are required." }, { status: 400 });
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey, "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline" },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: Number(origin.latitude), longitude: Number(origin.longitude) } } },
        destination: { location: { latLng: { latitude: Number(destination.latitude), longitude: Number(destination.longitude) } } },
        travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "en-IN", units: "METRIC"
      })
    });
    const data = await response.json();
    if (!response.ok) return Response.json({ error: "Google Routes API request failed", details: data }, { status: 502 });
    const route = data?.routes?.[0];
    if (!route) return Response.json({ error: "No driving route found." }, { status: 404 });
    const seconds = Number(String(route.duration || "0s").replace("s", ""));
    return Response.json({ distance_meters: route.distanceMeters, distance_km: Number((Number(route.distanceMeters) / 1000).toFixed(2)), duration_seconds: seconds, duration_minutes: Math.ceil(seconds / 60), encoded_polyline: route.polyline?.encodedPolyline || null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to calculate route" }, { status: 500 });
  }
});
