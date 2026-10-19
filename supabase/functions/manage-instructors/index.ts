import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Instructor management is not configured on the server.' }, 500)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in as the owner to manage instructors.' }, 401)
  const token = authorization.slice('Bearer '.length)
  const callerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: caller, error: callerError } = await callerClient.auth.getUser(token)
  if (callerError || !caller.user) return json({ error: 'Your sign-in is invalid or expired.' }, 401)

  const { data: callerProfile, error: profileError } = await serviceClient
    .from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle()
  if (profileError) return json({ error: profileError.message }, 500)
  if (callerProfile?.role !== 'owner' || !callerProfile.active) return json({ error: 'Only the active owner can manage instructor accounts.' }, 403)

  let body: { action?: string; email?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  if (body.action === 'list') {
    const { data: profiles, error: listError } = await serviceClient
      .from('profiles').select('id, active').eq('role', 'instructor').order('id')
    if (listError) return json({ error: listError.message }, 500)
    const instructors = []
    for (const profile of profiles || []) {
      const { data, error } = await serviceClient.auth.admin.getUserById(profile.id)
      if (error) return json({ error: error.message }, 500)
      instructors.push({ id: profile.id, email: data.user.email || '', active: profile.active })
    }
    return json({ instructors })
  }

  if (body.action === 'invite') {
    const email = body.email?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid instructor email address.' }, 400)

    let existingUser: { id: string; email?: string } | null = null
    for (let page = 1; !existingUser; page++) {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return json({ error: error.message }, 500)
      existingUser = data.users.find(user => user.email?.toLowerCase() === email) || null
      if (existingUser || data.users.length < 1000) break
    }
    if (existingUser) {
      const { data: existingProfile, error: existingProfileError } = await serviceClient
        .from('profiles').select('role').eq('id', existingUser.id).maybeSingle()
      if (existingProfileError) return json({ error: existingProfileError.message }, 500)
      if (existingProfile?.role === 'instructor') return json({ error: 'This email already has an instructor account. Use the access control below to restore it if deactivated.' }, 409)
      return json({ error: 'This email already belongs to an account. Student and other existing accounts cannot be converted into instructors.' }, 409)
    }

    const siteUrl = Deno.env.get('SITE_URL')
    const { data: invitation, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      ...(siteUrl ? { redirectTo: `${siteUrl.replace(/\/$/, '')}/instructor/sign-in?invite=1` } : {}),
    })
    if (inviteError) {
      const alreadyRegistered = /already (registered|exists)|user exists/i.test(inviteError.message)
      return json({ error: alreadyRegistered
        ? 'This email already belongs to an account. Student and other existing accounts cannot be converted into instructors.'
        : inviteError.message }, 400)
    }
    if (!invitation.user) return json({ error: 'Supabase did not return the invited account.' }, 502)

    const { error: activateError } = await serviceClient.from('profiles')
      .update({ role: 'instructor', active: true }).eq('id', invitation.user.id)
    if (activateError) return json({ error: `The invitation was sent, but instructor access could not be assigned: ${activateError.message}` }, 500)
    return json({ invited: true })
  }

  if (body.action === 'activate' || body.action === 'deactivate') {
    if (!body.userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)) {
      return json({ error: 'A valid instructor account ID is required.' }, 400)
    }
    const { data: instructor, error: instructorError } = await serviceClient
      .from('profiles').select('role, active').eq('id', body.userId).maybeSingle()
    if (instructorError) return json({ error: instructorError.message }, 500)
    if (instructor?.role !== 'instructor') return json({ error: 'Only instructor accounts can be activated or deactivated.' }, 403)

    const activating = body.action === 'activate'
    const { error: authError } = await serviceClient.auth.admin.updateUserById(body.userId, {
      ban_duration: activating ? 'none' : '876000h',
    })
    if (authError) return json({ error: authError.message }, 500)
    const { error: updateError } = await serviceClient.from('profiles')
      .update({ active: activating }).eq('id', body.userId)
    if (updateError) return json({ error: updateError.message }, 500)
    return json({ active: activating })
  }

  return json({ error: 'Unsupported instructor management action.' }, 400)
})
