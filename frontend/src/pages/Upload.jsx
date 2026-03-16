import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Upload.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function parseSkillFile(content) {
  const result = { name: "", description: "", tags: "" };
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontMatterMatch) {
    const fm = frontMatterMatch[1];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    if (descMatch) result.description = descMatch[1].trim().replace(/^['"]|['"]$/g, "");
    const tagsMatch = fm.match(/^tags:\s*(.+)$/m);
    if (tagsMatch) result.tags = tagsMatch[1].trim().replace(/[\[\]]/g, "").split(",").map(t => t.trim()).filter(Boolean).join(", ");
  }
  if (!result.name) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) result.name = h1Match[1].trim();
  }
  if (!result.description) {
    const body = content.replace(/^---[\s\S]*?---\s*\n/, "").replace(/^#+.+$/m, "").trim();
    const firstPara = body.split(/\n\n/)[0]?.trim();
    if (firstPara && firstPara.length > 20 && firstPara.length < 400)
      result.description = firstPara.replace(/[#*`]/g, "").trim();
  }
  if (!result.tags) {
    const headings = [...content.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m => m[1].toLowerCase().trim());
    const boldWords = [...content.matchAll(/\*\*(.+?)\*\*/g)].map(m => m[1].toLowerCase().trim());
    const candidates = [...new Set([...headings, ...boldWords])].filter(w => w.length > 2 && w.length < 20 && !w.includes(" ")).slice(0, 5);
    result.tags = candidates.join(", ");
  }
  return result;
}

function getFileType(filename) {
  if (!filename) return "MD";
  return filename.endsWith(".skill") ? "SKILL" : "MD";
}

export default function Upload() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const attachmentRef = useRef();
  const [form, setForm] = useState({ name: "", author: "", description: "", tags: "" });
  const [attachments, setAttachments] = useState([]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const [existingSkills, setExistingSkills] = useState([]);
  const [selectedPairs, setSelectedPairs] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/skills`)
      .then(r => r.json())
      .then(d => setExistingSkills(d.skills || []))
      .catch(() => {});
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleFile = async (f) => {
    if (!f) return;
    const isValid = f.name.endsWith(".md") || f.name.endsWith(".skill");
    if (!isValid) { setError("Only .md and .skill files are accepted."); return; }
    setFile(f); setError(null); setAutofilled(false);
    if (f.name.endsWith(".md")) {
      const text = await f.text();
      const parsed = parseSkillFile(text);
      setForm(prev => ({ author: prev.author, name: parsed.name || f.name.replace(/\.md$/, "").replace(/[-_]/g, " "), description: parsed.description || "", tags: parsed.tags || "" }));
      if (parsed.name || parsed.description || parsed.tags) setAutofilled(true);
    } else {
      setForm(prev => ({ author: prev.author, name: f.name.replace(/\.skill$/, "").replace(/[-_]/g, " "), description: "", tags: "" }));
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const togglePair = (id) => {
    setSelectedPairs(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.author || !form.description || !form.tags || !file) {
      setError("Please fill in all fields and select a file."); return;
    }
    setSubmitting(true); setError(null);
    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("author", form.author.trim());
    fd.append("description", form.description.trim());
    fd.append("tags", form.tags);
    fd.append("pairs_with", JSON.stringify(selectedPairs));
    fd.append("file", file);
    for (const att of attachments) {
      fd.append("attachments", att);
    }
    try {
      const res = await fetch(`${API}/api/skills`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      navigate("/", { state: { uploaded: form.name } });
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  const tagList = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const fileType = file ? getFileType(file.name) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload a Skill</h1>
          <p className="page-subtitle">
            Share a skill with your team. Upload the file and we'll fill in the details automatically.
            <span className="autopopulate-info" onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)}>
              ⓘ
              {tooltip && (
                <span className="autopopulate-tooltip">
                  <strong>Auto-populate</strong> only works with <span className="tt-md">MD</span> files. <span className="tt-skill">SKILL</span> files require manual entry.
                </span>
              )}
            </span>
          </p>
        </div>
      </div>

      <div className="upload-notice">
        ℹ️ Uploaded skills are <strong>pending review</strong> before appearing as verified in the library. They'll still be visible to all users while awaiting verification.
      </div>

      <div className="upload-layout">
        <form className="upload-form card" onSubmit={handleSubmit}>
          {error && <div className="upload-error">⚠️ {error}</div>}

          <div className={`drop-zone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}>
            <input ref={fileRef} type="file" accept=".md,.skill,text/markdown,text/plain" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
            {file ? (
              <div className="drop-zone-file">
                <span className="drop-zone-file-icon">📄</span>
                <div>
                  <div className="drop-zone-file-name">{file.name}<span className={`file-type-badge file-type-${fileType.toLowerCase()}`}>{fileType}</span></div>
                  <div className="drop-zone-file-size">{(file.size / 1024).toFixed(1)} KB — click to change</div>
                  {autofilled && <div className="autofill-notice">✨ Fields auto-populated — please review below</div>}
                  {fileType === "SKILL" && <div className="manual-notice">📝 SKILL files require manual field entry</div>}
                </div>
              </div>
            ) : (
              <div className="drop-zone-empty">
                <span className="drop-zone-icon">⬆️</span>
                <div className="drop-zone-label">Drop your skill file here</div>
                <div className="drop-zone-sub">or click to browse · .md and .skill files accepted</div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Supporting Files <span className="form-label-optional">(optional)</span></label>
            <div className="form-hint" style={{marginBottom: 8}}>Attach any supporting files (.py, .js, .csv, etc.) that go with this skill.</div>
            <input
              ref={attachmentRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const picked = Array.from(e.target.files);
                setAttachments(prev => [...prev, ...picked]);
                e.target.value = "";
              }}
            />
            {attachments.length > 0 && (
              <ul className="attachment-list">
                {attachments.map((att, i) => (
                  <li key={i} className="attachment-item">
                    <span className="attachment-name">{att.name}</span>
                    <span className="attachment-size">{(att.size / 1024).toFixed(1)} KB</span>
                    <button type="button" className="attachment-remove" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>x</button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="attachment-add-btn" onClick={() => attachmentRef.current.click()}>+ Add files</button>
          </div>

          <div className="form-group"><label className="form-label">Skill Name</label><input className="form-input" type="text" placeholder="e.g. PDF Extractor" value={form.name} onChange={set("name")} required /></div>
          <div className="form-group"><label className="form-label">Your Name</label><input className="form-input" type="text" placeholder="e.g. Sarah Johnson" value={form.author} onChange={set("author")} required /></div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Describe what this skill does, when to use it, and what problem it solves." value={form.description} onChange={set("description")} rows={4} required />
            <div className="form-hint">Aim for 2–4 sentences. Good descriptions = better AI matching.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Tags</label>
            <input className="form-input" type="text" placeholder="pdf, extraction, documents" value={form.tags} onChange={set("tags")} required />
            <div className="form-hint">Comma-separated. Use lowercase.</div>
            {tagList.length > 0 && <div className="tag-preview">{tagList.map((t) => <span key={t} className="tag tag-pink">{t}</span>)}</div>}
          </div>

          {existingSkills.length > 0 && (
            <div className="form-group">
              <label className="form-label">Pairs well with <span className="form-label-optional">(optional)</span></label>
              <div className="form-hint" style={{marginBottom: 10}}>Select skills from the library that work well together with this one.</div>
              <div className="pairs-selector">
                {existingSkills.map(s => (
                  <label key={s.id} className={`pairs-option ${selectedPairs.includes(s.id) ? "selected" : ""}`}>
                    <input type="checkbox" checked={selectedPairs.includes(s.id)} onChange={() => togglePair(s.id)} />
                    <span>{s.name}</span>
                    {s.verified === 1 && <span className="verified-badge" style={{fontSize:"0.6rem"}}>✓</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary upload-submit" disabled={submitting}>
            {submitting ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Uploading…</> : "Upload Skill →"}
          </button>
        </form>

        <div className="upload-tips">
          <div className="tips-card card">
            <h3 className="tips-title">Accepted file types</h3>
            <div className="file-type-info">
              <div className="file-type-row"><span className="file-type-badge file-type-md">MD</span><div><div style={{ fontSize: "0.825rem", color: "var(--text)", fontWeight: 600 }}>Markdown files</div><div style={{ fontSize: "0.775rem", color: "var(--muted)" }}>Auto-populates fields on upload</div></div></div>
              <div className="file-type-row"><span className="file-type-badge file-type-skill">SKILL</span><div><div style={{ fontSize: "0.825rem", color: "var(--text)", fontWeight: 600 }}>Claude skill files</div><div style={{ fontSize: "0.775rem", color: "var(--muted)" }}>Binary format — fill fields manually</div></div></div>
            </div>
          </div>
          <div className="tips-card card">
            <h3 className="tips-title">Writing a great description</h3>
            <ul className="tips-list">
              <li><span className="tip-icon">✅</span><span>State what the skill <strong>does</strong>, not how it works</span></li>
              <li><span className="tip-icon">✅</span><span>Mention the <strong>input</strong> and <strong>output</strong> format</span></li>
              <li><span className="tip-icon">✅</span><span>Describe the <strong>use case</strong> it was built for</span></li>
              <li><span className="tip-icon">✅</span><span>Call out any <strong>limitations</strong></span></li>
            </ul>
          </div>
          <div className="tips-card card">
            <h3 className="tips-title">Good tag examples</h3>
            <div className="tips-tags">{["pdf", "excel", "summarisation", "extraction", "automation", "email", "data-cleaning", "presentation", "reporting"].map(t => <span key={t} className="tag">{t}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
