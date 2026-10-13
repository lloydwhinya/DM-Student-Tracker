import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './supabase'

const SKILLS = ['SEO','Paid Ads','Social Media','Email Marketing','Content','Analytics','Copywriting','CRO / Web']
const STATUSES = ['Enrolled','Job-ready','Interviewing','Employed','Freelancing','Alumni']
const OUTCOMES = ['Scheduled','Awaiting result','Offer','Rejected']
const ADMIN_EMAIL = 'lloydwhinya98@gmail.com'
const initials = n => (n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()
const photoUrl = p => p ? supabase.storage.from('photos').getPublicUrl(p).data.publicUrl : null
const link = u => (u && !/^https?:\/\//i.test(u) ? 'https://' + u : u)

async function openCv(path) {
  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(path, 60)
  if (error) return alert(error.message)
  window.open(data.signedUrl, '_blank', 'noopener')
}

function Auth() {
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [msg, setMsg] = useState({})
  const submit = async e => {
    e.preventDefault(); setMsg({})
    if (mode === 'admin' && email.trim().toLowerCase() !== ADMIN_EMAIL) {
      setMsg({ err: 'Admin account creation is not enabled for this email.' })
      return
    }
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (error) setMsg({ err: error.message })
    else if (mode === 'admin') setMsg({ ok: 'Account created. Confirm your email before signing in; admin access is granted after confirmation.' })
    else if (mode === 'up') setMsg({ ok: 'Account created. Check your email to confirm it if asked, then sign in.' })
  }
  const reset = async () => {
    if (!email) return setMsg({ err: 'Enter your email first.' })
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setMsg(error ? { err: error.message } : { ok: 'Password reset link sent.' })
  }
  return (
    <form className="auth" onSubmit={submit}>
      <h1>{mode === 'in' ? 'Sign in' : mode === 'admin' ? 'Create admin account' : 'Create your account'}</h1>
      <p className="mu">Digital Marketing Student Tracker</p>
      <label htmlFor="auth-email">Email</label><input id="auth-email" type="email" required readOnly={mode === 'admin'} value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="auth-password">Password</label>
      <div className="password-control">
        <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="p" type="submit">{mode === 'in' ? 'Sign in' : mode === 'admin' ? 'Create admin account' : 'Create account'}</button>
        {mode !== 'in' && <button type="button" onClick={() => { setMode('in'); setMsg({}) }}>Have an account? Sign in</button>}
        {mode === 'in' && <button type="button" onClick={() => { setMode('up'); setMsg({}) }}>New student? Sign up</button>}
        {mode !== 'admin' && <button type="button" onClick={() => { setEmail(ADMIN_EMAIL); setMode('admin'); setMsg({}) }}>Create admin account</button>}
      </div>
      {mode === 'in' && <p><button type="button" onClick={reset} style={{ border: 0, padding: 0, background: 'none', color: 'var(--ac)' }}>Forgot password?</button></p>}
      {msg.err && <div className="err">{msg.err}</div>}{msg.ok && <div className="ok">{msg.ok}</div>}
    </form>
  )
}

function StudentForm({ initial, isAdmin, onDone }) {
  const [s, setS] = useState({ interviews: [], skills: [], status: 'Enrolled', ...initial })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setS(p => ({ ...p, [k]: v }))
  useEffect(() => {
    if (isAdmin && initial.created_at)
      supabase.from('staff_notes').select('notes').eq('student_id', initial.id).maybeSingle().then(r => setNotes(r.data?.notes || ''))
  }, [])
  const upload = async (bucket, key, file) => {
    if (!file) return
    const folder = isAdmin ? s.id : s.user_id
    const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) return alert('Upload failed: ' + error.message)
    set(key, path)
  }
  const setIv = (i, k, v) => set('interviews', s.interviews.map((x, n) => n === i ? { ...x, [k]: v } : x))
  const save = async e => {
    e.preventDefault(); setBusy(true)
    const { created_at, ...row } = s
    if (!row.start_date) row.start_date = null
    const { error } = await supabase.from('students').upsert(row)
    if (!error && isAdmin) await supabase.from('staff_notes').upsert({ student_id: s.id, notes })
    setBusy(false)
    error ? alert(error.message) : onDone(true)
  }
  const remove = async () => {
    if (!confirm('Delete this student?')) return
    await supabase.from('students').delete().eq('id', s.id); onDone(true)
  }
  const F = (k, label, props = {}) => <div><label>{label}</label><input value={s[k] || ''} onChange={e => set(k, e.target.value)} {...props} /></div>
  return (
    <form className="panel" onSubmit={save}>
      <div className="row sp"><h2>{initial.created_at ? 'Edit profile' : 'Your profile'}</h2>{isAdmin && <button type="button" onClick={() => onDone(false)}>Back</button>}</div>
      <div className="row">
        {photoUrl(s.photo_path) ? <img className="av" src={photoUrl(s.photo_path)} alt="" /> : <div className="av">{initials(s.name)}</div>}
        <div style={{ flex: 1 }}><label>Photo</label><input type="file" accept="image/*" onChange={e => upload('photos', 'photo_path', e.target.files[0])} /></div>
      </div>
      <div className="two">{F('name', 'Full name *', { required: true })}{F('cohort', 'Cohort / intake')}{F('email', 'Email')}{F('phone', 'Phone / WhatsApp')}
        <div><label>Status</label><select value={s.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>{F('goal', 'Career goal')}</div>
      <h3>Skills</h3>
      <div className="chk">{SKILLS.map(k => <label key={k}><input type="checkbox" checked={s.skills.includes(k)} onChange={e => set('skills', e.target.checked ? [...s.skills, k] : s.skills.filter(x => x !== k))} />{k}</label>)}</div>
      {F('tools', 'Tools known (GA4, Meta Ads, Semrush…)')}{F('certs', 'Certifications')}
      <h3>Portfolio and CV</h3>
      <div className="two">{F('portfolio', 'Portfolio link')}{F('linkedin', 'LinkedIn')}</div>
      <label>CV (PDF) {s.cv_path && <button type="button" onClick={() => openCv(s.cv_path)} style={{ padding: '2px 8px' }}>Open current CV</button>}</label>
      <input type="file" accept="application/pdf" onChange={e => upload('cvs', 'cv_path', e.target.files[0])} />
      <h3>Employment</h3>
      <div className="two">{F('employer', 'Employer')}{F('job_title', 'Job title')}{F('start_date', 'Start date', { type: 'date' })}{F('clients', 'Freelance clients')}</div>
      <h3>Interviews</h3>
      {s.interviews.map((i, n) => (
        <div className="iv" key={n}>
          <input placeholder="Company" value={i.company || ''} onChange={e => setIv(n, 'company', e.target.value)} />
          <input placeholder="Role" value={i.role || ''} onChange={e => setIv(n, 'role', e.target.value)} />
          <input type="date" value={i.date || ''} onChange={e => setIv(n, 'date', e.target.value)} />
          <select value={i.outcome || 'Scheduled'} onChange={e => setIv(n, 'outcome', e.target.value)}>{OUTCOMES.map(o => <option key={o}>{o}</option>)}</select>
          <button type="button" aria-label="Remove interview" onClick={() => set('interviews', s.interviews.filter((_, x) => x !== n))}>✕</button>
        </div>))}
      <button type="button" onClick={() => set('interviews', [...s.interviews, { outcome: 'Scheduled' }])}>Add interview</button>
      {isAdmin && <><label>Instructor notes (students cannot see these)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} /></>}
      <div className="row sp" style={{ marginTop: 20 }}>
        <div>{isAdmin && initial.created_at && <button type="button" className="d" onClick={remove}>Delete student</button>}</div>
        <button className="p" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  )
}

function Admin() {
  const [list, setList] = useState([]); const [q, setQ] = useState(''); const [fs, setFs] = useState('')
  const [editing, setEditing] = useState(null)
  const load = () => supabase.from('students').select('*').order('name').then(r => setList(r.data || []))
  useEffect(() => { load() }, [])
  if (editing) return <StudentForm initial={editing} isAdmin onDone={d => { setEditing(null); d && load() }} />
  const today = new Date().toISOString().slice(0, 10)
  const emp = list.filter(s => s.status === 'Employed').length
  const ready = list.filter(s => s.status !== 'Enrolled').length
  const upcoming = list.flatMap(s => s.interviews || []).filter(i => i.date >= today && i.outcome !== 'Rejected').length
  const shown = list.filter(s => (!fs || s.status === fs) && (!q || JSON.stringify(s).toLowerCase().includes(q.toLowerCase())))
  return (<>
    <div className="stats">{[[list.length, 'Students'], [list.filter(s => s.status === 'Interviewing').length, 'Interviewing'], [upcoming, 'Upcoming interviews'], [emp, 'Employed'], [ready ? Math.round(emp / ready * 100) + '%' : '–', 'Placement rate']].map(([n, l]) => <div className="stat" key={l}><b>{n}</b><span>{l}</span></div>)}</div>
    <div className="row admin-toolbar"><input style={{ flex: 1, minWidth: 180 }} placeholder="Search name, skill, employer, cohort" value={q} onChange={e => setQ(e.target.value)} />
      <select style={{ width: 'auto' }} value={fs} onChange={e => setFs(e.target.value)}><option value="">All statuses</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</select>
      <button className="p" onClick={() => setEditing({ id: crypto.randomUUID(), user_id: null })}>Add student</button></div>
    <div className="grid">
      {shown.map(s => <div className="card" key={s.id} onClick={() => setEditing(s)}>
        <div className="row">{photoUrl(s.photo_path) ? <img className="av" src={photoUrl(s.photo_path)} alt="" /> : <div className="av">{initials(s.name)}</div>}
          <div><b>{s.name}</b><div className="mu">{s.cohort} {s.email}</div></div></div>
        <span className={`tag status-tag status-${s.status.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{s.status}</span>{(s.skills || []).map(k => <span className="tag" key={k}>{k}</span>)}
        {s.employer && <div className="mu" style={{ marginTop: 8 }}>{s.job_title} {s.job_title && 'at'} {s.employer}</div>}
        <div className="mu card-links" style={{ marginTop: 6 }}>
          {s.portfolio && <a className="card-link" href={link(s.portfolio)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>Portfolio</a>}
          {s.linkedin && <a href={link(s.linkedin)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>LinkedIn </a>}
          {s.cv_path && <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); openCv(s.cv_path) }}>CV</a>}</div>
      </div>)}
    </div>
    {!shown.length && <p className="mu empty-state">No students match. Add your first student with the button above.</p>}
  </>)
}

function Student({ user }) {
  const [rec, setRec] = useState(null); const [saved, setSaved] = useState(false)
  const load = () => supabase.from('students').select('*').eq('user_id', user.id).maybeSingle()
    .then(r => setRec(r.data || { id: crypto.randomUUID(), user_id: user.id, email: user.email }))
  useEffect(() => { load() }, [])
  if (!rec) return <p className="mu">Loading…</p>
  return <>{saved && <div className="ok">Saved.</div>}<StudentForm key={rec.id + saved} initial={rec} onDone={() => { setSaved(true); load() }} /></>
}

export default function App() {
  const [session, setSession] = useState(undefined); const [role, setRole] = useState(null)
  const location = useLocation()
  useEffect(() => {
    supabase.auth.getSession().then(r => setSession(r.data.session))
    const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    setRole(null)
    if (session) supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(r => setRole(r.data?.role || 'student'))
  }, [session?.user.id])
  if (session === undefined) return null
  if (!session) return <Auth />
  const homePath = role === 'admin' ? '/admin' : '/student'
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark">ST</span><span>Student Tracker</span></div>
        <div className="sidebar-caption">Marketing learning community</div>
        <nav className="view-nav" aria-label="Main navigation">
          {role === 'admin' ? <>
            <span className="nav-heading">Workspace</span>
            <NavLink to="/admin">Admin</NavLink>
            <NavLink to="/student">Student view</NavLink>
          </> : <NavLink to="/student">My profile</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-email">{session.user.email}</span>
          <button className="sidebar-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="page-heading"><h1>Student Tracker</h1></header>
        {role === null ? <p className="mu">Loading…</p> : <Routes location={location}>
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route path="/admin" element={role === 'admin' ? <Admin /> : <Navigate to="/student" replace />} />
          <Route path="/student" element={<Student user={session.user} />} />
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>}
      </main>
    </div>
  )
}
