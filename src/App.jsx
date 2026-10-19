import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

const SKILLS = ['SEO', 'Paid Ads', 'Social Media', 'Email Marketing', 'Content', 'Analytics', 'Copywriting', 'CRO / Web']
const STATUSES = ['Enrolled', 'Job-ready', 'Interviewing', 'Employed', 'Freelancing', 'Alumni']
const OUTCOMES = ['Scheduled', 'Awaiting result', 'Offer', 'Rejected']
const initials = name => (name || '?').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
const link = value => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value)

function usePhotoUrl(path) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    if (!path) {
      setUrl('')
      return () => { active = false }
    }
    supabase.storage.from('photos').createSignedUrl(path, 3600).then(({ data, error }) => {
      if (active) setUrl(error ? '' : data.signedUrl)
    })
    return () => { active = false }
  }, [path])
  return url
}

function Avatar({ student }) {
  const url = usePhotoUrl(student.photo_path)
  return url
    ? <img className="av" src={url} alt="" />
    : <div className="av">{initials(student.name)}</div>
}

async function openCv(path) {
  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(path, 60)
  if (error) return alert(error.message)
  window.open(data.signedUrl, '_blank', 'noopener')
}

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState({})
  const [busy, setBusy] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setMessage({})
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setMessage({ error: error.message })
  }

  const reset = async () => {
    if (!email) return setMessage({ error: 'Enter your instructor email first.' })
    const redirectTo = `${window.location.origin}/instructor/sign-in?recovery=1`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setMessage(error ? { error: error.message } : { success: 'Password reset link sent.' })
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Instructor sign in</h1>
      <p className="mu">Private student database</p>
      <label htmlFor="auth-email">Instructor email</label>
      <input id="auth-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
      <label htmlFor="auth-password">Password</label>
      <div className="password-control">
        <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
        <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="p" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" onClick={reset}>Forgot password?</button>
      </div>
      {message.error && <div className="err" role="alert">{message.error}</div>}
      {message.success && <div className="ok" role="status">{message.success}</div>}
    </form>
  )
}

function PasswordSetup({ mode, onDone }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async event => {
    event.preventDefault()
    if (password !== confirmation) return setError('The passwords do not match.')
    setBusy(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) return setError(updateError.message)
    onDone()
  }

  return <form className="auth" onSubmit={submit}>
    <h1>{mode === 'invite' ? 'Set your instructor password' : 'Reset your password'}</h1>
    <p className="mu">{mode === 'invite' ? 'Choose a password to finish setting up your instructor account.' : 'Choose a new password for your instructor account.'}</p>
    <label htmlFor="new-password">New password</label>
    <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
    <label htmlFor="confirm-password">Confirm password</label>
    <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
    {error && <p className="err" role="alert">{error}</p>}
    <button className="p" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
  </form>
}

function StudentForm({ initial, onDone }) {
  const [student, setStudent] = useState({ interviews: [], skills: [], status: 'Enrolled', ...initial })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photoUrl = usePhotoUrl(student.photo_path)
  const set = (key, value) => setStudent(previous => ({ ...previous, [key]: value }))

  useEffect(() => {
    if (!initial.created_at) return
    supabase.from('staff_notes').select('notes').eq('student_id', initial.id).maybeSingle()
      .then(({ data, error: notesError }) => {
        if (notesError) setError(notesError.message)
        else setNotes(data?.notes || '')
      })
  }, [initial.created_at, initial.id])

  const upload = async (bucket, key, file) => {
    if (!file) return
    const path = `${student.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
    if (uploadError) return setError(`Upload failed: ${uploadError.message}`)
    set(key, path)
  }

  const setInterview = (index, key, value) => set('interviews', (student.interviews || []).map((interview, current) => current === index ? { ...interview, [key]: value } : interview))

  const save = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { created_at, ...row } = student
    if (!row.start_date) row.start_date = null
    const { error: studentError } = await supabase.from('students').upsert(row)
    if (studentError) {
      setBusy(false)
      return setError(studentError.message)
    }
    const { error: notesError } = await supabase.from('staff_notes').upsert({ student_id: student.id, notes })
    setBusy(false)
    if (notesError) return setError(notesError.message)
    onDone(true)
  }

  const field = (key, label, props = {}) => <div><label>{label}</label><input value={student[key] || ''} onChange={event => set(key, event.target.value)} {...props} /></div>

  return (
    <form className="panel" onSubmit={save}>
      <div className="row sp"><h2>{initial.created_at ? 'Edit student record' : 'Add student record'}</h2><button type="button" onClick={() => onDone(false)}>Back to students</button></div>
      <div className="row">
        {photoUrl ? <img className="av" src={photoUrl} alt="" /> : <div className="av">{initials(student.name)}</div>}
        <div style={{ flex: 1 }}><label>Photo</label><input type="file" accept="image/*" onChange={event => upload('photos', 'photo_path', event.target.files[0])} /></div>
      </div>
      <div className="two">{field('name', 'Full name *', { required: true })}{field('cohort', 'Cohort / intake')}{field('email', 'Email', { type: 'email' })}{field('phone', 'Phone / WhatsApp')}
        <div><label>Status</label><select value={student.status || 'Enrolled'} onChange={event => set('status', event.target.value)}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></div>{field('goal', 'Career goal')}</div>
      <h3>Skills</h3>
      <div className="chk">{SKILLS.map(skill => <label key={skill}><input type="checkbox" checked={(student.skills || []).includes(skill)} onChange={event => set('skills', event.target.checked ? [...(student.skills || []), skill] : (student.skills || []).filter(item => item !== skill))} />{skill}</label>)}</div>
      {field('tools', 'Tools known (GA4, Meta Ads, Semrush…)')}{field('certs', 'Certifications')}
      <h3>Portfolio and CV</h3>
      <div className="two">{field('portfolio', 'Portfolio link')}{field('linkedin', 'LinkedIn')}</div>
      <label>CV (PDF) {student.cv_path && <button type="button" onClick={() => openCv(student.cv_path)} style={{ padding: '2px 8px' }}>Open current CV</button>}</label>
      <input type="file" accept="application/pdf" onChange={event => upload('cvs', 'cv_path', event.target.files[0])} />
      <h3>Employment</h3>
      <div className="two">{field('employer', 'Employer')}{field('job_title', 'Job title')}{field('start_date', 'Start date', { type: 'date' })}{field('clients', 'Freelance clients')}</div>
      <h3>Interviews</h3>
      {(student.interviews || []).map((interview, index) => (
        <div className="iv" key={index}>
          <input aria-label="Company" placeholder="Company" value={interview.company || ''} onChange={event => setInterview(index, 'company', event.target.value)} />
          <input aria-label="Role" placeholder="Role" value={interview.role || ''} onChange={event => setInterview(index, 'role', event.target.value)} />
          <input aria-label="Interview date" type="date" value={interview.date || ''} onChange={event => setInterview(index, 'date', event.target.value)} />
          <select aria-label="Interview outcome" value={interview.outcome || 'Scheduled'} onChange={event => setInterview(index, 'outcome', event.target.value)}>{OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}</select>
          <button type="button" aria-label="Remove interview" onClick={() => set('interviews', (student.interviews || []).filter((_, current) => current !== index))}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => set('interviews', [...(student.interviews || []), { outcome: 'Scheduled' }])}>Add interview</button>
      <h3>Instructor notes</h3>
      <textarea aria-label="Instructor notes" value={notes} onChange={event => setNotes(event.target.value)} />
      {error && <p className="err" role="alert">{error}</p>}
      <div className="row sp" style={{ marginTop: 20 }}>
        <span className="mu">Student records are retained; deletion is disabled.</span>
        <button className="p" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
      </div>
    </form>
  )
}

async function getStudents() {
  const { data, error } = await supabase.from('students').select('*').order('name')
  if (error) throw error
  return data || []
}

function Dashboard() {
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getStudents().then(setStudents).catch(reason => setError(reason.message)).finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="mu">Loading dashboard…</p>
  if (error) return <p className="err" role="alert">Could not load dashboard: {error}</p>
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = students.flatMap(student => (student.interviews || [])
    .filter(interview => interview.date >= today && interview.outcome !== 'Rejected')
    .map(interview => ({ ...interview, studentName: student.name })))
    .sort((a, b) => a.date.localeCompare(b.date))
  const cohorts = [...new Set(students.map(student => (student.cohort || '').trim()))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const employed = students.filter(student => student.status === 'Employed').length
  return <>
    <div className="dashboard-intro">
      <div><h2>Instructor dashboard</h2><p className="mu">A private overview of student progress and upcoming interviews.</p></div>
      <Link className="dashboard-action" to="/students">Manage student records</Link>
    </div>
    <div className="stats dashboard-stats">
      <div className="stat"><b>{students.length}</b><span>Total students</span></div>
      <div className="stat"><b>{upcoming.length}</b><span>Upcoming interviews</span></div>
      <div className="stat"><b>{employed}</b><span>Employed</span></div>
      <div className="stat"><b>{students.length ? `${Math.round(employed / students.length * 100)}%` : '–'}</b><span>Employment rate</span></div>
    </div>
    <div className="dashboard-columns">
      <section className="dashboard-panel">
        <h3>Students by status</h3>
        <div className="dashboard-list">{STATUSES.map(status => <div className="dashboard-list-row" key={status}><span>{status}</span><b>{students.filter(student => student.status === status).length}</b></div>)}</div>
      </section>
      <section className="dashboard-panel">
        <h3>Students by cohort</h3>
        {cohorts.length ? <div className="dashboard-list">{cohorts.map(cohort => <div className="dashboard-list-row" key={cohort || 'unassigned'}><span>{cohort ? `${cohort} Cohort` : 'Cohort not set'}</span><b>{students.filter(student => (student.cohort || '').trim() === cohort).length}</b></div>)}</div> : <p className="mu">No cohort information has been added yet.</p>}
      </section>
      <section className="dashboard-panel dashboard-interviews">
        <h3>Upcoming interviews</h3>
        {upcoming.length ? <div className="dashboard-list">{upcoming.slice(0, 6).map((interview, index) => <div className="interview-row" key={`${interview.studentName}-${interview.date}-${index}`}><div><b>{interview.studentName}</b><span>{interview.company || 'Interview'}{interview.role ? ` · ${interview.role}` : ''}</span></div><time dateTime={interview.date}>{interview.date}</time></div>)}</div> : <p className="mu">No upcoming interviews recorded.</p>}
      </section>
    </div>
  </>
}

function StudentManagement() {
  const [students, setStudents] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cohortFilter, setCohortFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => getStudents().then(setStudents).catch(reason => setError(reason.message)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  if (editing) return <StudentForm key={editing.id} initial={editing} onDone={saved => { setEditing(null); if (saved) load() }} />
  const cohortOf = student => (student.cohort || '').trim()
  const compareCohorts = (a, b) => {
    if (!a) return b ? 1 : 0
    if (!b) return -1
    const aYear = /^\d{4}$/.test(a)
    const bYear = /^\d{4}$/.test(b)
    if (aYear && bYear) return Number(b) - Number(a)
    if (aYear) return -1
    if (bYear) return 1
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }
  const today = new Date().toISOString().slice(0, 10)
  const employed = students.filter(student => student.status === 'Employed').length
  const ready = students.filter(student => student.status !== 'Enrolled').length
  const upcoming = students.flatMap(student => student.interviews || []).filter(interview => interview.date >= today && interview.outcome !== 'Rejected').length
  const cohorts = [...new Set(students.map(cohortOf).filter(Boolean))].sort(compareCohorts)
  const shown = students.filter(student => (!statusFilter || student.status === statusFilter) && (!cohortFilter || cohortOf(student) === cohortFilter) && (!query || JSON.stringify(student).toLowerCase().includes(query.toLowerCase())))
  const groups = new Map()
  shown.forEach(student => {
    const cohort = cohortOf(student)
    if (!groups.has(cohort)) groups.set(cohort, [])
    groups.get(cohort).push(student)
  })
  const shownGroups = [...groups.entries()].sort(([a], [b]) => compareCohorts(a, b))

  return <>
    <div className="dashboard-intro">
      <div><h2>Manage student records</h2><p className="mu">Search, filter, add, and update private student records.</p></div>
      <Link className="dashboard-action" to="/dashboard">Back to dashboard</Link>
    </div>
    {error && <p className="err" role="alert">Could not load students: {error}</p>}
    {loading ? <p className="mu">Loading student records…</p> : <>
      <div className="stats">{[[students.length, 'Students'], [students.filter(student => student.status === 'Interviewing').length, 'Interviewing'], [upcoming, 'Upcoming interviews'], [employed, 'Employed'], [ready ? `${Math.round(employed / ready * 100)}%` : '–', 'Placement rate']].map(([count, label]) => <div className="stat" key={label}><b>{count}</b><span>{label}</span></div>)}</div>
      <div className="row admin-toolbar">
        <input aria-label="Search students" style={{ flex: 1, minWidth: 180 }} placeholder="Search name, skill, employer, cohort" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Filter by status" style={{ width: 'auto' }} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All statuses</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select>
        <select aria-label="Filter by cohort" style={{ width: 'auto' }} value={cohortFilter} onChange={event => setCohortFilter(event.target.value)}><option value="">All cohorts</option>{cohorts.map(cohort => <option key={cohort} value={cohort}>{cohort} Cohort</option>)}</select>
        <button className="p" onClick={() => setEditing({ id: crypto.randomUUID(), user_id: null, interviews: [], skills: [] })}>Add student</button>
      </div>
      {shownGroups.map(([cohort, groupedStudents]) => <section className="cohort-section" key={cohort || 'unassigned'}>
        <h2 className="cohort-heading">{cohort ? `${cohort} Cohort` : 'Cohort not set'}<span>{groupedStudents.length}</span></h2>
        <div className="grid">{groupedStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })).map(student => <div className="card" key={student.id} onClick={() => setEditing(student)}>
          <div className="row"><Avatar student={student} /><div><b>{student.name}</b><div className="mu">{student.email}</div></div></div>
          <span className={`tag status-tag status-${(student.status || 'Enrolled').toLowerCase().replace(/[^a-z]+/g, '-')}`}>{student.status || 'Enrolled'}</span>
          {(student.skills || []).map(skill => <span className="tag" key={skill}>{skill}</span>)}
          {student.employer && <div className="mu" style={{ marginTop: 8 }}>{student.job_title} {student.job_title && 'at'} {student.employer}</div>}
          <div className="mu card-links" style={{ marginTop: 6 }}>
            {student.portfolio && <a className="card-link" href={link(student.portfolio)} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>Portfolio</a>}
            {student.linkedin && <a href={link(student.linkedin)} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>LinkedIn</a>}
            {student.cv_path && <a href="#" onClick={event => { event.preventDefault(); event.stopPropagation(); openCv(student.cv_path) }}>CV</a>}
          </div>
        </div>)}</div>
      </section>)}
      {!shown.length && <p className="mu empty-state">No students match. Add your first student with the button above.</p>}
    </>}
  </>
}

async function manageInstructors(body) {
  const { data, error } = await supabase.functions.invoke('manage-instructors', { body })
  if (error) {
    if (error.context instanceof Response) {
      const responseBody = await error.context.clone().json().catch(() => null)
      if (responseBody?.error) throw new Error(responseBody.error)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data
}

function InstructorManagement() {
  const [instructors, setInstructors] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = () => manageInstructors({ action: 'list' }).then(result => setInstructors(result.instructors)).catch(reason => setError(reason.message)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const invite = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await manageInstructors({ action: 'invite', email: email.trim() })
      setEmail('')
      setSuccess('Instructor invitation sent. They will set their own password from the email link.')
      await load()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  const setAccess = async instructor => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await manageInstructors({ action: instructor.active ? 'deactivate' : 'activate', userId: instructor.id })
      setSuccess(`${instructor.email} access ${instructor.active ? 'deactivated' : 'restored'}.`)
      await load()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="dashboard-intro">
      <div><h2>Manage instructors</h2><p className="mu">Owner-only controls for instructor invitations and access.</p></div>
      <Link className="dashboard-action" to="/dashboard">Back to dashboard</Link>
    </div>
    <section className="dashboard-panel instructor-invite">
      <h3>Invite an instructor</h3>
      <form className="row" onSubmit={invite}>
        <input aria-label="Instructor email to invite" type="email" required placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} />
        <button className="p" disabled={busy}>{busy ? 'Please wait…' : 'Send invitation'}</button>
      </form>
      <p className="mu">An invitation is sent through Supabase Auth. Instructors cannot invite other accounts or manage owner access.</p>
    </section>
    {error && <p className="err" role="alert">{error}</p>}
    {success && <p className="ok" role="status">{success}</p>}
    <section className="dashboard-panel instructor-list">
      <h3>Instructor accounts</h3>
      {loading ? <p className="mu">Loading instructor accounts…</p> : instructors.length ? <div className="dashboard-list">
        {instructors.map(instructor => <div className="dashboard-list-row" key={instructor.id}>
          <div><b>{instructor.email}</b><div className="mu">{instructor.active ? 'Active' : 'Deactivated'}</div></div>
          <button type="button" className={instructor.active ? 'd' : ''} disabled={busy} onClick={() => setAccess(instructor)}>{instructor.active ? 'Deactivate' : 'Restore access'}</button>
        </div>)}
      </div> : <p className="mu">No instructor accounts have been added.</p>}
    </section>
  </>
}

function AccessDenied({ onSignOut }) {
  return <section className="auth">
    <h1>Instructor access required</h1>
    <p className="mu">This account is not authorized to access the private student database.</p>
    <button className="p" onClick={onSignOut}>Sign out</button>
  </section>
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [roleError, setRoleError] = useState('')
  const [passwordMode, setPasswordMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('invite') ? 'invite' : params.has('recovery') ? 'recovery' : null
  })
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setRoleError(error.message)
      setSession(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordMode('recovery')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setRole(null)
    setRoleError('')
    if (!session) return
    let active = true
    supabase.from('profiles').select('role, active').eq('id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setRoleError(error.message)
        setRole(data?.active && ['owner', 'instructor'].includes(data.role) ? data.role : 'denied')
      })
    return () => { active = false }
  }, [session?.user.id])

  if (session === undefined) return null
  if (!session) return <Routes><Route path="/instructor/sign-in" element={<Auth />} /><Route path="*" element={<Navigate to="/instructor/sign-in" replace />} /></Routes>
  if (roleError) return <main className="main-content"><p className="err" role="alert">Could not verify instructor access: {roleError}</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></main>
  if (role === null) return <p className="mu">Verifying instructor access…</p>
  if (role === 'denied') return <AccessDenied onSignOut={() => supabase.auth.signOut()} />
  if (passwordMode) return <PasswordSetup mode={passwordMode} onDone={() => {
    setPasswordMode(null)
    navigate('/dashboard', { replace: true })
  }} />
  const homePath = '/dashboard'
  const owner = role === 'owner'
  return <div className="app-layout">
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark">ST</span><span>Student Database</span></div>
      <div className="sidebar-caption">Private instructor workspace</div>
      <nav className="view-nav" aria-label="Main navigation">
        <span className="nav-heading">Workspace</span>
        <NavLink end to="/dashboard">Dashboard</NavLink>
        <NavLink to="/students">Manage students</NavLink>
        {owner && <><span className="nav-heading">Owner</span><NavLink to="/instructors">Manage instructors</NavLink></>}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-email">{session.user.email} · {owner ? 'Owner' : 'Instructor'}</span>
        <button className="sidebar-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </aside>
    <main className="main-content">
      <header className="page-heading"><h1>Instructor Student Database</h1></header>
      <Routes location={location}>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students" element={<StudentManagement />} />
        <Route path="/instructors" element={owner ? <InstructorManagement /> : <Navigate to={homePath} replace />} />
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/students" element={<Navigate to="/students" replace />} />
        <Route path="/student/*" element={<Navigate to={homePath} replace />} />
        <Route path="/instructor/sign-in" element={<Navigate to={homePath} replace />} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </main>
  </div>
}
