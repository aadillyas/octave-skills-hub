import "./SkillCard.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getFileType(filename) {
  if (!filename) return "MD";
  return filename.endsWith(".skill") ? "SKILL" : "MD";
}

export default function SkillCard({ skill, style }) {
  const handleDownload = () => { window.location.href = `${API}/api/skills/${skill.id}/download`; };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const fileType = getFileType(skill.filename);

  return (
    <div className="skill-card card" style={style}>
      <div className="skill-card-header">
        <div className="skill-card-icon">{skill.name.charAt(0).toUpperCase()}</div>
        <div className="skill-card-meta">
          <div className="skill-card-name-row">
            <h3 className="skill-card-name">{skill.name}</h3>
            <span className={`file-type-badge file-type-${fileType.toLowerCase()}`}>{fileType}</span>
          </div>
          <div className="skill-card-author">by {skill.author}</div>
        </div>
      </div>
      <p className="skill-card-description">{skill.description}</p>
      <div className="skill-card-tags">
        {skill.tags.slice(0, 4).map((tag) => <span key={tag} className="tag">{tag}</span>)}
        {skill.tags.length > 4 && <span className="tag">+{skill.tags.length - 4}</span>}
      </div>
      <div className="skill-card-footer">
        <div className="skill-card-stats">
          <span className="skill-stat">📥 {skill.downloads} downloads</span>
          <span className="skill-stat">🕐 {timeAgo(skill.created_at)}</span>
        </div>
        <button className="btn btn-primary skill-download-btn" onClick={handleDownload}>Download .{fileType.toLowerCase()}</button>
      </div>
    </div>
  );
}
