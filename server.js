const express = require("express");
const path = require("path");
const { timingSafeEqual } = require("crypto");
const { openDb, run, get, all, init } = require("./db");

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/:file", (req, res, next) => {
  const file = req.params.file;
  if (!file.endsWith(".html") && !["auth.js", "shop.js", "style.css"].includes(file)) {
    return next();
  }
  res.sendFile(path.join(__dirname, file));
});

app.use("/images", express.static(path.join(__dirname, "images")));

function close(db) {
  db.close(() => {});
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", (req, res, next) => {
  const expected = process.env.API_TOKEN;
  const provided = req.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected) return res.status(503).json({ error: "API is not configured" });

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Inventory
app.get("/api/inventory", async (_req, res) => {
  const db = openDb();
  try {
    const rows = await all(db, "SELECT * FROM inventory ORDER BY name");
    res.json(rows.map((r) => ({ ...r, avail: !!r.avail })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.get("/api/inventory/:id", async (req, res) => {
  const db = openDb();
  try {
    const row = await get(db, "SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Item not found" });
    res.json({ ...row, avail: !!row.avail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.post("/api/inventory", async (req, res) => {
  const { id, cat, name, price, unit, min_qty, min, stock, img, description, desc, avail } = req.body || {};
  if (!id || !name) return res.status(400).json({ error: "id and name are required" });
  const db = openDb();
  try {
    await run(
      db,
      `INSERT INTO inventory (id, cat, name, price, unit, min_qty, stock, img, description, avail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cat || "",
        name,
        Number(price) || 0,
        unit || "",
        Number(min_qty ?? min) || 1,
        Number(stock) || 0,
        img || "",
        description ?? desc ?? "",
        avail === false || avail === 0 ? 0 : 1,
      ]
    );
    const row = await get(db, "SELECT * FROM inventory WHERE id = ?", [id]);
    res.status(201).json({ ...row, avail: !!row.avail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.put("/api/inventory/:id", async (req, res) => {
  const { cat, name, price, unit, min_qty, min, stock, img, description, desc, avail } = req.body || {};
  const db = openDb();
  try {
    const existing = await get(db, "SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Item not found" });
    await run(
      db,
      `UPDATE inventory SET
         cat = ?, name = ?, price = ?, unit = ?, min_qty = ?, stock = ?, img = ?, description = ?, avail = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [
        cat ?? existing.cat,
        name ?? existing.name,
        price != null ? Number(price) : existing.price,
        unit ?? existing.unit,
        min_qty != null || min != null ? Number(min_qty ?? min) : existing.min_qty,
        stock != null ? Number(stock) : existing.stock,
        img ?? existing.img,
        description != null || desc != null ? (description ?? desc) : existing.description,
        avail == null ? existing.avail : (avail ? 1 : 0),
        req.params.id,
      ]
    );
    const row = await get(db, "SELECT * FROM inventory WHERE id = ?", [req.params.id]);
    res.json({ ...row, avail: !!row.avail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  const db = openDb();
  try {
    const result = await run(db, "DELETE FROM inventory WHERE id = ?", [req.params.id]);
    if (!result.changes) return res.status(404).json({ error: "Item not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

// Customers
app.get("/api/customers", async (_req, res) => {
  const db = openDb();
  try {
    const rows = await all(
      db,
      "SELECT id, role, name, username, email, phone, address, created_at, updated_at FROM customers ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.get("/api/customers/:id", async (req, res) => {
  const db = openDb();
  try {
    const row = await get(
      db,
      "SELECT id, role, name, username, email, phone, address, created_at, updated_at FROM customers WHERE id = ?",
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.post("/api/customers", async (req, res) => {
  const { id, role, name, username, email, phone, address, salt, pass_hash, passHash } = req.body || {};
  if (!id || !name || !email) return res.status(400).json({ error: "id, name, and email are required" });
  const db = openDb();
  try {
    await run(
      db,
      `INSERT INTO customers (id, role, name, username, email, phone, address, salt, pass_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        role || "customer",
        name,
        username || null,
        String(email).toLowerCase(),
        phone || "",
        address || "",
        salt || "",
        pass_hash ?? passHash ?? "",
      ]
    );
    const row = await get(
      db,
      "SELECT id, role, name, username, email, phone, address, created_at, updated_at FROM customers WHERE id = ?",
      [id]
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.put("/api/customers/:id", async (req, res) => {
  const { role, name, username, email, phone, address, salt, pass_hash, passHash } = req.body || {};
  const db = openDb();
  try {
    const existing = await get(db, "SELECT * FROM customers WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Customer not found" });
    await run(
      db,
      `UPDATE customers SET
         role = ?, name = ?, username = ?, email = ?, phone = ?, address = ?, salt = ?, pass_hash = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [
        role ?? existing.role,
        name ?? existing.name,
        username !== undefined ? username : existing.username,
        email != null ? String(email).toLowerCase() : existing.email,
        phone ?? existing.phone,
        address ?? existing.address,
        salt ?? existing.salt,
        pass_hash != null || passHash != null ? (pass_hash ?? passHash) : existing.pass_hash,
        req.params.id,
      ]
    );
    const row = await get(
      db,
      "SELECT id, role, name, username, email, phone, address, created_at, updated_at FROM customers WHERE id = ?",
      [req.params.id]
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  const db = openDb();
  try {
    const result = await run(db, "DELETE FROM customers WHERE id = ?", [req.params.id]);
    if (!result.changes) return res.status(404).json({ error: "Customer not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    close(db);
  }
});

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  });
