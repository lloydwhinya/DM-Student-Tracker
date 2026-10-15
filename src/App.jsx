import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
  const [s, setS] = useState({ interviews: [], skills: [], status: 'Enrolled', community_published: false, ...initial })
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
    delete row.cohort_visible
    if (!isAdmin) delete row.community_published
    if (!row.start_date) row.start_date = null
    const { error } = await supabase.from('students').upsert(row)
    setBusy(false)
    if (error) return alert(error.message)
    if (isAdmin) {
      const { error: notesError } = await supabase.from('staff_notes').upsert({ student_id: s.id, notes })
      if (notesError) return alert(notesError.message)
    }
    onDone(true)
  }
  const remove = async () => {
    if (!confirm('Delete this student?')) return
    await supabase.from('students').delete().eq('id', s.id); onDone(true)
  }
  const F = (k, label, props = {}) => <div><label>{label}</label><input value={s[k] || ''} onChange={e => set(k, e.target.value)} {...props} /></div>
  return (
    <form className="panel" onSubmit={save}>
      <div className="row sp"><h2>{initial.created_at ? 'Edit profile' : 'Your profile'}</h2><button type="button" onClick={() => onDone(false)}>Back</button></div>
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
      {isAdmin ? <div className="visibility-setting">
        <label><input type="checkbox" checked={Boolean(s.community_published)} onChange={e => set('community_published', e.target.checked)} /> Publish this student’s name and portfolio to their cohort community</label>
        <p className="mu">Only the name and portfolio link are shared. Publication takes effect when you save, and requires a cohort and portfolio link.</p>
      </div> : <p className="mu">Community publication is managed by an admin. Only your name and portfolio link can be shared with your cohort.</p>}
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

async function getStudents() {
  const { data, error } = await supabase.from('students').select('*').order('name')
  if (error) throw error
  return data || []
}

function StudentCommunity() {
  const [community, setCommunity] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.rpc('get_student_cohort_community')
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw rpcError
        setCommunity(data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="mu">Loading your cohort community…</p>
  if (error) return <p className="err" role="alert">Could not load your cohort community: {error}</p>
  const stats = [
    [community.total_students, 'Students'],
    [community.enrolled_students, 'Enrolled'],
    [community.employed_students, 'Employed'],
  ]
  return <>
    <div className="dashboard-intro">
      <div><h2>Cohort community</h2><p className="mu">A read-only look at your cohort and portfolios approved for sharing by an admin.</p></div>
      <Link className="dashboard-action" to="/student">Back to dashboard</Link>
    </div>
    {community.has_cohort ? <>
      <div className="stats community-stats">
        {stats.map(([count, label]) => <div className="stat" key={label}><b>{count}</b><span>{label}</span></div>)}
      </div>
      <section className="dashboard-panel community-panel">
        <h3>Peer portfolios</h3>
        <p className="mu">Only each peer’s name and portfolio link are shown. Peers without a portfolio link are not listed.</p>
        {community.peers.length ? <div className="community-peers">
          {community.peers.map((peer, index) => <article className="community-peer" key={`${peer.name}-${index}`}>
            <b>{peer.name}</b>
            <button type="button" onClick={() => setSelected(peer)}>View profile</button>
          </article>)}
        </div> : <p className="mu">No peers have opted to share a portfolio yet.</p>}
      </section>
    </> : <section className="empty-state"><b>Your cohort is not set yet.</b><p>Update your profile with your cohort to see its community statistics and shared portfolios.</p><Link to="/student/profile">Update your profile</Link></section>}
    {selected && <div className="community-modal-backdrop" onClick={() => setSelected(null)}>
      <section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="peer-profile-title" onClick={e => e.stopPropagation()}>
        <div className="row sp"><h2 id="peer-profile-title">Peer profile</h2><button type="button" aria-label="Close profile" onClick={() => setSelected(null)}>Close</button></div>
        <p><b>{selected.name}</b></p>
        <a className="card-link" href={link(selected.portfolio)} target="_blank" rel="noopener noreferrer">Open portfolio</a>
      </section>
    </div>}
  </>
}

function AdminDashboard() {
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getStudents()
      .then(setList)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = list.flatMap(student => (student.interviews || [])
    .filter(interview => interview.date >= today && interview.outcome !== 'Rejected')
    .map(interview => ({ ...interview, studentName: student.name })))
    .sort((a, b) => a.date.localeCompare(b.date))
  const cohorts = [...new Set(list.map(student => (student.cohort || '').trim()))]
    .sort((a, b) => {
      if (!a) return b ? 1 : 0
      if (!b) return -1
      const aYear = /^\d{4}$/.test(a)
      const bYear = /^\d{4}$/.test(b)
      if (aYear && bYear) return Number(b) - Number(a)
      if (aYear) return -1
      if (bYear) return 1
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
  const employed = list.filter(student => student.status === 'Employed').length
  if (loading) return <p className="mu">Loading dashboard…</p>
  if (error) return <p className="err" role="alert">Could not load dashboard: {error}</p>
  return <>
    <div className="dashboard-intro">
      <div><h2>Admin dashboard</h2><p className="mu">A live overview of student progress and upcoming interviews.</p></div>
      <Link className="dashboard-action" to="/admin/students">Manage students</Link>
    </div>
    <div className="stats dashboard-stats">
      <div className="stat"><b>{list.length}</b><span>Total students</span></div>
      <div className="stat"><b>{upcoming.length}</b><span>Upcoming interviews</span></div>
      <div className="stat"><b>{employed}</b><span>Employed</span></div>
      <div className="stat"><b>{list.length ? `${Math.round(employed / list.length * 100)}%` : '–'}</b><span>Employment rate</span></div>
    </div>
    <div className="dashboard-columns">
      <section className="dashboard-panel">
        <h3>Students by status</h3>
        <div className="dashboard-list">
          {STATUSES.map(status => <div className="dashboard-list-row" key={status}><span>{status}</span><b>{list.filter(student => student.status === status).length}</b></div>)}
        </div>
      </section>
      <section className="dashboard-panel">
        <h3>Students by cohort</h3>
        {cohorts.length ? <div className="dashboard-list">
          {cohorts.map(cohort => <div className="dashboard-list-row" key={cohort || 'unassigned'}><span>{cohort ? `${cohort} Cohort` : 'Cohort not set'}</span><b>{list.filter(student => (student.cohort || '').trim() === cohort).length}</b></div>)}
        </div> : <p className="mu">No cohort information has been added yet.</p>}
      </section>
      <section className="dashboard-panel dashboard-interviews">
        <h3>Upcoming interviews</h3>
        {upcoming.length ? <div className="dashboard-list">
          {upcoming.slice(0, 6).map((interview, index) => <div className="interview-row" key={`${interview.studentName}-${interview.date}-${index}`}>
            <div><b>{interview.studentName}</b><span>{interview.company || 'Interview'}{interview.role ? ` · ${interview.role}` : ''}</span></div>
            <time dateTime={interview.date}>{interview.date}</time>
          </div>)}
        </div> : <p className="mu">No upcoming interviews recorded.</p>}
      </section>
    </div>
  </>
}

function AdminManagement() {
  const [list, setList] = useState([]); const [q, setQ] = useState(''); const [fs, setFs] = useState(''); const [fc, setFc] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const load = () => getStudents().then(setList).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  if (editing) return <StudentForm initial={editing} isAdmin onDone={d => { setEditing(null); d && load() }} />
  const cohortOf = s => (s.cohort || '').trim()
  const compareCohorts = (a, b) => {
    if (!a) return b ? 1 : 0
    if (!b) return -1
    const aIsYear = /^\d{4}$/.test(a)
    const bIsYear = /^\d{4}$/.test(b)
    if (aIsYear && bIsYear) return Number(b) - Number(a)
    if (aIsYear) return -1
    if (bIsYear) return 1
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }
  const today = new Date().toISOString().slice(0, 10)
  const emp = list.filter(s => s.status === 'Employed').length
  const ready = list.filter(s => s.status !== 'Enrolled').length
  const upcoming = list.flatMap(s => s.interviews || []).filter(i => i.date >= today && i.outcome !== 'Rejected').length
  const cohorts = [...new Set(list.map(cohortOf).filter(Boolean))].sort(compareCohorts)
  const shown = list.filter(s => (!fs || s.status === fs) && (!fc || cohortOf(s) === fc) && (!q || JSON.stringify(s).toLowerCase().includes(q.toLowerCase())))
  const groups = new Map()
  shown.forEach(s => {
    const cohort = cohortOf(s)
    if (!groups.has(cohort)) groups.set(cohort, [])
    groups.get(cohort).push(s)
  })
  const shownGroups = [...groups.entries()].sort(([a], [b]) => compareCohorts(a, b))
  return (<>
    <div className="dashboard-intro">
      <div><h2>Manage students</h2><p className="mu">Search, filter, add, and update student records.</p></div>
      <Link className="dashboard-action" to="/admin">Back to dashboard</Link>
    </div>
    {error && <p className="err" role="alert">Could not load students: {error}</p>}
    <div className="stats">{[[list.length, 'Students'], [list.filter(s => s.status === 'Interviewing').length, 'Interviewing'], [upcoming, 'Upcoming interviews'], [emp, 'Employed'], [ready ? Math.round(emp / ready * 100) + '%' : '–', 'Placement rate']].map(([n, l]) => <div className="stat" key={l}><b>{n}</b><span>{l}</span></div>)}</div>
    <div className="row admin-toolbar"><input style={{ flex: 1, minWidth: 180 }} placeholder="Search name, skill, employer, cohort" value={q} onChange={e => setQ(e.target.value)} />
      <select style={{ width: 'auto' }} value={fs} onChange={e => setFs(e.target.value)}><option value="">All statuses</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</select>
      <select aria-label="Filter by cohort" style={{ width: 'auto' }} value={fc} onChange={e => setFc(e.target.value)}><option value="">All cohorts</option>{cohorts.map(x => <option key={x} value={x}>{x} Cohort</option>)}</select>
      <button className="p" onClick={() => setEditing({ id: crypto.randomUUID(), user_id: null })}>Add student</button></div>
    {shownGroups.map(([cohort, students]) => <section className="cohort-section" key={cohort || 'unassigned'}>
      <h2 className="cohort-heading">{cohort ? `${cohort} Cohort` : 'Cohort not set'}<span>{students.length}</span></h2>
      <div className="grid">
        {students.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })).map(s => <div className="card" key={s.id} onClick={() => setEditing(s)}>
          <div className="row">{photoUrl(s.photo_path) ? <img className="av" src={photoUrl(s.photo_path)} alt="" /> : <div className="av">{initials(s.name)}</div>}
            <div><b>{s.name}</b><div className="mu">{s.email}</div></div></div>
          <span className={`tag ${s.community_published ? 'community-published' : 'community-unpublished'}`}>{s.community_published ? 'Published to cohort' : 'Not published'}</span>
          <span className={`tag status-tag status-${s.status.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{s.status}</span>{(s.skills || []).map(k => <span className="tag" key={k}>{k}</span>)}
          {s.employer && <div className="mu" style={{ marginTop: 8 }}>{s.job_title} {s.job_title && 'at'} {s.employer}</div>}
          <div className="mu card-links" style={{ marginTop: 6 }}>
            {s.portfolio && <a className="card-link" href={link(s.portfolio)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>Portfolio</a>}
            {s.linkedin && <a href={link(s.linkedin)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>LinkedIn </a>}
            {s.cv_path && <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); openCv(s.cv_path) }}>CV</a>}</div>
        </div>)}
      </div>
    </section>)}
    {!shown.length && <p className="mu empty-state">No students match. Add your first student with the button above.</p>}
  </>)
}

function Student({ user, editProfile = false }) {
  const [rec, setRec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const load = () => supabase.from('students').select('*').eq('user_id', user.id).maybeSingle()
    .then(r => {
      if (r.error) throw r.error
      setRec(r.data || { id: crypto.randomUUID(), user_id: user.id, email: user.email })
    })
  useEffect(() => {
    load().catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [user.id])
  if (loading) return <p className="mu">Loading your dashboard…</p>
  if (error) return <p className="err" role="alert">Could not load your profile: {error}</p>
  if (editProfile) return <StudentForm key={rec.id} initial={rec} onDone={saved => {
    if (saved) navigate('/student', { state: { profileSaved: true } })
    else navigate('/student')
  }} />
  const missing = [
    !rec.name?.trim() && 'name',
    !rec.cohort?.trim() && 'cohort',
    !rec.goal?.trim() && 'career goal',
    !rec.skills?.length && 'skills',
  ].filter(Boolean)
  return <>
    {location.state?.profileSaved && <div className="success-banner" role="status">Your profile was saved successfully.</div>}
    <div className="dashboard-intro">
      <div><h2>Student dashboard</h2><p className="mu">Your profile and career progress at a glance.</p></div>
      <div className="row"><Link className="dashboard-action" to="/student/profile">My profile</Link><Link className="dashboard-action" to="/student/community">Cohort community</Link></div>
    </div>
    {missing.length > 0 && <section className="profile-prompt">
      <div><h3>Complete your profile</h3><p>Add your {missing.join(', ')} to give your profile a fuller picture.</p></div>
      <Link className="dashboard-action" to="/student/profile">Finish profile</Link>
    </section>}
    <section className="student-overview">
      <div className="student-overview-heading">
        {photoUrl(rec.photo_path) ? <img className="av" src={photoUrl(rec.photo_path)} alt="" /> : <div className="av">{initials(rec.name)}</div>}
        <div><h2>{rec.name || 'Welcome'}</h2><span className={`tag status-tag status-${(rec.status || 'Enrolled').toLowerCase().replace(/[^a-z]+/g, '-')}`}>{rec.status || 'Enrolled'}</span></div>
      </div>
      <div className="dashboard-detail-grid">
        <div><span className="detail-label">Cohort</span><b>{rec.cohort || 'Not set'}</b></div>
        <div><span className="detail-label">Career goal</span><b>{rec.goal || 'Not set'}</b></div>
        <div className="student-skills"><span className="detail-label">Skills</span><div>{rec.skills?.length ? rec.skills.map(skill => <span className="tag" key={skill}>{skill}</span>) : <span className="mu">No skills added yet.</span>}</div></div>
        <div><span className="detail-label">Portfolio</span>{rec.portfolio ? <a className="card-link" href={link(rec.portfolio)} target="_blank" rel="noopener noreferrer">View portfolio</a> : <span className="mu">Not added yet</span>}</div>
      </div>
    </section>
    <p className="student-profile-link"><Link to="/student/profile">Update your profile</Link></p>
  </>
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
            <NavLink end to="/admin">Dashboard</NavLink>
            <NavLink to="/admin/students">Manage students</NavLink>
          </> : <>
            <span className="nav-heading">Workspace</span>
            <NavLink end to="/student">Dashboard</NavLink>
            <NavLink to="/student/community">Cohort community</NavLink>
            <NavLink to="/student/profile">My profile</NavLink>
          </>}
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
          <Route path="/admin" element={role === 'admin' ? <AdminDashboard /> : <Navigate to="/student" replace />} />
          <Route path="/admin/students" element={role === 'admin' ? <AdminManagement /> : <Navigate to="/student" replace />} />
          <Route path="/student" element={role === 'student' ? <Student user={session.user} /> : <Navigate to="/admin" replace />} />
          <Route path="/student/community" element={role === 'student' ? <StudentCommunity /> : <Navigate to="/admin" replace />} />
          <Route path="/student/profile" element={role === 'student' ? <Student user={session.user} editProfile /> : <Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>}
      </main>
    </div>
  )
}
