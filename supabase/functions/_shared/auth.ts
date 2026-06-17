// Shared auth helpers for edge functions.
// Validates the Authorization header against the external Supabase project
// and (optionally) verifies the caller has a specific role via user_roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const EXTERNAL_SUPABASE_URL = "https://ezdtulcrqzmgocamjwwl.supabase.co";

function normalizeSecret(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwt?.[0]) return jwt[0];
  const sk = trimmed.match(/sb_secret_[A-Za-z0-9_-]+/);
  if (sk?.[0]) return sk[0];
  return trimmed;
}

export type AuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: Response };

export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: { role?: string } = {},
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  // Use the service role to look up the user from the token. We avoid trusting
  // the caller-provided anon key alone.
  const serviceKey = normalizeSecret(
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "",
  );

  if (!serviceKey) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Server auth not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  const admin = createClient(EXTERNAL_SUPABASE_URL, serviceKey);
  const { data: userData, error } = await admin.auth.getUser(token);

  if (error || !userData?.user) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (opts.role) {
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", opts.role)
      .maybeSingle();

    if (!roleRow) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      };
    }
  }

  return { ok: true, userId: userData.user.id, email: userData.user.email ?? null };
}
