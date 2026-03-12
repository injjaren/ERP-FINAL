'use strict';
const constants  = require('./constants');
const audit      = require('./audit');
const accounting = require('./accounting');
const inventory  = require('./inventory');
const codes      = require('./codes');
const crud       = require('./crud');

module.exports = {
  ...constants,
  ...audit,
  ...accounting,
  ...inventory,
  ...codes,
  ...crud
};
