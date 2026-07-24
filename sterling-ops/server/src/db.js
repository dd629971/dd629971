import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "sterling.db");
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    type TEXT NOT NULL DEFAULT 'Prospect',
    leadSource TEXT,
    zone TEXT,
    recordingUrl TEXT,
    transcript TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    customerId TEXT NOT NULL REFERENCES customers(id),
    customerName TEXT NOT NULL,
    serviceType TEXT NOT NULL,
    sqft TEXT NOT NULL,
    address TEXT,
    lineItems TEXT NOT NULL DEFAULT '[]',
    basePrice REAL NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    cardOnFile INTEGER NOT NULL DEFAULT 0,
    stripeSetupIntentId TEXT,
    stripeCustomerId TEXT,
    needsReconfirmation INTEGER NOT NULL DEFAULT 0,
    serviceDate TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    quoteId TEXT NOT NULL REFERENCES quotes(id),
    customerId TEXT NOT NULL REFERENCES customers(id),
    customerName TEXT NOT NULL,
    serviceType TEXT NOT NULL,
    address TEXT,
    price REAL NOT NULL,
    cleanerPay REAL NOT NULL,
    cardOnFile INTEGER NOT NULL DEFAULT 0,
    serviceDate TEXT,
    stage TEXT NOT NULL DEFAULT 'Scheduled',
    cleanerId TEXT REFERENCES cleaners(id),
    briefText TEXT,
    briefSentAt TEXT,
    timeline TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cleaners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    areas TEXT,
    blacklisted INTEGER NOT NULL DEFAULT 0,
    reliabilityNotes TEXT
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    area TEXT NOT NULL,
    decision TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    date TEXT NOT NULL
  );
`);

const cleanerCount = db.prepare("SELECT COUNT(*) AS n FROM cleaners").get().n;
if (cleanerCount === 0) {
  const insert = db.prepare(
    "INSERT INTO cleaners (id, name, phone, areas, blacklisted, reliabilityNotes) VALUES (?, ?, ?, ?, 0, NULL)"
  );
  insert.run("c1", "Justice Perkins", "+15550001111", "Dallas, Plano, Frisco, Arlington");
  insert.run("c2", "Gwen Richardson", "+15550002222", "Houston, Katy, Sugar Land");
  insert.run("c3", "Kyle Nolan", "+15550003333", "San Antonio, New Braunfels");
}
