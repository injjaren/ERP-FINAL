// هذا السكريبت يطبق التصحيحات على النظام الموجود
const Database = require('better-sqlite3');
const fs = require('fs');

const DB_PATH = './database/accounting.db';

if (!fs.existsSync(DB_PATH)) {
  console.log('❌ Database not found. Please run the system first.');
  process.exit(1);
}

const db = new Database(DB_PATH);

console.log('🔧 Applying fixes...');

// إضافة عمود image_url
try {
  db.exec('ALTER TABLE inventory ADD COLUMN image_url TEXT');
  console.log('✅ Added image_url column to inventory');
} catch (e) {
  if (e.message.includes('duplicate')) {
    console.log('ℹ️  image_url already exists');
  }
}

// إنشاء جدول auto_counters إذا لم يكن موجوداً
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auto_counters (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      client_counter INTEGER DEFAULT 1000,
      supplier_counter INTEGER DEFAULT 2000,
      color_code_counter INTEGER DEFAULT 3000,
      warehouse_counter INTEGER DEFAULT 4000,
      product_type_counter INTEGER DEFAULT 5000,
      service_type_counter INTEGER DEFAULT 6000,
      artisan_counter INTEGER DEFAULT 7000
    );
    INSERT OR IGNORE INTO auto_counters (id) VALUES (1);
  `);
  console.log('✅ Created auto_counters table');
} catch (e) {
  console.log('ℹ️  auto_counters already exists');
}

db.close();
console.log('✅ All fixes applied successfully!');
console.log('📌 Next: Restart the server');
