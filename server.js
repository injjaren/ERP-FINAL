'use strict';
const { db } = require('./server/database');
const { createApp } = require('./server/app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🏭 PROFESSIONAL ERP ACCOUNTING SYSTEM v2.5 (REFINED)         ║
║                                                                ║
║   📊 Dashboard:     http://localhost:${PORT}                      ║
║   🔌 API:           http://localhost:${PORT}/api/dashboard        ║
║   💾 Database:      ./database/accounting.db      ║
║                                                                ║
║   ✅ NEW IN v2.5 (Refined TDWAR System):                       ║
║      - Single source of truth: TDWAR only (old screen disabled)║
║      - Labor cost = actual production × price (NOT expected)   ║
║      - Waste auto-calculated (expected - actual)               ║
║      - SABRA auto-created with same color as BOBINE            ║
║      - JAAB (bags) optional: can be 0                          ║
║      - Artisan expenses/advances with treasury integration     ║
║      - Simplified artisan screen with payment button           ║
║      - Reduced duplicate screens                               ║
║                                                                ║
║   ✅ FROM v2.4:                                                ║
║      - TDWAR production system, artisan dashboard              ║
║                                                                ║
║   ✅ Modules:                                                  ║
║      - Color Codes (inline creation)                           ║
║      - Advanced Inventory                                      ║
║      - Manufacturing with material tracking                    ║
║      - POS System with constraints                             ║
║      - Professional Check Management                           ║
║      - Treasury Ledger (read-only)                             ║
║      - Financial Reports (accurate)                            ║
║      - Complete Audit Log                                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => { console.log('Shutting down gracefully...'); db.close(); process.exit(0); });
