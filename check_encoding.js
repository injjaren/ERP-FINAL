const db = require('better-sqlite3')('/app/database/accounting.db');

const wh = db.prepare('SELECT id, name, hex(name) as h FROM warehouses').all();
const pt = db.prepare('SELECT id, name, hex(name) as h FROM product_types').all();

console.log('=== WAREHOUSES ===');
wh.forEach(r => console.log(`id=${r.id} hex=${r.h} name=${r.name}`));

console.log('=== PRODUCT_TYPES ===');
pt.forEach(r => console.log(`id=${r.id} hex=${r.h} name=${r.name}`));
