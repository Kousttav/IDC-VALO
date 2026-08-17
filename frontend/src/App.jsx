import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Routes, Route, Link, NavLink, useNavigate, useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ============================================================
   API HELPER
============================================================ */
async function api(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ============================================================
   AUTH CONTEXT
============================================================ */
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('idc_token') || '');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    api('/auth/me', { token })
      .then((d) => setUser(d.user))
      .catch(() => {
        setToken('');
        localStorage.removeItem('idc_token');
      })
      .finally(() => setChecking(false));
  }, [token]);

  const login = async (username, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { username, password } });
    localStorage.setItem('idc_token', d.token);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const logout = () => {
    localStorage.removeItem('idc_token');
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ============================================================
   HELPERS + CONSTANTS
============================================================ */
function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function fmtTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const ROLES = ['Duelist', 'Sentinel', 'Controller', 'Initiator', 'Flex', 'IGL'];
const RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];

/* Bulk-import column contract, kept in one place so the hint text and
   the actual payload never drift apart. */
const IMPORT_COLUMNS = [
  'timestamp', 'email', 'fullName', 'discordUsername', 'age', 'contactNumber', 'dob',
  'languages', 'ignTag', 'preferredServer', 'mainRole', 'secondaryRole',
  'currentRank', 'peakRank', 'trackerLink', 'team', 'pic'
];

/* ============================================================
   LAYOUT
============================================================ */
function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/about', label: 'About' },
    { to: '/roster', label: 'Roster' },
    { to: '/contact', label: 'Contact' },
  ];
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">IDC</span>
          <span className="brand-sub" >Immortal&nbsp;De&nbsp;Campeons</span>
        </Link>
        <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <nav className={`nav-links ${open ? 'is-open' : ''}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active admin-link' : 'admin-link')} onClick={() => setOpen(false)}>
            {user ? 'Panel' : 'Admin'}
          </NavLink>
          {user && <button className="nav-logout" onClick={logout}>Log out</button>}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="brand-mark small">IDC</span>
        <p>ONE CLAN. ONE FILE. NO GHOSTS ON THE ROSTER. © {new Date().getFullYear()} Immortal De Campeons.</p>
      </div>
    </footer>
  );
}

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

/* ============================================================
   HOME PAGE
============================================================ */
function Home() {
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    api('/teams').then(setTeams).catch(() => { });
  }, []);

  return (
    <div>
      <section className="hero">
        <div className="hero-grid-lines" />
        <div className="hero-content">
          <p className="eyebrow">DOSSIER&nbsp;// VALORANT · APAC DIVISION</p>
          <h1>
            EVERY PLAYER
            <br />
            <span className="accent-ember">ON RECORD.</span>
          </h1>
          <p className="hero-copy">
            Immortal De Campeons runs its Valorant rosters like a case file — every player logged,
            ranked, and accountable. Discipline in the draft, discipline on the server.
          </p>
          <div className="hero-actions">
            <Link to="/roster" className="btn btn-primary">Open Roster File</Link>
            <Link to="/about" className="btn btn-ghost">Our Story</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">FILE 01 — ACTIVE SQUADS</p>
        <h2 className="section-title">Active Squads</h2>
        {teams.length === 0 ? (
          <p className="muted">No squads have been published yet — check back soon.</p>
        ) : (
          <div className="team-grid">
            {teams.map((t) => (
              <Link key={t._id} to={`/roster/${t._id}`} className="team-card" style={{ '--tint': t.theme?.primaryColor || '#e6432b' }}>
                <div className="team-card-tab">SQUAD</div>
                {t.logo ? <img src={t.logo} alt={t.name} /> : <div className="team-logo-fallback">{t.name?.[0]}</div>}
                <div className="team-card-body">
                  <h3>{t.name}</h3>
                  <p>{t.tagline || `${t.playerCount} player${t.playerCount === 1 ? '' : 's'}`}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   ABOUT PAGE
============================================================ */
function About() {
  return (
    <section className="section narrow">
      <p className="eyebrow">FILE 00 — WHO WE ARE</p>
      <h1 className="page-title">The Clan Behind the File</h1>
      <p className="lede">
        Immortal De Campeons started as a group chat that couldn't stop scrimming. It's grown into a
        multi-roster Valorant organization built on one rule: talent gets you into the room,
        the paperwork keeps you in it.
      </p>
      <div className="pillar-grid">
        <div className="pillar">
          <span className="pillar-tag">STRUCTURE</span>
          <h3>Every player, logged</h3>
          <p>Shared draft pool, VOD review cadence, and a coaching staff that tracks individual improvement — not just the scoreline.</p>
        </div>
        <div className="pillar">
          <span className="pillar-tag">DEPTH</span>
          <h3>Built, not bought</h3>
          <p>Multiple squads mean players move up when they're ready. The org scouts and develops rather than only buying finished rosters.</p>
        </div>
        <div className="pillar">
          <span className="pillar-tag">IDENTITY</span>
          <h3>The dragon is the standard</h3>
          <p>Show up prepared, play for the crest, and let the scoreboard do the talking.</p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ROSTER — team list
============================================================ */
function RosterList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/teams').then(setTeams).catch(() => { }).finally(() => setLoading(false));
  }, []);

  return (
    <section className="section">
      <p className="eyebrow">FILE 01 — SQUADS</p>
      <h1 className="page-title">Roster</h1>
      {loading ? (
        <p className="muted">Pulling the file…</p>
      ) : teams.length === 0 ? (
        <p className="muted">No teams yet. Add one from the Admin Panel.</p>
      ) : (
        <div className="team-grid">
          {teams.map((t) => (
            <Link key={t._id} to={`/roster/${t._id}`} className="team-card" style={{ '--tint': t.theme?.primaryColor || '#e6432b' }}>
              <div className="team-card-tab">SQUAD</div>
              {t.logo ? <img src={t.logo} alt={t.name} /> : <div className="team-logo-fallback">{t.name?.[0]}</div>}
              <div className="team-card-body">
                <h3>{t.name}</h3>
                <p>{t.playerCount} player{t.playerCount === 1 ? '' : 's'} · {t.region}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   ROSTER — single team + players
============================================================ */
function TeamRoster() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/teams/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <section className="section"><p className="muted">{err}</p></section>;
  if (!data) return <section className="section"><p className="muted">Pulling the file…</p></section>;

  const { team, players } = data;

  return (
    <section className="section" style={{ '--tint': team.theme?.primaryColor || '#e6432b' }}>
      <div className="team-header">
        {team.logo && <img src={team.logo} alt={team.name} className="team-header-logo" />}
        <div>
          <p className="eyebrow">{team.region} · VALORANT ROSTER</p>
          <h1 className="page-title">{team.name}</h1>
          {team.tagline && <p className="lede">{team.tagline}</p>}
        </div>
      </div>

      {players.length === 0 ? (
        <p className="muted">No players filed under this squad yet.</p>
      ) : (
        <div className="player-strip">
          {players.map((p) => (
            <Link key={p._id} to={`/player/${p._id}`} className="player-chip">
              <div className="player-chip-avatar">
                {p.pic ? <img src={p.pic} alt={p.ignTag} /> : <span>{p.ignTag?.[0]}</span>}
              </div>
              <div>
                <strong>{p.ignTag}</strong>
                <span>{p.mainRole}{p.currentRank ? ` · ${p.currentRank}` : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   PLAYER CARD PAGE — dossier ID card, flips front/back
============================================================ */
function DossierRow({ label, value }) {
  return (
    <div className="dossier-row">
      <span className="dossier-key">{label}</span>
      <span className="dossier-val">{value || '—'}</span>
    </div>
  );
}

function PlayerCardPage() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/players/${id}`).then(setPlayer).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <section className="section"><p className="muted">{err}</p></section>;
  if (!player) return <section className="section"><p className="muted">Pulling player file…</p></section>;

  const tint = player.team?.theme?.primaryColor || '#e6432b';

  return (
    <section className="section narrow player-page" style={{ '--tint': tint }}>
      <Link to={player.team ? `/roster/${player.team._id}` : '/roster'} className="back-link">← Back to roster</Link>

      <div className="player-page-grid">
        <div className="card-3d-wrap">
          <div className={`card-3d ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
            <div className="card-face card-front">
              <div className="dossier-stamp">ROSTER FILE</div>
              <div className="card-top">
                {player.team?.logo && <img src={player.team.logo} className="card-team-logo" alt="" />}
                <span className="card-region">{player.preferredServer}</span>
              </div>
              <div className="card-art">
                {player.pic ? (
                  <img src={player.pic} alt={player.ignTag} />
                ) : (
                  <div className="card-art-fallback">{player.ignTag?.[0]}</div>
                )}
              </div>
              <div className="card-name-plate">
                <h2>{player.ignTag}</h2>
                <p>{player.mainRole}{player.secondaryRole ? ` / ${player.secondaryRole}` : ''}</p>
              </div>
              <span className="card-flip-hint">TAP TO FLIP ↻</span>
            </div>

            <div className="card-face card-back">
              <div className="dossier-stamp">CLASSIFIED</div>
              <div className="card-back-header">
                <h3>{player.ignTag}</h3>
                <span>{player.team?.name || 'UNASSIGNED'}</span>
              </div>
              <div className="dossier-sheet">
                <DossierRow label="MAIN ROLE" value={player.mainRole} />
                <DossierRow label="SECONDARY" value={player.secondaryRole} />
                <DossierRow label="CURRENT RANK" value={player.currentRank} />
                <DossierRow label="PEAK RANK" value={player.peakRank} />
                <DossierRow label="SERVER" value={player.preferredServer} />
                <DossierRow label="LANGUAGES" value={player.languages} />
              </div>
              {player.trackerLink && (
                <a href={player.trackerLink} target="_blank" rel="noreferrer" className="tracker-link">
                  VIEW COMPETITIVE TRACKER →
                </a>
              )}
              <span className="card-flip-hint">TAP TO FLIP ↻</span>
            </div>
          </div>
        </div>

        <div className="player-meta">
          <p className="eyebrow">PLAYER FILE</p>
          <h1 className="page-title">{player.ignTag}</h1>
          <p className="lede">
            {player.mainRole}{player.secondaryRole ? ` · Secondary ${player.secondaryRole}` : ''} · {player.team?.name || 'Unassigned'}
          </p>

          <div className="dossier-sheet standalone">
            <DossierRow label="Current Rank" value={player.currentRank} />
            <DossierRow label="Peak Rank" value={player.peakRank} />
            <DossierRow label="Preferred Server" value={player.preferredServer} />
            <DossierRow label="Languages" value={player.languages} />
          </div>

          {player.trackerLink && (
            <a href={player.trackerLink} target="_blank" rel="noreferrer" className="btn btn-ghost tracker-btn">
              Competitive Tracker ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   CONTACT PAGE
============================================================ */
function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState({ state: 'idle', msg: '' });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading', msg: '' });
    try {
      const d = await api('/contact', { method: 'POST', body: form });
      setStatus({ state: 'success', msg: d.message });
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setStatus({ state: 'error', msg: err.message });
    }
  };

  return (
    <section className="section narrow">
      <p className="eyebrow">FILE 02 — GET IN TOUCH</p>
      <h1 className="page-title">Contact Us</h1>
      <p className="lede">Sponsorships, scrim requests, tryout questions — send it over.</p>

      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label>Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>Email
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>
        <label>Subject
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </label>
        <label>Message
          <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </label>
        <button className="btn btn-primary" disabled={status.state === 'loading'}>
          {status.state === 'loading' ? 'Sending…' : 'Send Message'}
        </button>
        {status.msg && <p className={status.state === 'error' ? 'form-error' : 'form-success'}>{status.msg}</p>}
      </form>
    </section>
  );
}

/* ============================================================
   ADMIN — SHARED UI (modal + icons)
============================================================ */
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-panel ${wide ? 'wide' : ''}`}>
        <div className="modal-panel-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-panel-body">{children}</div>
      </div>
    </div>
  );
}

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}
function IconSearch() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
}
function IconEye() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IconPencil() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6" /></svg>;
}
function IconUpload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>;
}

/* File input rendered as a clan-styled "Upload" button + filename,
   replacing the browser's native "Choose File" control everywhere. */
function FileField({ id, accept, onChange, fileName, placeholder = 'No file chosen' }) {
  return (
    <div className="file-field">
      <input id={id} type="file" accept={accept} onChange={onChange} />
      <label htmlFor={id} className="file-field-btn">
        <IconUpload /> Upload
      </label>
      <span className="file-field-name">{fileName || placeholder}</span>
    </div>
  );
}

/* ============================================================
   ADMIN — LOGIN
============================================================ */
function AdminLogin() {
  const { login } = useAuth();
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(creds.username, creds.password);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section narrow gate-section">
      <div className="gate-card">
        <div className="gate-stamp">CLEARANCE&nbsp;REQUIRED</div>
        <p className="eyebrow">RESTRICTED ACCESS · FILE 00</p>
        <h1 className="page-title">Admin Panel</h1>
        <p className="gate-copy">Sign in with a clan-issued login to open the roster file.</p>
        <form className="form gate-form" onSubmit={submit}>
          <label>Username
            <input required autoFocus value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} placeholder="agent handle" />
          </label>
          <label>Password
            <input required type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} placeholder="••••••••" />
          </label>
          <button className="btn btn-primary" disabled={loading}>{loading ? 'Verifying…' : 'Enter Panel'}</button>
          {err && <p className="form-error">{err}</p>}
        </form>
      </div>
    </section>
  );
}

/* ============================================================
   ADMIN — TEAMS TAB
============================================================ */
function AdminTeams({ token, teams, reload }) {
  const [form, setForm] = useState({ name: '', tagline: '', region: 'APAC', primaryColor: '#e6432b', accentColor: '#b8935a' });
  const [logoFile, setLogoFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (logoFile) fd.append('logo', logoFile);
      await api('/teams', { method: 'POST', body: fd, isForm: true, token });
      setMsg('Team created.');
      setForm({ name: '', tagline: '', region: 'APAC', primaryColor: '#e6432b', accentColor: '#b8935a' });
      setLogoFile(null);
      reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this team? Players stay, but become unassigned.')) return;
    await api(`/teams/${id}`, { method: 'DELETE', token });
    reload();
  };

  return (
    <div className="admin-grid">
      <form className="form admin-card" onSubmit={submit}>
        <div className="admin-card-tab">NEW ENTRY</div>
        <h3>Create Team</h3>
        <label>Team Name
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>Tagline
          <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="ONE CLAN. ONE FILE." />
        </label>
        <div className="form-row">
          <label>Region
            <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </label>
          <label>Primary Color
            <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
          </label>
        </div>
        <div className="form-label-block">Team Logo
          <FileField id="team-logo-file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} fileName={logoFile?.name} />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create Team'}</button>
        {msg && <p className="form-success">{msg}</p>}
      </form>

      <div className="admin-card">
        <div className="admin-card-tab">ROSTER</div>
        <div className="admin-card-heading">
          <h3>Existing Teams</h3>
          <span className="admin-card-count">{teams.length}</span>
        </div>
        <ul className="admin-list">
          {teams.map((t) => (
            <li key={t._id}>
              {t.logo ? <img src={t.logo} alt="" className="admin-list-thumb" /> : <div className="admin-list-thumb fallback">{t.name[0]}</div>}
              <div className="admin-list-body">
                <strong>{t.name}</strong>
                <span>{t.playerCount} player{t.playerCount === 1 ? '' : 's'} · {t.region}</span>
              </div>
              <button className="btn-icon danger" onClick={() => remove(t._id)}>Delete</button>
            </li>
          ))}
          {teams.length === 0 && <p className="muted admin-empty">No squads filed yet.</p>}
        </ul>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN — PLAYERS TAB
   Rebuilt around the tryout-form / Excel export headline:
   Timestamp, Email, Full Name, Discord Username, Age, Contact
   Number, DOB, Languages, IGN w/ Tag, Preferred Server, Main
   Role, Secondary Role, Current Rank, Peak Rank, Tracker Link, Pic
============================================================ */
const emptyPlayerForm = {
  email: '', fullName: '', discordUsername: '', contactNumber: '', dob: '',
  languages: '', ignTag: '', preferredServer: '', mainRole: 'Flex', secondaryRole: '',
  currentRank: '', peakRank: '', trackerLink: '', team: '', accessLevel: 'none',
};

function toDateInputValue(dobStr) {
  if (!dobStr) return '';
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function AdminPlayers({ token, teams, players, reload }) {
  const [form, setForm] = useState(emptyPlayerForm);
  const [picFile, setPicFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [creds, setCreds] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingPic, setEditingPic] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewingPlayer, setViewingPlayer] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const liveAge = calcAge(form.dob);

  const openNewForm = () => {
    setEditingId(null);
    setEditingPic('');
    setForm(emptyPlayerForm);
    setPicFile(null);
    setMsg('');
    setCreds(null);
    setFormOpen(true);
  };

  const startEdit = (p) => {
    setEditingId(p._id);
    setEditingPic(p.pic || '');
    setPicFile(null);
    setCreds(null);
    setMsg('');
    setForm({
      email: p.email || '',
      fullName: p.fullName || '',
      discordUsername: p.discordUsername || '',
      contactNumber: p.contactNumber || '',
      dob: toDateInputValue(p.dob),
      languages: p.languages || '',
      ignTag: p.ignTag || '',
      preferredServer: p.preferredServer || '',
      mainRole: p.mainRole || 'Flex',
      secondaryRole: p.secondaryRole || '',
      currentRank: p.currentRank || '',
      peakRank: p.peakRank || '',
      trackerLink: p.trackerLink || '',
      team: p.team?._id || '',
      accessLevel: p.accessLevel || 'none',
    });
    setFormOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingPic('');
    setForm(emptyPlayerForm);
    setPicFile(null);
    setMsg('');
    setCreds(null);
    setFormOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setCreds(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('age', liveAge ?? '');
      if (!editingId) fd.append('timestamp', new Date().toISOString());
      if (picFile) fd.append('pic', picFile);

      const d = editingId
        ? await api(`/players/${editingId}`, { method: 'PUT', body: fd, isForm: true, token })
        : await api('/players', { method: 'POST', body: fd, isForm: true, token });

      setMsg(`Player "${d.player.ignTag}" ${editingId ? 'updated' : 'filed'}.`);
      if (d.credentials) {
        setCreds(d.credentials);
      } else {
        setFormOpen(false);
      }
      setForm(emptyPlayerForm);
      setPicFile(null);
      setEditingId(null);
      setEditingPic('');
      reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this player?')) return;
    await api(`/players/${id}`, { method: 'DELETE', token });
    if (editingId === id) cancelEdit();
    if (viewingPlayer?._id === id) setViewingPlayer(null);
    reload();
  };

  const importExcel = async (e) => {
    e.preventDefault();
    if (!excelFile) return;
    setBusy(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', excelFile);
      const d = await api('/players/bulk-import', { method: 'POST', body: fd, isForm: true, token });
      setImportResult(d);
      reload();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  };

  const filteredPlayers = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [p.ignTag, p.fullName, p.email, p.discordUsername].some((v) => v?.toLowerCase().includes(q));
  });
  const downloadSample = () => {
    const headers = IMPORT_COLUMNS
    const csv = [headers].map((r) => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "IDC_Players_Sample.csv" });
    a.click(); showToast("Sample CSV downloaded!", "success");
  };
  return (
    <div className="players-stack">
      <div className="admin-card admin-card-compact">
        <div className="admin-card-tab">BULK IMPORT</div>
        <h3>Excel / Form Export</h3>
        <p className="muted small">
          Columns: {IMPORT_COLUMNS.join(', ')}
        </p>
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: "1rem" }} onClick={downloadSample}>
          <i className="fas fa-download"></i> Download Sample CSV
        </button>
        <form onSubmit={importExcel} className="form import-form">
          <FileField id="bulk-import-file" accept=".xlsx,.xls,.csv" onChange={(e) => setExcelFile(e.target.files[0])} fileName={excelFile?.name} placeholder="Choose spreadsheet" />
          <button className="btn btn-ghost" disabled={busy || !excelFile}>{busy ? 'Importing…' : 'Import'}</button>
        </form>
        {importResult && (
          importResult.error
            ? <p className="form-error">{importResult.error}</p>
            : (
              <p className="form-success">
                Filed {importResult.created} player(s).
                {importResult.failed?.length > 0 && ` ${importResult.failed.length} row(s) failed: ${importResult.failed.map(f => `row ${f.row} (${f.error})`).join('; ')}`}
              </p>
            )
        )}
      </div>

      <div className="admin-card admin-card-solo roster-card">
        <div className="admin-card-tab">ROSTER</div>
        <div className="roster-toolbar">
          <div className="admin-card-heading">
            <h3>Player Roster</h3>
            <span className="admin-card-count">{players.length}</span>
          </div>
          <button type="button" className="btn btn-primary btn-add" onClick={openNewForm}>
            <IconPlus /> Add Player
          </button>
        </div>

        <div className="roster-search">
          <IconSearch />
          <input
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Email</th>
                <th>Role</th>
                <th>Team</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div className="player-cell">
                      {p.pic ? <img src={p.pic} alt="" className="roster-avatar" /> : <div className="roster-avatar fallback">{p.ignTag?.[0]}</div>}
                      <div className="roster-names">
                        <strong>{p.ignTag}</strong>
                        <span>{p.fullName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{p.email}</td>
                  <td><span className="role-tag">{p.mainRole}</span></td>
                  <td>
                    <span className={`status-pill ${p.team ? 'is-assigned' : ''}`}>
                      {p.team?.name || 'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <div className="tbl-actions">
                      <button type="button" className="icon-btn" onClick={() => setViewingPlayer(p)} aria-label="View profile"><IconEye /></button>
                      <button type="button" className="icon-btn" onClick={() => startEdit(p)} aria-label="Edit player"><IconPencil /></button>
                      <button type="button" className="icon-btn danger" onClick={() => remove(p._id)} aria-label="Delete player"><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPlayers.length === 0 && (
                <tr><td colSpan={5} className="muted admin-empty">
                  {players.length === 0 ? 'No players on file yet.' : 'No players match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <Modal title={editingId ? 'Edit Player' : 'File a Player'} onClose={cancelEdit} wide>
          <form className="form" onSubmit={submit}>
            <div className="form-row">
              <label>Email Address
                <input required type="email" value={form.email} onChange={set('email')} />
              </label>
              <label>Full Name
                <input required value={form.fullName} onChange={set('fullName')} />
              </label>
            </div>

            <div className="form-row">
              <label>Discord Username
                <input required value={form.discordUsername} onChange={set('discordUsername')} placeholder="username" />
              </label>
              <label>Contact Number
                <input required value={form.contactNumber} onChange={set('contactNumber')} />
              </label>
            </div>

            <div className="form-row three">
              <label>DOB
                <input required type="date" max={new Date().toISOString().split('T')[0]} value={form.dob} onChange={set('dob')} />
              </label>
              <label>Age (auto-calculated)
                <input disabled value={form.dob ? (liveAge ?? '—') : ''} placeholder="Set DOB first" />
              </label>
              <label>Preferred Server
                <input required value={form.preferredServer} onChange={set('preferredServer')} placeholder="Mumbai, Singapore…" />
              </label>
            </div>

            <label>Languages You Can Communicate In
              <input value={form.languages} onChange={set('languages')} placeholder="English, Hindi, Tamil" />
            </label>

            <label>In-Game Name (IGN) with Tag
              <input required value={form.ignTag} onChange={set('ignTag')} placeholder="Vanguard#IDC1" />
            </label>

            <div className="form-row">
              <label>Team
                <select value={form.team} onChange={set('team')}>
                  <option value="">Unassigned</option>
                  {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </label>
              <label>Admin Panel Access
                <select value={form.accessLevel} onChange={set('accessLevel')}>
                  <option value="none">Not Admin</option>
                  <option value="staff">Staff (view only)</option>
                  <option value="admin">Admin (full access)</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>Main Role
                <select value={form.mainRole} onChange={set('mainRole')}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>Secondary Role
                <select value={form.secondaryRole} onChange={set('secondaryRole')}>
                  <option value="">None</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>Current Rank
                <select required value={form.currentRank} onChange={set('currentRank')}>
                  <option value="">Select rank</option>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>Peak Rank Achieved
                <select value={form.peakRank} onChange={set('peakRank')}>
                  <option value="">Select rank</option>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>

            <label>Current Competitive Tracker Link
              <input value={form.trackerLink} onChange={set('trackerLink')} placeholder="https://tracker.gg/valorant/profile/…" />
            </label>

            <div className="form-label-block">Your Pic{editingId ? ' (leave blank to keep current)' : ''}
              {editingId && editingPic && (
                <img src={editingPic} alt="Current" className="admin-list-thumb" style={{ marginBottom: '0.5rem' }} />
              )}
              <FileField id="player-pic-file" accept="image/*" onChange={(e) => setPicFile(e.target.files[0])} fileName={picFile?.name} />
            </div>

            <div className="form-actions-row">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Add Player'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={busy}>
                {creds ? 'Done' : 'Cancel'}
              </button>
            </div>
            {msg && <p className={creds ? 'form-success' : 'form-error'}>{msg}</p>}
            {creds && (
              <p className="form-success">
                Login created — username: <strong>{creds.username}</strong>, password: <strong>{creds.password}</strong> (shown once, share securely).
              </p>
            )}
          </form>
        </Modal>
      )}

      {viewingPlayer && (
        <Modal title="Player Dossier" onClose={() => setViewingPlayer(null)}>
          <div className="profile-view">
            <div className="profile-view-head">
              {viewingPlayer.pic ? <img src={viewingPlayer.pic} alt="" className="profile-view-avatar" /> : <div className="profile-view-avatar fallback">{viewingPlayer.ignTag?.[0]}</div>}
              <div>
                <h4>{viewingPlayer.ignTag}</h4>
                <span>{viewingPlayer.fullName}</span>
              </div>
            </div>
            <dl className="profile-grid">
              <div><dt>Email</dt><dd>{viewingPlayer.email}</dd></div>
              <div><dt>Discord</dt><dd>{viewingPlayer.discordUsername}</dd></div>
              <div><dt>Contact</dt><dd>{viewingPlayer.contactNumber}</dd></div>
              <div><dt>DOB / Age</dt><dd>
                {viewingPlayer.dob
                  ? new Date(viewingPlayer.dob).toISOString().split('T')[0]
                  : '—'}
                {' / '}
                {viewingPlayer.age ?? calcAge(viewingPlayer.dob) ?? '—'}
              </dd></div>
              <div><dt>Languages</dt><dd>{viewingPlayer.languages || '—'}</dd></div>
              <div><dt>Server</dt><dd>{viewingPlayer.preferredServer || '—'}</dd></div>
              <div><dt>Main Role</dt><dd>{viewingPlayer.mainRole || '—'}</dd></div>
              <div><dt>Secondary Role</dt><dd>{viewingPlayer.secondaryRole || '—'}</dd></div>
              <div><dt>Current Rank</dt><dd>{viewingPlayer.currentRank || '—'}</dd></div>
              <div><dt>Peak Rank</dt><dd>{viewingPlayer.peakRank || '—'}</dd></div>
              <div><dt>Tracker</dt><dd>{viewingPlayer.trackerLink ? <a href={viewingPlayer.trackerLink} target="_blank" rel="noopener noreferrer">Open ↗</a> : '—'}</dd></div>
              <div><dt>Team</dt><dd>{viewingPlayer.team?.name || 'Unassigned'}</dd></div>
              <div><dt>Filed</dt><dd className="mono">{fmtTimestamp(viewingPlayer.timestamp || viewingPlayer.createdAt)}</dd></div>
            </dl>
            <div className="form-actions-row">
              <button type="button" className="btn btn-primary" onClick={() => { const p = viewingPlayer; setViewingPlayer(null); startEdit(p); }}>Edit This Player</button>
              <button type="button" className="btn btn-ghost" onClick={() => setViewingPlayer(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   ADMIN — INBOX TAB
============================================================ */
function AdminInbox({ token, contacts, reload }) {
  const setStatus = async (id, status) => {
    await api(`/contact/${id}`, { method: 'PATCH', body: { status }, token });
    reload();
  };
  const remove = async (id) => {
    await api(`/contact/${id}`, { method: 'DELETE', token });
    reload();
  };

  const unread = contacts.filter((c) => c.status === 'new').length;

  return (
    <div className="admin-card admin-card-solo">
      <div className="admin-card-tab">INBOX</div>
      <div className="admin-card-heading">
        <h3>Contact Inbox</h3>
        <span className="admin-card-count">{contacts.length}</span>
      </div>
      {unread > 0 && <p className="muted small admin-card-note">{unread} unread message{unread === 1 ? '' : 's'} awaiting review.</p>}
      <ul className="admin-list stacked">
        {contacts.map((c) => (
          <li key={c._id} className="inbox-item">
            <div className="admin-list-body">
              <strong>{c.subject} <span className={`tag tag-${c.status}`}>{c.status}</span></strong>
              <span>{c.name} · {c.email}</span>
              <p>{c.message}</p>
            </div>
            <div className="inbox-actions">
              {c.status !== 'read' && <button className="btn-icon" onClick={() => setStatus(c._id, 'read')}>Mark read</button>}
              {c.status !== 'archived' && <button className="btn-icon" onClick={() => setStatus(c._id, 'archived')}>Archive</button>}
              <button className="btn-icon danger" onClick={() => remove(c._id)}>Delete</button>
            </div>
          </li>
        ))}
        {contacts.length === 0 && <p className="muted admin-empty">No messages yet.</p>}
      </ul>
    </div>
  );
}

/* ============================================================
   ADMIN — ACCOUNTS TAB (admin only)
============================================================ */
function AdminAccounts({ token }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' });
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api('/auth/users', { token }).then(setUsers).catch(() => { });
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/users', { method: 'POST', body: form, token });
      setMsg('Account created.');
      setForm({ username: '', password: '', role: 'staff' });
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Remove this login?')) return;
    await api(`/auth/users/${id}`, { method: 'DELETE', token });
    load();
  };

  return (
    <div className="admin-grid">
      <form className="form admin-card" onSubmit={submit}>
        <div className="admin-card-tab">NEW ENTRY</div>
        <h3>Create Panel Login</h3>
        <label>Username
          <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>Password
          <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <label>Access Level
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="btn btn-primary">Create</button>
        {msg && <p className="form-success">{msg}</p>}
      </form>

      <div className="admin-card">
        <div className="admin-card-tab">CLEARANCE</div>
        <div className="admin-card-heading">
          <h3>Accounts</h3>
          <span className="admin-card-count">{users.length}</span>
        </div>
        <ul className="admin-list">
          {users.map((u) => (
            <li key={u._id}>
              <div className="admin-list-body">
                <strong>{u.username}</strong>
                <span className={`role-tag ${u.role === 'admin' ? '' : 'alt'}`} style={{ display: 'inline-block', marginTop: '0.3rem' }}>{u.role}</span>
              </div>
              <button className="btn-icon danger" onClick={() => remove(u._id)}>Remove</button>
            </li>
          ))}
          {users.length === 0 && <p className="muted admin-empty">No panel logins yet.</p>}
        </ul>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN — SHELL
============================================================ */
function AdminPanel() {
  const { user, checking, token, logout } = useAuth();
  const [tab, setTab] = useState('teams');
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [contacts, setContacts] = useState([]);

  const reload = useCallback(() => {
    api('/teams').then(setTeams).catch(() => { });
    api('/players').then(setPlayers).catch(() => { });
    api('/contact', { token }).then(setContacts).catch(() => { });
  }, [token]);

  useEffect(() => { if (user) reload(); }, [user, reload]);

  if (checking) return <section className="section"><p className="muted">Checking session…</p></section>;
  if (!user) return <AdminLogin />;

  const unreadCount = contacts.filter((c) => c.status === 'new').length;

  const tabs = [
    { id: 'teams', label: 'Teams', count: teams.length },
    { id: 'players', label: 'Players', count: players.length },
    { id: 'inbox', label: 'Inbox', count: unreadCount, badge: true },
    ...(user.role === 'admin' ? [{ id: 'accounts', label: 'Accounts' }] : []),
  ];

  const tabLabel = tabs.find((t) => t.id === tab)?.label || '';

  return (
    <section className="section wide admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-id">
          <div className="admin-sidebar-avatar">{user.username[0]?.toUpperCase()}</div>
          <div className="admin-sidebar-idbody">
            <strong>{user.username}</strong>
            <span>{user.role === 'admin' ? 'Full Access' : 'Staff · View'}</span>
          </div>
        </div>

        <nav className="admin-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <span>{t.label}</span>
              {typeof t.count === 'number' && (
                <span className={`admin-nav-count ${t.badge && t.count > 0 ? 'is-alert' : ''}`}>{t.count}</span>
              )}
            </button>
          ))}
        </nav>

        <button className="admin-sidebar-logout" onClick={logout}>Log Out</button>
      </aside>

      <div className="admin-main">
        <div className="admin-header">
          <p className="eyebrow">DOSSIER // ADMIN PANEL</p>
          <h1 className="page-title">{tabLabel}</h1>
        </div>

        <div className="admin-stats-row">
          <div className="admin-stat">
            <span className="admin-stat-value">{teams.length}</span>
            <span className="admin-stat-label">Squads Filed</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{players.length}</span>
            <span className="admin-stat-label">Players On Record</span>
          </div>
          <div className={`admin-stat ${unreadCount > 0 ? 'is-alert' : ''}`}>
            <span className="admin-stat-value">{unreadCount}</span>
            <span className="admin-stat-label">Unread Messages</span>
          </div>
        </div>

        {tab === 'teams' && <AdminTeams token={token} teams={teams} reload={reload} />}
        {tab === 'players' && <AdminPlayers token={token} teams={teams} players={players} reload={reload} />}
        {tab === 'inbox' && <AdminInbox token={token} contacts={contacts} reload={reload} />}
        {tab === 'accounts' && user.role === 'admin' && <AdminAccounts token={token} />}
      </div>
    </section>
  );
}

/* ============================================================
   ROOT APP
============================================================ */
export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/roster" element={<RosterList />} />
          <Route path="/roster/:id" element={<TeamRoster />} />
          <Route path="/player/:id" element={<PlayerCardPage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<section className="section"><p className="muted">Page not found.</p></section>} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}