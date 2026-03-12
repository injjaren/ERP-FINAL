'use strict';

// ============================================
// ERP-v10: INVENTORY STAGE VALIDATION
// ============================================
const KG_TO_OZ = 32; // Fixed commercial conversion: 1 kg = 32 ounces

const STAGE_BRANCH_RULES = {
  'raw_bobbin':   ['wholesale'],
  'wholesale_kg': ['wholesale'],
  'retail_kg':    ['retail'],
  'retail_oz':    ['retail'],
  'supplies':     ['supplies', 'wholesale', 'retail']
};

const VALID_STAGES = Object.keys(STAGE_BRANCH_RULES);

// ============================================
// AUTO-GENERATE CODES (v2.1)
// ============================================
const CODE_PREFIXES = {
  clients:       { prefix: 'CLI', start: 1000 },
  suppliers:     { prefix: 'SUP', start: 2000 },
  warehouses:    { prefix: 'WH',  start: 4000 },
  product_types: { prefix: 'PRD', start: 5000 },
  service_types: { prefix: 'SRV', start: 6000 },
  artisans:      { prefix: 'ART', start: 7000 },
  employees:     { prefix: 'EMP', start: 8000 },
  partners:      { prefix: 'PTR', start: 9000 }
};

// ============================================
// COLOR CONTROL POLICY v6
// ============================================
const MASTER_COLOR_WRITE_BRANCH = 'الجملة'; // only this branch may create or mutate colors

module.exports = { KG_TO_OZ, STAGE_BRANCH_RULES, VALID_STAGES, CODE_PREFIXES, MASTER_COLOR_WRITE_BRANCH };
