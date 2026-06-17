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
    const { email, password, modules } = await req.json()
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email e password são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceKey = normalizeSecret(Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '')
    if (!serviceKey) {
      throw new Error('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY não configurada')
    }

    const supabaseAdmin = createClient(EXTERNAL_SUPABASE_URL, serviceKey)

    let { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error && error.message.toLowerCase().includes('already been registered')) {
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (listError) throw listError

      const existingUser = users.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (!existingUser) throw error

      const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      })
      if (updateError) throw updateError
      data = updated
    } else if (error) {
      throw error
    }

    const userId = data.user?.id
    if (userId && Array.isArray(modules)) {
      const { error: deleteErr } = await supabaseAdmin.from('user_modules').delete().eq('user_id', userId)
      if (deleteErr) throw deleteErr

      if (modules.length > 0) {
        const inserts = modules.map((m: string) => ({ user_id: userId, module: m }))
        const { error: modErr } = await supabaseAdmin.from('user_modules').insert(inserts)
        if (modErr) throw modErr
      }
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
