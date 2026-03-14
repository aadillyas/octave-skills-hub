import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import SkillCard from "../components/SkillCard";
import "./Discover.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function QuickGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className={`quick-guide ${open ? "open" : ""}`}>
      <button className="quick-guide-toggle" onClick={() => setOpen(o => !o)}>
        <span>💡 How to use Skills Hub</span>
        <span className="quick-guide-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="quick-guide-body">
          <div className="quick-guide-steps">
            <div className="quick-guide-step">
              <span className="qg-num">1</span>
              <div><strong>Find a skill</strong> — search by keyword, tag, or author. Or use <Link to="/match">AI Match</Link> to describe your problem in plain English.</div>
            </div>
            <div className="quick-guide-step">
              <span className="qg-num">2</span>
              <div><strong>Click any card</strong> to preview the full details, see what it pairs with, and understand how to apply it.</div>
            </div>
            <div className="quick-guide-step">
              <span className="qg-num">3</span>
              <div><strong>Download the .md file</strong> and load it into Claude — paste into Project Instructions, or attach it in a chat.</div>
            </div>
            <div className="quick-guide-step">
              <span className="qg-num">4</span>
              <div><strong>Share your own skills</strong> — go to <Link to="/upload">Upload Skill</Link> to contribute to the library.</div>
            </div>
          </div>
          <div className="quick-guide-footer">
            <Link to="/guide" className="quick-guide-link">Read the full guide →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifiedToggle({ value, onChange }) {
  const [tooltip, setTooltip] = useState(false);
  return (
    <div className="verified-toggle-wrap">
      <div className="verified-toggle">
        <button
          className={`toggle-opt ${value === "all" ? "active" : ""}`}
          onClick={() => onChange("all")}
        >
          All skills
        </button>
        <button
          className={`toggle-opt toggle-opt-verified ${value === "verified" ? "active" : ""}`}
          onClick={() => onChange("verified")}
        >
          ✓ Verified only
        </button>
      </div>
      <span
        className="verified-info-icon"
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
      >
        ⓘ
        {tooltip && (
          <span className="verified-tooltip">
            <strong>Verified skills</strong> have been reviewed and approved by the internal Octave team. Unverified skills are community uploads awaiting review.
          </span>
        )}
      </span>
    </div>
  );
}

export default function Discover() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = debouncedSearch
        ? `${API}/api/skills?q=${encodeURIComponent(debouncedSearch)}`
        : `${API}/api/skills`;
      if (filter === "verified") url += (url.includes("?") ? "&" : "?") + "verified=true";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSkills(data.skills);
    } catch (e) {
      setError("Could not connect to the Skills Hub server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const verifiedCount = skills.filter(s => s.verified === 1).length;

  return (
    <div className="page">
      <div className="discover-header page-header">
        <div>
          <h1 className="page-title">Skill Library</h1>
          <p className="page-subtitle">Browse and download skills built by your team</p>
        </div>
        <Link to="/upload" className="btn btn-primary">+ Upload a Skill</Link>
      </div>

      <QuickGuide />

      <div className="discover-controls">
        <div className="discover-search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, description, tag, or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>
        <VerifiedToggle value={filter} onChange={setFilter} />
      </div>

      {loading && (
        <div className="discover-loading"><div className="spinner" /><span>Loading skills…</span></div>
      )}

      {error && (
        <div className="discover-error">
          <span>⚠️</span>
          <div><strong>Connection error</strong><p>{error}</p></div>
        </div>
      )}

      {!loading && !error && skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⬡</div>
          <h3>{search ? "No skills match your search" : filter === "verified" ? "No verified skills yet" : "No skills yet"}</h3>
          <p>{search ? "Try different keywords or browse all skills." : "Be the first to upload a skill."}</p>
          {!search && <Link to="/upload" className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>Upload the first skill</Link>}
        </div>
      )}

      {!loading && !error && skills.length > 0 && (
        <>
          <div className="discover-count">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
            {filter === "verified" && " · verified only"}
            {filter === "all" && verifiedCount > 0 && <span className="verified-count-hint"> · {verifiedCount} verified</span>}
          </div>
          <div className="skills-grid">
            {skills.map((skill, i) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                allSkills={skills}
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
