import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function normalizePhone(value: unknown): { digits: string; e164: string } | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 10 ? digits : digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : null;
  return local ? { digits: "91" + local, e164: "+91" + local } : null;
}
function internalEmail(digits: string): string {
  // Reserved .invalid domain: never deliver mail here. This alias is only an Auth login identifier.
  return "m" + digits + "@login.kampro.invalid";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("mobile-login missing required server configuration");
    return json({ error: "Sign-in service is not configured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request body" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const phone = normalizePhone(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  if (!phone) return json({ error: "Enter a valid Indian mobile number" }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "Incorrect mobile number or password" }, 401);

  // Find the existing Auth user by phone. The service-role key stays on the server.
  let matchedUser: Record<string, unknown> | null = null;
  for (let page = 1; page <= 20; page++) {
    let response: Response;
    try {
      response = await fetch(new URL(`/auth/v1/admin/users?page=${page}&per_page=1000`, supabaseUrl), {
        headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
      });
    } catch {
      return json({ error: "Sign-in service is temporarily unavailable" }, 502);
    }
    if (!response.ok) {
      console.error("mobile-login could not look up Auth users", response.status);
      return json({ error: "Sign-in service is temporarily unavailable" }, 502);
    }
    const payload = await response.json();
    const users: unknown[] = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : [];
    matchedUser = users.find((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = normalizePhone((item as Record<string, unknown>).phone);
      return candidate?.digits === phone.digits;
    }) as Record<string, unknown> | undefined ?? null;
    if (matchedUser || users.length < 1000) break;
  }
  if (!matchedUser || typeof matchedUser.id !== "string") {
    return json({ error: "Incorrect mobile number or password" }, 401);
  }

  let loginEmail = typeof matchedUser.email === "string" ? matchedUser.email : "";
  if (!loginEmail) {
    loginEmail = internalEmail(phone.digits);
    let updateResponse: Response;
    try {
      updateResponse = await fetch(new URL(`/auth/v1/admin/users/${matchedUser.id}`, supabaseUrl), {
        method: "PUT",
        headers: { "Content-Type": "application/json", apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
        body: JSON.stringify({
          email: loginEmail,
          email_confirm: true,
          user_metadata: {
            ...((matchedUser.user_metadata && typeof matchedUser.user_metadata === "object") ? matchedUser.user_metadata : {}),
            mobile_login_alias: true,
          },
        }),
      });
    } catch {
      return json({ error: "Could not prepare mobile sign-in. Please try again." }, 502);
    }
    if (!updateResponse.ok) {
      const errorPayload = await updateResponse.json().catch(() => ({}));
      console.error("mobile-login could not prepare Auth alias", updateResponse.status, String(errorPayload?.code || errorPayload?.msg || "").slice(0, 80));
      return json({ error: "Could not prepare mobile sign-in. Please try again." }, 409);
    }
  }

  // Let Supabase Auth validate the password and issue a normal user session.
  let authResponse: Response;
  try {
    authResponse = await fetch(new URL("/auth/v1/token?grant_type=password", supabaseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email: loginEmail, password }),
    });
  } catch {
    return json({ error: "Sign-in service is temporarily unavailable" }, 502);
  }
  const authResult = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok) {
    return json({ error: "Incorrect mobile number or password. Please check your details and try again." }, 401);
  }
  return json({
    access_token: authResult.access_token,
    refresh_token: authResult.refresh_token,
    expires_in: authResult.expires_in,
    token_type: authResult.token_type,
    user: authResult.user,
  });
});
