'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');

// POST /api/login
// Body: { username, password, branch_id }
router.post('/login', (req, res) => {
  try {
    const { username, password, branch_id } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password are required' });
    if (!branch_id)
      return res.status(400).json({ error: 'يجب اختيار الفرع قبل تسجيل الدخول' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'active')
      return res.status(401).json({ error: 'Account is inactive' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    // Validate branch belongs to user's company
    const branch = db.prepare(
      'SELECT id, name, branch_type FROM branches WHERE id = ? AND company_id = ?'
    ).get(branch_id, user.company_id);
    if (!branch)
      return res.status(400).json({ error: 'الفرع المحدد غير صالح لهذه الشركة' });

    req.session.user = {
      id:          user.id,
      username:    user.username,
      role:        user.role,
      company_id:  user.company_id,
      branch_id:   branch.id,
      branch_name: branch.name,
      branch_type: branch.branch_type || null
    };

    res.json({
      success: true,
      user: {
        id:          user.id,
        username:    user.username,
        role:        user.role,
        company_id:  user.company_id,
        branch_id:   branch.id,
        branch_name: branch.name,
        branch_type: branch.branch_type || null
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true, message: 'Logged out' });
  });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).json({ error: 'Unauthorized' });

  // Refresh branch info from DB in case it was renamed
  const u = req.session.user;
  let branch_name = u.branch_name || null;
  let branch_type = u.branch_type || null;
  if (u.branch_id) {
    const branch = db.prepare('SELECT name, branch_type FROM branches WHERE id = ? AND company_id = ?').get(u.branch_id, u.company_id);
    if (branch) { branch_name = branch.name; branch_type = branch.branch_type || null; }
  }

  res.json({
    user: {
      id:          u.id,
      username:    u.username,
      role:        u.role,
      company_id:  u.company_id,
      branch_id:   u.branch_id   || null,
      branch_name: branch_name,
      branch_type: branch_type
    }
  });
});

// POST /api/session/branch
// Switch active branch for authenticated user.
// SAFETY: Blocks switch if a POS session is currently open for this user.
router.post('/session/branch', requireAuth, (req, res) => {
  try {
    const { branch_id } = req.body;
    if (!branch_id)
      return res.status(400).json({ error: 'branch_id مطلوب' });

    const u = req.session.user;

    // Validate branch belongs to user's company
    const branch = db.prepare(
      'SELECT id, name, branch_type FROM branches WHERE id = ? AND company_id = ?'
    ).get(branch_id, u.company_id);
    if (!branch)
      return res.status(400).json({ error: 'الفرع المحدد غير صالح لهذه الشركة' });

    // SAFETY RULE: block switch if user has an active POS session
    // Uses `sales` table (the actual POS table — sales_invoices does not exist)
    const openPOS = db.prepare(`
      SELECT id FROM sales
      WHERE company_id = ? AND created_by = ? AND status = 'draft'
      LIMIT 1
    `).get(u.company_id, u.username);

    if (openPOS) {
      return res.status(409).json({
        error: 'لا يمكن تغيير الفرع أثناء وجود جلسة POS مفتوحة. أغلق جلسة البيع أولاً.'
      });
    }

    // Also check for open production sessions on current branch
    const openMfg = db.prepare(`
      SELECT id FROM production_sessions
      WHERE company_id = ? AND status = 'OPEN'
      LIMIT 1
    `).get(u.company_id);

    if (openMfg) {
      return res.status(409).json({
        error: 'لا يمكن تغيير الفرع أثناء وجود جلسة إنتاج مفتوحة. أغلق جلسة الإنتاج أولاً.'
      });
    }

    // Update session — include branch_type for UI isolation
    req.session.user = {
      ...u,
      branch_id:   branch.id,
      branch_name: branch.name,
      branch_type: branch.branch_type || null
    };

    res.json({
      success: true,
      branch_id:   branch.id,
      branch_name: branch.name,
      branch_type: branch.branch_type || null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
