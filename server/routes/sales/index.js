'use strict';
const router = require('express').Router();

router.use(require('./pos'));
router.use(require('./revisions'));
router.use(require('./payments'));

module.exports = router;
