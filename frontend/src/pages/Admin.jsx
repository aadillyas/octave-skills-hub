import { useState, useEffect } from "react";
import "./Admin.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [skills, setSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("pending");
  const [actionMsg, setActionMsg] = useState(null);

  const headers = { "Content-Type": "application/json", "x-admin-password": password };

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) { setAuthError("Incorrect password"); return; }
      setAuthed(true);
      loadSkills();
    } catch { setAuthError("Could not connect to server"); }
  };

  const loadSkills = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch(`${API}/api/admin/pending`, { headers }),
        fetch(`${API}/api/skills`, { headers })
      ]);
      const pendingData = await pendingRes.json();
      const allData = await allRes.json();
      setSkills(pendingData.skills || []);
      setAllSkills(allData.skills || []);
    } catch { }
    setLoading(false);
  };

  const flash = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(null), 2500); };

  const verify = async (id) => {
    await fetch(`${API}/api/admin/verify/${id}`, { method: "POST", headers });
    flash("✅ Skill verified");
    loadSkills();
  };

  const unverify = async (id) => {
    await fetch(`${API}/api/admin/unverify/${id}`, { method: "POST", headers });
    flash("↩️ Skill unverified");
    loadSkills();
  };

  const deleteSkill = async (id) => {
    if (!confirm("Delete this skill permanently?")) return;
    await fetch(`${API}/api/skills/${id}`, { method: "DELETE", headers });
    flash("🗑️ Skill deleted");
    loadSkills();
  };

  const updatePairs = async (id, pairs) => {
    await fetch(`${API}/api/admin/pairs/${id}`, { method: "PATCH", headers, body: JSON.stringify({ pairs_with: pairs }) });
    flash("🔗 Pairs updated");
    loadSkills();
  };

  const verifiedSkills = allSkills.filter(s => s.verified === 1);
  const displaySkills = tab === "pending" ? skills : verifiedSkills;

  if (!authed) {
    return (
      <div className="page admin-login-page">
        <div className="admin-login-box card">
          <div className="admin-login-icon">🔐</div>
          <h1 className="admin-login-title">Admin Access</h1>
          <p className="admin-login-sub">Enter your admin password to manage skills</p>
          <form onSubmit={login}>
            <input
              type="password"
              className="form-input"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {authError && <div className="admin-error">{authError}</div>}
            <button type="submit" className="btn btn-primary admin-login-btn">Access Admin →</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header admin-page-header">
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Review uploaded skills and manage the library</p>
        </div>
        {actionMsg && <div className="admin-flash">{actionMsg}</div>}
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          Pending Review {skills.length > 0 && <span className="admin-tab-badge">{skills.length}</span>}
        </button>
        <button className={`admin-tab ${tab === "verified" ? "active" : ""}`} onClick={() => setTab("verified")}>
          Verified Skills {verifiedSkills.length > 0 && <span className="admin-tab-badge admin-tab-badge-teal">{verifiedSkills.length}</span>}
        </button>
      </div>

      {loading && <div className="discover-loading"><div className="spinner" /><span>Loading…</span></div>}

      {!loading && displaySkills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">{tab === "pending" ? "🎉" : "⬡"}</div>
          <h3>{tab === "pending" ? "No pending skills" : "No verified skills yet"}</h3>
          <p>{tab === "pending" ? "All submissions have been reviewed." : "Verify skills from the pending tab."}</p>
        </div>
      )}

      <div className="admin-skills-list">
        {displaySkills.map(skill => (
          <AdminSkillRow
            key={skill.id}
            skill={skill}
            allSkills={allSkills}
            onVerify={() => verify(skill.id)}
            onUnverify={() => unverify(skill.id)}
            onDelete={() => deleteSkill(skill.id)}
            onUpdatePairs={(pairs) => updatePairs(skill.id, pairs)}
          />
        ))}
      </div>
    </div>
  );
}

function AdminSkillRow({ skill, allSkills, onVerify, onUnverify, onDelete, onUpdatePairs }) {
  const [expanded, setExpanded] = useState(false);
  const [editPairs, setEditPairs] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState(skill.pairs_with || []);

  const togglePair = (id) => {
    setSelectedPairs(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const savePairs = () => {
    onUpdatePairs(selectedPairs);
    setEditPairs(false);
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <div className="admin-skill-row card">
      <div className="admin-skill-main">
        <div className="admin-skill-info">
          <div className="admin-skill-name-row">
            <span className="admin-skill-name">{skill.name}</span>
            {skill.verified === 1 && <span className="verified-badge">✓ Verified</span>}
          </div>
          <div className="admin-skill-meta">by {skill.author} · {timeAgo(skill.created_at)} · {skill.filename}</div>
          <div className="admin-skill-tags">
            {skill.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
        <div className="admin-skill-actions">
          <button className="btn btn-ghost" onClick={() => setExpanded(e => !e)}>
            {expanded ? "Hide" : "Preview"}
          </button>
          <button className="btn btn-ghost" onClick={() => setEditPairs(e => !e)}>
            🔗 Pairs
          </button>
          {skill.verified === 0
            ? <button className="btn btn-primary admin-verify-btn" onClick={onVerify}>Verify ✓</button>
            : <button className="btn btn-secondary admin-verify-btn" onClick={onUnverify}>Unverify</button>
          }
          <button className="btn btn-ghost admin-delete-btn" onClick={onDelete}>🗑️</button>
        </div>
      </div>

      {expanded && (
        <div className="admin-skill-preview">
          <p>{skill.description}</p>
        </div>
      )}

      {editPairs && (
        <div className="admin-pairs-editor">
          <div className="admin-pairs-label">Select skills that pair well with "{skill.name}":</div>
          <div className="admin-pairs-grid">
            {allSkills.filter(s => s.id !== skill.id).map(s => (
              <label key={s.id} className={`admin-pair-option ${selectedPairs.includes(s.id) ? "selected" : ""}`}>
                <input type="checkbox" checked={selectedPairs.includes(s.id)} onChange={() => togglePair(s.id)} />
                <span>{s.name}</span>
                {s.verified === 1 && <span className="verified-badge" style={{fontSize:"0.6rem"}}>✓</span>}
              </label>
            ))}
          </div>
          <div className="admin-pairs-footer">
            <button className="btn btn-secondary" onClick={() => setEditPairs(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePairs}>Save pairs</button>
          </div>
        </div>
      )}
    </div>
  );
}
