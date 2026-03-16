#!/usr/bin/env node
// restore.js — re-uploads all skills from local backup to Railway
// Run after a redeploy: node scripts/restore.js

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

// Multipart form-data helper (no dependencies needed)
function buildFormData(fields, filename, fileContent) {
  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const lines = [];

  for (const [key, value] of Object.entries(fields)) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${key}"`);
    lines.push("");
    lines.push(value);
  }

  // File field
  lines.push(`--${boundary}`);
  lines.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
  lines.push("Content-Type: text/markdown");
  lines.push("");
  lines.push(fileContent);
  lines.push(`--${boundary}--`);

  const body = lines.join("\r\n");
  return { body, boundary };
}

function post(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function patchJson(urlStr, data, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", (chunk) => (d += chunk));
      res.on("end", () => resolve({ status: res.statusCode }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function restore() {
  const skills = JSON.parse(fs.readFileSync(BACKUP, "utf-8"));
  console.log(`⬆️  Restoring ${skills.length} skill(s) to Railway...\n`);

  const idMap = {}; // old id → new id (for pairs_with remapping)

  // First pass — upload all skills
  for (const skill of skills) {
    const filename = skill.filename || `${skill.name.replace(/\s+/g, "-").toLowerCase()}.md`;
    const fileContent = skill.file_content || "";

    const { body, boundary } = buildFormData(
      {
        name: skill.name,
        author: skill.author,
        description: skill.description,
        tags: JSON.stringify(skill.tags || []),
        pairs_with: "[]", // set after all IDs are known
      },
      filename,
      fileContent
    );

    const res = await post(`${API_URL}/api/skills`, body, {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": Buffer.byteLength(body),
    });

    if (res.status === 201) {
      const newId = res.body.id;
      idMap[skill.id] = newId;
      const attCount = (skill.attachments || []).length;
      const attNote = attCount > 0 ? ` (${attCount} attachment(s) — re-upload manually)` : "";
      console.log(`  ✓ Uploaded: ${skill.name} (new id: ${newId})${attNote}`);

      // Re-verify if it was verified
      if (skill.verified === 1) {
        await post(`${API_URL}/api/admin/verify/${newId}`, "", {
          "x-admin-password": ADMIN_PASSWORD,
          "Content-Length": "0",
        });
        console.log(`    ✓ Verified`);
      }
    } else {
      console.log(`  ✗ Failed: ${skill.name} — ${JSON.stringify(res.body)}`);
    }
  }

  // Second pass — restore pairs_with using remapped IDs
  console.log("\n🔗 Restoring skill pairs...");
  for (const skill of skills) {
    const newId = idMap[skill.id];
    if (!newId) continue;
    const oldPairs = skill.pairs_with || [];
    const newPairs = oldPairs.map(oldId => idMap[oldId]).filter(Boolean);
    if (newPairs.length > 0) {
      await patchJson(
        `${API_URL}/api/admin/pairs/${newId}`,
        { pairs_with: newPairs },
        { "x-admin-password": ADMIN_PASSWORD }
      );
      console.log(`  ✓ Pairs restored for: ${skill.name}`);
    }
  }

  console.log(`\n✅ Restore complete — ${Object.keys(idMap).length} skills uploaded.\n`);
}

restore().catch((err) => {
  console.error("❌ Restore failed:", err.message);
  process.exit(1);
});
