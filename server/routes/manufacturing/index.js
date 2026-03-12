'use strict';
const router = require('express').Router();

router.use(require('./batches'));
router.use(require('./artisans'));
router.use(require('./sessions').router);
router.use(require('./workers'));
router.use(require('./overview'));

module.exports = router;
