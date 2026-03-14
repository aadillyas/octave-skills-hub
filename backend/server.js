require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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

// Simple admin auth middleware
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

// GET all skills — optionally filter by verified only
app.get("/api/skills", (req, res) => {
  try {
    const { q, verified } = req.query;
    let skills = q && q.trim()
      ? queries.searchSkills.all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      : queries.getAllSkills.all();
    if (verified === "true") skills = skills.filter(s => s.verified === 1);
    skills = skills.map((s) => ({
      ...s,
      tags: JSON.parse(s.tags),
      pairs_with: JSON.parse(s.pairs_with || "[]")
    }));
    res.json({ skills });
  } catch (err) { res.status(500).json({ error: "Failed to fetch skills" }); }
});

// GET all skill names (for pairs_with dropdown)
app.get("/api/skills/names", (req, res) => {
  try {
    const names = queries.getAllSkillNames.all();
    res.json({ skills: names });
  } catch (err) { res.status(500).json({ error: "Failed to fetch skill names" }); }
});

// GET single skill
app.get("/api/skills/:id", (req, res) => {
  try {
    const skill = queries.getSkillById.get(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json({ ...skill, tags: JSON.parse(skill.tags), pairs_with: JSON.parse(skill.pairs_with || "[]") });
  } catch (err) { res.status(500).json({ error: "Failed to fetch skill" }); }
});

// GET download
app.get("/api/skills/:id/download", (req, res) => {
  try {
    const skill = queries.getSkillById.get(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    queries.incrementDownloads.run(req.params.id);
    res.setHeader("Content-Disposition", `attachment; filename="${skill.filename}"`);
    res.setHeader("Content-Type", "text/markdown");
    res.send(skill.file_content);
  } catch (err) { res.status(500).json({ error: "Failed to download skill" }); }
});

// POST upload skill (unverified by default)
app.post("/api/skills", upload.single("file"), (req, res) => {
  try {
    const { name, author, description, tags, pairs_with } = req.body;
    if (!name || !author || !description || !tags || !req.file)
      return res.status(400).json({ error: "All fields and a .md or .skill file are required" });
    const fileContent = fs.readFileSync(req.file.path, "utf-8");
    let parsedTags;
    try { parsedTags = JSON.parse(tags); } catch { parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean); }
    let parsedPairs;
    try { parsedPairs = JSON.parse(pairs_with || "[]"); } catch { parsedPairs = []; }

    const result = queries.insertSkill.run({
      name: name.trim(), author: author.trim(), description: description.trim(),
      tags: JSON.stringify(parsedTags), filename: req.file.originalname,
      file_path: req.file.path, file_content: fileContent,
      verified: 0,
      pairs_with: JSON.stringify(parsedPairs)
    });
    res.status(201).json({ message: "Skill uploaded successfully — pending review", id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message || "Failed to upload skill" }); }
});

// DELETE skill
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

// GET all pending (unverified) skills
app.get("/api/admin/pending", adminAuth, (req, res) => {
  try {
    const skills = queries.getPendingSkills.all().map(s => ({
      ...s, tags: JSON.parse(s.tags), pairs_with: JSON.parse(s.pairs_with || "[]")
    }));
    res.json({ skills });
  } catch (err) { res.status(500).json({ error: "Failed to fetch pending skills" }); }
});

// POST verify a skill
app.post("/api/admin/verify/:id", adminAuth, (req, res) => {
  try {
    queries.verifySkill.run(req.params.id);
    res.json({ message: "Skill verified" });
  } catch (err) { res.status(500).json({ error: "Failed to verify skill" }); }
});

// POST unverify a skill
app.post("/api/admin/unverify/:id", adminAuth, (req, res) => {
  try {
    queries.unverifySkill.run(req.params.id);
    res.json({ message: "Skill unverified" });
  } catch (err) { res.status(500).json({ error: "Failed to unverify skill" }); }
});

// PATCH update pairs_with for a skill
app.patch("/api/admin/pairs/:id", adminAuth, (req, res) => {
  try {
    const { pairs_with } = req.body;
    queries.updatePairsWith.run(JSON.stringify(pairs_with || []), req.params.id);
    res.json({ message: "Pairs updated" });
  } catch (err) { res.status(500).json({ error: "Failed to update pairs" }); }
});

// POST admin login check
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
});

// ── AI Match ──────────────────────────────────────────────────────────────────

app.post("/api/match", async (req, res) => {
  try {
    const { problem } = req.body;
    if (!problem?.trim()) return res.status(400).json({ error: "Problem description is required" });
    const skills = queries.getAllSkillsWithContent.all();
    if (skills.length === 0) return res.json({ matches: [], message: "No skills in the library yet." });
    const skillsContext = skills.map((s) => `SKILL ID: ${s.id}\nNAME: ${s.name}\nAUTHOR: ${s.author}\nTAGS: ${JSON.parse(s.tags).join(", ")}\nDESCRIPTION: ${s.description}\nCONTENT PREVIEW:\n${s.file_content.slice(0, 800)}\n---`).join("\n");
    const prompt = `You are a skills recommendation engine for an organisation's internal AI skills library.\n\nA user has described their problem or task. Recommend the most relevant skills from the library below, ranked by relevance.\n\nUSER PROBLEM:\n"${problem}"\n\nAVAILABLE SKILLS:\n${skillsContext}\n\nRespond with a JSON array of matches (maximum 5, minimum 1). Only include genuinely relevant skills.\nEach match must have:\n- id: the skill's integer ID\n- relevance_score: integer 1-10\n- reason: 1-2 sentence explanation\n- how_to_use: 1 sentence on how to apply it\n- can_combine_with: array of other skill IDs (empty array if none)\n\nReturn ONLY valid JSON, no markdown, no extra text.`;
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    let matches;
    try { matches = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return res.status(500).json({ error: "AI returned an unexpected format. Please try again." }); }
    const enriched = matches.map((match) => {
      const skill = skills.find((s) => s.id === match.id);
      if (!skill) return null;
      return { ...match, name: skill.name, author: skill.author, tags: JSON.parse(skill.tags), description: skill.description, verified: skill.verified };
    }).filter(Boolean).sort((a, b) => b.relevance_score - a.relevance_score);
    res.json({ matches: enriched });
  } catch (err) {
    if (err.message?.includes("GEMINI_API_KEY")) return res.status(500).json({ error: "Gemini API key not configured." });
    res.status(500).json({ error: "AI matching failed. Please try again." });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => { console.log(`\n✅ Skills Hub API running at http://localhost:${PORT}\n`); });
