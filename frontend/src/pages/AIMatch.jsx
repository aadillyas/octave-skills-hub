import { useState } from "react";
import { Link } from "react-router-dom";
import "./AIMatch.css";

const API = "http://localhost:3001";

export default function AIMatch() {
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const [noMatches, setNoMatches] = useState(false);

  const handleMatch = async (e) => {
    e.preventDefault();
    if (!problem.trim()) return;

    setLoading(true);
    setError(null);
    setMatches(null);
    setNoMatches(false);

    try {
      const res = await fetch(`${API}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Matching failed");
      if (!data.matches || data.matches.length === 0) {
        setNoMatches(true);
      } else {
        setMatches(data.matches);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score) => {
    if (score >= 8) return "#0A8A5C";
    if (score >= 5) return "#E82AAE";
    return "#C0BFBB";
  };

  const scoreBg = (score) => {
    if (score >= 8) return "rgba(38,234,159,0.12)";
    if (score >= 5) return "rgba(232,42,174,0.08)";
    return "var(--surface2)";
  };

  const examples = [
    "I need to pull data from a spreadsheet, clean it up, and create a summary report",
    "I want to automate reading through long PDF documents and extracting key information",
    "I need to build a weekly email summary from multiple data sources",
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">AI Skill Matcher</h1>
        <p className="page-subtitle">
          Describe your problem in plain English — the AI will find the best matching skills from the library
        </p>
      </div>

      <div className="match-layout">
        <div className="match-input-col">
          <form className="match-form card" onSubmit={handleMatch}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Describe your task or problem</label>
              <textarea
                className="form-textarea match-textarea"
                placeholder="e.g. I need to go through a folder of PDF contracts, extract the key dates and amounts, and put them into a spreadsheet…"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={5}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary match-submit"
              disabled={loading || !problem.trim()}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Analysing skills…</>
              ) : (
                "Find matching skills →"
              )}
            </button>
          </form>

          {!matches && !loading && (
            <div className="match-examples">
              <div className="match-examples-label">Try an example:</div>
              {examples.map((ex) => (
                <button
                  key={ex}
                  className="example-pill"
                  onClick={() => setProblem(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="match-results-col">
          {loading && (
            <div className="match-loading">
              <div className="match-loading-inner">
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <div>
                  <div className="match-loading-title">Analysing your problem…</div>
                  <div className="match-loading-sub">Reading {" "}skill descriptions and finding the best matches</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="match-error card">
              <div className="match-error-icon">⚠️</div>
              <div>
                <strong>Something went wrong</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {noMatches && (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No matching skills found</h3>
              <p>No skills in the library match your description. Consider uploading one!</p>
              <Link to="/upload" className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>
                Upload a skill
              </Link>
            </div>
          )}

          {matches && (
            <div className="match-results animate-fade-up">
              <div className="match-results-header">
                <span className="match-results-count">{matches.length} skill{matches.length !== 1 ? "s" : ""} recommended</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setMatches(null); setProblem(""); }}>
                  Start over
                </button>
              </div>

              <div className="match-cards">
                {matches.map((match, i) => (
                  <div key={match.id} className="match-card card" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="match-card-top">
                      <div className="match-card-header">
                        <div
                          className="score-badge"
                          style={{
                            background: scoreBg(match.relevance_score),
                            color: scoreColor(match.relevance_score),
                          }}
                        >
                          {match.relevance_score}
                        </div>
                        <div>
                          <h3 className="match-card-name">{match.name}</h3>
                          <div className="match-card-author">by {match.author}</div>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary match-dl-btn"
                        onClick={() => window.location.href = `${API}/api/skills/${match.id}/download`}
                      >
                        Download .md
                      </button>
                    </div>

                    <div className="match-card-tags">
                      {match.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>

                    <div className="match-reason">
                      <div className="match-reason-label">Why this matches</div>
                      <p>{match.reason}</p>
                    </div>

                    <div className="match-how">
                      <div className="match-reason-label">How to apply it</div>
                      <p>{match.how_to_use}</p>
                    </div>

                    {match.can_combine_with?.length > 0 && (
                      <div className="match-combine">
                        💡 Pairs well with:{" "}
                        {match.can_combine_with.map((id) => {
                          const other = matches.find((m) => m.id === id);
                          return other ? (
                            <span key={id} className="tag tag-teal">{other.name}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !matches && !error && !noMatches && (
            <div className="match-placeholder">
              <div className="match-placeholder-icon">✨</div>
              <p>Your skill recommendations will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
