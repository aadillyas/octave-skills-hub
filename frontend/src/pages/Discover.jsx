import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import SkillCard from "../components/SkillCard";
import "./Discover.css";

const API = "http://localhost:3001";

export default function Discover() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = debouncedSearch
        ? `${API}/api/skills?q=${encodeURIComponent(debouncedSearch)}`
        : `${API}/api/skills`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSkills(data.skills);
    } catch (e) {
      setError("Could not connect to the Skills Hub server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return (
    <div className="page">
      <div className="discover-header page-header">
        <div>
          <h1 className="page-title">Skill Library</h1>
          <p className="page-subtitle">
            Browse and download skills built by your team
          </p>
        </div>
        <Link to="/upload" className="btn btn-primary">
          + Upload a Skill
        </Link>
      </div>

      <div className="discover-search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, description, tag, or author…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch("")}>✕</button>
        )}
      </div>

      {loading && (
        <div className="discover-loading">
          <div className="spinner" />
          <span>Loading skills…</span>
        </div>
      )}

      {error && (
        <div className="discover-error">
          <span>⚠️</span>
          <div>
            <strong>Connection error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⬡</div>
          <h3>{search ? "No skills match your search" : "No skills yet"}</h3>
          <p>
            {search
              ? "Try different keywords or browse all skills."
              : "Be the first to upload a skill to the library."}
          </p>
          {!search && (
            <Link to="/upload" className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>
              Upload the first skill
            </Link>
          )}
        </div>
      )}

      {!loading && !error && skills.length > 0 && (
        <>
          <div className="discover-count">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </div>
          <div className="skills-grid">
            {skills.map((skill, i) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
