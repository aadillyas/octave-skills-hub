#!/usr/bin/env node
// backup.js — exports all skills from Railway to a local JSON file
// Run before any redeploy: node scripts/backup.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const API = process.env.API_URL || "https://octave-skills-hub-production.up.railway.app";
const OUTPUT = path.join(__dirname, "skills-backup.json");

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ json: JSON.parse(data), raw: data }); }
        catch { resolve({ json: null, raw: data }); }
      });
    }).on("error", reject);
  });
}

async function backup() {
  console.log("⬇️  Fetching skills from Railway...");
  const { json } = await get(`${API}/api/skills`);
  const skills = json?.skills;

  if (!skills || skills.length === 0) {
    console.log("⚠️  No skills found — nothing to back up.");
    return;
  }

  console.log(`📦  Found ${skills.length} skill(s). Fetching file content...`);
  const full = [];

  for (const skill of skills) {
    // Fetch the actual file content via the individual endpoint
    const { json: detail } = await get(`${API}/api/skills/${skill.id}`);

    full.push({
      id: skill.id,
      name: skill.name,
      author: skill.author,
      description: skill.description,
      tags: skill.tags,
      filename: skill.filename,
      verified: skill.verified,
      pairs_with: skill.pairs_with || [],   // ← captured from list endpoint
      downloads: skill.downloads,
      created_at: skill.created_at,
      file_content: detail?.file_content || "", // ← from detail endpoint
    });

    console.log(`  ✓ ${skill.name} (pairs: ${(skill.pairs_with || []).length})`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(full, null, 2));
  console.log(`\n✅ Backup saved to scripts/skills-backup.json (${full.length} skills)`);
  console.log("   Commit this file to GitHub to keep it safe.\n");
}

backup().catch((err) => {
  console.error("❌ Backup failed:", err.message);
  process.exit(1);
});
