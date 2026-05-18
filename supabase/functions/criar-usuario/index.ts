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
    const { email, password, modules } = await req.json()
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email e password são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!serviceKey) {
      throw new Error('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY não configurada')
    }

    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, serviceKey)

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) throw error

    const userId = data.user?.id
    if (userId && Array.isArray(modules) && modules.length > 0) {
      const inserts = modules.map((m: string) => ({ user_id: userId, module: m }))
      const { error: modErr } = await supabaseAdmin.from('user_modules').insert(inserts)
      if (modErr) throw modErr
    }

    return new Response(
      JSON.stringify({ user: { id: userId, email } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
