import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import SkillCard from "../components/SkillCard";
import SkillModal from "../components/SkillModal";
import "./Discover.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const EXAMPLES = [
  "I need to extract data from a PDF and put it in a spreadsheet",
  "I want to summarise long documents automatically",
  "Help me build a weekly report from multiple sources",
];

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
              <div><strong>Find a skill</strong> — browse the library or use the AI bar at the bottom to describe your problem in plain English.</div>
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
        <button className={`toggle-opt ${value === "all" ? "active" : ""}`} onClick={() => onChange("all")}>
          All skills
        </button>
        <button className={`toggle-opt toggle-opt-verified ${value === "verified" ? "active" : ""}`} onClick={() => onChange("verified")}>
          ✓ Verified only
        </button>
      </div>
      <span className="verified-info-icon" onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)}>
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

function AIMatchBar({ allSkills }) {
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const inputRef = useRef();

  const handleMatch = async (text) => {
    const query = text || problem;
    if (!query.trim()) return;
    setProblem(query);
    setLoading(true);
    setError(null);
    setMatches(null);
    try {
      const res = await fetch(`${API}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matching failed");
      setMatches(data.matches || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleMatch(); };

  const clear = () => {
    setProblem("");
    setMatches(null);
    setError(null);
    inputRef.current?.focus();
  };

  const scoreColor = (score) => {
    if (score >= 8) return "var(--teal-text)";
    if (score >= 5) return "var(--pink)";
    return "var(--dim)";
  };

  const scoreBg = (score) => {
    if (score >= 8) return "rgba(38,234,159,0.12)";
    if (score >= 5) return "rgba(232,42,174,0.08)";
    return "var(--surface2)";
  };

  return (
    <div className="ai-float-wrap">
      {/* Results panel floats above the input bar */}
      {(matches || loading || error) && (
        <div className="ai-float-results">
          {loading && (
            <div className="ai-results-loading">
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Finding the best skills for your task…</span>
            </div>
          )}
          {error && (
            <div className="ai-match-error">
              ⚠️ {error} — <button className="ai-retry" onClick={clear}>Try again</button>
            </div>
          )}
          {matches && (
            <>
              <div className="ai-match-results-header">
                <span className="ai-match-results-label">
                  ✨ {matches.length} skill{matches.length !== 1 ? "s" : ""} matched for &quot;{problem}&quot;
                </span>
                <button className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "4px 10px" }} onClick={clear}>Clear</button>
              </div>
              {matches.length === 0 && <p className="ai-match-empty">No skills match your description yet.</p>}
              <div className="ai-match-cards">
                {matches.map((match, i) => (
                  <div key={match.id} className="ai-match-card" style={{ animationDelay: `${i * 60}ms` }} onClick={() => setSelectedSkill(match)}>
                    <div className="ai-match-card-left">
                      <div className="ai-score-badge" style={{ background: scoreBg(match.relevance_score), color: scoreColor(match.relevance_score) }}>
                        {match.relevance_score}
                      </div>
                      <div>
                        <div className="ai-match-card-name">
                          {match.name}
                          {match.verified === 1 && <span className="verified-badge" style={{ fontSize: "0.6rem" }}>✓</span>}
                        </div>
                        <div className="ai-match-card-reason">{match.reason}</div>
                        {match.can_combine_with?.length > 0 && (
                          <div className="ai-match-combines">
                            💡 Pairs with: {match.can_combine_with.map(id => {
                              const other = matches.find(m => m.id === id);
                              return other ? <span key={id} className="tag tag-teal" style={{ fontSize: "0.7rem" }}>{other.name}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <button className="btn btn-primary ai-match-dl" onClick={e => { e.stopPropagation(); window.location.href = `${API}/api/skills/${match.id}/download`; }}>
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating input bar */}
      <div className="ai-match-bar">
        <div className="ai-match-input-row">
          <span className="ai-match-icon">✨</span>
          <input
            ref={inputRef}
            type="text"
            className="ai-match-input"
            placeholder="Describe your task and I'll find the best matching skills…"
            value={problem}
            onChange={e => setProblem(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {problem && !loading && <button className="ai-match-clear" onClick={clear}>✕</button>}
          <button className="ai-match-btn" onClick={() => handleMatch()} disabled={loading || !problem.trim()}>
            {loading ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : "Match →"}
          </button>
        </div>
        {!matches && !loading && !error && (
          <div className="ai-match-examples">
            {EXAMPLES.map(ex => (
              <button key={ex} className="ai-example-pill" onClick={() => handleMatch(ex)}>{ex}</button>
            ))}
          </div>
        )}
      </div>

      {selectedSkill && (
        <SkillModal
          skill={selectedSkill}
          allSkills={allSkills}
          onClose={() => setSelectedSkill(null)}
          onDownload={() => window.location.href = `${API}/api/skills/${selectedSkill.id}/download`}
        />
      )}
    </div>
  );
}

export default function Discover() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filter === "verified" ? `${API}/api/skills?verified=true` : `${API}/api/skills`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSkills(data.skills);
    } catch (e) {
      setError("Could not connect to the Skills Hub server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const verifiedCount = skills.filter(s => s.verified === 1).length;

  return (
    <div className="page page-with-float">
      <div className="discover-header page-header">
        <div>
          <h1 className="page-title">Skill Library</h1>
          <p className="page-subtitle">Browse and download skills built by your team</p>
        </div>
        <Link to="/upload" className="btn btn-primary">+ Upload a Skill</Link>
      </div>

      <QuickGuide />

      <div className="discover-controls">
        <VerifiedToggle value={filter} onChange={setFilter} />
      </div>

      {loading && <div className="discover-loading"><div className="spinner" /><span>Loading skills…</span></div>}

      {error && (
        <div className="discover-error">
          <span>⚠️</span>
          <div><strong>Connection error</strong><p>{error}</p></div>
        </div>
      )}

      {!loading && !error && skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⬡</div>
          <h3>{filter === "verified" ? "No verified skills yet" : "No skills yet"}</h3>
          <p>Be the first to upload a skill.</p>
          <Link to="/upload" className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>Upload the first skill</Link>
        </div>
      )}

      {!loading && !error && skills.length > 0 && (
        <>
          <div className="discover-count">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
            {filter === "verified" && " · verified only"}
            {filter === "all" && verifiedCount > 0 && <span className="verified-count-hint"> · {verifiedCount} verified</span>}
          </div>
          <div className="skills-grid">
            {skills.map((skill, i) => (
              <SkillCard key={skill.id} skill={skill} allSkills={skills} style={{ animationDelay: `${i * 40}ms` }} />
            ))}
          </div>
        </>
      )}

      {/* Floating AI bar — fixed at bottom */}
      <AIMatchBar allSkills={skills} />
    </div>
  );
}
