require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { queries } = require("./database");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "octave-admin";

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.includes("localhost") || origin.includes("vercel.app") || origin.includes(process.env.FRONTEND_URL || "")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));
app.use(express.json());

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const validExt = file.originalname.endsWith(".md") || file.originalname.endsWith(".skill");
    const validMime = ["text/markdown", "text/plain", "application/octet-stream"].includes(file.mimetype);
    if (validExt || validMime) { cb(null, true); } else { cb(new Error("Only .md and .skill files are allowed"), false); }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadWithAttachments = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "file") {
      const validExt = file.originalname.endsWith(".md") || file.originalname.endsWith(".skill");
      const validMime = ["text/markdown", "text/plain", "application/octet-stream"].includes(file.mimetype);
      if (validExt || validMime) { cb(null, true); } else { cb(new Error("Only .md and .skill files are allowed"), false); }
    } else {
      cb(null, true);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

function adminAuth(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Unauthorised" });
  next();
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");
  return new GoogleGenerativeAI(apiKey);
}

// ── Public Routes ─────────────────────────────────────────────────────────────

app.get("/api/skills", (req, res) => {
  try {
    const { q, verified } = req.query;
    let skills = q && q.trim()
      ? queries.searchSkills.all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      : queries.getAllSkills.all();
    if (verified === "true") skills = skills.filter(s => s.verified === 1);
    skills = skills.map((s) => ({ ...s, tags: JSON.parse(s.tags), pairs_with: JSON.parse(s.pairs_with || "[]") }));
    res.json({ skills });
  } catch (err) { res.status(500).json({ error: "Failed to fetch skills" }); }
});

app.get("/api/skills/names", (req, res) => {
  try {
    const names = queries.getAllSkillNames.all();
    res.json({ skills: names });
  } catch (err) { res.status(500).json({ error: "Failed to fetch skill names" }); }
});

app.get("/api/skills/:id", (req, res) => {
  try {
    const skill = queries.getSkillById.get(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json({ ...skill, tags: JSON.parse(skill.tags), pairs_with: JSON.parse(skill.pairs_with || "[]") });
  } catch (err) { res.status(500).json({ error: "Failed to fetch skill" }); }
});

app.get("/api/skills/:id/download", (req, res) => {
  try {
    const skill = queries.getSkillById.get(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    queries.incrementDownloads.run(req.params.id);
    const attachments = queries.getAttachmentsWithContentBySkillId.all(req.params.id);
    if (attachments.length === 0) {
      res.setHeader("Content-Disposition", `attachment; filename="${skill.filename}"`);
      res.setHeader("Content-Type", "text/markdown");
      return res.send(skill.file_content);
    }
    const zipName = skill.filename.replace(/\.(md|skill)$/, "") + ".zip";
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    res.setHeader("Content-Type", "application/zip");
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);
    archive.append(Buffer.from(skill.file_content, "utf-8"), { name: skill.filename });
    for (const att of attachments) {
      archive.append(att.file_content, { name: att.filename });
    }
    archive.finalize();
  } catch (err) { res.status(500).json({ error: "Failed to download skill" }); }
});

app.post("/api/skills", uploadWithAttachments.fields([{ name: "file", maxCount: 1 }, { name: "attachments", maxCount: 10 }]), (req, res) => {
  try {
    const { name, author, description, tags, pairs_with } = req.body;
    const mainFile = req.files?.file?.[0];
    if (!name || !author || !description || !tags || !mainFile)
      return res.status(400).json({ error: "All fields and a .md or .skill file are required" });
    const fileContent = fs.readFileSync(mainFile.path, "utf-8");
    let parsedTags;
    try { parsedTags = JSON.parse(tags); } catch { parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean); }
    let parsedPairs;
    try { parsedPairs = JSON.parse(pairs_with || "[]"); } catch { parsedPairs = []; }
    const result = queries.insertSkill.run({
      name: name.trim(), author: author.trim(), description: description.trim(),
      tags: JSON.stringify(parsedTags), filename: mainFile.originalname,
      file_path: mainFile.path, file_content: fileContent,
      verified: 0, pairs_with: JSON.stringify(parsedPairs)
    });
    const skillId = result.lastInsertRowid;
    for (const att of (req.files?.attachments || [])) {
      const content = fs.readFileSync(att.path);
      queries.insertAttachment.run({ skill_id: skillId, filename: att.originalname, file_content: content, file_size: att.size });
    }
    res.status(201).json({ message: "Skill uploaded successfully — pending review", id: skillId });
  } catch (err) { res.status(500).json({ error: err.message || "Failed to upload skill" }); }
});

app.get("/api/skills/:id/attachments", (req, res) => {
  try {
    const attachments = queries.getAttachmentsBySkillId.all(req.params.id);
    res.json({ attachments });
  } catch (err) { res.status(500).json({ error: "Failed to fetch attachments" }); }
});

app.delete("/api/skills/:skillId/attachments/:attId", adminAuth, (req, res) => {
  try {
    queries.deleteAttachment.run(req.params.attId, req.params.skillId);
    res.json({ message: "Attachment deleted" });
  } catch (err) { res.status(500).json({ error: "Failed to delete attachment" }); }
});

app.delete("/api/skills/:id", adminAuth, (req, res) => {
  try {
    const skill = queries.getSkillById.get(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    if (fs.existsSync(skill.file_path)) fs.unlinkSync(skill.file_path);
    queries.deleteSkill.run(req.params.id);
    res.json({ message: "Skill deleted" });
  } catch (err) { res.status(500).json({ error: "Failed to delete skill" }); }
});

// ── Admin Routes ──────────────────────────────────────────────────────────────

app.get("/api/admin/pending", adminAuth, (req, res) => {
  try {
    const skills = queries.getPendingSkills.all().map(s => ({
      ...s, tags: JSON.parse(s.tags), pairs_with: JSON.parse(s.pairs_with || "[]")
    }));
    res.json({ skills });
  } catch (err) { res.status(500).json({ error: "Failed to fetch pending skills" }); }
});

app.post("/api/admin/verify/:id", adminAuth, (req, res) => {
  try {
    queries.verifySkill.run(req.params.id);
    res.json({ message: "Skill verified" });
  } catch (err) { res.status(500).json({ error: "Failed to verify skill" }); }
});

app.post("/api/admin/unverify/:id", adminAuth, (req, res) => {
  try {
    queries.unverifySkill.run(req.params.id);
    res.json({ message: "Skill unverified" });
  } catch (err) { res.status(500).json({ error: "Failed to unverify skill" }); }
});

app.patch("/api/admin/pairs/:id", adminAuth, (req, res) => {
  try {
    const { pairs_with } = req.body;
    queries.updatePairsWith.run(JSON.stringify(pairs_with || []), req.params.id);
    res.json({ message: "Pairs updated" });
  } catch (err) { res.status(500).json({ error: "Failed to update pairs" }); }
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) { res.json({ success: true }); }
  else { res.status(401).json({ error: "Incorrect password" }); }
});

// ── AI Match ──────────────────────────────────────────────────────────────────

app.post("/api/match", async (req, res) => {
  try {
    const { problem } = req.body;
    if (!problem?.trim()) return res.status(400).json({ error: "Problem description is required" });

    const skills = queries.getAllSkillsWithContent.all();
    if (skills.length === 0) return res.json({ matches: [], message: "No skills in the library yet." });

    const skillsContext = skills.map((s) =>
      `SKILL ID: ${s.id}\nNAME: ${s.name}\nAUTHOR: ${s.author}\nTAGS: ${JSON.parse(s.tags).join(", ")}\nDESCRIPTION: ${s.description}\nCONTENT PREVIEW:\n${s.file_content.slice(0, 800)}\n---`
    ).join("\n");

    const prompt = `You are a skills recommendation engine for an organisation's internal AI skills library.

A user has described their problem or task. Recommend the most relevant skills from the library below, ranked by relevance.

USER PROBLEM:
"${problem}"

AVAILABLE SKILLS:
${skillsContext}

Respond with a JSON array of matches (maximum 5, minimum 1). Only include genuinely relevant skills.
Each match must have:
- id: the skill's integer ID
- relevance_score: integer 1-10
- reason: 1-2 sentence explanation
- how_to_use: 1 sentence on how to apply it
- can_combine_with: array of other skill IDs (empty array if none)

Return ONLY valid JSON, no markdown, no extra text.`;

    const genAI = getGeminiClient();
    // Updated to gemini-2.0-flash — gemini-1.5-flash is deprecated
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (geminiErr) {
      console.error("Gemini API error:", geminiErr.message);
      return res.status(500).json({ error: `Gemini API error: ${geminiErr.message}` });
    }

    const text = result.response.text().trim();
    let matches;
    try {
      matches = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      console.error("Failed to parse Gemini response:", text.slice(0, 200));
      return res.status(500).json({ error: "AI returned an unexpected format. Please try again." });
    }

    const enriched = matches
      .map((match) => {
        const skill = skills.find((s) => s.id === match.id);
        if (!skill) return null;
        return { ...match, name: skill.name, author: skill.author, tags: JSON.parse(skill.tags), description: skill.description, verified: skill.verified };
      })
      .filter(Boolean)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    res.json({ matches: enriched });
  } catch (err) {
    console.error("Match route error:", err.message);
    if (err.message?.includes("GEMINI_API_KEY")) return res.status(500).json({ error: "Gemini API key not configured. Check Railway Variables." });
    res.status(500).json({ error: err.message || "AI matching failed. Please try again." });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => { console.log(`\n✅ Skills Hub API running at http://localhost:${PORT}\n`); });
