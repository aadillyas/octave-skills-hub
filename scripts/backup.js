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
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function backup() {
  console.log("⬇️  Fetching skills from Railway...");
  const { skills } = await get(`${API}/api/skills`);

  if (!skills || skills.length === 0) {
    console.log("⚠️  No skills found — nothing to back up.");
    return;
  }

  // Fetch full content for each skill (including file_content)
  console.log(`📦  Found ${skills.length} skill(s). Fetching full details...`);
  const full = [];
  for (const skill of skills) {
    const detail = await get(`${API}/api/skills/${skill.id}`);
    full.push(detail);
    console.log(`  ✓ ${skill.name}`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(full, null, 2));
  console.log(`\n✅ Backup saved to scripts/skills-backup.json (${full.length} skills)`);
  console.log("   Commit this file to GitHub to keep it safe.\n");
}

backup().catch((err) => {
  console.error("❌ Backup failed:", err.message);
  process.exit(1);
});
