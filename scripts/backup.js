#!/usr/bin/env node
// backup.js — downloads a full-fidelity backup from the live backend
// Manual fallback: node scripts/backup.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const API_URL = process.env.API_URL || "https://octave-skills-hub-production.up.railway.app";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "octave-admin";
const OUTPUT = path.join(__dirname, "skills-backup.json");

function getJson(urlString, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (error) {
          return reject(new Error("Live backup endpoint did not return valid JSON"));
        }

        if (res.statusCode >= 400) {
          return reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
        }

        resolve(parsed);
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function backup() {
  console.log("⬇️  Downloading full backup from the live backend...");
  const payload = await getJson(`${API_URL}/api/admin/backup`, {
    "x-admin-password": ADMIN_PASSWORD,
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
  console.log(`✅ Backup saved to ${OUTPUT}`);
  console.log(`   Includes ${payload.skills?.length || 0} skill(s), metadata, and attachment content.\n`);
}

backup().catch((err) => {
  console.error("❌ Backup failed:", err.message);
  process.exit(1);
});
