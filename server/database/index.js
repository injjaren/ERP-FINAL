'use strict';
const { db, originalPrepare, activateIsolation } = require('./connection');
const { schema }       = require('./schema');
const { runMigrations } = require('./migrations');

// 1. Execute schema (CREATE TABLE IF NOT EXISTS — idempotent)
db.exec(schema);

// 2. Run all migrations and seed data
runMigrations();

// 3. Activate isolation guard — must happen AFTER all migrations/seeds complete
activateIsolation();

module.exports = { db, originalPrepare };
