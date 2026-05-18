import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTERNAL_SUPABASE_URL = 'https://ezdtulcrqzmgocamjwwl.supabase.co'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
