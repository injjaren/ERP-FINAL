'use strict';
const router = require('express').Router();
const { db } = require('../database');

// ============================================
// VERSION CONSTANTS - single source of truth
// ============================================
const ERP_VERSION = 'ERP-v9-COLOR-INVENTORY-TABLE';
const ERP_BUILD   = new Date().toISOString();

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    time: new Date().toISOString(),
    version: ERP_VERSION,
    build_time: ERP_BUILD,
    docker: process.env.DOCKER === 'true'
  });
});

// ============================================
// ERP-v8: GET /api/context — Branch Visual Context Layer
// Returns branch identity + user role for UI rendering only.
// No business logic. No POS/accounting/transfer changes.
// ============================================
router.get('/api/context', (req, res) => {
  try {
    const cid      = req.company_id;
    const session  = req.session && req.session.user;
    const role     = session ? session.role     : null;
    const branchId = session ? session.branch_id : null;

    let branch = null;
    if (branchId) {
      branch = db.prepare(
        `SELECT id, name, code, branch_type FROM branches WHERE id = ? AND company_id = ?`
      ).get(branchId, cid);
    }

    res.json({
      branch_id:   branch ? branch.id        : null,
      branch_name: branch ? branch.name      : null,
      branch_type: branch ? branch.branch_type : null,
      role:        role,
      is_admin:    role === 'ADMIN'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/system/version', (req, res) => {
  res.json({
    version: ERP_VERSION,
    build_time: ERP_BUILD,
    environment: process.env.NODE_ENV || 'development',
    docker: process.env.DOCKER === 'true'
  });
});

// No DB query. No company_id. Always 200.
router.get('/api/version', (req, res) => {
  res.json({
    version:    ERP_VERSION,
    build_time: ERP_BUILD || null,
    status:     'OK'
  });
});

module.exports = router;
