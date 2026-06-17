import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { requireUser } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTERNAL_SUPABASE_URL = 'https://ezdtulcrqzmgocamjwwl.supabase.co'

function normalizeSecret(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
  if (jwt?.[0]) return jwt[0]
  const secretKey = trimmed.match(/sb_secret_[A-Za-z0-9_-]+/)
  if (secretKey?.[0]) return secretKey[0]
  return trimmed.includes('=') ? trimmed.split('=').pop()?.trim().replace(/^['"]|['"]$/g, '') ?? trimmed : trimmed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const auth = await requireUser(req, corsHeaders, { role: 'admin' })
  if (!auth.ok) return auth.response

  try {
    const serviceKey = normalizeSecret(Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '')
    if (!serviceKey) {
      throw new Error('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY não configurada')
    }

    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, serviceKey)

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

    if (error) throw error

    return new Response(
      JSON.stringify({ users: users.users.map((u: any) => ({ id: u.id, email: u.email })) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
