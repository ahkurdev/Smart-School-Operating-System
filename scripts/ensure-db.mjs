// Dev helper: create the application database if it does not exist.
// Uses a direct pg connection to the default "postgres" database.
// Run: node scripts/ensure-db.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const target = new URL(url);
const dbName = target.pathname.replace(/^\//, "");
target.pathname = "/postgres";
target.search = "";

const client = new pg.Client({ connectionString: target.toString() });
await client.connect();
try {
  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (rows.length === 0) {
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`created database ${dbName}`);
  } else {
    console.log(`database ${dbName} already exists`);
  }
} finally {
  await client.end();
}
