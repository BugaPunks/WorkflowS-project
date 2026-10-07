import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = path.resolve(process.cwd(), "dev.db");

if (!fs.existsSync(dbPath)) {
	console.error(`No se encontró la base de datos en ${dbPath}`);
	process.exit(1);
}

// Backup previo al reset
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupPath = `${dbPath}.bak-reset-${stamp}`;
fs.copyFileSync(dbPath, backupPath);
console.log(`Backup creado: ${backupPath}`);

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = OFF");

const keep = new Set(["users", "_prisma_migrations"]);
const tables = db
	.prepare(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
	)
	.all() as { name: string }[];

const allNames = tables.map((t) => t.name);
const toTruncate = allNames.filter((n) => !keep.has(n));

const countsBefore: Record<string, number> = {};
for (const name of allNames) {
	countsBefore[name] = (
		db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get() as { c: number }
	).c;
}

db.exec("BEGIN");
try {
	for (const name of toTruncate) {
		db.exec(`DELETE FROM "${name}"`);
	}
	db.exec("COMMIT");
} catch (err) {
	db.exec("ROLLBACK");
	throw err;
}

db.exec("PRAGMA foreign_keys = ON");
db.exec("VACUUM");
db.close();

console.log("\nFilas eliminadas por tabla:");
for (const name of toTruncate) {
	console.log(`  - ${name}: ${countsBefore[name]}`);
}
console.log("\nFilas conservadas:");
for (const name of keep) {
	if (countsBefore[name] !== undefined) console.log(`  - ${name}: ${countsBefore[name]}`);
}
console.log("\nReset completado.");
