'use strict';

// ── Context middleware — sets req.company_id and req.branch_id on every request ─
// Reads both values from session (set at login).
// Renamed internally to contextMiddleware; exported as companyMiddleware
// for backward compatibility with all existing route imports.
function contextMiddleware(req, res, next) {
  const u = req.session && req.session.user;
  req.company_id = u ? u.company_id : 1;
  req.branch_id  = u ? (u.branch_id || null) : null;

  // STRICT BRANCH ISOLATION: Require branch for all API requests (except Auth/Setup/Branches)
  const isAuthRoute = req.path.match(/^\/api\/(login|logout|me|session\/branch|branches)/);
  if (!isAuthRoute && !req.branch_id && req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Missing active branch context. Please select a branch.' });
  }

  next();
}

// Backward-compatible export alias
module.exports = { companyMiddleware: contextMiddleware };
