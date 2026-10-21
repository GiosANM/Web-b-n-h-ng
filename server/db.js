import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { catalog } from "./catalog.js";
export function openDatabase(filename) {
  if (filename !== ":memory:")
    fs.mkdirSync(path.dirname(path.resolve(filename)), {
      recursive: true,
      mode: 0o700,
    });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS variants(product_id TEXT NOT NULL REFERENCES products(id),color TEXT NOT NULL,size TEXT NOT NULL,stock INTEGER NOT NULL CHECK(stock>=0),PRIMARY KEY(product_id,color,size));
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,request_hash TEXT NOT NULL,access_token TEXT NOT NULL,customer TEXT NOT NULL,items TEXT NOT NULL,subtotal INTEGER NOT NULL,discount INTEGER NOT NULL,shipping INTEGER NOT NULL,total INTEGER NOT NULL,coupon TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);`);
  db.exec("BEGIN");
  try {
    const product = db.prepare("INSERT OR IGNORE INTO products VALUES(?,?)");
    const variant = db.prepare(
      "INSERT OR IGNORE INTO variants VALUES(?,?,?,?)",
    );
    for (const p of catalog) {
      product.run(p.id, JSON.stringify(p));
      for (const color of p.colors)
        for (const size of p.sizes) variant.run(p.id, color.id, size, 10);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return db;
}
export function getProducts(db) {
  return db
    .prepare("SELECT data FROM products ORDER BY rowid")
    .all()
    .map((row) => {
      const p = JSON.parse(row.data);
      return {
        ...p,
        variants: db
          .prepare("SELECT color,size,stock FROM variants WHERE product_id=?")
          .all(p.id),
      };
    });
}
