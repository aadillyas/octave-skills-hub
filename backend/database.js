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

db.exec(`
  CREATE TABLE IF NOT EXISTS skill_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_content BLOB NOT NULL,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrate existing databases — safe to run on fresh ones too
try { db.exec(`ALTER TABLE skills ADD COLUMN verified INTEGER DEFAULT 0`); } catch(e) {}
try { db.exec(`ALTER TABLE skills ADD COLUMN pairs_with TEXT DEFAULT '[]'`); } catch(e) {}

const queries = {
  countSkills: db.prepare(`SELECT COUNT(*) AS count FROM skills`),

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

  getAllSkillsForBackup: db.prepare(`
    SELECT id, name, author, description, tags, filename, file_path, file_content, created_at, downloads, verified, pairs_with
    FROM skills ORDER BY id ASC
  `),

  insertSkill: db.prepare(`
    INSERT INTO skills (name, author, description, tags, filename, file_path, file_content, verified, pairs_with)
    VALUES (@name, @author, @description, @tags, @filename, @file_path, @file_content, @verified, @pairs_with)
  `),

  insertSkillFromBackup: db.prepare(`
    INSERT INTO skills (id, name, author, description, tags, filename, file_path, file_content, created_at, downloads, verified, pairs_with)
    VALUES (@id, @name, @author, @description, @tags, @filename, @file_path, @file_content, @created_at, @downloads, @verified, @pairs_with)
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
  getAllSkillNames: db.prepare(`SELECT id, name, verified FROM skills ORDER BY name ASC`),

  insertAttachment: db.prepare(`
    INSERT INTO skill_attachments (skill_id, filename, file_content, file_size)
    VALUES (@skill_id, @filename, @file_content, @file_size)
  `),

  getAttachmentsBySkillId: db.prepare(`
    SELECT id, skill_id, filename, file_size, created_at FROM skill_attachments WHERE skill_id = ?
  `),

  getAttachmentsWithContentBySkillId: db.prepare(`
    SELECT id, filename, file_content, file_size FROM skill_attachments WHERE skill_id = ?
  `),

  getAllAttachmentsForBackup: db.prepare(`
    SELECT id, skill_id, filename, file_content, file_size, created_at
    FROM skill_attachments ORDER BY skill_id ASC, id ASC
  `),

  insertAttachmentFromBackup: db.prepare(`
    INSERT INTO skill_attachments (id, skill_id, filename, file_content, file_size, created_at)
    VALUES (@id, @skill_id, @filename, @file_content, @file_size, @created_at)
  `),

  getAttachmentContentById: db.prepare(`
    SELECT filename, file_content FROM skill_attachments WHERE id = ?
  `),

  deleteAttachment: db.prepare(`DELETE FROM skill_attachments WHERE id = ? AND skill_id = ?`)
};

module.exports = { db, queries };
