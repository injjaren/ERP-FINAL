'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const { db } = require('./database');

const { companyMiddleware } = require('./middleware/company');

// Route modules
const systemRouter        = require('./routes/system');
const authRouter          = require('./routes/auth');
const serviceTypesRouter  = require('./routes/service-types');
const inventoryRouter     = require('./routes/inventory');
const dashboardRouter     = require('./routes/dashboard');
const branchesRouter      = require('./routes/branches');
const masterDataRouter    = require('./routes/master-data');
const colorsRouter        = require('./routes/colors');
const manufacturingRouter = require('./routes/manufacturing');
const purchasesRouter     = require('./routes/purchases');
const salesRouter         = require('./routes/sales');
const treasuryRouter      = require('./routes/treasury');
const checksRouter        = require('./routes/checks');
const accountingRouter    = require('./routes/accounting');
const tailoringRouter     = require('./routes/tailoring');

function createApp() {
  const app = express();

  // Core middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors());
  app.use(express.json());
  app.use(session({
    secret: 'erp-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  app.use(express.static('public'));
  app.use(companyMiddleware);

  // Route modules
  app.use(systemRouter);
  app.use('/api', authRouter);
  app.use('/api/service-types', serviceTypesRouter);
  app.use('/api', inventoryRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', branchesRouter);
  app.use('/api', masterDataRouter);
  app.use('/api', colorsRouter);
  app.use('/api', manufacturingRouter);
  app.use('/api', purchasesRouter);
  app.use('/api', salesRouter);
  app.use('/api/treasury', treasuryRouter);
  app.use('/api/checks', checksRouter);
  app.use('/api', accountingRouter);
  app.use('/api', tailoringRouter);

  // Error handlers
  app.use('/api/*', (req, res) => { res.status(404).json({ error: 'API endpoint not found' }); });
  app.use((err, req, res, next) => { console.error('Error:', err); res.status(500).json({ error: err.message || 'Internal server error' }); });

  // Midnight auto-close: close stale OPEN sessions from previous days at 00:05
  scheduleAutoClose();

  return app;
}

// Runs daily at 00:05 to close OPEN sessions with session_date < today
function scheduleAutoClose() {
  const { autoCloseSessionSync } = require('./routes/manufacturing/sessions');

  const msUntilNext0005 = () => {
    const now = new Date(), next = new Date();
    next.setHours(0, 5, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  };

  const tick = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stale = db.prepare(
        `SELECT id, company_id FROM production_sessions WHERE status = 'OPEN' AND session_date < ?`
      ).all(today);
      if (stale.length > 0) {
        for (const s of stale) {
          try { autoCloseSessionSync(s.id, s.company_id); } catch (e) {
            console.error(`[AUTO-CLOSE] Failed session ${s.id}:`, e.message);
          }
        }
        console.log(`[AUTO-CLOSE] Closed ${stale.length} stale sessions`);
      }
    } catch (e) { console.error('[AUTO-CLOSE ERROR]', e.message); }
    setTimeout(tick, msUntilNext0005());
  };

  setTimeout(tick, msUntilNext0005());
}

module.exports = { createApp };
