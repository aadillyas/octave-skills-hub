#!/usr/bin/env node
// restore.js — sends the saved backup to the live backend restore endpoint
// Manual fallback after a reset: node scripts/restore.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const API_URL = process.env.API_URL || "https://octave-skills-hub-production.up.railway.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "octave-admin";
const BACKUP = path.join(__dirname, "skills-backup.json");

if (!fs.existsSync(BACKUP)) {
  console.error("❌ No backup file found at scripts/skills-backup.json");
  console.error("   Run 'node scripts/backup.js' first.");
  process.exit(1);
}

function postJson(urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (error) {}

        if (res.statusCode >= 400) {
          return reject(new Error(parsed?.error || `HTTP ${res.statusCode}`));
        }

        resolve(parsed);
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function restore() {
  const payload = JSON.parse(fs.readFileSync(BACKUP, "utf-8"));
  const count = Array.isArray(payload.skills) ? payload.skills.length : Array.isArray(payload) ? payload.length : 0;

  console.log(`⬆️  Restoring ${count} skill(s) from ${BACKUP}...`);
  const result = await postJson(`${API_URL}/api/admin/restore`, payload, {
    "x-admin-password": ADMIN_PASSWORD,
  });

  console.log(`✅ Restore complete (${result.count || 0} skill(s) restored from ${result.source || "backup"}).\n`);
}

restore().catch((err) => {
  console.error("❌ Restore failed:", err.message);
  process.exit(1);
});
