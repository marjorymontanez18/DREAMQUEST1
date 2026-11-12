const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "dreamquest.db");

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function init() {
  const db = openDb();
  await run(db, "PRAGMA foreign_keys = ON");

  await run(db, `
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      cat TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      min_qty INTEGER NOT NULL DEFAULT 1,
      stock INTEGER NOT NULL DEFAULT 0,
      img TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      avail INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'customer',
      name TEXT NOT NULL,
      username TEXT,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      salt TEXT NOT NULL DEFAULT '',
      pass_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await run(db, `CREATE INDEX IF NOT EXISTS idx_inventory_cat ON inventory(cat)`);
  await run(db, `CREATE INDEX IF NOT EXISTS idx_customers_role ON customers(role)`);

  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve(DB_PATH)));
  });
}

module.exports = {
  DB_PATH,
  openDb,
  run,
  get,
  all,
  init,
};
