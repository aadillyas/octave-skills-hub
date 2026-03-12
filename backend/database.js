const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "skills-hub.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create tables
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
    downloads INTEGER DEFAULT 0
  );
`);

// Queries
const queries = {
  getAllSkills: db.prepare(`
    SELECT id, name, author, description, tags, filename, created_at, downloads
    FROM skills
    ORDER BY created_at DESC
  `),

  searchSkills: db.prepare(`
    SELECT id, name, author, description, tags, filename, created_at, downloads
    FROM skills
    WHERE name LIKE ? OR description LIKE ? OR tags LIKE ? OR author LIKE ?
    ORDER BY created_at DESC
  `),

  getSkillById: db.prepare(`
    SELECT * FROM skills WHERE id = ?
  `),

  insertSkill: db.prepare(`
    INSERT INTO skills (name, author, description, tags, filename, file_path, file_content)
    VALUES (@name, @author, @description, @tags, @filename, @file_path, @file_content)
  `),

  incrementDownloads: db.prepare(`
    UPDATE skills SET downloads = downloads + 1 WHERE id = ?
  `),

  getAllSkillsWithContent: db.prepare(`
    SELECT id, name, author, description, tags, file_content
    FROM skills
  `),

  deleteSkill: db.prepare(`
    DELETE FROM skills WHERE id = ?
  `)
};

module.exports = { db, queries };
