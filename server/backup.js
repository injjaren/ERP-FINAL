const fs = require('fs');
fs.copyFileSync('../database/accounting.db', '../database/accounting_pre_branch_isolation.db.bak');
console.log('Backup successful');
