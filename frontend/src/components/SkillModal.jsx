import { useEffect } from "react";
import "./SkillModal.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getFileType(filename) {
  if (!filename) return "MD";
  return filename.endsWith(".skill") ? "SKILL" : "MD";
}

export default function SkillModal({ skill, allSkills = [], onClose, onDownload }) {
  const fileType = getFileType(skill.filename);

  const pairedSkills = (skill.pairs_with || [])
    .map(id => allSkills.find(s => s.id === id))
    .filter(Boolean);

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  // Close on Escape key
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon">{skill.name.charAt(0).toUpperCase()}</div>
          <div className="modal-title-block">
            <div className="modal-name-row">
              <h2 className="modal-name">{skill.name}</h2>
              <span className={`file-type-badge file-type-${fileType.toLowerCase()}`}>{fileType}</span>
              {skill.verified === 1 && <span className="verified-badge">✓ Verified</span>}
            </div>
            <div className="modal-author">by {skill.author} · {timeAgo(skill.created_at)} · {skill.downloads} downloads</div>
          </div>
        </div>

        {/* Description */}
        <div className="modal-section">
          <div className="modal-section-label">Description</div>
          <p className="modal-description">{skill.description}</p>
        </div>

        {/* Tags */}
        <div className="modal-section">
          <div className="modal-section-label">Tags</div>
          <div className="modal-tags">
            {skill.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
          </div>
        </div>

        {/* Pairs with */}
        {pairedSkills.length > 0 && (
          <div className="modal-section">
            <div className="modal-section-label">🔗 Pairs well with</div>
            <div className="modal-pairs">
              {pairedSkills.map(p => (
                <div key={p.id} className="modal-pair-card">
                  <div className="modal-pair-icon">{p.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="modal-pair-name">{p.name}</div>
                    <div className="modal-pair-author">by {p.author}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="modal-pairs-hint">These skills are designed to work together. Consider downloading all of them for your workflow.</p>
          </div>
        )}

        {/* How to use hint */}
        <div className="modal-section modal-howto">
          <div className="modal-section-label">How to use this skill</div>
          <div className="modal-howto-steps">
            <div className="modal-howto-step"><span className="howto-num">1</span><span>Download the file below</span></div>
            <div className="modal-howto-step"><span className="howto-num">2</span><span>Open Claude and go to your Project Instructions, or start a new chat</span></div>
            <div className="modal-howto-step"><span className="howto-num">3</span><span>Paste the file content into Project Instructions, or attach the file directly in chat</span></div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onDownload}>
            Download .{fileType.toLowerCase()} →
          </button>
        </div>
      </div>
    </div>
  );
}
