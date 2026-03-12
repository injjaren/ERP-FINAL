/**
 * fix_encoding.js
 * Removes garbled test records inserted via Git Bash (CP1256 bytes).
 * Preserves all original user data.
 * Run once inside Docker: node /app/fix_encoding.js
 */
const Database = require('better-sqlite3');
const db = new Database('/app/database/accounting.db');

db.pragma('foreign_keys = OFF');

const fix = db.transaction(() => {
  // Delete inventory_movements that reference garbled test inventory rows (id 1, 2)
  const delMovements = db.prepare(
    `DELETE FROM inventory_movements WHERE inventory_id IN (1, 2)`
  ).run();
  console.log(`Deleted ${delMovements.changes} inventory_movements`);

  // Delete purchases_items referencing those inventory rows (safety)
  const delPurchItems = db.prepare(
    `DELETE FROM purchases_items WHERE inventory_id IN (1, 2)`
  ).run();
  console.log(`Deleted ${delPurchItems.changes} purchases_items`);

  // Delete garbled inventory rows
  const delInv = db.prepare(`DELETE FROM inventory WHERE id IN (1, 2)`).run();
  console.log(`Deleted ${delInv.changes} inventory rows`);

  // Delete garbled product_types (ids 4, 5 — added in test session)
  const delPT = db.prepare(`DELETE FROM product_types WHERE id IN (4, 5)`).run();
  console.log(`Deleted ${delPT.changes} product_types`);

  // Delete garbled warehouse (id 2 — added in test session)
  const delWH = db.prepare(`DELETE FROM warehouses WHERE id = 2`).run();
  console.log(`Deleted ${delWH.changes} warehouses`);
});

fix();
db.pragma('foreign_keys = ON');
console.log('Cleanup complete.');
db.close();
