const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "skills-hub.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT NOT NULL,
    tags TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    downloads INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    pairs_with TEXT DEFAULT '[]'
  );
`);

// Migrate existing databases — safe to run on fresh ones too
try { db.exec(`ALTER TABLE skills ADD COLUMN verified INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE skills ADD COLUMN pairs_with TEXT DEFAULT '[]'`); } catch(e) {}

const queries = {
  getAllSkills: db.prepare(`
    SELECT id, name, author, description, tags, filename, created_at, downloads, verified, pairs_with
    FROM skills ORDER BY verified DESC, created_at DESC
  `),

  searchSkills: db.prepare(`
    SELECT id, name, author, description, tags, filename, created_at, downloads, verified, pairs_with
    FROM skills
    WHERE name LIKE ? OR description LIKE ? OR tags LIKE ? OR author LIKE ?
    ORDER BY verified DESC, created_at DESC
  `),

  getSkillById: db.prepare(`SELECT * FROM skills WHERE id = ?`),

  insertSkill: db.prepare(`
    INSERT INTO skills (name, author, description, tags, filename, file_path, file_content, verified, pairs_with)
    VALUES (@name, @author, @description, @tags, @filename, @file_path, @file_content, @verified, @pairs_with)
  `),

  incrementDownloads: db.prepare(`UPDATE skills SET downloads = downloads + 1 WHERE id = ?`),

  getAllSkillsWithContent: db.prepare(`
    SELECT id, name, author, description, tags, file_content, verified, pairs_with FROM skills
  `),

  verifySkill: db.prepare(`UPDATE skills SET verified = 1 WHERE id = ?`),
  unverifySkill: db.prepare(`UPDATE skills SET verified = 0 WHERE id = ?`),
  updatePairsWith: db.prepare(`UPDATE skills SET pairs_with = ? WHERE id = ?`),

  getPendingSkills: db.prepare(`
    SELECT id, name, author, description, tags, filename, created_at, downloads, verified, pairs_with
    FROM skills WHERE verified = 0 ORDER BY created_at DESC
  `),

  deleteSkill: db.prepare(`DELETE FROM skills WHERE id = ?`),
  getAllSkillNames: db.prepare(`SELECT id, name, verified FROM skills ORDER BY name ASC`)
};

module.exports = { db, queries };
