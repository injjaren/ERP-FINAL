'use strict';
const { db, originalPrepare } = require('./server/database');
const tables = originalPrepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
const brCols = originalPrepare('PRAGMA table_info(branches)').all().map(c => c.name);
console.log('Branch cols:', brCols);
