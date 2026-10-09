import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    if (!googleKey) return Response.json({ error: "Google Maps routing is not configured on the server." }, { status: 503 });
    const authorization = req.headers.get("Authorization");
    if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    if (!body?.job_id) return Response.json({ error: "job_id is required" }, { status: 400 });

    const { data: job, error: jobError } = await userClient.from("jobs")
      .select("id,customer_id,professional_id,status")
      .eq("id", body.job_id).maybeSingle();
    if (jobError) throw jobError;
    if (!job || (job.customer_id !== user.id && job.professional_id !== user.id)) {
      return Response.json({ error: "Job not found or access denied." }, { status: 404 });
    }
    if (!["worker_accepted", "on_the_way", "arrived", "work_started"].includes(job.status)) {
      return Response.json({ error: "Route ETA is available only while the job is active." }, { status: 409 });
    }
    const [{ data: liveRows, error: liveError }, { data: privateData, error: locationError }] = await Promise.all([
      userClient.rpc("get_job_live_location", { p_job_id: job.id }),
      userClient.rpc("get_job_contact_and_location", { p_job_id: job.id })
    ]);
    if (liveError) throw liveError;
    if (locationError) throw locationError;
    const origin = liveRows?.[0];
    const destination = privateData?.service_location;
    const valid = (p: any) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) &&
      Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180;
    if (!valid(origin) || !valid(destination)) {
      return Response.json({ error: "Professional live location or service location is not available yet." }, { status: 409 });
    }

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
