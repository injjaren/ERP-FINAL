'use strict';
const router = require('express').Router();
const { db } = require('../database');

router.get('/', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM service_types WHERE company_id = ?').all(req.company_id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, description, overhead_rate } = req.body;
    const cid = req.company_id;
    const last = db.prepare(`SELECT code FROM service_types WHERE company_id = ? AND code LIKE 'SRV%' ORDER BY id DESC LIMIT 1`).get(cid);
    let nextCode = 'SRV6000';
    if (last && last.code) { const n = parseInt(last.code.replace('SRV','')) || 6000; nextCode = `SRV${n+1}`; }
    const result = db.prepare(`INSERT INTO service_types (code, name, description, overhead_rate, company_id) VALUES (?, ?, ?, ?, ?)`).run(nextCode, name, description, overhead_rate || 0.10, cid);
    res.status(201).json({ id: result.lastInsertRowid, code: nextCode, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, description, overhead_rate } = req.body;
    db.prepare(`UPDATE service_types SET name = ?, description = ?, overhead_rate = ? WHERE id = ? AND company_id = ?`).run(name, description, overhead_rate, req.params.id, req.company_id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM service_types WHERE id = ? AND company_id = ?').run(req.params.id, req.company_id);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
