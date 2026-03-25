const fs = require("fs");
const path = require("path");
const https = require("https");
const { db, queries } = require("./database");

const BACKUP_VERSION = 2;
const LOCAL_BACKUP_PATH = path.join(__dirname, "..", "scripts", "skills-backup.json");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sanitizeFileName(filename) {
  return (filename || "skill.md").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function requestJson(method, urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        Accept: "application/json",
        "User-Agent": "octave-skills-hub-backup",
        ...headers,
      },
    };

    if (payload) {
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (error) {}

        if (res.statusCode >= 400) {
          const message = parsed?.message || parsed?.error || `HTTP ${res.statusCode}`;
          return reject(new Error(message));
        }

        resolve(parsed);
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function getGitHubConfig() {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO;

  if (!token || !repo) return null;

  return {
    token,
    repo,
    branch: process.env.GITHUB_BACKUP_BRANCH || "main",
    path: process.env.GITHUB_BACKUP_PATH || "scripts/skills-backup.json",
    apiBase: "https://api.github.com",
  };
}

function buildBackupPayload() {
  const skills = queries.getAllSkillsForBackup.all();
  const attachments = queries.getAllAttachmentsForBackup.all();
  const attachmentsBySkill = new Map();

  for (const attachment of attachments) {
    const items = attachmentsBySkill.get(attachment.skill_id) || [];
    items.push({
      id: attachment.id,
      filename: attachment.filename,
      file_size: attachment.file_size,
      created_at: attachment.created_at,
      file_content_base64: Buffer.from(attachment.file_content).toString("base64"),
    });
    attachmentsBySkill.set(attachment.skill_id, items);
  }

  return {
    version: BACKUP_VERSION,
    generated_at: new Date().toISOString(),
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      author: skill.author,
      description: skill.description,
      tags: JSON.parse(skill.tags || "[]"),
      filename: skill.filename,
      file_content: skill.file_content,
      created_at: skill.created_at,
      downloads: skill.downloads,
      verified: skill.verified,
      pairs_with: JSON.parse(skill.pairs_with || "[]"),
      attachments: attachmentsBySkill.get(skill.id) || [],
    })),
  };
}

function writeBackupToDisk(payload, filePath = LOCAL_BACKUP_PATH) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

async function syncBackupToGitHub(payload) {
  const config = getGitHubConfig();
  if (!config) return { synced: false, reason: "GitHub backup sync not configured" };

  const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");
  const headers = {
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const url = `${config.apiBase}/repos/${config.repo}/contents/${config.path}?ref=${encodeURIComponent(config.branch)}`;

  let sha;
  try {
    const existing = await requestJson("GET", url, null, headers);
    sha = existing?.sha;
  } catch (error) {
    if (!String(error.message).includes("Not Found")) throw error;
  }

  await requestJson("PUT", `${config.apiBase}/repos/${config.repo}/contents/${config.path}`, {
    message: `chore: update skills backup (${payload.skills.length} skills)`,
    content,
    branch: config.branch,
    sha,
  }, headers);

  return { synced: true };
}

async function createBackup(reason = "manual") {
  const payload = buildBackupPayload();
  writeBackupToDisk(payload);
  const syncResult = await syncBackupToGitHub(payload);
  return {
    ...syncResult,
    reason,
    filePath: LOCAL_BACKUP_PATH,
    skills: payload.skills.length,
    generated_at: payload.generated_at,
  };
}

async function readBackupFromGitHub() {
  const config = getGitHubConfig();
  if (!config) return null;

  const headers = {
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const url = `${config.apiBase}/repos/${config.repo}/contents/${config.path}?ref=${encodeURIComponent(config.branch)}`;

  const response = await requestJson("GET", url, null, headers);
  if (!response?.content) return null;

  return JSON.parse(Buffer.from(response.content, "base64").toString("utf-8"));
}

function normaliseBackupPayload(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    return {
      version: 1,
      generated_at: null,
      skills: payload,
    };
  }
  return {
    version: payload.version || 1,
    generated_at: payload.generated_at || null,
    skills: Array.isArray(payload.skills) ? payload.skills : [],
  };
}

function writeRestoredMainFile(uploadsDir, skill) {
  const restoredName = `${Date.now()}-${skill.id}-${sanitizeFileName(skill.filename)}`;
  const filePath = path.join(uploadsDir, restoredName);
  fs.writeFileSync(filePath, skill.file_content || "", "utf-8");
  return filePath;
}

function restoreBackupPayload(payload, uploadsDir) {
  const backup = normaliseBackupPayload(payload);
  if (!backup || backup.skills.length === 0) {
    return { restored: false, count: 0, source: "empty" };
  }

  fs.mkdirSync(uploadsDir, { recursive: true });

  const restore = db.transaction((skills) => {
    for (const skill of skills) {
      const filePath = writeRestoredMainFile(uploadsDir, skill);
      queries.insertSkillFromBackup.run({
        id: skill.id,
        name: skill.name,
        author: skill.author,
        description: skill.description,
        tags: JSON.stringify(skill.tags || []),
        filename: skill.filename,
        file_path: filePath,
        file_content: skill.file_content || "",
        created_at: skill.created_at || new Date().toISOString(),
        downloads: skill.downloads || 0,
        verified: skill.verified || 0,
        pairs_with: JSON.stringify(skill.pairs_with || []),
      });

      for (const attachment of (skill.attachments || [])) {
        let contentBuffer = Buffer.alloc(0);

        if (attachment.file_content_base64) {
          contentBuffer = Buffer.from(attachment.file_content_base64, "base64");
        } else if (typeof attachment.file_content === "string") {
          contentBuffer = Buffer.from(attachment.file_content, "utf-8");
        }

        queries.insertAttachmentFromBackup.run({
          id: attachment.id,
          skill_id: skill.id,
          filename: attachment.filename,
          file_content: contentBuffer,
          file_size: attachment.file_size || contentBuffer.length,
          created_at: attachment.created_at || skill.created_at || new Date().toISOString(),
        });
      }
    }
  });

  restore(backup.skills);
  return { restored: true, count: backup.skills.length, source: "backup" };
}

async function restoreLatestBackupIfNeeded(uploadsDir) {
  const existingCount = queries.countSkills.get().count;
  if (existingCount > 0) {
    return { restored: false, count: existingCount, source: "database" };
  }

  let payload = null;
  let source = "local";

  try {
    payload = await readBackupFromGitHub();
    if (payload) source = "github";
  } catch (error) {
    console.warn(`Backup sync: failed to fetch GitHub backup (${error.message})`);
  }

  if (!payload) {
    payload = readJsonFile(LOCAL_BACKUP_PATH);
    source = "local";
  }

  if (!payload) {
    return { restored: false, count: 0, source: "none" };
  }

  const result = restoreBackupPayload(payload, uploadsDir);
  return { ...result, source };
}

module.exports = {
  BACKUP_VERSION,
  LOCAL_BACKUP_PATH,
  buildBackupPayload,
  createBackup,
  normaliseBackupPayload,
  restoreBackupPayload,
  restoreLatestBackupIfNeeded,
  writeBackupToDisk,
};
