const API = '';
const USER = 'admin';

// Utils
const fmt = (n) => parseFloat(n||0).toLocaleString('ar-MA') + ' DH';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-MA') : '';

async function api(url, opts = {}) {
  const res = await fetch(API + url, {
    ...opts,
    headers: {'Content-Type': 'application/json', ...opts.headers}
  });
  if (!res.ok) throw new Error((await res.json()).error || 'خطأ');
  return res.status === 204 ? null : await res.json();
}

function toast(msg, type='success') {
  const d = document.createElement('div');
  d.className = `alert alert-${type}`;
  d.textContent = msg;
  d.style.cssText = 'position:fixed;top:90px;left:50%;transform:translateX(-50%);z-index:9999;animation:slideDown 0.3s';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

function modal(title, html, onSave) {
  const m = document.getElementById('modal-container');
  m.innerHTML = `<div class="modal active"><div class="modal-content">
    <div class="modal-header"><span>${title}</span><button class="modal-close" onclick="this.closest('.modal').remove()">×</button></div>
    <div>${html}</div></div></div>`;
  const form = m.querySelector('form');
  if (form && onSave) form.onsubmit = async (e) => {
    e.preventDefault();
    try { await onSave(e); m.innerHTML = ''; }
    catch(err) { toast(err.message, 'danger'); }
  };
}

function nav(page) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  const item = document.querySelector(`[data-page="${page}"]`);
  if (item) item.classList.add('active');
  const c = document.getElementById('page-container');
  const pages = {
    'dashboard': loadDashboard,
    'color-codes': loadColorCodes,
    'warehouses': loadWarehouses,
    'product-types': loadProductTypes,
    'service-types': loadServiceTypes,
    'inventory': loadInventory,
    'artisans': loadArtisans,
    'manufacturing': loadManufacturing,
    'tdwar': loadTDWAR,
    'artisan-dashboard': loadArtisanDashboard,
    'pos': loadPOS,
    'special-orders': loadSpecialOrders,
    'sales': loadSales,
    'purchases': loadPurchases,
    'checks-portfolio': loadChecksPortfolio,
    'checks-issued': loadChecksIssued,
    'treasury': loadTreasury,
    'expenses': loadExpenses,
    'clients': loadClients,
    'suppliers': loadSuppliers,
    'reports': loadReports
  };
  if (pages[page]) pages[page](c);
  else c.innerHTML = '<div class="alert alert-warning">صفحة غير موجودة</div>';
}

// Dashboard
async function loadDashboard(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const d = await api('/api/dashboard');
    c.innerHTML = `
      <div class="page-header"><h2>📊 لوحة التحكم</h2></div>
      <div class="alert alert-success">✅ النظام يعمل بنجاح | v2.6 - إصلاحات TDWAR + POS</div>
      <div class="stats-grid">
        <div class="stat-card"><h3>💰 الصندوق</h3><div class="value">${fmt(d.cash)}</div></div>
        <div class="stat-card success"><h3>🏦 البنك</h3><div class="value">${fmt(d.bank)}</div></div>
        <div class="stat-card warning"><h3>📝 شيكات تحت التحصيل</h3><div class="value">${fmt(d.checksUnderCollection)}</div></div>
        <div class="stat-card success"><h3>💵 إجمالي السيولة</h3><div class="value">${fmt(d.totalLiquid)}</div></div>
        <div class="stat-card warning"><h3>📦 قيمة المخزون</h3><div class="value">${fmt(d.inventoryValue)}</div></div>
        <div class="stat-card success"><h3>📈 إجمالي المبيعات</h3><div class="value">${fmt(d.grossSales)}</div></div>
        <div class="stat-card warning"><h3>🏷️ خصومات المبيعات</h3><div class="value">${fmt(d.salesDiscounts)}</div><div class="subtext">نقص إيراد</div></div>
        <div class="stat-card success"><h3>✅ صافي المبيعات</h3><div class="value">${fmt(d.netSales)}</div></div>
        <div class="stat-card danger"><h3>💸 المصروفات</h3><div class="value">${fmt(d.totalExpenses)}</div></div>
        <div class="stat-card ${d.netProfit>=0?'success':'danger'}"><h3>💰 صافي الربح</h3><div class="value">${fmt(d.netProfit)}</div></div>
      </div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Color Codes
async function loadColorCodes(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const items = await api('/api/color-codes');
    c.innerHTML = `
      <div class="page-header"><h2>🎨 أكواد الألوان</h2>
      <button class="btn" onclick="addColorCode()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>اللون</th><th>الدرجة</th><th>الوصف</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => `<tr>
        <td class="font-bold">${i.code}</td><td>${i.main_color}</td><td>${i.shade||'-'}</td><td>${i.description||'-'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="delColorCode(${i.id})">🗑️</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addColorCode = () => {
  modal('إضافة كود لون', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الكود</label><input name="code" required></div>
      <div class="form-group"><label class="required">اللون</label><input name="main_color" required></div>
      <div class="form-group"><label>الدرجة</label><input name="shade"></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/color-codes', {method: 'POST', body: JSON.stringify({
      code: fd.get('code'), main_color: fd.get('main_color'), shade: fd.get('shade'), active: 1, user: USER
    })});
    toast('تمت الإضافة'); nav('color-codes');
  });
};

window.delColorCode = async (id) => {
  if (!confirm('حذف؟')) return;
  try { await api(`/api/color-codes/${id}`, {method:'DELETE', body: JSON.stringify({user:USER})}); toast('تم الحذف'); nav('color-codes'); }
  catch(e) { toast(e.message, 'danger'); }
};

// Warehouses
async function loadWarehouses(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const items = await api('/api/warehouses');
    c.innerHTML = `
      <div class="page-header"><h2>🏬 المخازن</h2>
      <button class="btn" onclick="addWarehouse()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>الموقع</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => `<tr>
        <td>${i.code}</td><td>${i.name}</td><td>${i.location||'-'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="delWarehouse(${i.id})">🗑️</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addWarehouse = () => {
  modal('إضافة مخزن', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label>الموقع</label><input name="location"></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/warehouses', {method: 'POST', body: JSON.stringify({
      name: fd.get('name'), location: fd.get('location'), active: 1, user: USER
    })});
    toast('تمت الإضافة'); nav('warehouses');
  });
};

window.delWarehouse = async (id) => {
  if (!confirm('حذف؟')) return;
  try { await api(`/api/warehouses/${id}`, {method:'DELETE', body: JSON.stringify({user:USER})}); toast('تم الحذف'); nav('warehouses'); }
  catch(e) { toast(e.message, 'danger'); }
};

// Product Types
async function loadProductTypes(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const items = await api('/api/product-types');
    c.innerHTML = `
      <div class="page-header"><h2>📦 أنواع المنتجات</h2>
      <button class="btn" onclick="addProductType()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>الفئة</th><th>الوحدة</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => `<tr>
        <td>${i.code}</td><td>${i.name}</td><td>${i.category||'-'}</td><td><span class="badge badge-info">${i.unit}</span></td>
        <td><button class="btn btn-sm btn-danger" onclick="delProductType(${i.id})">🗑️</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addProductType = () => {
  modal('إضافة نوع منتج', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label>الفئة</label><select name="category">
        <option value="مواد_خام">مواد خام</option>
        <option value="منتجات_نهائية">منتجات نهائية</option>
      </select></div>
      <div class="form-group"><label class="required">الوحدة</label><input name="unit" required></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/product-types', {method: 'POST', body: JSON.stringify({
      name: fd.get('name'), category: fd.get('category'), unit: fd.get('unit'), user: USER
    })});
    toast('تمت الإضافة'); nav('product-types');
  });
};

window.delProductType = async (id) => {
  if (!confirm('حذف؟')) return;
  try { await api(`/api/product-types/${id}`, {method:'DELETE', body: JSON.stringify({user:USER})}); toast('تم الحذف'); nav('product-types'); }
  catch(e) { toast(e.message, 'danger'); }
};

// Service Types
async function loadServiceTypes(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const items = await api('/api/service-types');
    c.innerHTML = `
      <div class="page-header"><h2>⚙️ أنواع الخدمات</h2>
      <button class="btn" onclick="addServiceType()">➕ إضافة</button></div>
      <div class="alert alert-info">💡 نسبة Overhead قابلة للتعديل لكل خدمة</div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>Overhead</th><th>الوصف</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => `<tr>
        <td>${i.code}</td><td>${i.name}</td>
        <td><span class="badge badge-warning">${((i.overhead_rate||0)*100).toFixed(0)}%</span></td>
        <td>${i.description||'-'}</td>
        <td><button class="btn btn-sm" onclick="editServiceType(${i.id})">✏️</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addServiceType = () => {
  modal('إضافة خدمة', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label class="required">نسبة Overhead (%)</label>
        <input type="number" name="overhead" value="10" step="0.1" required></div>
      <div class="form-group"><label>الوصف</label><textarea name="description"></textarea></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/service-types', {method: 'POST', body: JSON.stringify({
      name: fd.get('name'),
      overhead_rate: parseFloat(fd.get('overhead'))/100,
      description: fd.get('description'), user: USER
    })});
    toast('تمت الإضافة'); nav('service-types');
  });
};

window.editServiceType = async (id) => {
  const items = await api('/api/service-types');
  const item = items.find(i => i.id === id);
  modal('تعديل خدمة', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label class="required">نسبة Overhead (%)</label>
        <input type="number" name="overhead" value="${((item.overhead_rate||0)*100).toFixed(1)}" step="0.1" required></div>
      <div class="form-group"><label>الوصف</label><textarea name="description">${item.description||''}</textarea></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/service-types/${id}`, {method: 'PUT', body: JSON.stringify({
      name: fd.get('name'),
      overhead_rate: parseFloat(fd.get('overhead'))/100,
      description: fd.get('description'), user: USER
    })});
    toast('تم التعديل'); nav('service-types');
  });
};

// Inventory
async function loadInventory(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const items = await api('/api/inventory');
    c.innerHTML = `
      <div class="page-header"><h2>📦 المخزون</h2>
      <button class="btn" onclick="addInventory()">➕ إضافة</button></div>
      <div class="alert alert-info">💡 v2.2: يمكنك الآن إضافة كود لون جديد أثناء إضافة المخزون، أو ترك اللون فارغاً</div>
      <div class="table-container"><table><thead><tr>
        <th>المخزن</th><th>المنتج</th><th>كود اللون</th><th>الكمية</th><th>التكلفة</th><th>السعر</th><th>القيمة</th>
      </tr></thead><tbody>${items.map(i => `<tr>
        <td>${i.warehouse_name}</td><td>${i.product_name}</td>
        <td><span class="badge badge-${i.color_code ? 'primary' : 'secondary'}">${i.display_color || i.color_code || 'بدون'}</span></td>
        <td class="font-bold">${i.quantity} ${i.unit}</td>
        <td>${fmt(i.unit_cost)}</td><td>${fmt(i.unit_price)}</td>
        <td class="text-success font-bold">${fmt(i.quantity * i.unit_cost)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addInventory = async () => {
  const [wh, pt, cc] = await Promise.all([api('/api/warehouses'), api('/api/product-types'), api('/api/color-codes')]);
  modal('إضافة عنصر مخزون', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">المخزن</label><select name="warehouse_id" required>
        ${wh.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="required">المنتج</label><select name="product_type_id" required>
        ${pt.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
    </div>

    <h4 style="margin: 15px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">🎨 كود اللون (اختياري)</h4>
    <div class="form-group">
      <select name="color_option" id="colorOptionSelect" onchange="toggleColorOptions()">
        <option value="none">❌ بدون لون</option>
        <option value="existing">📋 اختيار من الموجود</option>
        <option value="new">➕ إضافة كود جديد</option>
        <option value="description">📝 وصف حر</option>
      </select>
    </div>

    <div id="existingColorFields" class="hidden">
      <div class="form-group"><label>اختر كود اللون</label><select name="color_code_id">
        <option value="">اختر...</option>
        ${cc.map(c => `<option value="${c.id}">${c.code} - ${c.main_color} ${c.shade ? '(' + c.shade + ')' : ''}</option>`).join('')}</select></div>
    </div>

    <div id="newColorFields" class="hidden">
      <div class="alert alert-success" style="margin-bottom:10px">💡 سيتم إنشاء كود اللون تلقائياً وربطه بهذا المنتج</div>
      <div class="form-grid">
        <div class="form-group"><label class="required">الكود</label><input name="color_code" placeholder="مثال: CLR-001"></div>
        <div class="form-group"><label class="required">اللون الرئيسي</label><input name="color_name" placeholder="مثال: أحمر"></div>
        <div class="form-group"><label>الدرجة</label><input name="color_shade" placeholder="مثال: فاتح، غامق"></div>
      </div>
    </div>

    <div id="descriptionColorFields" class="hidden">
      <div class="form-group"><label>وصف اللون</label><input name="color_description" placeholder="مثال: أزرق سماوي فاتح"></div>
    </div>

    <h4 style="margin: 15px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">📊 الكميات والأسعار</h4>
    <div class="form-grid">
      <div class="form-group"><label>الكمية</label><input type="number" name="quantity" value="0" step="0.01"></div>
      <div class="form-group"><label>تكلفة الوحدة</label><input type="number" name="unit_cost" value="0" step="0.01"></div>
      <div class="form-group"><label>سعر البيع</label><input type="number" name="unit_price" value="0" step="0.01"></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const colorOption = fd.get('color_option');

    const data = {
      warehouse_id: parseInt(fd.get('warehouse_id')),
      product_type_id: parseInt(fd.get('product_type_id')),
      quantity: parseFloat(fd.get('quantity')),
      unit_cost: parseFloat(fd.get('unit_cost')),
      unit_price: parseFloat(fd.get('unit_price')),
      user: USER
    };

    if (colorOption === 'existing' && fd.get('color_code_id')) {
      data.color_code_id = parseInt(fd.get('color_code_id'));
    } else if (colorOption === 'new' && fd.get('color_code') && fd.get('color_name')) {
      data.color_code = fd.get('color_code');
      data.color_name = fd.get('color_name');
      data.color_shade = fd.get('color_shade');
    } else if (colorOption === 'description' && fd.get('color_description')) {
      data.color_description = fd.get('color_description');
    }

    await api('/api/inventory', {method: 'POST', body: JSON.stringify(data)});
    toast('تمت الإضافة'); nav('inventory');
  });
};

window.toggleColorOptions = () => {
  const option = document.getElementById('colorOptionSelect').value;
  document.getElementById('existingColorFields').classList.add('hidden');
  document.getElementById('newColorFields').classList.add('hidden');
  document.getElementById('descriptionColorFields').classList.add('hidden');

  if (option === 'existing') document.getElementById('existingColorFields').classList.remove('hidden');
  else if (option === 'new') document.getElementById('newColorFields').classList.remove('hidden');
  else if (option === 'description') document.getElementById('descriptionColorFields').classList.remove('hidden');
};

// Artisans
async function loadArtisans(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const items = await api('/api/artisans');
    c.innerHTML = `
      <div class="page-header">
        <h2>👨‍🔧 الصنّاع</h2>
        <div>
          <button class="btn" onclick="addArtisan()">➕ إضافة صانع</button>
          <button class="btn btn-secondary" onclick="nav('artisan-dashboard')">📊 لوحة الأداء</button>
        </div>
      </div>

      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>نوع الصنعة</th><th>الهاتف</th>
        <th>سعر الكيلو</th><th>الرصيد</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => {
        const tdwarService = i.services.find(s => s.service_name?.includes('تدوير') || s.service_name?.includes('TDWAR'));
        return `<tr>
        <td>${i.code}</td>
        <td class="font-bold">${i.name}</td>
        <td><span class="badge badge-warning">${i.craft_type || 'تدوير'}</span></td>
        <td>${i.phone||'-'}</td>
        <td class="font-bold">${tdwarService ? tdwarService.rate + ' DH/كلغ' : (i.services[0] ? i.services[0].rate + ' DH' : '6 DH')}</td>
        <td class="${i.account_balance>=0?'text-success':'text-danger'} font-bold">${fmt(i.account_balance)}</td>
        <td>
          <button class="btn btn-sm" onclick="viewArtisanProfile(${i.id})" title="عرض">👁️</button>
          <button class="btn btn-sm" onclick="payArtisan(${i.id})" title="دفعة/تسبيق">💰</button>
          <button class="btn btn-sm" onclick="editArtisan(${i.id})" title="تعديل">✏️</button>
        </td>
      </tr>`;
      }).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addArtisan = async () => {
  const st = await api('/api/service-types');
  modal('إضافة صانع', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone"></div>
      <div class="form-group"><label>نوع الصنعة</label>
        <select name="craft_type">
          <option value="">اختر...</option>
          <option value="تعبئة">تعبئة</option>
          <option value="سفيفة">سفيفة</option>
          <option value="طراسن">طراسن</option>
          <option value="تطريز">تطريز</option>
          <option value="خياطة">خياطة</option>
          <option value="أخرى">أخرى</option>
        </select>
      </div>
      <div class="form-group"><label>مصروف يومي (اختياري)</label><input type="number" name="daily_expense" placeholder="اتركه فارغاً إن لم يكن ثابتاً" step="0.01"></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً | المصروف اليومي اختياري ومتغير</div>
    <h3>الخدمات</h3>
    <div id="services">
      ${st.map(s => `<div class="form-group">
        <label><input type="checkbox" name="service_${s.id}"> ${s.name}</label>
        <input type="number" name="rate_${s.id}" placeholder="السعر" step="0.01">
      </div>`).join('')}
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const services = st.filter(s => fd.get(`service_${s.id}`))
      .map(s => ({service_type_id: s.id, rate: parseFloat(fd.get(`rate_${s.id}`))||0, rate_unit: 'كيلو'}));
    await api('/api/artisans', {method: 'POST', body: JSON.stringify({
      name: fd.get('name'), phone: fd.get('phone'),
      craft_type: fd.get('craft_type') || null,
      daily_expense: fd.get('daily_expense') ? parseFloat(fd.get('daily_expense')) : null,
      services, user: USER
    })});
    toast('تمت الإضافة'); nav('artisans');
  });
};

window.editArtisan = async (id) => {
  const [artisans, st] = await Promise.all([api('/api/artisans'), api('/api/service-types')]);
  const item = artisans.find(a => a.id === id);
  modal('تعديل صانع', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone" value="${item.phone||''}"></div>
      <div class="form-group"><label>العنوان</label><input name="address" value="${item.address||''}"></div>
      <div class="form-group"><label>نوع الصنعة</label>
        <select name="craft_type">
          <option value="">اختر...</option>
          <option value="تعبئة" ${item.craft_type==='تعبئة'?'selected':''}>تعبئة</option>
          <option value="سفيفة" ${item.craft_type==='سفيفة'?'selected':''}>سفيفة</option>
          <option value="طراسن" ${item.craft_type==='طراسن'?'selected':''}>طراسن</option>
          <option value="تطريز" ${item.craft_type==='تطريز'?'selected':''}>تطريز</option>
          <option value="خياطة" ${item.craft_type==='خياطة'?'selected':''}>خياطة</option>
          <option value="أخرى" ${item.craft_type==='أخرى'?'selected':''}>أخرى</option>
        </select>
      </div>
      <div class="form-group"><label>مصروف يومي (اختياري)</label><input type="number" name="daily_expense" value="${item.daily_expense||''}" step="0.01" placeholder="اتركه فارغاً إن لم يكن ثابتاً"></div>
      <div class="form-group"><label>مصروف أسبوعي (اختياري)</label><input type="number" name="weekly_expense" value="${item.weekly_expense||''}" step="0.01"></div>
      <div class="form-group"><label>الحالة</label><select name="active">
        <option value="1" ${item.active?'selected':''}>نشط</option>
        <option value="0" ${!item.active?'selected':''}>غير نشط</option>
      </select></div>
    </div>
    <h3>الخدمات</h3>
    <div id="editServices">
      ${st.map(s => {
        const existing = item.services.find(x => x.service_type_id === s.id);
        return `<div class="form-group">
          <label><input type="checkbox" name="service_${s.id}" ${existing?'checked':''}> ${s.name}</label>
          <input type="number" name="rate_${s.id}" placeholder="السعر" step="0.01" value="${existing?existing.rate:''}">
        </div>`;
      }).join('')}
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const services = st.filter(s => fd.get(`service_${s.id}`))
      .map(s => ({service_type_id: s.id, rate: parseFloat(fd.get(`rate_${s.id}`))||0, rate_unit: 'كيلو'}));
    await api(`/api/artisans/${id}`, {method: 'PUT', body: JSON.stringify({
      name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'),
      craft_type: fd.get('craft_type') || null,
      daily_expense: fd.get('daily_expense') ? parseFloat(fd.get('daily_expense')) : null,
      weekly_expense: fd.get('weekly_expense') ? parseFloat(fd.get('weekly_expense')) : null,
      active: parseInt(fd.get('active')),
      services, user: USER
    })});
    toast('تم التعديل'); nav('artisans');
  });
};

window.delArtisan = async (id) => {
  if (!confirm('هل تريد حذف هذا الصانع؟')) return;
  try {
    await api(`/api/artisans/${id}`, {method: 'DELETE', body: JSON.stringify({user: USER})});
    toast('تم الحذف'); nav('artisans');
  } catch(e) { toast(e.message, 'danger'); }
};

// View artisan profile with expenses
window.viewArtisanProfile = async (id) => {
  try {
    const [artisans, expensesData, dashboard] = await Promise.all([
      api('/api/artisans'),
      api(`/api/artisans/${id}/expenses`),
      api(`/api/artisans/${id}/dashboard?period=weekly`)
    ]);
    const artisan = artisans.find(a => a.id === id);
    if (!artisan) return toast('الصانع غير موجود', 'danger');

    const { expenses, totals } = expensesData;
    const { kpis } = dashboard;

    modal('ملف الصانع', `
      <div class="stats-grid" style="margin-bottom:15px">
        <div class="stat-card"><h4>الاسم</h4><div class="value">${artisan.name}</div></div>
        <div class="stat-card"><h4>نوع الصنعة</h4><div>${artisan.craft_type || 'تدوير'}</div></div>
        <div class="stat-card"><h4>الهاتف</h4><div>${artisan.phone || '-'}</div></div>
      </div>

      <h4>📊 الأداء (أسبوعي)</h4>
      <div class="stats-grid" style="margin-bottom:15px">
        <div class="stat-card success"><h4>الإنتاج</h4><div class="value">${(kpis?.kg_total || 0).toFixed(2)} كلغ</div></div>
        <div class="stat-card"><h4>المعدل/خنشة</h4><div class="value">${(kpis?.avg_kg_per_bag || 0).toFixed(2)}</div></div>
        <div class="stat-card ${(kpis?.waste_percentage || 0) > 10 ? 'danger' : 'success'}"><h4>الهدر</h4><div class="value">${kpis?.waste_percentage || 0}%</div></div>
      </div>

      <h4>💰 الحساب</h4>
      <div class="stats-grid" style="margin-bottom:15px">
        <div class="stat-card success"><h4>المستحق</h4><div class="value">${fmt(totals.total_earned)}</div></div>
        <div class="stat-card"><h4>المدفوع</h4><div class="value">${fmt(totals.total_paid)}</div></div>
        <div class="stat-card ${totals.balance > 0 ? 'warning' : 'success'}">
          <h4>الرصيد المتبقي</h4>
          <div class="value">${fmt(totals.balance)}</div>
        </div>
      </div>

      <h4>📋 سجل الدفعات والتسبيقات</h4>
      <div class="table-container" style="max-height:200px;overflow-y:auto">
        <table style="font-size:0.9em">
          <thead><tr><th>التاريخ</th><th>الوصف</th><th>المبلغ</th></tr></thead>
          <tbody>${expenses.length === 0 ? '<tr><td colspan="3" class="text-center">لا توجد دفعات</td></tr>' :
            expenses.map(e => `<tr>
              <td>${fmtDate(e.date)}</td>
              <td>${e.description}</td>
              <td class="text-danger font-bold">${fmt(e.amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:15px;text-align:center">
        <button class="btn" onclick="payArtisan(${id});closeModal()">💰 دفعة جديدة</button>
        <button class="btn btn-secondary" onclick="loadArtisanKPIs(${id});closeModal()">📊 لوحة الأداء</button>
      </div>
    `);
  } catch(e) { toast(e.message, 'danger'); }
};

// Pay artisan (advance/expense/payment)
window.payArtisan = async (id) => {
  const artisans = await api('/api/artisans');
  const artisan = artisans.find(a => a.id === id);
  if (!artisan) return toast('الصانع غير موجود', 'danger');

  modal('دفعة / تسبيق للصانع', `
    <div class="alert alert-info" style="margin-bottom:15px">
      <strong>${artisan.name}</strong> - الرصيد الحالي: <span class="${artisan.account_balance > 0 ? 'text-success' : ''}">${fmt(artisan.account_balance)}</span>
    </div>
    <form>
      <div class="form-grid">
        <div class="form-group">
          <label class="required">نوع العملية</label>
          <select name="expense_type" required>
            <option value="دفعة">💵 دفعة (من المستحق)</option>
            <option value="تسبيق">💳 تسبيق (مقدم)</option>
            <option value="مصروف">📝 مصروف (نقل، أكل...)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="required">المبلغ</label>
          <input type="number" name="amount" step="0.01" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="required">التاريخ</label>
          <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="form-group">
          <label>الوصف</label>
          <input name="description" placeholder="ملاحظات...">
        </div>
      </div>
      <button type="submit" class="btn btn-success btn-lg" style="width:100%;margin-top:15px">✅ تأكيد الدفع</button>
    </form>
  `, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/artisans/${id}/expenses`, {method: 'POST', body: JSON.stringify({
      date: fd.get('date'),
      amount: parseFloat(fd.get('amount')),
      description: fd.get('description') || fd.get('expense_type'),
      expense_type: fd.get('expense_type'),
      user: USER
    })});
    toast('تم تسجيل الدفعة بنجاح'); nav('artisans');
  });
};

window.closeModal = () => {
  document.getElementById('modal-container').innerHTML = '';
};

// استمرار باقي الصفحات...

// Manufacturing
async function loadManufacturing(c) {
  // Redirect to TDWAR - single source of truth
  c.innerHTML = `
    <div class="page-header"><h2>🏭 أوامر التصنيع</h2></div>
    <div class="alert alert-warning" style="padding:20px;text-align:center">
      <h3>⚠️ تم تحديث نظام التصنيع</h3>
      <p style="margin:15px 0">تم دمج جميع أوامر التصنيع في <strong>نظام التدوير TDWAR</strong></p>
      <button class="btn btn-lg" onclick="nav('tdwar')" style="margin-top:10px">
        🔄 الانتقال لنظام التدوير
      </button>
    </div>
  `;

  // Still show existing orders for reference (read-only)
  try {
    const orders = await api('/api/manufacturing/orders');
    if (orders.length > 0) {
      c.innerHTML += `
      <div class="card" style="margin-top:20px">
        <h3>📋 الأوامر السابقة (للعرض فقط)</h3>
        <div class="alert alert-info">💡 هذه أوامر قديمة. لإنشاء أوامر جديدة استخدم نظام التدوير</div>
      <div class="table-container"><table><thead><tr>
        <th>رقم الأمر</th><th>التاريخ</th><th>الخدمة</th><th>الصانع</th><th>سعر الوحدة</th>
        <th>المواد</th><th>التكلفة</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead><tbody>${orders.map(o => {
        const pendingInputs = (o.inputs || []).filter(i => i.status !== 'مكتمل').length;
        const completedInputs = (o.inputs || []).filter(i => i.status === 'مكتمل').length;
        const totalInputs = (o.inputs || []).length;
        return `<tr>
        <td class="font-bold">${o.order_number}</td><td>${fmtDate(o.date)}</td>
        <td>${o.service_name}</td><td>${o.artisan_name}</td>
        <td>${fmt(o.labor_cost_per_unit)}/وحدة</td>
        <td>
          <span class="badge badge-${pendingInputs>0?'warning':'success'}">
            ${completedInputs}/${totalInputs} مكتمل
          </span>
          ${(o.inputs || []).map(inp => `<div style="font-size:11px;margin-top:3px">
            ${inp.product_name} (${inp.display_color}): ${inp.status === 'مكتمل' ?
              `<span class="text-success">✓ ${inp.extraction_rate?.toFixed(1)}%</span>` :
              `<span class="text-warning">⏳ قيد التنفيذ</span>`}
          </div>`).join('')}
        </td>
        <td>${fmt(o.total_cost)}</td>
        <td><span class="badge badge-${o.status==='مكتمل'?'success':'warning'}">${o.status.replace('_', ' ')}</span></td>
        <td>
          <button class="btn btn-sm" onclick="viewOrderDetails(${o.id})">👁️</button>
        </td>
      </tr>`;
      }).join('')}</tbody></table></div></div>`;
    }
  } catch(e) { console.error(e); }
}

window.viewOrderDetails = async (orderId) => {
  const orders = await api('/api/manufacturing/orders');
  const order = orders.find(o => o.id === orderId);
  if (!order) return toast('الأمر غير موجود', 'danger');

  modal('تفاصيل أمر التصنيع', `
    <div class="stats-grid" style="margin-bottom:15px">
      <div class="stat-card"><h3>رقم الأمر</h3><div class="value">${order.order_number}</div></div>
      <div class="stat-card"><h3>الخدمة</h3><div class="value">${order.service_name}</div></div>
      <div class="stat-card"><h3>الصانع</h3><div class="value">${order.artisan_name}</div></div>
      <div class="stat-card"><h3>الحالة</h3><div class="value"><span class="badge badge-${order.status==='مكتمل'?'success':'warning'}">${order.status}</span></div></div>
    </div>

    <h4>📦 المواد الأولية</h4>
    <table>
      <thead><tr><th>المادة</th><th>اللون</th><th>الكمية المستخدمة</th><th>المتوقع</th><th>الفعلي</th><th>الهدر</th><th>نسبة الاستخراج</th><th>الحالة</th></tr></thead>
      <tbody>${(order.inputs || []).map(inp => `<tr>
        <td>${inp.product_name}</td>
        <td><span class="badge badge-primary">${inp.display_color}</span></td>
        <td>${inp.quantity_used}</td>
        <td>${inp.expected_output_quantity || '-'}</td>
        <td class="text-success font-bold">${inp.actual_output_quantity || '-'}</td>
        <td class="text-danger">${inp.waste_quantity || '-'}</td>
        <td><span class="badge badge-${(inp.extraction_rate||0) > 80 ? 'success' : 'warning'}">${inp.extraction_rate ? inp.extraction_rate.toFixed(1) + '%' : '-'}</span></td>
        <td><span class="badge badge-${inp.status==='مكتمل'?'success':'warning'}">${inp.status}</span></td>
      </tr>`).join('')}</tbody>
    </table>

    <h4 style="margin-top:20px">📤 المخرجات</h4>
    <table>
      <thead><tr><th>المنتج</th><th>اللون</th><th>الكمية</th><th>تكلفة الوحدة</th></tr></thead>
      <tbody>${(order.outputs || []).map(out => `<tr>
        <td>${out.product_name}</td>
        <td><span class="badge badge-primary">${out.color_code || '-'}</span></td>
        <td class="font-bold">${out.quantity}</td>
        <td>${fmt(out.unit_cost)}</td>
      </tr>`).join('')}</tbody>
    </table>

    <div class="stats-grid" style="margin-top:15px">
      <div class="stat-card"><h3>تكلفة المواد</h3><div class="value">${fmt(order.total_material_cost)}</div></div>
      <div class="stat-card"><h3>تكلفة العمالة</h3><div class="value">${fmt(order.total_labor_cost)}</div></div>
      <div class="stat-card warning"><h3>Overhead</h3><div class="value">${fmt(order.overhead_cost)}</div></div>
      <div class="stat-card success"><h3>التكلفة الإجمالية</h3><div class="value">${fmt(order.total_cost)}</div></div>
    </div>
  `);
};

window.completeOrderMaterials = async (orderId) => {
  const orders = await api('/api/manufacturing/orders');
  const order = orders.find(o => o.id === orderId);
  const inv = await api('/api/inventory');
  const pendingInputs = (order.inputs || []).filter(i => i.status !== 'مكتمل');

  if (pendingInputs.length === 0) {
    toast('جميع المواد مكتملة', 'warning');
    return;
  }

  modal('إكمال مواد التصنيع', `<form>
    <div class="alert alert-info">💡 أدخل الكمية الفعلية لكل مادة ومنتج الإخراج</div>
    ${pendingInputs.map((inp, idx) => `
      <div class="card" style="margin-bottom:15px;padding:15px;background:#f9f9f9">
        <h4 style="margin-bottom:10px">📦 ${inp.product_name} - <span class="badge badge-primary">${inp.display_color}</span></h4>
        <div class="form-grid">
          <div class="form-group"><label>الكمية المستخدمة</label><input type="text" value="${inp.quantity_used}" disabled></div>
          <div class="form-group"><label>المتوقع</label><input type="text" value="${inp.expected_output_quantity || 'غير محدد'}" disabled></div>
          <div class="form-group"><label class="required">الكمية الفعلية</label>
            <input type="number" name="actual_${inp.id}" required step="0.01" value="${inp.expected_output_quantity || ''}">
          </div>
          <div class="form-group"><label>الهدر</label>
            <input type="number" name="waste_${inp.id}" step="0.01" value="0">
          </div>
          <div class="form-group"><label class="required">منتج الإخراج</label>
            <select name="output_${inp.id}" required>
              ${inv.map(i => `<option value="${i.id}">${i.product_name} - ${i.display_color || i.color_code || 'بدون'}</option>`).join('')}
            </select>
          </div>
        </div>
        <input type="hidden" name="input_${idx}" value="${inp.id}">
      </div>
    `).join('')}
    <input type="hidden" name="input_count" value="${pendingInputs.length}">
    <button type="submit" class="btn btn-success btn-lg" style="width:100%">✅ إكمال جميع المواد</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const outputs = [];
    const count = parseInt(fd.get('input_count'));

    for (let i = 0; i < count; i++) {
      const inputId = parseInt(fd.get(`input_${i}`));
      outputs.push({
        input_id: inputId,
        actual_output_quantity: parseFloat(fd.get(`actual_${inputId}`)),
        output_inventory_id: parseInt(fd.get(`output_${inputId}`)),
        waste_quantity: parseFloat(fd.get(`waste_${inputId}`)) || 0
      });
    }

    await api(`/api/manufacturing/orders/${orderId}/complete`, {method: 'PUT', body: JSON.stringify({
      outputs, user: USER
    })});
    toast('تم إكمال الأمر'); nav('manufacturing');
  });
};

window.addManufacturingOrder = async () => {
  const [st, inv] = await Promise.all([api('/api/service-types'), api('/api/inventory')]);
  modal('أمر تصنيع جديد', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">رقم الأمر</label><input name="order_number" value="MFG${Date.now()}" required></div>
      <div class="form-group"><label class="required">التاريخ</label><input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required></div>
      <div class="form-group"><label class="required">نوع الخدمة</label><select name="service_type_id" id="serviceSelect" required onchange="loadQualifiedArtisans()">
        <option value="">اختر...</option>
        ${st.map(s => `<option value="${s.id}">${s.name} (Overhead: ${(s.overhead_rate*100).toFixed(0)}%)</option>`).join('')}</select></div>
      <div class="form-group"><label class="required">الصانع</label><select name="artisan_id" id="artisanSelect" required><option value="">اختر الخدمة أولاً</option></select></div>
      <div class="form-group"><label>تكلفة الوحدة (قابلة للتعديل)</label>
        <input type="number" name="labor_cost_per_unit" id="laborCostInput" step="0.01" placeholder="سيتم ملؤها من سعر الصانع">
        <small style="color:#666">💡 السعر المرجعي من الصانع، يمكنك تعديله لهذا الأمر</small>
      </div>
    </div>

    <h4>📦 المواد الأولية (مع الكمية المتوقعة لكل مادة)</h4>
    <div class="alert alert-warning">💡 حدد الكمية المتوقعة من المخرجات لكل مادة لتتبع نسبة الاستخراج</div>
    <div id="materials">
      <div class="form-grid material-row">
        <div class="form-group"><label>المادة</label><select name="material_0">
          <option value="">اختر...</option>
          ${inv.map(i => `<option value="${i.id}">${i.product_name} - ${i.display_color || i.color_code || 'بدون'} (${i.quantity} ${i.unit})</option>`).join('')}</select></div>
        <div class="form-group"><label>الكمية</label><input type="number" name="qty_0" placeholder="كمية المادة" step="0.01"></div>
        <div class="form-group"><label>المخرج المتوقع</label><input type="number" name="expected_0" placeholder="الكمية المتوقعة" step="0.01"></div>
        <div class="form-group"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.material-row').remove()">🗑️</button></div>
      </div>
    </div>
    <button type="button" class="btn btn-sm" onclick="addMaterial()">➕ إضافة مادة</button>

    <div class="form-group" style="margin-top:15px"><label>ملاحظات</label><textarea name="notes" placeholder="ملاحظات إضافية..."></textarea></div>

    <button type="submit" class="btn btn-success btn-lg mt-20" style="width:100%">💾 حفظ أمر التصنيع</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const materials = [];
    for(let i=0; i<20; i++) {
      const mid = fd.get(`material_${i}`);
      const qty = fd.get(`qty_${i}`);
      const expected = fd.get(`expected_${i}`);
      if(mid && qty) materials.push({
        inventory_id: parseInt(mid),
        quantity_used: parseFloat(qty),
        expected_output_quantity: expected ? parseFloat(expected) : null
      });
    }

    if (materials.length === 0) {
      toast('أضف مادة واحدة على الأقل', 'danger');
      throw new Error('No materials');
    }

    await api('/api/manufacturing/orders', {method: 'POST', body: JSON.stringify({
      order_number: fd.get('order_number'),
      date: fd.get('date'),
      service_type_id: parseInt(fd.get('service_type_id')),
      artisan_id: parseInt(fd.get('artisan_id')),
      labor_cost_per_unit: fd.get('labor_cost_per_unit') ? parseFloat(fd.get('labor_cost_per_unit')) : null,
      materials,
      notes: fd.get('notes'),
      user: USER
    })});
    toast('تم إنشاء الأمر'); nav('manufacturing');
  });
};

window.loadQualifiedArtisans = async () => {
  const sid = document.getElementById('serviceSelect').value;
  if(!sid) return;
  const artisans = await api(`/api/artisans/qualified?service_type_id=${sid}`);
  const select = document.getElementById('artisanSelect');
  select.innerHTML = artisans.map(a =>
    `<option value="${a.id}" data-rate="${a.rate}">${a.name} - ${a.rate} DH/${a.rate_unit}</option>`).join('');

  // Auto-fill labor cost from first artisan
  if (artisans.length > 0) {
    const laborInput = document.getElementById('laborCostInput');
    if (laborInput) laborInput.value = artisans[0].rate;
  }

  // Update labor cost when artisan changes
  select.onchange = () => {
    const opt = select.options[select.selectedIndex];
    const laborInput = document.getElementById('laborCostInput');
    if (laborInput && opt.dataset.rate) laborInput.value = opt.dataset.rate;
  };
};

window.addMaterial = () => {
  const container = document.getElementById('materials');
  const count = container.children.length;
  const firstSelect = container.querySelector('select').cloneNode(true);
  firstSelect.name = `material_${count}`;
  firstSelect.value = '';
  const div = document.createElement('div');
  div.className = 'form-grid material-row';
  div.innerHTML = `
    <div class="form-group"></div>
    <div class="form-group"><input type="number" name="qty_${count}" placeholder="كمية المادة" step="0.01"></div>
    <div class="form-group"><input type="number" name="expected_${count}" placeholder="الكمية المتوقعة" step="0.01"></div>
    <div class="form-group"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.material-row').remove()">🗑️</button></div>
  `;
  div.querySelector('.form-group').appendChild(firstSelect);
  container.appendChild(div);
};

window.completeOrder = async (id) => {
  const inv = await api('/api/inventory');
  modal('إكمال أمر التصنيع', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الكمية الفعلية</label>
        <input type="number" name="actual_output_quantity" required step="0.01"></div>
      <div class="form-group"><label class="required">المنتج النهائي (المخزون)</label>
        <select name="output_inventory_id" required>
          ${inv.map(i => `<option value="${i.id}">${i.product_name} - ${i.color_code}</option>`).join('')}
        </select></div>
    </div>
    <button type="submit" class="btn btn-success">✓ إكمال</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/manufacturing/orders/${id}/complete`, {method: 'PUT', body: JSON.stringify({
      actual_output_quantity: parseFloat(fd.get('actual_output_quantity')),
      output_inventory_id: parseInt(fd.get('output_inventory_id')),
      user: USER
    })});
    toast('تم إكمال الأمر'); nav('manufacturing');
  });
};

// ============================================
// TDWAR PRODUCTION SYSTEM (v2.3)
// ============================================

async function loadTDWAR(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const orders = await api('/api/manufacturing/orders');
    // Filter TDWAR orders (those with number_of_compositions > 0 or service is TDWAR)
    const tdwarOrders = orders.filter(o => o.number_of_compositions > 0 || o.service_name?.includes('تدوير') || o.service_name?.includes('TDWAR'));

    c.innerHTML = `
      <div class="page-header">
        <h2>🔄 نظام التدوير TDWAR</h2>
        <div>
          <button class="btn" onclick="addTDWAROrder()">➕ أمر تدوير جديد</button>
          <button class="btn btn-secondary" onclick="nav('artisan-dashboard')">📊 لوحة الصناع</button>
        </div>
      </div>

      <div class="alert alert-info">
        💡 <strong>منطق التركيبة:</strong> 1 تركيبة = 4 بوبينات بنفس اللون |
        <strong>مردودية الخنشة:</strong> ≥26 كلغ OK | 23-25 ضعيف | <23 هدر
      </div>

      <div id="tdwarKPIs"></div>

      <div class="card" style="margin-bottom:20px">
        <h3>📋 أوامر التدوير</h3>
        <div class="table-container"><table><thead><tr>
          <th>رقم الأمر</th><th>التاريخ</th><th>الصانع</th>
          <th>التركيبات</th><th>البوبينات</th><th>الخناشي</th>
          <th>الإنتاج (كلغ)</th><th>المعدل/خنشة</th><th>الحالة</th><th>إجراءات</th>
        </tr></thead><tbody>${tdwarOrders.length === 0 ?
          '<tr><td colspan="10" class="text-center">لا توجد أوامر تدوير</td></tr>' :
          tdwarOrders.map(o => `<tr>
          <td class="font-bold">${o.order_number}</td>
          <td>${fmtDate(o.date)}</td>
          <td>${o.artisan_name || '-'}</td>
          <td class="text-center">${o.number_of_compositions || 0}</td>
          <td class="text-center">${o.bobbins_used || 0}</td>
          <td class="text-center">${o.number_of_bags || 0}</td>
          <td class="text-success font-bold">${(o.total_produced_kg || 0).toFixed(2)} كلغ</td>
          <td class="${(o.avg_kg_per_bag || 0) >= 26 ? 'text-success' : (o.avg_kg_per_bag || 0) >= 23 ? 'text-warning' : 'text-danger'} font-bold">
            ${(o.avg_kg_per_bag || 0).toFixed(2)}
          </td>
          <td><span class="badge badge-${o.status==='مكتمل'?'success':'info'}">${o.status?.replace('_',' ') || 'جديد'}</span></td>
          <td>
            <button class="btn btn-sm" onclick="viewTDWAROrder(${o.id})">👁️</button>
            ${o.status !== 'مكتمل' ? `
              <button class="btn btn-sm btn-success" onclick="recordTDWARProduction(${o.id})">📝 تسجيل</button>
              <button class="btn btn-sm btn-warning" onclick="completeTDWAROrder(${o.id})">✅ إكمال</button>
            ` : ''}
          </td>
        </tr>`).join('')}</tbody></table></div>
      </div>
    `;

    // Load KPIs
    loadTDWARKPIs();
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

async function loadTDWARKPIs() {
  try {
    const summary = await api('/api/tdwar/daily-summary');
    document.getElementById('tdwarKPIs').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card success">
          <h3>📦 إنتاج اليوم</h3>
          <div class="value">${(summary.totals?.total_kg || 0).toFixed(2)} كلغ</div>
          <div class="subtext">${summary.totals?.artisans_count || 0} صانع</div>
        </div>
        <div class="stat-card">
          <h3>💰 تكلفة العمالة</h3>
          <div class="value">${fmt(summary.totals?.total_cost || 0)}</div>
        </div>
        <div class="stat-card warning">
          <h3>👥 الصناع النشطون</h3>
          <div class="value">${summary.artisans?.length || 0}</div>
        </div>
      </div>
    `;
  } catch(e) { console.error('KPIs error:', e); }
}

window.addTDWAROrder = async () => {
  // Use TDWAR-specific artisans endpoint
  const [artisans, inventory] = await Promise.all([
    api('/api/artisans/tdwar').catch(() => api('/api/artisans')), // Fallback to all artisans
    api('/api/inventory')
  ]);

  // Filter BOBINE and JAAB inventory
  const bobines = inventory.filter(i => i.product_name?.toUpperCase().includes('BOBINE') || i.product_name?.includes('بوبين'));
  const jaabs = inventory.filter(i => i.product_name?.toUpperCase().includes('JAAB') || i.product_name?.includes('خنشة') || i.product_name?.includes('جاب'));

  // Store bobines data for JavaScript access
  window._tdwarBobines = bobines;

  modal('أمر تدوير جديد', `<form>
    <div class="alert alert-info" style="margin-bottom:15px">
      💡 <strong>منطق التدوير:</strong> 1 تركيبة = 4 بوبينات | يمكن إضافة ألوان متعددة | الصبرة تُنشأ تلقائياً بنفس اللون
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label class="required">رقم الأمر</label>
        <input name="order_number" value="TDWAR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}" required>
      </div>
      <div class="form-group">
        <label class="required">التاريخ</label>
        <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
      </div>
      <div class="form-group">
        <label class="required">الصانع (TDWAR فقط)</label>
        <select name="artisan_id" required>
          <option value="">اختر الصانع...</option>
          ${artisans.filter(a => a.active !== false).map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>سعر الكيلو (DH)</label>
        <input type="number" name="labor_cost_per_kg" value="6" step="0.5">
      </div>
    </div>

    <h4 style="margin-top:15px">🧵 تركيبات الألوان (BOBINE) - إجباري</h4>
    <div class="alert alert-warning" style="margin-bottom:10px">
      🎨 يمكنك إضافة عدة تركيبات بألوان مختلفة في نفس الأمر
    </div>

    <div id="colorCombinationsContainer">
      <div class="color-combination-row" data-index="0" style="border:1px solid #ddd; padding:10px; margin-bottom:10px; border-radius:8px; background:#f9f9f9">
        <div class="form-grid">
          <div class="form-group">
            <label class="required">مخزون البوبين</label>
            <select class="bobine-select" data-index="0" required onchange="updateColorCombinationStock(0)">
              <option value="">اختر...</option>
              ${bobines.map(b => `<option value="${b.id}" data-qty="${b.quantity}" data-color="${b.color_code_id || ''}" data-colorname="${b.display_color || b.color_code || 'بدون'}">${b.product_name} - ${b.display_color || b.color_code || 'بدون'} (متوفر: ${b.quantity})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="required">عدد التركيبات</label>
            <input type="number" class="compositions-input" data-index="0" min="1" required oninput="updateColorCombinationStock(0)" placeholder="عدد">
          </div>
          <div class="form-group">
            <label>البوبينات المطلوبة</label>
            <div class="bobbins-display" data-index="0" style="padding:8px; background:#fff; border-radius:4px">0</div>
            <small class="stock-status" data-index="0" style="color:green"></small>
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn btn-info" onclick="addColorCombinationRow()" style="margin-bottom:15px">
      ➕ إضافة لون آخر
    </button>

    <h4 style="margin-top:15px">🛍️ الخناشي (JAAB) - اختياري</h4>
    <div class="form-grid">
      <div class="form-group">
        <label>مخزون الخنشة (اختياري)</label>
        <select name="jaab_inventory_id" id="jaabSelect">
          <option value="">-- بدون خناشي --</option>
          ${jaabs.map(j => `<option value="${j.id}">${j.product_name} - ${j.display_color || 'بدون'} (${j.quantity})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>عدد الخناشي</label>
        <input type="number" name="number_of_bags" min="0" value="0" id="bagsInput">
        <small>💡 الخنشة مادة مساعدة لتتبع المردودية</small>
      </div>
    </div>

    <div class="alert alert-success" style="margin-top:15px">
      📤 <strong>الإخراج:</strong> الصبرة (SABRA) ستُنشأ تلقائياً بنفس لون كل تركيبة عند تسجيل الإنتاج
    </div>

    <div id="combinationsSummary" style="margin-top:15px; padding:10px; background:#e3f2fd; border-radius:8px; display:none">
      <strong>📊 ملخص التركيبات:</strong>
      <div id="summaryContent"></div>
    </div>

    <div class="form-group" style="margin-top:15px">
      <label>ملاحظات</label>
      <textarea name="notes" placeholder="ملاحظات إضافية..."></textarea>
    </div>

    <button type="submit" class="btn btn-success btn-lg" style="width:100%;margin-top:15px">
      ✅ إنشاء أمر التدوير
    </button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);

    // Collect all color combinations
    const colorCombinations = [];
    const rows = document.querySelectorAll('.color-combination-row');

    for (const row of rows) {
      const index = row.dataset.index;
      const bobineSelect = row.querySelector('.bobine-select');
      const compositionsInput = row.querySelector('.compositions-input');

      if (!bobineSelect.value || !compositionsInput.value) continue;

      const bobineId = parseInt(bobineSelect.value);
      const compositions = parseInt(compositionsInput.value);
      const bobbinsNeeded = compositions * 4;
      const bobineQty = parseFloat(bobineSelect.selectedOptions[0]?.dataset.qty || 0);
      const colorCodeId = bobineSelect.selectedOptions[0]?.dataset.color || null;

      // Validate stock
      if (bobbinsNeeded > bobineQty) {
        toast(`المخزون غير كافي للتركيبة ${parseInt(index) + 1}!`, 'danger');
        return;
      }

      colorCombinations.push({
        bobine_inventory_id: bobineId,
        color_code_id: colorCodeId ? parseInt(colorCodeId) : null,
        number_of_compositions: compositions
      });
    }

    if (colorCombinations.length === 0) {
      toast('يجب إضافة تركيبة واحدة على الأقل!', 'danger');
      return;
    }

    // JAAB is optional - only include if selected
    const jaabInventoryId = fd.get('jaab_inventory_id');
    const numberOfBags = parseInt(fd.get('number_of_bags')) || 0;

    await api('/api/tdwar/orders', {method: 'POST', body: JSON.stringify({
      order_number: fd.get('order_number'),
      date: fd.get('date'),
      artisan_id: parseInt(fd.get('artisan_id')),
      color_combinations: colorCombinations,
      jaab_inventory_id: jaabInventoryId ? parseInt(jaabInventoryId) : null,
      number_of_bags: numberOfBags,
      labor_cost_per_kg: parseFloat(fd.get('labor_cost_per_kg')) || 6,
      notes: fd.get('notes'),
      user: USER
    })});
    toast('تم إنشاء أمر التدوير'); nav('tdwar');
  });
};

// Add new color combination row
window.addColorCombinationRow = () => {
  const container = document.getElementById('colorCombinationsContainer');
  const bobines = window._tdwarBobines || [];
  const newIndex = container.querySelectorAll('.color-combination-row').length;

  const newRow = document.createElement('div');
  newRow.className = 'color-combination-row';
  newRow.dataset.index = newIndex;
  newRow.style.cssText = 'border:1px solid #ddd; padding:10px; margin-bottom:10px; border-radius:8px; background:#f9f9f9; position:relative';

  newRow.innerHTML = `
    <button type="button" onclick="removeColorCombinationRow(${newIndex})" style="position:absolute; top:5px; left:5px; background:#dc3545; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer">×</button>
    <div class="form-grid">
      <div class="form-group">
        <label class="required">مخزون البوبين</label>
        <select class="bobine-select" data-index="${newIndex}" required onchange="updateColorCombinationStock(${newIndex})">
          <option value="">اختر...</option>
          ${bobines.map(b => `<option value="${b.id}" data-qty="${b.quantity}" data-color="${b.color_code_id || ''}" data-colorname="${b.display_color || b.color_code || 'بدون'}">${b.product_name} - ${b.display_color || b.color_code || 'بدون'} (متوفر: ${b.quantity})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="required">عدد التركيبات</label>
        <input type="number" class="compositions-input" data-index="${newIndex}" min="1" required oninput="updateColorCombinationStock(${newIndex})" placeholder="عدد">
      </div>
      <div class="form-group">
        <label>البوبينات المطلوبة</label>
        <div class="bobbins-display" data-index="${newIndex}" style="padding:8px; background:#fff; border-radius:4px">0</div>
        <small class="stock-status" data-index="${newIndex}" style="color:green"></small>
      </div>
    </div>
  `;

  container.appendChild(newRow);
  updateCombinationsSummary();
};

// Remove color combination row
window.removeColorCombinationRow = (index) => {
  const row = document.querySelector(`.color-combination-row[data-index="${index}"]`);
  if (row) {
    row.remove();
    updateCombinationsSummary();
  }
};

// Update stock status for a specific color combination
window.updateColorCombinationStock = (index) => {
  const row = document.querySelector(`.color-combination-row[data-index="${index}"]`);
  if (!row) return;

  const bobineSelect = row.querySelector('.bobine-select');
  const compositionsInput = row.querySelector('.compositions-input');
  const bobbinsDisplay = row.querySelector('.bobbins-display');
  const stockStatus = row.querySelector('.stock-status');

  const compositions = parseInt(compositionsInput?.value) || 0;
  const bobbinsNeeded = compositions * 4;
  bobbinsDisplay.textContent = bobbinsNeeded;

  const bobineQty = parseFloat(bobineSelect.selectedOptions[0]?.dataset.qty || 0);

  if (bobbinsNeeded > bobineQty && bobbinsNeeded > 0) {
    stockStatus.style.color = '#dc3545';
    stockStatus.textContent = `❌ غير كافي! (متوفر: ${bobineQty})`;
  } else if (bobbinsNeeded > 0) {
    stockStatus.style.color = '#28a745';
    stockStatus.textContent = `✅ كافي (متوفر: ${bobineQty})`;
  } else {
    stockStatus.textContent = '';
  }

  updateCombinationsSummary();
};

// Update combinations summary
window.updateCombinationsSummary = () => {
  const summaryDiv = document.getElementById('combinationsSummary');
  const summaryContent = document.getElementById('summaryContent');
  const rows = document.querySelectorAll('.color-combination-row');

  let totalBobbins = 0;
  let summaryHtml = '';

  rows.forEach((row, i) => {
    const bobineSelect = row.querySelector('.bobine-select');
    const compositionsInput = row.querySelector('.compositions-input');

    if (bobineSelect.value && compositionsInput.value) {
      const colorName = bobineSelect.selectedOptions[0]?.dataset.colorname || 'بدون';
      const compositions = parseInt(compositionsInput.value) || 0;
      const bobbins = compositions * 4;
      totalBobbins += bobbins;

      summaryHtml += `<div>🎨 ${colorName}: ${compositions} تركيبة (${bobbins} بوبين)</div>`;
    }
  });

  if (summaryHtml) {
    summaryHtml += `<div style="margin-top:5px; font-weight:bold">📦 إجمالي البوبينات: ${totalBobbins}</div>`;
    summaryContent.innerHTML = summaryHtml;
    summaryDiv.style.display = 'block';
  } else {
    summaryDiv.style.display = 'none';
  }
};

// Legacy functions kept for backward compatibility
window.calculateBobbins = () => {
  // Replaced by updateColorCombinationStock
};

window.updateBobineStock = () => {
  // Replaced by updateColorCombinationStock
};

window.recordTDWARProduction = async (orderId) => {
  const [orders, bags, inventory] = await Promise.all([
    api('/api/manufacturing/orders'),
    api(`/api/tdwar/orders/${orderId}/bags`),
    api('/api/inventory')
  ]);

  const order = orders.find(o => o.id === orderId);
  if (!order) return toast('الأمر غير موجود', 'danger');

  const openBags = bags.filter(b => b.status !== 'مكتمل');
  const sabras = inventory.filter(i => i.product_name?.toUpperCase().includes('SABRA') || i.product_name?.includes('صبرة'));

  modal('تسجيل إنتاج', `<form>
    <div class="alert alert-info">
      📊 <strong>أمر:</strong> ${order.order_number} |
      <strong>الصانع:</strong> ${order.artisan_name} |
      <strong>الإنتاج الحالي:</strong> ${(order.total_produced_kg || 0).toFixed(2)} كلغ
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label class="required">التاريخ</label>
        <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
      </div>
      <div class="form-group">
        <label class="required">الكمية (كلغ)</label>
        <input type="number" name="quantity_kg" step="0.01" required placeholder="أدخل الوزن بالكيلوغرام">
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label>الخنشة (اختياري)</label>
        <select name="production_bag_id">
          <option value="">-- بدون تحديد خنشة --</option>
          ${openBags.map(b => `<option value="${b.id}">خنشة #${b.id} - ${b.color_code || 'بدون لون'} (${(b.total_produced_kg || 0).toFixed(2)} كلغ)</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="required">مخزون الإخراج</label>
        <select name="output_inventory_id" required>
          ${sabras.map(s => `<option value="${s.id}">${s.product_name} - ${s.display_color || 'بدون'}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>ملاحظات</label>
      <input name="notes" placeholder="ملاحظات...">
    </div>

    <div class="stats-grid" style="margin:15px 0">
      <div class="stat-card"><h4>سعر الكيلو</h4><div>${order.labor_cost_per_unit || 6} DH</div></div>
      <div class="stat-card warning" id="earnedPreview"><h4>المستحق</h4><div>0 DH</div></div>
    </div>

    <button type="submit" class="btn btn-success btn-lg" style="width:100%">💾 تسجيل الإنتاج</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/tdwar/production', {method: 'POST', body: JSON.stringify({
      manufacturing_order_id: orderId,
      production_bag_id: fd.get('production_bag_id') ? parseInt(fd.get('production_bag_id')) : null,
      quantity_kg: parseFloat(fd.get('quantity_kg')),
      output_inventory_id: parseInt(fd.get('output_inventory_id')),
      date: fd.get('date'),
      notes: fd.get('notes'),
      user: USER
    })});
    toast('تم تسجيل الإنتاج'); nav('tdwar');
  });

  // Update earned preview
  const qtyInput = document.querySelector('input[name="quantity_kg"]');
  qtyInput?.addEventListener('input', () => {
    const qty = parseFloat(qtyInput.value) || 0;
    const earned = qty * (order.labor_cost_per_unit || 6);
    document.getElementById('earnedPreview').innerHTML = `<h4>المستحق</h4><div class="text-success">${fmt(earned)}</div>`;
  });
};

window.viewTDWAROrder = async (orderId) => {
  const [orders, bags, production, combinations] = await Promise.all([
    api('/api/manufacturing/orders'),
    api(`/api/tdwar/orders/${orderId}/bags`),
    api(`/api/tdwar/orders/${orderId}/production`),
    api(`/api/tdwar/orders/${orderId}/combinations`).catch(() => []) // Fallback for orders without combinations
  ]);

  const order = orders.find(o => o.id === orderId);
  if (!order) return toast('الأمر غير موجود', 'danger');

  // Build color combinations section
  const combinationsHtml = combinations.length > 0 ? `
    <h4 style="margin-top:15px">🎨 تركيبات الألوان (${combinations.length})</h4>
    <table style="font-size:0.9em">
      <thead><tr><th>#</th><th>اللون</th><th>التركيبات</th><th>البوبينات</th><th>الإنتاج</th><th>الحالة</th></tr></thead>
      <tbody>${combinations.map((c, i) => `<tr>
        <td>${i+1}</td>
        <td><span class="badge badge-primary">${c.color_name || c.color_code || 'بدون'}</span></td>
        <td class="text-center">${c.number_of_compositions}</td>
        <td class="text-center">${c.bobbins_used}</td>
        <td class="text-success font-bold">${(c.total_produced_kg || 0).toFixed(2)} كلغ</td>
        <td><span class="badge badge-${c.status==='مكتمل'?'success':'info'}">${c.status || 'قيد_الإنتاج'}</span></td>
      </tr>`).join('')}</tbody>
    </table>
  ` : '';

  modal('تفاصيل أمر التدوير', `
    <div class="stats-grid" style="margin-bottom:15px">
      <div class="stat-card"><h4>رقم الأمر</h4><div>${order.order_number}</div></div>
      <div class="stat-card"><h4>الصانع</h4><div>${order.artisan_name}</div></div>
      <div class="stat-card"><h4>التاريخ</h4><div>${fmtDate(order.date)}</div></div>
      <div class="stat-card"><h4>الحالة</h4><div><span class="badge badge-${order.status==='مكتمل'?'success':'info'}">${order.status}</span></div></div>
    </div>

    <div class="stats-grid" style="margin-bottom:15px">
      <div class="stat-card warning"><h4>التركيبات</h4><div class="value">${order.number_of_compositions || 0}</div></div>
      <div class="stat-card"><h4>البوبينات</h4><div class="value">${order.bobbins_used || 0}</div></div>
      <div class="stat-card"><h4>الخناشي</h4><div class="value">${order.number_of_bags || 0}</div></div>
      <div class="stat-card success"><h4>الإنتاج</h4><div class="value">${(order.total_produced_kg || 0).toFixed(2)} كلغ</div></div>
    </div>

    ${combinationsHtml}

    <h4 style="margin-top:15px">🛍️ الخناشي (${bags.length})</h4>
    ${bags.length > 0 ? `
    <table style="font-size:0.9em">
      <thead><tr><th>#</th><th>اللون</th><th>الإنتاج</th><th>الهدر</th><th>التصنيف</th><th>الحالة</th></tr></thead>
      <tbody>${bags.map((b, i) => `<tr>
        <td>${i+1}</td>
        <td>${b.color_code || '-'}</td>
        <td class="font-bold ${(b.total_produced_kg || 0) >= 26 ? 'text-success' : (b.total_produced_kg || 0) >= 23 ? 'text-warning' : 'text-danger'}">${(b.total_produced_kg || 0).toFixed(2)} كلغ</td>
        <td class="text-danger">${b.status === 'مغلقة' ? ((b.waste_kg || 0).toFixed(2) + ' كلغ') : '-'}</td>
        <td>
          ${b.yield_classification === 'OK' ? '<span class="badge badge-success">OK</span>' :
            b.yield_classification === 'ضعيف' ? '<span class="badge badge-warning">ضعيف</span>' :
            b.yield_classification === 'هدر' ? '<span class="badge badge-danger">هدر</span>' :
            '<span class="badge">-</span>'}
        </td>
        <td><span class="badge badge-${b.status==='مغلقة'?'success':b.status==='مكتمل'?'success':'info'}">${b.status}</span></td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="alert">لا توجد خناشي</div>'}

    <h4 style="margin-top:15px">📝 سجل الإنتاج (${production.length})</h4>
    ${production.length > 0 ? `
    <table style="font-size:0.9em">
      <thead><tr><th>التاريخ</th><th>الكمية</th><th>المستحق</th><th>الخنشة</th></tr></thead>
      <tbody>${production.map(p => `<tr>
        <td>${fmtDate(p.date)}</td>
        <td class="text-success font-bold">${p.quantity_kg} كلغ</td>
        <td>${fmt(p.artisan_amount)}</td>
        <td>${p.bag_number ? '#' + p.bag_number : '-'}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="alert">لا يوجد إنتاج مسجل</div>'}

    <div class="stats-grid" style="margin-top:15px">
      <div class="stat-card"><h4>تكلفة المواد</h4><div>${fmt(order.total_material_cost)}</div></div>
      <div class="stat-card"><h4>تكلفة العمالة</h4><div>${fmt(order.total_labor_cost)}</div></div>
      <div class="stat-card success"><h4>التكلفة الإجمالية</h4><div>${fmt(order.total_cost)}</div></div>
    </div>
  `);
};

window.completeTDWAROrder = async (orderId) => {
  if (!confirm('هل تريد إغلاق أمر التدوير؟ لن يمكن تسجيل إنتاج بعد ذلك.')) return;
  try {
    await api(`/api/tdwar/orders/${orderId}/complete`, {method: 'PUT', body: JSON.stringify({ user: USER })});
    toast('تم إغلاق الأمر'); nav('tdwar');
  } catch(e) { toast(e.message, 'danger'); }
};

// ============================================
// ARTISAN DASHBOARD (v2.3)
// ============================================

async function loadArtisanDashboard(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    // Use TDWAR artisans only for the dashboard
    const artisans = await api('/api/artisans/tdwar').catch(() => api('/api/artisans'));
    const comparison = await api('/api/artisans/comparison?period=weekly');

    c.innerHTML = `
      <div class="page-header">
        <h2>📊 لوحة أداء الصناع</h2>
        <button class="btn" onclick="nav('tdwar')">🔄 العودة للتدوير</button>
      </div>

      <div class="card" style="margin-bottom:20px;padding:15px">
        <h3>🔍 اختر صانع لعرض التفاصيل</h3>
        <div class="form-grid">
          <select id="artisanSelect" onchange="loadArtisanKPIs(this.value)" style="padding:10px;font-size:16px">
            <option value="">-- اختر صانع --</option>
            ${artisans.filter(a => a.active).map(a => `<option value="${a.id}">${a.name} ${a.craft_type ? '('+a.craft_type+')' : ''}</option>`).join('')}
          </select>
          <select id="periodSelect" onchange="loadArtisanKPIs(document.getElementById('artisanSelect').value)" style="padding:10px">
            <option value="weekly">هذا الأسبوع</option>
            <option value="daily">اليوم</option>
            <option value="monthly">هذا الشهر</option>
            <option value="">الكل</option>
          </select>
        </div>
      </div>

      <div id="artisanKPIsContainer"></div>

      <div class="card" style="margin-top:20px">
        <h3>📈 مقارنة الصناع (أسبوعي)</h3>
        <div class="table-container"><table><thead><tr>
          <th>الصانع</th><th>إجمالي الإنتاج</th><th>أيام العمل</th><th>المعدل/يوم</th>
          <th>عدد الخناشي</th><th>المعدل/خنشة</th><th>نسبة الهدر</th>
        </tr></thead><tbody>${comparison.length === 0 ?
          '<tr><td colspan="7" class="text-center">لا توجد بيانات</td></tr>' :
          comparison.map(a => `<tr>
          <td class="font-bold">${a.name}</td>
          <td class="text-success font-bold">${(a.total_kg || 0).toFixed(2)} كلغ</td>
          <td>${a.working_days || 0}</td>
          <td>${a.avg_per_day || 0} كلغ</td>
          <td>${a.total_bags || 0}</td>
          <td class="${(a.avg_per_bag || 0) >= 26 ? 'text-success' : (a.avg_per_bag || 0) >= 23 ? 'text-warning' : 'text-danger'} font-bold">${a.avg_per_bag || 0}</td>
          <td class="${(a.waste_percent || 0) > 10 ? 'text-danger' : 'text-success'}">${a.waste_percent || 0}%</td>
        </tr>`).join('')}</tbody></table></div>
      </div>
    `;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.loadArtisanKPIs = async (artisanId) => {
  if (!artisanId) {
    document.getElementById('artisanKPIsContainer').innerHTML = '';
    return;
  }

  const period = document.getElementById('periodSelect')?.value || 'weekly';
  try {
    const data = await api(`/api/artisans/${artisanId}/dashboard?period=${period}`);
    const { artisan, kpis, yield_breakdown } = data;

    // FIXED: Simplified dashboard - only daily/weekly production + waste (closed bags only)
    // Removed: ratios, percentages as per requirement
    document.getElementById('artisanKPIsContainer').innerHTML = `
      <div class="card" style="margin-bottom:15px">
        <h3>📊 ${artisan.name} ${artisan.craft_type ? '- '+artisan.craft_type : ''}</h3>

        <div class="stats-grid">
          <div class="stat-card success">
            <h4>📦 الإنتاج الإجمالي</h4>
            <div class="value">${(kpis.kg_total || 0).toFixed(2)} كلغ</div>
            <div class="subtext">${kpis.avg_kg_per_day || 0} كلغ/يوم</div>
          </div>
          <div class="stat-card">
            <h4>📅 أيام العمل</h4>
            <div class="value">${kpis.working_days || 0}</div>
          </div>
          <div class="stat-card">
            <h4>🛍️ الخناشي المغلقة</h4>
            <div class="value">${kpis.closed_bags || 0}</div>
            ${kpis.open_bags > 0 ? `<div class="subtext" style="color:#f39c12">${kpis.open_bags} خنشة مفتوحة</div>` : ''}
          </div>
          <div class="stat-card ${(kpis.total_waste_kg || 0) > 0 ? 'warning' : 'success'}">
            <h4>🗑️ الهدر (خناشي مغلقة)</h4>
            <div class="value">${(kpis.total_waste_kg || 0).toFixed(2)} كلغ</div>
            <div class="subtext">من ${kpis.closed_bags || 0} خنشة مغلقة</div>
          </div>
        </div>

        ${yield_breakdown.note ? `<div class="alert alert-info" style="margin-top:10px">💡 ${yield_breakdown.note}</div>` : ''}

        <div class="stats-grid" style="margin-top:15px">
          <div class="stat-card">
            <h4>💰 المستحق</h4>
            <div class="value">${fmt(kpis.total_earned)}</div>
          </div>
          <div class="stat-card success">
            <h4>💵 المدفوع</h4>
            <div class="value">${fmt(kpis.total_paid)}</div>
          </div>
          <div class="stat-card ${kpis.balance > 0 ? 'warning' : 'success'}">
            <h4>📋 الرصيد</h4>
            <div class="value">${fmt(kpis.balance)}</div>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    document.getElementById('artisanKPIsContainer').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
};

// POS (نقطة البيع) - تصميم كاشير متكامل
async function loadPOS(c) {
  const [invData, clients] = await Promise.all([api('/api/inventory/by-category'), api('/api/clients')]);
  const { inventory, categories } = invData;

  // Store data globally
  window.posInventory = inventory;
  window.posClients = clients;
  window.posCart = [];
  window.posPayments = [];
  window.posDiscount = 0;
  window.posClientId = null;
  window.posClientPhone = '';
  window.posClientName = '';

  const categoryList = Object.keys(categories);
  const categoryIcons = {
    'مواد_خام': '🧱',
    'منتجات_نهائية': '📦',
    'غير مصنف': '📋'
  };

  c.innerHTML = `
    <style>
      .pos-container { display: grid; grid-template-columns: 1fr 400px; gap: 20px; height: calc(100vh - 130px); }
      .pos-products { display: flex; flex-direction: column; overflow: hidden; }
      .pos-categories { display: flex; gap: 10px; padding: 10px 0; overflow-x: auto; flex-shrink: 0; }
      .pos-category-btn { padding: 12px 24px; border: 2px solid var(--border); border-radius: 25px; background: white; cursor: pointer; font-weight: 700; font-size: 14px; white-space: nowrap; transition: all 0.2s; }
      .pos-category-btn:hover, .pos-category-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
      .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; overflow-y: auto; padding: 10px 0; flex: 1; }
      .pos-product-card { background: white; border-radius: 12px; padding: 15px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px solid var(--border); }
      .pos-product-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); border-color: var(--primary); }
      .pos-product-icon { font-size: 40px; margin-bottom: 8px; }
      .pos-product-name { font-weight: 700; font-size: 13px; margin-bottom: 5px; }
      .pos-product-color { font-size: 11px; color: var(--primary); margin-bottom: 5px; }
      .pos-product-price { font-weight: 900; color: var(--success); font-size: 14px; }
      .pos-product-qty { font-size: 11px; color: #666; }
      .pos-receipt { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
      .pos-receipt-header { background: linear-gradient(135deg, var(--primary), #7c3aed); color: white; padding: 20px; text-align: center; }
      .pos-receipt-header h3 { font-size: 18px; margin-bottom: 5px; }
      .pos-receipt-header .time { font-size: 12px; opacity: 0.8; }
      .pos-customer-info { padding: 15px; background: #f8f9fa; border-bottom: 1px dashed var(--border); }
      .pos-customer-info select, .pos-customer-info input { width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; font-family: 'Cairo'; }
      .pos-items { flex: 1; overflow-y: auto; padding: 10px; }
      .pos-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border); }
      .pos-item-info { flex: 1; }
      .pos-item-name { font-weight: 700; font-size: 13px; }
      .pos-item-details { font-size: 11px; color: #666; }
      .pos-item-qty { display: flex; align-items: center; gap: 8px; }
      .pos-item-qty button { width: 28px; height: 28px; border: none; border-radius: 50%; cursor: pointer; font-weight: 700; }
      .pos-item-qty .minus { background: #fee2e2; color: var(--danger); }
      .pos-item-qty .plus { background: #d1fae5; color: var(--success); }
      .pos-item-qty span { min-width: 30px; text-align: center; font-weight: 700; }
      .pos-item-total { font-weight: 900; color: var(--primary); min-width: 80px; text-align: left; }
      .pos-totals { padding: 15px; background: #f8f9fa; border-top: 2px dashed var(--border); }
      .pos-total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
      .pos-total-row.final { font-size: 20px; font-weight: 900; color: var(--primary); padding-top: 10px; border-top: 2px solid var(--primary); }
      .pos-actions { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
      .pos-actions button { padding: 15px; border: none; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 16px; font-family: 'Cairo'; }
      .pos-pay-btn { background: var(--success); color: white; }
      .pos-pay-btn:hover { background: #059669; }
      .pos-clear-btn { background: var(--danger); color: white; }
      .pos-shortcuts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 15px; background: #f0f0f0; }
      .pos-shortcut { padding: 10px; background: white; border: 1px solid var(--border); border-radius: 8px; text-align: center; cursor: pointer; font-size: 12px; }
      .pos-shortcut:hover { background: var(--light); }
      .pos-search { padding: 15px; background: white; border-bottom: 1px solid var(--border); }
      .pos-search input { width: 100%; padding: 12px 15px; border: 2px solid var(--border); border-radius: 25px; font-size: 14px; font-family: 'Cairo'; }
      .pos-search input:focus { border-color: var(--primary); outline: none; }
      .pos-empty { text-align: center; padding: 40px; color: #999; }
      .pos-empty-icon { font-size: 50px; margin-bottom: 15px; }
      .pos-waiting { position: fixed; bottom: 20px; left: 20px; background: white; padding: 15px 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 100; }
      .pos-waiting-title { font-weight: 700; margin-bottom: 10px; }
      .pos-waiting-items { display: flex; gap: 8px; }
      .pos-waiting-item { padding: 8px 12px; background: var(--light); border-radius: 6px; cursor: pointer; font-size: 12px; }
      .pos-discount-input { display: flex; align-items: center; gap: 10px; padding: 10px 15px; background: #fff3cd; }
      .pos-discount-input label { font-weight: 700; font-size: 13px; }
      .pos-discount-input input { width: 80px; padding: 8px; border: 1px solid var(--warning); border-radius: 6px; text-align: center; }
    </style>

    <div class="pos-container">
      <!-- Products Section -->
      <div class="pos-products">
        <div class="pos-search">
          <input type="text" id="posSearchInput" placeholder="🔍 بحث عن منتج..." oninput="filterPOSProducts()">
        </div>
        <div class="pos-categories">
          <button class="pos-category-btn active" onclick="filterPOSCategory('all')">📋 الكل</button>
          ${categoryList.map(cat => `<button class="pos-category-btn" onclick="filterPOSCategory('${cat}')">${categoryIcons[cat] || '📦'} ${cat.replace('_', ' ')}</button>`).join('')}
        </div>
        <div class="pos-grid" id="posProductsGrid">
          ${inventory.length === 0 ? '<div class="pos-empty"><div class="pos-empty-icon">📦</div><p>لا توجد منتجات في المخزون</p></div>' :
            inventory.map(item => `
              <div class="pos-product-card" data-category="${item.category || 'غير مصنف'}" data-name="${item.product_name}" onclick="addToCart(${item.id})">
                <div class="pos-product-icon">${getCategoryIcon(item.category)}</div>
                <div class="pos-product-name">${item.product_name}</div>
                <div class="pos-product-color">🎨 ${item.color_code}</div>
                <div class="pos-product-price">${fmt(item.unit_price)}</div>
                <div class="pos-product-qty">المتاح: ${item.quantity} ${item.unit}</div>
              </div>
            `).join('')}
        </div>
      </div>

      <!-- Receipt Section -->
      <div class="pos-receipt">
        <div class="pos-receipt-header">
          <h3>🧾 الفاتورة</h3>
          <div class="time" id="posTime">${new Date().toLocaleString('ar-MA')}</div>
        </div>

        <div class="pos-customer-info">
          <select id="posClientSelect" onchange="selectPOSClient()">
            <option value="">👤 عميل عابر</option>
            ${clients.map(cl => `<option value="${cl.id}" data-phone="${cl.phone||''}" data-name="${cl.name}" data-balance="${cl.balance||0}">${cl.code} - ${cl.name} ${parseFloat(cl.balance||0) > 0 ? '(دين: '+parseFloat(cl.balance||0).toFixed(2)+' DH)' : ''}</option>`).join('')}
          </select>
          <input type="text" id="posClientPhone" placeholder="📱 رقم الهاتف (إجباري للدين)">
          <input type="text" id="posClientName" placeholder="👤 اسم العميل">
        </div>
        <div id="posClientDebtInfo" class="alert alert-warning" style="display:none;margin-top:5px;padding:8px;font-size:12px"></div>

        <div class="pos-items" id="posCartItems">
          <div class="pos-empty">
            <div class="pos-empty-icon">🛒</div>
            <p>السلة فارغة</p>
            <p style="font-size:12px">اضغط على منتج لإضافته</p>
          </div>
        </div>

        <div class="pos-discount-input">
          <label>🏷️ خصم %</label>
          <input type="number" id="posDiscountInput" value="0" min="0" max="${USER==='admin'?100:5}" step="0.1" onchange="updatePOSDiscount()">
          ${USER!=='admin' ? '<span style="font-size:11px;color:#666">(الحد الأقصى 5%)</span>' : ''}
        </div>

        <div class="pos-totals">
          <div class="pos-total-row"><span>المجموع</span><span id="posSubtotal">0 DH</span></div>
          <div class="pos-total-row"><span>الخصم</span><span id="posDiscountAmount" style="color:var(--warning)">0 DH</span></div>
          <div class="pos-total-row final"><span>الإجمالي</span><span id="posFinalTotal">0 DH</span></div>
        </div>

        <div class="pos-shortcuts">
          <div class="pos-shortcut" onclick="quickPayCash()">💵 نقدي</div>
          <div class="pos-shortcut" onclick="openPaymentModal()">💳 طرق الدفع</div>
          <div class="pos-shortcut" onclick="holdOrder()">⏸️ انتظار</div>
          <div class="pos-shortcut" onclick="clearPOSCart()">🗑️ إلغاء</div>
        </div>

        <div class="pos-actions">
          <button class="pos-pay-btn" onclick="openPaymentModal()">💰 إتمام البيع (F12)</button>
        </div>
      </div>
    </div>

    <!-- Waiting Orders -->
    <div class="pos-waiting" id="posWaiting" style="display:none">
      <div class="pos-waiting-title">⏸️ طلبات في الانتظار</div>
      <div class="pos-waiting-items" id="posWaitingItems"></div>
    </div>
  `;

  // Update time
  setInterval(() => {
    const timeEl = document.getElementById('posTime');
    if(timeEl) timeEl.textContent = new Date().toLocaleString('ar-MA');
  }, 1000);

  // Keyboard shortcuts
  document.addEventListener('keydown', handlePOSKeyboard);
}

function getCategoryIcon(category) {
  const icons = { 'مواد_خام': '🧱', 'منتجات_نهائية': '✨', 'غير مصنف': '📦' };
  return icons[category] || '📦';
}

window.filterPOSCategory = (category) => {
  document.querySelectorAll('.pos-category-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  document.querySelectorAll('.pos-product-card').forEach(card => {
    if(category === 'all' || card.dataset.category === category) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
};

window.filterPOSProducts = () => {
  const search = document.getElementById('posSearchInput').value.toLowerCase();
  document.querySelectorAll('.pos-product-card').forEach(card => {
    const name = card.dataset.name.toLowerCase();
    card.style.display = name.includes(search) ? 'block' : 'none';
  });
};

window.addToCart = (inventoryId) => {
  const item = window.posInventory.find(i => i.id === inventoryId);
  if(!item) return;

  const existing = window.posCart.find(c => c.inventory_id === inventoryId);
  if(existing) {
    if(existing.quantity < item.quantity) {
      existing.quantity += 1;
    } else {
      toast('الكمية غير متوفرة', 'danger');
      return;
    }
  } else {
    window.posCart.push({
      inventory_id: item.id,
      product_name: item.product_name,
      color_code: item.color_code,
      color_code_id: item.color_code_id,
      unit_price: item.unit_price,
      quantity: 1,
      max_qty: item.quantity,
      unit: item.unit
    });
  }
  renderPOSCart();
};

window.updateCartQty = (inventoryId, delta) => {
  const item = window.posCart.find(c => c.inventory_id === inventoryId);
  if(!item) return;

  const newQty = item.quantity + delta;
  if(newQty <= 0) {
    window.posCart = window.posCart.filter(c => c.inventory_id !== inventoryId);
  } else if(newQty <= item.max_qty) {
    item.quantity = newQty;
  } else {
    toast('الكمية غير متوفرة', 'danger');
    return;
  }
  renderPOSCart();
};

window.removeFromCart = (inventoryId) => {
  window.posCart = window.posCart.filter(c => c.inventory_id !== inventoryId);
  renderPOSCart();
};

function renderPOSCart() {
  const container = document.getElementById('posCartItems');
  if(window.posCart.length === 0) {
    container.innerHTML = `<div class="pos-empty"><div class="pos-empty-icon">🛒</div><p>السلة فارغة</p></div>`;
  } else {
    container.innerHTML = window.posCart.map(item => `
      <div class="pos-item">
        <div class="pos-item-info">
          <div class="pos-item-name">${item.product_name}</div>
          <div class="pos-item-details">🎨 ${item.color_code} • ${fmt(item.unit_price)}</div>
        </div>
        <div class="pos-item-qty">
          <button class="minus" onclick="updateCartQty(${item.inventory_id}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="plus" onclick="updateCartQty(${item.inventory_id}, 1)">+</button>
        </div>
        <div class="pos-item-total">${fmt(item.quantity * item.unit_price)}</div>
      </div>
    `).join('');
  }
  updatePOSTotals();
}

window.updatePOSDiscount = () => {
  let discount = parseFloat(document.getElementById('posDiscountInput').value) || 0;
  if(USER !== 'admin' && discount > 5) {
    discount = 5;
    document.getElementById('posDiscountInput').value = 5;
    toast('الحد الأقصى للخصم هو 5%', 'danger');
  }
  window.posDiscount = discount;
  updatePOSTotals();
};

window.updatePOSTotals = () => {
  const subtotal = window.posCart.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discountAmount = subtotal * (window.posDiscount || 0) / 100;
  const finalTotal = subtotal - discountAmount;

  document.getElementById('posSubtotal').textContent = fmt(subtotal);
  document.getElementById('posDiscountAmount').textContent = fmt(discountAmount);
  document.getElementById('posFinalTotal').textContent = fmt(finalTotal);
};

window.selectPOSClient = () => {
  const select = document.getElementById('posClientSelect');
  const option = select.options[select.selectedIndex];
  const debtInfoEl = document.getElementById('posClientDebtInfo');

  if(option.value) {
    window.posClientId = parseInt(option.value);
    window.posClientPreviousDebt = parseFloat(option.dataset.balance || 0);
    document.getElementById('posClientPhone').value = option.dataset.phone || '';
    document.getElementById('posClientName').value = option.dataset.name || '';

    // Show previous debt info if exists
    if(window.posClientPreviousDebt > 0) {
      debtInfoEl.innerHTML = `⚠️ <strong>دين سابق:</strong> ${fmt(window.posClientPreviousDebt)}`;
      debtInfoEl.style.display = 'block';
    } else {
      debtInfoEl.style.display = 'none';
    }
  } else {
    window.posClientId = null;
    window.posClientPreviousDebt = 0;
    document.getElementById('posClientPhone').value = '';
    document.getElementById('posClientName').value = '';
    debtInfoEl.style.display = 'none';
  }
};

window.clearPOSCart = () => {
  if(window.posCart.length === 0) return;
  if(!confirm('هل تريد إلغاء الفاتورة؟')) return;
  window.posCart = [];
  window.posDiscount = 0;
  document.getElementById('posDiscountInput').value = 0;
  renderPOSCart();
};

window.quickPayCash = () => {
  if(window.posCart.length === 0) {
    toast('السلة فارغة', 'danger');
    return;
  }
  const subtotal = window.posCart.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discountAmount = subtotal * (window.posDiscount || 0) / 100;
  const finalTotal = subtotal - discountAmount;

  window.posPayments = [{ payment_type: 'نقدي', amount: finalTotal }];
  completePOSSale();
};

window.openPaymentModal = () => {
  if(window.posCart.length === 0) {
    toast('السلة فارغة', 'danger');
    return;
  }

  const subtotal = window.posCart.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discountAmount = subtotal * (window.posDiscount || 0) / 100;
  const finalTotal = subtotal - discountAmount;
  const previousDebt = window.posClientPreviousDebt || 0;
  const globalTotal = finalTotal + previousDebt;

  // Store for updatePaymentTotals
  window.posInvoiceTotal = finalTotal;
  window.posGlobalTotal = globalTotal;

  // Build debt info section - shows previous debt + invoice = global total
  const debtInfoHtml = previousDebt > 0 ? `
    <div class="alert alert-warning" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between"><span>⚠️ دين سابق:</span><strong>${fmt(previousDebt)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>📄 هذه الفاتورة:</span><strong>${fmt(finalTotal)}</strong></div>
      <hr style="margin:5px 0">
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>💰 الإجمالي الكلي (للإعلام):</span><strong style="color:#dc3545">${fmt(globalTotal)}</strong></div>
    </div>
  ` : '';

  modal('💰 طرق الدفع', `
    ${debtInfoHtml}
    <div class="alert alert-info">المبلغ المطلوب لهذه الفاتورة: <strong>${fmt(finalTotal)}</strong></div>
    <div id="paymentMethods"></div>
    <button type="button" class="btn btn-sm mt-20" onclick="addPaymentMethod()">➕ إضافة طريقة دفع</button>
    <div class="mt-20" style="background:#f8f9fa;padding:10px;border-radius:8px">
      <div class="pos-total-row"><span>إجمالي المدفوع:</span><span id="totalPaid" style="color:#28a745;font-weight:bold">0 DH</span></div>
      <div class="pos-total-row"><span>المتبقي من الفاتورة:</span><span id="remaining">${fmt(finalTotal)}</span></div>
      <hr style="margin:8px 0">
      <div class="pos-total-row"><span>🔴 الدين الجديد للعميل:</span><span id="newDebt" style="color:#dc3545;font-weight:bold">${fmt(globalTotal)}</span></div>
      <small style="color:#666">الدين الجديد = الدين السابق + الفاتورة - المدفوعات</small>
    </div>
    <button type="button" class="btn btn-success btn-lg mt-20" style="width:100%" onclick="completePOSSale()">✅ إتمام البيع</button>
  `);

  window.posPayments = [];
  addPaymentMethod();
};

window.addPaymentMethod = () => {
  const container = document.getElementById('paymentMethods');
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'form-grid payment-method-row';
  // FIXED: Removed "آجل" (debt) - debt is calculated automatically, not selectable
  // Added: تحويل (Bank Transfer), TPE
  div.innerHTML = `
    <div class="form-group">
      <select name="pay_type_${idx}" onchange="togglePOSCheckFields(this, ${idx}); updatePaymentTotals()">
        <option value="نقدي">💵 نقدي (صندوق)</option>
        <option value="شيك">📝 شيك</option>
        <option value="تحويل">🏦 تحويل بنكي</option>
        <option value="TPE">💳 TPE</option>
      </select>
    </div>
    <div class="form-group">
      <input type="number" name="pay_amt_${idx}" placeholder="المبلغ" step="0.01" min="0" oninput="updatePaymentTotals()">
    </div>
    <div class="form-group check-fields-${idx} hidden">
      <input type="text" name="pay_check_${idx}" placeholder="رقم الشيك">
      <input type="date" name="pay_due_${idx}">
      <input type="text" name="pay_bank_${idx}" placeholder="البنك">
    </div>
    <div class="form-group">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.payment-method-row').remove(); updatePaymentTotals()">🗑️</button>
    </div>
  `;
  container.appendChild(div);
};

window.togglePOSCheckFields = (select, idx) => {
  const checkFields = document.querySelector(`.check-fields-${idx}`);
  if(select.value === 'شيك') {
    checkFields.classList.remove('hidden');
  } else {
    checkFields.classList.add('hidden');
  }
};

window.updatePaymentTotals = () => {
  const subtotal = window.posCart.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discountAmount = subtotal * (window.posDiscount || 0) / 100;
  const finalTotal = subtotal - discountAmount;
  const previousDebt = window.posClientPreviousDebt || 0;

  let totalPaid = 0;
  document.querySelectorAll('.payment-method-row').forEach((row, i) => {
    const amt = parseFloat(row.querySelector(`input[name="pay_amt_${i}"]`)?.value) || 0;
    totalPaid += amt;
  });

  const remaining = finalTotal - totalPaid;
  document.getElementById('totalPaid').textContent = fmt(totalPaid);

  // Show remaining from invoice
  const remainingEl = document.getElementById('remaining');
  if (remaining > 0.01) {
    remainingEl.textContent = fmt(remaining);
    remainingEl.style.color = '#dc3545';
  } else {
    remainingEl.textContent = fmt(Math.max(0, remaining));
    remainingEl.style.color = '#28a745';
  }

  // Calculate and show NEW DEBT = previous debt + invoice - payments
  const newDebtEl = document.getElementById('newDebt');
  if (newDebtEl) {
    const invoiceDebt = Math.max(0, remaining); // What's left unpaid from this invoice
    const newTotalDebt = previousDebt + invoiceDebt;
    newDebtEl.textContent = fmt(newTotalDebt);
    newDebtEl.style.color = newTotalDebt > 0 ? '#dc3545' : '#28a745';
  }
};

window.completePOSSale = async () => {
  if(window.posCart.length === 0) {
    toast('السلة فارغة', 'danger');
    return;
  }

  // Collect payments
  const payments = [];
  document.querySelectorAll('.payment-method-row').forEach((row, i) => {
    const type = row.querySelector(`select[name="pay_type_${i}"]`)?.value;
    const amt = parseFloat(row.querySelector(`input[name="pay_amt_${i}"]`)?.value) || 0;

    if(type && amt > 0) {
      const payment = { payment_type: type, amount: amt };
      if(type === 'شيك') {
        payment.check_number = row.querySelector(`input[name="pay_check_${i}"]`)?.value;
        payment.check_due_date = row.querySelector(`input[name="pay_due_${i}"]`)?.value;
        payment.bank = row.querySelector(`input[name="pay_bank_${i}"]`)?.value;
      }
      payments.push(payment);
    }
  });

  // If quick pay cash
  if(window.posPayments.length > 0 && payments.length === 0) {
    payments.push(...window.posPayments);
  }

  // FIXED: Allow zero payment invoices - debt is calculated automatically
  // Removed: validation that blocks invoice when no payments exist

  const clientPhone = document.getElementById('posClientPhone').value;
  const clientName = document.getElementById('posClientName').value;

  const subtotal = window.posCart.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discountAmount = subtotal * (window.posDiscount || 0) / 100;
  const finalTotal = subtotal - discountAmount;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  // FIXED: Calculate debt automatically
  // debt = invoice_total - total_paid
  // If total_paid = 0, full amount is debt
  const debtAmount = finalTotal - totalPaid;
  const hasDebt = debtAmount > 0.01;

  // If there's debt (including full invoice as debt), phone is required
  if(hasDebt && !clientPhone) {
    toast('رقم الهاتف إجباري للبيع بالدين', 'danger');
    return;
  }

  // Auto-add debt as payment record if there's remaining amount
  // This works even if payments array is empty (full invoice as debt)
  if(hasDebt) {
    payments.push({ payment_type: 'آجل', amount: debtAmount });
  }

  try {
    const items = window.posCart.map(c => ({
      inventory_id: c.inventory_id,
      product_name: c.product_name,
      color_code_id: c.color_code_id,
      quantity: c.quantity,
      unit_price: c.unit_price,
      total_price: c.quantity * c.unit_price
    }));

    await api('/api/pos/sale', {method: 'POST', body: JSON.stringify({
      invoice_number: `SAL${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      client_id: window.posClientId,
      client_phone: clientPhone,
      client_name: clientName,
      items, payments,
      discount_percent: window.posDiscount,
      discount_amount: discountAmount,
      user: USER
    })});

    toast('✅ تم حفظ الفاتورة بنجاح', 'success');

    // Reload clients to get updated balances (debt)
    try {
      const updatedClients = await api('/api/clients');
      window.posClients = updatedClients;
      // Update dropdown options with new balances
      const clientSelect = document.getElementById('posClientSelect');
      if (clientSelect) {
        clientSelect.innerHTML = '<option value="">👤 عميل عابر</option>' +
          updatedClients.map(cl => `<option value="${cl.id}" data-phone="${cl.phone||''}" data-name="${cl.name}" data-balance="${cl.balance||0}">${cl.code} - ${cl.name} ${parseFloat(cl.balance||0) > 0 ? '(دين: '+parseFloat(cl.balance||0).toFixed(2)+' DH)' : ''}</option>`).join('');
      }
    } catch(e) {
      console.error('Failed to reload clients:', e);
    }

    // Close modal and reset
    document.querySelector('.modal')?.remove();
    window.posCart = [];
    window.posDiscount = 0;
    window.posPayments = [];
    document.getElementById('posDiscountInput').value = 0;
    document.getElementById('posClientSelect').value = '';
    document.getElementById('posClientPhone').value = '';
    document.getElementById('posClientName').value = '';
    renderPOSCart();

  } catch(err) {
    toast(err.message, 'danger');
  }
};

// Waiting orders
window.posWaitingOrders = [];

window.holdOrder = () => {
  if(window.posCart.length === 0) return;

  window.posWaitingOrders.push({
    id: Date.now(),
    cart: [...window.posCart],
    discount: window.posDiscount,
    clientId: window.posClientId,
    time: new Date().toLocaleTimeString('ar-MA')
  });

  window.posCart = [];
  window.posDiscount = 0;
  document.getElementById('posDiscountInput').value = 0;
  renderPOSCart();
  renderWaitingOrders();
  toast('تم حفظ الطلب في الانتظار');
};

window.restoreOrder = (orderId) => {
  const order = window.posWaitingOrders.find(o => o.id === orderId);
  if(!order) return;

  window.posCart = order.cart;
  window.posDiscount = order.discount;
  document.getElementById('posDiscountInput').value = order.discount;

  window.posWaitingOrders = window.posWaitingOrders.filter(o => o.id !== orderId);
  renderPOSCart();
  renderWaitingOrders();
};

function renderWaitingOrders() {
  const container = document.getElementById('posWaiting');
  const items = document.getElementById('posWaitingItems');

  if(window.posWaitingOrders.length === 0) {
    container.style.display = 'none';
  } else {
    container.style.display = 'block';
    items.innerHTML = window.posWaitingOrders.map(o => `
      <div class="pos-waiting-item" onclick="restoreOrder(${o.id})">
        🕐 ${o.time} (${o.cart.length} عناصر)
      </div>
    `).join('');
  }
}

function handlePOSKeyboard(e) {
  if(e.key === 'F12') {
    e.preventDefault();
    openPaymentModal();
  }
}

// Special Orders
async function loadSpecialOrders(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const orders = await api('/api/special-orders');
    c.innerHTML = `
      <div class="page-header"><h2>📋 الطلبيات الخاصة</h2></div>
      <div class="table-container"><table><thead><tr>
        <th>رقم الطلب</th><th>العميل</th><th>الهاتف</th><th>الخدمة</th><th>كود اللون</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead><tbody>${orders.map(o => `<tr>
        <td class="font-bold">${o.order_number}</td><td>${o.client_name||'-'}</td><td>${o.client_phone}</td>
        <td>${o.service_name||'-'}</td>
        <td>${o.color_code?`<span class="badge badge-primary">${o.color_code}</span>`:o.temp_color_description||'-'}</td>
        <td><span class="badge badge-${o.status==='مسلّم'?'success':'warning'}">${o.status}</span></td>
        <td><button class="btn btn-sm" onclick="updateOrderStatus(${o.id})">🔄</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.updateOrderStatus = async (id) => {
  const cc = await api('/api/color-codes');
  modal('تحديث الطلبية', `<form>
    <div class="form-grid">
      <div class="form-group"><label>كود اللون النهائي</label><select name="color_code_id">
        <option value="">لم يحدد بعد</option>
        ${cc.map(c => `<option value="${c.id}">${c.code} - ${c.main_color}</option>`).join('')}</select></div>
      <div class="form-group"><label>الحالة</label><select name="status">
        <option value="قيد_التحضير">قيد التحضير</option>
        <option value="محضّر">محضّر</option>
        <option value="مع_الصانع">مع الصانع</option>
        <option value="جاهز">جاهز</option>
        <option value="مسلّم">مسلّم</option>
      </select></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/special-orders/${id}`, {method: 'PUT', body: JSON.stringify({
      color_code_id: fd.get('color_code_id') ? parseInt(fd.get('color_code_id')) : null,
      status: fd.get('status'),
      user: USER
    })});
    toast('تم التحديث'); nav('special-orders');
  });
};

// Sales
async function loadSales(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const clients = await api('/api/clients');
    window.salesClients = clients;

    c.innerHTML = `
      <div class="page-header"><h2>📤 المبيعات</h2></div>

      <div class="card" style="margin-bottom:20px;padding:15px">
        <h4 style="margin-bottom:10px">🔍 الفلاتر</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>الفترة</label>
            <select id="salesPeriod" onchange="filterSales()">
              <option value="">الكل</option>
              <option value="daily">اليوم</option>
              <option value="weekly">هذا الأسبوع</option>
              <option value="monthly">هذا الشهر</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
          </div>
          <div class="form-group" id="customDateRange" style="display:none">
            <label>من</label><input type="date" id="salesFromDate">
            <label>إلى</label><input type="date" id="salesToDate">
          </div>
          <div class="form-group">
            <label>العميل</label>
            <select id="salesClient" onchange="filterSales()">
              <option value="">الكل</option>
              ${clients.map(cl => `<option value="${cl.id}">${cl.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <button class="btn" onclick="filterSales()">🔄 تحديث</button>
          </div>
        </div>
      </div>

      <div id="salesKPIs"></div>
      <div id="salesTable"></div>
    `;

    // Toggle custom date range
    document.getElementById('salesPeriod').onchange = function() {
      document.getElementById('customDateRange').style.display = this.value === 'custom' ? 'flex' : 'none';
      if (this.value !== 'custom') filterSales();
    };

    filterSales();
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.filterSales = async () => {
  const period = document.getElementById('salesPeriod').value;
  const clientId = document.getElementById('salesClient').value;
  const fromDate = document.getElementById('salesFromDate')?.value;
  const toDate = document.getElementById('salesToDate')?.value;

  let url = '/api/sales?';
  if (period && period !== 'custom') url += `period=${period}&`;
  if (period === 'custom' && fromDate && toDate) url += `from_date=${fromDate}&to_date=${toDate}&`;
  if (clientId) url += `client_id=${clientId}&`;

  try {
    const data = await api(url);
    const { sales, kpis } = data;

    // Render KPIs with payment breakdown
    document.getElementById('salesKPIs').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card success">
          <h3>💰 إجمالي المبيعات</h3>
          <div class="value">${fmt(kpis.total_sales)}</div>
          <div class="subtext">${kpis.count} فاتورة</div>
        </div>
        <div class="stat-card">
          <h3>💵 إجمالي المدفوع</h3>
          <div class="value">${fmt(kpis.total_paid)}</div>
        </div>
        <div class="stat-card warning">
          <h3>📝 الباقي (ديون)</h3>
          <div class="value">${fmt(kpis.total_remaining)}</div>
        </div>
        <div class="stat-card ${kpis.total_profit >= 0 ? 'success' : 'danger'}">
          <h3>📈 الربح</h3>
          <div class="value">${fmt(kpis.total_profit)}</div>
          <div class="subtext">تكلفة: ${fmt(kpis.total_cost)}</div>
        </div>
      </div>
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card" style="border-right:4px solid #28a745">
          <h3>💵 المدفوع نقداً</h3>
          <div class="value">${fmt(kpis.total_cash)}</div>
          <div class="subtext">يضاف للخزنة مباشرة</div>
        </div>
        <div class="stat-card" style="border-right:4px solid #17a2b8">
          <h3>📄 المدفوع بالشيكات</h3>
          <div class="value">${fmt(kpis.total_checks)}</div>
          <div class="subtext">قيد التحصيل</div>
        </div>
        <div class="stat-card" style="border-right:4px solid #6f42c1">
          <h3>🏦 المدفوع تحويل</h3>
          <div class="value">${fmt(kpis.total_transfers || 0)}</div>
        </div>
        <div class="stat-card" style="border-right:4px solid #dc3545">
          <h3>📋 آجل (ديون)</h3>
          <div class="value">${fmt(kpis.total_credit || 0)}</div>
        </div>
      </div>
    `;

    // Helper to shorten invoice number (INV-2026-0000012487 -> #12487)
    const shortInvoice = (inv) => {
      if (!inv) return '-';
      const match = inv.match(/(\d+)$/);
      return match ? `#${parseInt(match[1])}` : inv;
    };

    // Render table with payment breakdown
    document.getElementById('salesTable').innerHTML = `
      <div class="table-container"><table><thead><tr>
        <th>الفاتورة</th><th>التاريخ</th><th>العميل</th>
        <th>المبلغ</th><th>المدفوع (تفصيل)</th><th>الباقي</th><th>الربح</th><th>إجراءات</th>
      </tr></thead><tbody>${sales.length === 0 ? '<tr><td colspan="8" class="text-center">لا توجد مبيعات</td></tr>' : sales.map(s => `<tr>
        <td class="font-bold" title="${s.invoice_number}">${shortInvoice(s.invoice_number)}</td>
        <td>${fmtDate(s.date)}</td>
        <td>${s.client_name||'عميل عابر'}</td>
        <td class="text-success font-bold">${fmt(s.final_amount)}</td>
        <td style="font-size:0.85em">
          ${s.cash_paid > 0 ? `<span class="badge" style="background:#28a745;color:#fff">💵 ${fmt(s.cash_paid)}</span> ` : ''}
          ${s.check_paid > 0 ? `<span class="badge" style="background:#17a2b8;color:#fff">📄 ${fmt(s.check_paid)}</span> ` : ''}
          ${s.transfer_paid > 0 ? `<span class="badge" style="background:#6f42c1;color:#fff">🏦 ${fmt(s.transfer_paid)}</span> ` : ''}
          ${s.credit_amount > 0 ? `<span class="badge" style="background:#dc3545;color:#fff">📋 ${fmt(s.credit_amount)}</span>` : ''}
          ${s.total_paid === 0 ? '<span class="badge" style="background:#6c757d;color:#fff">لم يدفع</span>' : ''}
        </td>
        <td class="${s.remaining > 0 ? 'text-danger' : 'text-success'} font-bold">${fmt(s.remaining)}</td>
        <td class="${s.profit >= 0 ? 'text-success' : 'text-danger'} font-bold">${fmt(s.profit)}</td>
        <td><button class="btn btn-sm" onclick="viewSaleDetails(${s.id})">👁️</button></td>
      </tr>`).join('')}</tbody></table></div>
    `;
  } catch(e) {
    document.getElementById('salesTable').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
};

window.viewSaleDetails = async (saleId) => {
  const data = await api('/api/sales');
  const sale = data.sales.find(s => s.id === saleId);
  if (!sale) return toast('الفاتورة غير موجودة', 'danger');

  modal('تفاصيل الفاتورة', `
    <div class="stats-grid" style="margin-bottom:15px">
      <div class="stat-card"><h3>رقم الفاتورة</h3><div class="value">${sale.invoice_number}</div></div>
      <div class="stat-card"><h3>العميل</h3><div class="value">${sale.client_name || 'عابر'}</div></div>
      <div class="stat-card success"><h3>المبلغ</h3><div class="value">${fmt(sale.final_amount)}</div></div>
      <div class="stat-card ${sale.remaining > 0 ? 'warning' : 'success'}"><h3>الباقي</h3><div class="value">${fmt(sale.remaining)}</div></div>
    </div>

    <h4>📦 العناصر</h4>
    <table>
      <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>التكلفة</th><th>الإجمالي</th></tr></thead>
      <tbody>${(sale.items || []).map(item => `<tr>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>${fmt(item.unit_price)}</td>
        <td>${fmt(item.unit_cost || 0)}</td>
        <td class="font-bold">${fmt(item.total_price)}</td>
      </tr>`).join('')}</tbody>
    </table>

    <h4 style="margin-top:15px">💳 المدفوعات</h4>
    <table>
      <thead><tr><th>الطريقة</th><th>المبلغ</th><th>رقم الشيك</th><th>تاريخ الاستحقاق</th></tr></thead>
      <tbody>${(sale.payments || []).map(p => `<tr>
        <td><span class="badge badge-info">${p.payment_type}</span></td>
        <td class="font-bold">${fmt(p.amount)}</td>
        <td>${p.check_number || '-'}</td>
        <td>${p.check_due_date ? fmtDate(p.check_due_date) : '-'}</td>
      </tr>`).join('')}</tbody>
    </table>

    <div class="stats-grid" style="margin-top:15px">
      <div class="stat-card"><h3>التكلفة</h3><div class="value">${fmt(sale.total_cost)}</div></div>
      <div class="stat-card ${sale.profit >= 0 ? 'success' : 'danger'}"><h3>الربح</h3><div class="value">${fmt(sale.profit)}</div></div>
    </div>
  `);
};

// استمرار...

// Purchases
async function loadPurchases(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const suppliers = await api('/api/suppliers');
    window.purchaseSuppliers = suppliers;

    c.innerHTML = `
      <div class="page-header"><h2>📥 المشتريات</h2>
      <button class="btn" onclick="addPurchase()">➕ إضافة</button></div>

      <div class="card" style="margin-bottom:20px;padding:15px">
        <h4 style="margin-bottom:10px">🔍 الفلاتر</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>الفترة</label>
            <select id="purchasesPeriod" onchange="filterPurchases()">
              <option value="">الكل</option>
              <option value="daily">اليوم</option>
              <option value="weekly">هذا الأسبوع</option>
              <option value="monthly">هذا الشهر</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
          </div>
          <div class="form-group" id="purchasesCustomDateRange" style="display:none">
            <label>من</label><input type="date" id="purchasesFromDate">
            <label>إلى</label><input type="date" id="purchasesToDate">
          </div>
          <div class="form-group">
            <label>المورد</label>
            <select id="purchasesSupplier" onchange="filterPurchases()">
              <option value="">الكل</option>
              ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <button class="btn" onclick="filterPurchases()">🔄 تحديث</button>
          </div>
        </div>
      </div>

      <div id="purchasesKPIs"></div>
      <div id="purchasesTable"></div>
    `;

    // Toggle custom date range
    document.getElementById('purchasesPeriod').onchange = function() {
      document.getElementById('purchasesCustomDateRange').style.display = this.value === 'custom' ? 'flex' : 'none';
      if (this.value !== 'custom') filterPurchases();
    };

    filterPurchases();
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.filterPurchases = async () => {
  const period = document.getElementById('purchasesPeriod').value;
  const supplierId = document.getElementById('purchasesSupplier').value;
  const fromDate = document.getElementById('purchasesFromDate')?.value;
  const toDate = document.getElementById('purchasesToDate')?.value;

  let url = '/api/purchases?';
  if (period && period !== 'custom') url += `period=${period}&`;
  if (period === 'custom' && fromDate && toDate) url += `from_date=${fromDate}&to_date=${toDate}&`;
  if (supplierId) url += `supplier_id=${supplierId}&`;

  try {
    const data = await api(url);
    const { purchases, kpis } = data;

    // Render KPIs
    document.getElementById('purchasesKPIs').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card danger">
          <h3>💸 إجمالي المشتريات</h3>
          <div class="value">${fmt(kpis.total_purchases)}</div>
          <div class="subtext">${kpis.count} فاتورة</div>
        </div>
        <div class="stat-card">
          <h3>💵 المدفوع</h3>
          <div class="value">${fmt(kpis.total_paid)}</div>
        </div>
        <div class="stat-card warning">
          <h3>📝 الباقي (ديون للموردين)</h3>
          <div class="value">${fmt(kpis.total_remaining)}</div>
        </div>
      </div>
    `;

    // Render table
    document.getElementById('purchasesTable').innerHTML = `
      <div class="table-container"><table><thead><tr>
        <th>رقم الفاتورة</th><th>التاريخ</th><th>المورد</th>
        <th>المبلغ</th><th>المدفوع</th><th>الباقي</th><th>إجراءات</th>
      </tr></thead><tbody>${purchases.length === 0 ? '<tr><td colspan="7" class="text-center">لا توجد مشتريات</td></tr>' : purchases.map(p => `<tr>
        <td class="font-bold">${p.invoice_number}</td>
        <td>${fmtDate(p.date)}</td>
        <td>${p.supplier_name||'-'}</td>
        <td class="text-danger font-bold">${fmt(p.total_amount)}</td>
        <td>${fmt(p.total_paid)}</td>
        <td class="${p.remaining > 0 ? 'text-warning' : 'text-success'} font-bold">${fmt(p.remaining)}</td>
        <td><button class="btn btn-sm" onclick="viewPurchaseDetails(${p.id})">👁️</button></td>
      </tr>`).join('')}</tbody></table></div>
    `;
  } catch(e) {
    document.getElementById('purchasesTable').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
};

window.viewPurchaseDetails = async (purchaseId) => {
  const data = await api('/api/purchases');
  const purchase = data.purchases.find(p => p.id === purchaseId);
  if (!purchase) return toast('الفاتورة غير موجودة', 'danger');

  modal('تفاصيل فاتورة المشتريات', `
    <div class="stats-grid" style="margin-bottom:15px">
      <div class="stat-card"><h3>رقم الفاتورة</h3><div class="value">${purchase.invoice_number}</div></div>
      <div class="stat-card"><h3>المورد</h3><div class="value">${purchase.supplier_name || '-'}</div></div>
      <div class="stat-card danger"><h3>المبلغ</h3><div class="value">${fmt(purchase.total_amount)}</div></div>
      <div class="stat-card ${purchase.remaining > 0 ? 'warning' : 'success'}"><h3>الباقي</h3><div class="value">${fmt(purchase.remaining)}</div></div>
    </div>

    <h4>📦 العناصر</h4>
    <table>
      <thead><tr><th>المنتج</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الإجمالي</th></tr></thead>
      <tbody>${(purchase.items || []).map(item => `<tr>
        <td>منتج #${item.inventory_id}</td>
        <td>${item.quantity}</td>
        <td>${fmt(item.unit_cost)}</td>
        <td class="font-bold">${fmt(item.total_cost)}</td>
      </tr>`).join('')}</tbody>
    </table>

    <h4 style="margin-top:15px">💳 المدفوعات</h4>
    <table>
      <thead><tr><th>الطريقة</th><th>المبلغ</th><th>رقم الشيك</th><th>النوع</th></tr></thead>
      <tbody>${(purchase.payments || []).map(p => `<tr>
        <td><span class="badge badge-info">${p.payment_type}</span></td>
        <td class="font-bold">${fmt(p.amount)}</td>
        <td>${p.check_number || '-'}</td>
        <td>${p.source_check_id ? '<span class="badge badge-warning">مظهّر</span>' : '-'}</td>
      </tr>`).join('')}</tbody>
    </table>
  `);
};

window.addPurchase = async () => {
  const [suppliers, inv, availableChecks] = await Promise.all([
    api('/api/suppliers'),
    api('/api/inventory'),
    api('/api/checks/portfolio/available')
  ]);

  // Store available checks globally
  window.purchaseAvailableChecks = availableChecks;

  modal('إضافة فاتورة مشتريات', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">رقم الفاتورة</label><input name="invoice_number" value="PUR${Date.now()}" required></div>
      <div class="form-group"><label class="required">التاريخ</label><input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required></div>
      <div class="form-group"><label>المورد</label><select name="supplier_id" onchange="fillSupplierName(this)">
        <option value="">غير محدد</option>
        ${suppliers.map(s => `<option value="${s.id}" data-name="${s.name}">${s.code} - ${s.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>اسم المورد</label><input name="supplier_name" id="supplierNameInput"></div>
    </div>

    <h4>📦 العناصر</h4>
    <div id="purchaseItems">
      <div class="form-grid purchase-item-row">
        <div class="form-group"><select name="item_0">
          <option value="">اختر منتج...</option>
          ${inv.map(i => `<option value="${i.id}">${i.product_name} - ${i.color_code}</option>`).join('')}</select></div>
        <div class="form-group"><input type="number" name="qty_0" placeholder="الكمية" step="0.01" onchange="calcPurchaseTotal()"></div>
        <div class="form-group"><input type="number" name="cost_0" placeholder="تكلفة الوحدة" step="0.01" onchange="calcPurchaseTotal()"></div>
        <div class="form-group"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.purchase-item-row').remove(); calcPurchaseTotal()">🗑️</button></div>
      </div>
    </div>
    <button type="button" class="btn btn-sm" onclick="addPurchaseItem()">➕ إضافة عنصر</button>

    <div class="alert alert-info mt-20">
      <strong>إجمالي المشتريات:</strong> <span id="purchaseTotal">0 DH</span>
    </div>

    <h4 class="mt-20">💰 طرق الدفع</h4>
    <div class="alert alert-warning">💡 يمكنك الدفع بالشيكات المستلمة من العملاء (شيكات مظهّرة)</div>
    <div id="purchasePayments"></div>
    <button type="button" class="btn btn-sm" onclick="addPurchasePayment()">➕ إضافة طريقة دفع</button>

    <div class="mt-20">
      <div class="form-grid">
        <div><strong>إجمالي المدفوع:</strong> <span id="purchasePaid">0 DH</span></div>
        <div><strong>المتبقي:</strong> <span id="purchaseRemaining">0 DH</span></div>
      </div>
    </div>

    <button type="submit" class="btn btn-success btn-lg mt-20" style="width:100%">💾 حفظ فاتورة المشتريات</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const items = [];
    document.querySelectorAll('.purchase-item-row').forEach((row, i) => {
      const inv_id = row.querySelector(`select[name="item_${i}"]`)?.value;
      const qty = row.querySelector(`input[name="qty_${i}"]`)?.value;
      const cost = row.querySelector(`input[name="cost_${i}"]`)?.value;
      if(inv_id && qty && cost) {
        items.push({
          inventory_id: parseInt(inv_id),
          quantity: parseFloat(qty),
          unit_cost: parseFloat(cost),
          total_cost: parseFloat(qty) * parseFloat(cost)
        });
      }
    });

    if(items.length === 0) {
      toast('أضف عنصر واحد على الأقل', 'danger');
      return;
    }

    const payments = [];
    document.querySelectorAll('.purchase-payment-row').forEach((row, i) => {
      const type = row.querySelector(`select[name="ptype_${i}"]`)?.value;
      const amt = parseFloat(row.querySelector(`input[name="pamt_${i}"]`)?.value) || 0;

      if(type && amt > 0) {
        const payment = { payment_type: type, amount: amt };

        if(type === 'شيك') {
          payment.check_number = row.querySelector(`input[name="pcheck_${i}"]`)?.value;
          payment.check_due_date = row.querySelector(`input[name="pdue_${i}"]`)?.value;
          payment.bank = row.querySelector(`input[name="pbank_${i}"]`)?.value;
        } else if(type === 'شيك_مظهر') {
          const sourceCheckId = row.querySelector(`select[name="psource_${i}"]`)?.value;
          if(sourceCheckId) {
            payment.source_check_id = parseInt(sourceCheckId);
            const sourceCheck = window.purchaseAvailableChecks.find(c => c.id == sourceCheckId);
            if(sourceCheck) {
              payment.check_number = sourceCheck.check_number;
              payment.check_due_date = sourceCheck.due_date;
              payment.bank = sourceCheck.bank;
            }
          }
        }
        payments.push(payment);
      }
    });

    await api('/api/purchases', {method: 'POST', body: JSON.stringify({
      invoice_number: fd.get('invoice_number'),
      date: fd.get('date'),
      supplier_id: fd.get('supplier_id') ? parseInt(fd.get('supplier_id')) : null,
      supplier_name: fd.get('supplier_name'),
      items, payments, user: USER
    })});
    toast('تمت الإضافة'); nav('purchases');
  });

  // Add first payment method
  addPurchasePayment();
};

window.fillSupplierName = (select) => {
  const option = select.options[select.selectedIndex];
  if(option.value) {
    document.getElementById('supplierNameInput').value = option.dataset.name || '';
  }
};

window.calcPurchaseTotal = () => {
  let total = 0;
  document.querySelectorAll('.purchase-item-row').forEach((row, i) => {
    const qty = parseFloat(row.querySelector(`input[name="qty_${i}"]`)?.value) || 0;
    const cost = parseFloat(row.querySelector(`input[name="cost_${i}"]`)?.value) || 0;
    total += qty * cost;
  });
  document.getElementById('purchaseTotal').textContent = fmt(total);
  calcPurchasePayments();
};

window.calcPurchasePayments = () => {
  let totalItems = 0;
  document.querySelectorAll('.purchase-item-row').forEach((row, i) => {
    const qty = parseFloat(row.querySelector(`input[name="qty_${i}"]`)?.value) || 0;
    const cost = parseFloat(row.querySelector(`input[name="cost_${i}"]`)?.value) || 0;
    totalItems += qty * cost;
  });

  let totalPaid = 0;
  document.querySelectorAll('.purchase-payment-row').forEach((row, i) => {
    const amt = parseFloat(row.querySelector(`input[name="pamt_${i}"]`)?.value) || 0;
    totalPaid += amt;
  });

  document.getElementById('purchasePaid').textContent = fmt(totalPaid);
  document.getElementById('purchaseRemaining').textContent = fmt(totalItems - totalPaid);
};

window.addPurchaseItem = () => {
  const container = document.getElementById('purchaseItems');
  const idx = container.children.length;
  const firstSelect = container.querySelector('select').cloneNode(true);
  firstSelect.name = `item_${idx}`;
  const div = document.createElement('div');
  div.className = 'form-grid purchase-item-row';
  div.innerHTML = `
    <div class="form-group"></div>
    <div class="form-group"><input type="number" name="qty_${idx}" placeholder="الكمية" step="0.01" onchange="calcPurchaseTotal()"></div>
    <div class="form-group"><input type="number" name="cost_${idx}" placeholder="تكلفة الوحدة" step="0.01" onchange="calcPurchaseTotal()"></div>
    <div class="form-group"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.purchase-item-row').remove(); calcPurchaseTotal()">🗑️</button></div>
  `;
  div.querySelector('.form-group').appendChild(firstSelect);
  container.appendChild(div);
};

window.addPurchasePayment = () => {
  const container = document.getElementById('purchasePayments');
  const idx = container.children.length;
  const availableChecks = window.purchaseAvailableChecks || [];

  const div = document.createElement('div');
  div.className = 'form-grid purchase-payment-row';
  div.innerHTML = `
    <div class="form-group">
      <select name="ptype_${idx}" onchange="togglePurchasePaymentFields(this, ${idx})">
        <option value="نقدي">💵 نقدي</option>
        <option value="شيك">📝 شيك شخصي (جديد)</option>
        <option value="شيك_مظهر">🔄 شيك مظهّر (من المحفظة)</option>
        <option value="آجل">📅 آجل (دين)</option>
      </select>
    </div>
    <div class="form-group">
      <input type="number" name="pamt_${idx}" placeholder="المبلغ" step="0.01" onchange="calcPurchasePayments()">
    </div>
    <div class="form-group pcheck-fields-${idx} hidden">
      <input type="text" name="pcheck_${idx}" placeholder="رقم الشيك">
      <input type="date" name="pdue_${idx}" placeholder="تاريخ الاستحقاق">
      <input type="text" name="pbank_${idx}" placeholder="البنك">
    </div>
    <div class="form-group psource-fields-${idx} hidden">
      <select name="psource_${idx}" onchange="fillEndorsedCheckAmount(this, ${idx})">
        <option value="">اختر شيك من المحفظة...</option>
        ${availableChecks.map(ch => `<option value="${ch.id}" data-amount="${ch.amount}" data-due="${ch.due_date}" data-bank="${ch.bank}">${ch.check_number} - ${ch.from_client} - ${fmt(ch.amount)} (${fmtDate(ch.due_date)})</option>`).join('')}
      </select>
      <div style="font-size:11px;color:#666;margin-top:5px">
        ${availableChecks.length > 0 ? `✅ ${availableChecks.length} شيكات متاحة للتظهير` : '⚠️ لا توجد شيكات متاحة'}
      </div>
    </div>
    <div class="form-group">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.purchase-payment-row').remove(); calcPurchasePayments()">🗑️</button>
    </div>
  `;
  container.appendChild(div);
};

window.togglePurchasePaymentFields = (select, idx) => {
  const checkFields = document.querySelector(`.pcheck-fields-${idx}`);
  const sourceFields = document.querySelector(`.psource-fields-${idx}`);

  checkFields.classList.add('hidden');
  sourceFields.classList.add('hidden');

  if(select.value === 'شيك') {
    checkFields.classList.remove('hidden');
  } else if(select.value === 'شيك_مظهر') {
    sourceFields.classList.remove('hidden');
  }
};

window.fillEndorsedCheckAmount = (select, idx) => {
  const option = select.options[select.selectedIndex];
  if(option.value) {
    const amtInput = document.querySelector(`input[name="pamt_${idx}"]`);
    amtInput.value = option.dataset.amount || 0;
    calcPurchasePayments();
  }
};

// Checks Portfolio
async function loadChecksPortfolio(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const checks = await api('/api/checks/portfolio');
    c.innerHTML = `
      <div class="page-header"><h2>💳 محفظة الشيكات</h2>
      <button class="btn" onclick="addCheck()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>رقم الشيك</th><th>من</th><th>المبلغ</th><th>تاريخ الاستحقاق</th><th>البنك</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead><tbody>${checks.map(ch => `<tr>
        <td class="font-bold">${ch.check_number}</td><td>${ch.from_client}</td>
        <td class="font-bold">${fmt(ch.amount)}</td><td>${fmtDate(ch.due_date)}</td><td>${ch.bank}</td>
        <td><span class="badge badge-${ch.status==='محصّل'?'success':ch.status==='مظهّر'?'info':'warning'}">${ch.status}</span></td>
        <td>${ch.status==='معلق'?`<button class="btn btn-sm btn-success" onclick="depositCheck(${ch.id})">💰 تحصيل</button>`:''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addCheck = () => {
  modal('إضافة شيك', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">رقم الشيك</label><input name="check_number" required></div>
      <div class="form-group"><label class="required">من العميل</label><input name="from_client" required></div>
      <div class="form-group"><label class="required">المبلغ</label><input type="number" name="amount" required step="0.01"></div>
      <div class="form-group"><label class="required">تاريخ الاستحقاق</label><input type="date" name="due_date" required></div>
      <div class="form-group"><label class="required">البنك</label><input name="bank" required></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/checks/portfolio', {method: 'POST', body: JSON.stringify({
      check_number: fd.get('check_number'),
      date: new Date().toISOString().split('T')[0],
      from_client: fd.get('from_client'),
      amount: parseFloat(fd.get('amount')),
      due_date: fd.get('due_date'),
      bank: fd.get('bank'),
      user: USER
    })});
    toast('تمت الإضافة'); nav('checks-portfolio');
  });
};

window.depositCheck = async (id) => {
  if(!confirm('تحصيل الشيك إلى البنك؟')) return;
  try {
    await api(`/api/checks/portfolio/${id}/deposit`, {method: 'PUT', body: JSON.stringify({user: USER})});
    toast('تم التحصيل'); nav('checks-portfolio');
  } catch(e) { toast(e.message, 'danger'); }
};

// Checks Issued
async function loadChecksIssued(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    c.innerHTML = `
      <div class="page-header"><h2>📄 الشيكات الصادرة</h2>
      <button class="btn" onclick="addCheckIssued()">➕ إضافة شيك</button></div>

      <div class="card" style="margin-bottom:20px;padding:15px">
        <h4 style="margin-bottom:10px">🔍 الفلاتر</h4>
        <div class="form-grid">
          <div class="form-group">
            <label>الفترة</label>
            <select id="checksIssuedPeriod" onchange="filterChecksIssued()">
              <option value="">الكل</option>
              <option value="daily">استحقاق اليوم</option>
              <option value="weekly">هذا الأسبوع</option>
              <option value="monthly">هذا الشهر</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
          </div>
          <div class="form-group" id="checksIssuedCustomDateRange" style="display:none">
            <label>من</label><input type="date" id="checksIssuedFromDate">
            <label>إلى</label><input type="date" id="checksIssuedToDate">
          </div>
          <div class="form-group">
            <label>الحالة</label>
            <select id="checksIssuedStatus" onchange="filterChecksIssued()">
              <option value="">الكل</option>
              <option value="معلق">معلق</option>
              <option value="مدفوع">مدفوع</option>
              <option value="مرتجع">مرتجع</option>
            </select>
          </div>
          <div class="form-group">
            <button class="btn" onclick="filterChecksIssued()">🔄 تحديث</button>
          </div>
        </div>
      </div>

      <div id="checksIssuedKPIs"></div>
      <div id="checksIssuedTable"></div>
    `;

    // Toggle custom date range
    document.getElementById('checksIssuedPeriod').onchange = function() {
      document.getElementById('checksIssuedCustomDateRange').style.display = this.value === 'custom' ? 'flex' : 'none';
      if (this.value !== 'custom') filterChecksIssued();
    };

    filterChecksIssued();
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.filterChecksIssued = async () => {
  const period = document.getElementById('checksIssuedPeriod').value;
  const status = document.getElementById('checksIssuedStatus').value;
  const fromDate = document.getElementById('checksIssuedFromDate')?.value;
  const toDate = document.getElementById('checksIssuedToDate')?.value;

  let url = '/api/checks/issued?';
  if (period && period !== 'custom') url += `period=${period}&`;
  if (period === 'custom' && fromDate && toDate) url += `from_date=${fromDate}&to_date=${toDate}&`;
  if (status) url += `status=${status}&`;

  try {
    const data = await api(url);
    const { checks, kpis } = data;

    // Render KPIs
    document.getElementById('checksIssuedKPIs').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <h3>📋 إجمالي الشيكات</h3>
          <div class="value">${kpis.total_count}</div>
          <div class="subtext">${fmt(kpis.total_amount)}</div>
        </div>
        <div class="stat-card warning">
          <h3>⏳ معلقة</h3>
          <div class="value">${kpis.pending_count}</div>
          <div class="subtext">${fmt(kpis.pending_amount)}</div>
        </div>
        <div class="stat-card success">
          <h3>✅ مدفوعة</h3>
          <div class="value">${kpis.paid_count}</div>
          <div class="subtext">${fmt(kpis.paid_amount)}</div>
        </div>
        <div class="stat-card info">
          <h3>🔄 مظهّرة</h3>
          <div class="value">${kpis.endorsed_count}</div>
          <div class="subtext">${fmt(kpis.endorsed_amount)}</div>
        </div>
      </div>
    `;

    // Render table
    document.getElementById('checksIssuedTable').innerHTML = `
      <div class="table-container"><table><thead><tr>
        <th>رقم الشيك</th><th>صاحب الشيك</th><th>تاريخ الورود</th><th>إلى المورد</th>
        <th>المبلغ</th><th>تاريخ الاستحقاق</th><th>البنك</th><th>النوع</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead><tbody>${checks.length === 0 ? '<tr><td colspan="10" class="text-center">لا توجد شيكات</td></tr>' : checks.map(ch => `<tr>
        <td class="font-bold">${ch.check_number}</td>
        <td>${ch.check_owner || '-'}</td>
        <td>${ch.received_date ? fmtDate(ch.received_date) : '-'}</td>
        <td>${ch.to_supplier}</td>
        <td class="text-danger font-bold">${fmt(ch.amount)}</td>
        <td>${fmtDate(ch.due_date)}</td>
        <td>${ch.bank}</td>
        <td><span class="badge badge-${ch.type==='مظهّر'?'info':'primary'}">${ch.type}</span></td>
        <td><span class="badge badge-${ch.status==='مدفوع'?'success':ch.status==='مرتجع'?'danger':'warning'}">${ch.status}</span></td>
        <td>
          ${ch.status === 'معلق' ? `
            <button class="btn btn-sm btn-success" onclick="markCheckPaid(${ch.id})">✅ دفع</button>
            <button class="btn btn-sm" onclick="editCheckIssued(${ch.id})">✏️</button>
          ` : ''}
        </td>
      </tr>`).join('')}</tbody></table></div>
    `;
  } catch(e) {
    document.getElementById('checksIssuedTable').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
};

window.addCheckIssued = () => {
  modal('إضافة شيك صادر', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">رقم الشيك</label><input name="check_number" required></div>
      <div class="form-group"><label class="required">التاريخ</label><input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required></div>
      <div class="form-group"><label>صاحب الشيك</label><input name="check_owner" placeholder="صاحب الشيك الأصلي"></div>
      <div class="form-group"><label>تاريخ الورود</label><input type="date" name="received_date"></div>
      <div class="form-group"><label class="required">إلى المورد</label><input name="to_supplier" required></div>
      <div class="form-group"><label class="required">المبلغ</label><input type="number" name="amount" required step="0.01"></div>
      <div class="form-group"><label class="required">تاريخ الاستحقاق</label><input type="date" name="due_date" required></div>
      <div class="form-group"><label class="required">البنك</label><input name="bank" required></div>
      <div class="form-group"><label>النوع</label>
        <select name="type">
          <option value="شيكاتي">شيكاتي</option>
          <option value="مظهّر">مظهّر</option>
        </select>
      </div>
      <div class="form-group"><label>ملاحظات</label><textarea name="notes"></textarea></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/checks/issued', {method: 'POST', body: JSON.stringify({
      check_number: fd.get('check_number'),
      date: fd.get('date'),
      received_date: fd.get('received_date') || null,
      check_owner: fd.get('check_owner') || null,
      to_supplier: fd.get('to_supplier'),
      amount: parseFloat(fd.get('amount')),
      due_date: fd.get('due_date'),
      bank: fd.get('bank'),
      type: fd.get('type'),
      notes: fd.get('notes'),
      user: USER
    })});
    toast('تمت الإضافة'); nav('checks-issued');
  });
};

window.editCheckIssued = async (checkId) => {
  const data = await api('/api/checks/issued');
  const check = data.checks.find(c => c.id === checkId);
  if (!check) return toast('الشيك غير موجود', 'danger');

  modal('تعديل شيك صادر', `<form>
    <div class="form-grid">
      <div class="form-group"><label>صاحب الشيك</label><input name="check_owner" value="${check.check_owner || ''}"></div>
      <div class="form-group"><label>تاريخ الورود</label><input type="date" name="received_date" value="${check.received_date || ''}"></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/checks/issued/${checkId}`, {method: 'PUT', body: JSON.stringify({
      check_owner: fd.get('check_owner') || null,
      received_date: fd.get('received_date') || null,
      user: USER
    })});
    toast('تم التعديل'); nav('checks-issued');
  });
};

window.markCheckPaid = async (checkId) => {
  // Get check details first
  const data = await api('/api/checks/issued');
  const check = data.checks.find(c => c.id === checkId);
  if (!check) return toast('الشيك غير موجود', 'danger');

  modal('تأكيد دفع الشيك', `
    <div class="alert alert-warning" style="margin-bottom:15px">
      ⚠️ سيتم خصم مبلغ <strong>${fmt(check.amount)}</strong> من الحساب المحدد
    </div>
    <form>
      <div class="form-grid">
        <div class="form-group">
          <label class="required">مصدر الخصم</label>
          <select name="payment_source" required>
            <option value="">-- اختر مصدر الدفع --</option>
            <option value="الصندوق">💵 الخزنة (الصندوق)</option>
            <option value="البنك">🏦 البنك</option>
          </select>
        </div>
        <div class="form-group">
          <label>تاريخ الدفع</label>
          <input type="date" name="paid_date" value="${new Date().toISOString().split('T')[0]}" required>
        </div>
      </div>
      <div class="stats-grid" style="margin:15px 0">
        <div class="stat-card"><h4>رقم الشيك</h4><div>${check.check_number}</div></div>
        <div class="stat-card"><h4>المستفيد</h4><div>${check.to_supplier}</div></div>
        <div class="stat-card warning"><h4>المبلغ</h4><div class="value">${fmt(check.amount)}</div></div>
      </div>
      <button type="submit" class="btn btn-success">✅ تأكيد الدفع</button>
    </form>
  `, async (e) => {
    const fd = new FormData(e.target);
    const paymentSource = fd.get('payment_source');
    if (!paymentSource) { toast('يجب تحديد مصدر الدفع', 'danger'); return; }

    try {
      await api(`/api/checks/issued/${checkId}/pay`, {method: 'PUT', body: JSON.stringify({
        payment_source: paymentSource,
        paid_date: fd.get('paid_date'),
        user: USER
      })});
      toast('تم دفع الشيك وخصم المبلغ من ' + paymentSource, 'success');
      filterChecksIssued();
    } catch(e) { toast(e.message, 'danger'); }
  });
};

// Treasury
async function loadTreasury(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const summary = await api('/api/treasury/summary');
    const movements = await api('/api/treasury/movements?limit=50');
    c.innerHTML = `
      <div class="page-header"><h2>💰 الخزينة</h2></div>
      <div class="alert alert-info">💡 الخزينة = نتيجة حركات (للقراءة فقط)</div>
      <div class="stats-grid">
        <div class="stat-card"><h3>💵 الصندوق</h3><div class="value">${fmt(summary.cash.balance)}</div>
          <div class="subtext">وارد: ${fmt(summary.cash.in)} | صادر: ${fmt(summary.cash.out)}</div></div>
        <div class="stat-card success"><h3>🏦 البنك</h3><div class="value">${fmt(summary.bank.balance)}</div>
          <div class="subtext">وارد: ${fmt(summary.bank.in)} | صادر: ${fmt(summary.bank.out)}</div></div>
        <div class="stat-card warning"><h3>📝 شيكات تحت التحصيل</h3><div class="value">${fmt(summary.checksUnderCollection)}</div></div>
        <div class="stat-card success"><h3>💰 إجمالي السيولة</h3><div class="value">${fmt(summary.totalLiquid)}</div></div>
      </div>
      <div class="card"><h3>آخر 50 حركة</h3>
        <div class="table-container"><table><thead><tr>
          <th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>الحساب</th><th>المصدر</th>
        </tr></thead><tbody>${movements.map(m => `<tr>
          <td>${fmtDate(m.date)}</td>
          <td><span class="badge badge-${m.type==='وارد'?'success':'danger'}">${m.type}</span></td>
          <td>${m.description}</td>
          <td class="${m.type==='وارد'?'text-success':'text-danger'} font-bold">${fmt(m.amount)}</td>
          <td><span class="badge badge-info">${m.account}</span></td>
          <td><span class="badge badge-primary">${m.reference_type}</span></td>
        </tr>`).join('')}</tbody></table></div>
      </div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Expenses
async function loadExpenses(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const expenses = await api('/api/expenses');
    c.innerHTML = `
      <div class="page-header"><h2>💸 المصروفات</h2>
      <button class="btn" onclick="addExpense()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>التاريخ</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th><th>طريقة الدفع</th>
      </tr></thead><tbody>${expenses.map(e => `<tr>
        <td>${fmtDate(e.date)}</td><td><span class="badge badge-warning">${e.category}</span></td>
        <td>${e.description}</td><td class="text-danger font-bold">${fmt(e.amount)}</td>
        <td>${e.payment_method}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addExpense = () => {
  modal('إضافة مصروف', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">التاريخ</label><input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required></div>
      <div class="form-group"><label class="required">الفئة</label><input name="category" required placeholder="كراء، كهرباء، رواتب..."></div>
      <div class="form-group"><label class="required">الوصف</label><input name="description" required></div>
      <div class="form-group"><label class="required">المبلغ</label><input type="number" name="amount" required step="0.01"></div>
      <div class="form-group"><label class="required">طريقة الدفع</label><select name="payment_method" required>
        <option value="نقدي">نقدي</option>
        <option value="بنك">بنك</option>
      </select></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/expenses', {method: 'POST', body: JSON.stringify({
      date: fd.get('date'),
      category: fd.get('category'),
      description: fd.get('description'),
      amount: parseFloat(fd.get('amount')),
      payment_method: fd.get('payment_method'),
      user: USER
    })});
    toast('تمت الإضافة'); nav('expenses');
  });
};

// Clients & Suppliers
async function loadClients(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const clients = await api('/api/clients');
    c.innerHTML = `
      <div class="page-header"><h2>👥 العملاء</h2>
      <button class="btn" onclick="addClient()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th>
      </tr></thead><tbody>${clients.map(cl => `<tr>
        <td>${cl.code}</td><td class="font-bold">${cl.name}</td><td>${cl.phone||'-'}</td>
        <td class="${cl.balance>=0?'text-success':'text-danger'} font-bold">${fmt(cl.balance)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addClient = () => {
  modal('إضافة عميل', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone"></div>
      <div class="form-group"><label>العنوان</label><input name="address"></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/clients', {method: 'POST', body: JSON.stringify({
      name: fd.get('name'),
      phone: fd.get('phone'), address: fd.get('address'), user: USER
    })});
    toast('تمت الإضافة'); nav('clients');
  });
};

async function loadSuppliers(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const suppliers = await api('/api/suppliers');
    c.innerHTML = `
      <div class="page-header"><h2>🏭 الموردين</h2>
      <button class="btn" onclick="addSupplier()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th>
      </tr></thead><tbody>${suppliers.map(s => `<tr>
        <td>${s.code}</td><td class="font-bold">${s.name}</td><td>${s.phone||'-'}</td>
        <td class="${s.balance>=0?'text-success':'text-danger'} font-bold">${fmt(s.balance)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addSupplier = () => {
  modal('إضافة مورد', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone"></div>
      <div class="form-group"><label>العنوان</label><input name="address"></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api('/api/suppliers', {method: 'POST', body: JSON.stringify({
      name: fd.get('name'),
      phone: fd.get('phone'), address: fd.get('address'), user: USER
    })});
    toast('تمت الإضافة'); nav('suppliers');
  });
};

// Reports
async function loadReports(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [income, balance, mfgAnalysis] = await Promise.all([
      api('/api/reports/income-statement'),
      api('/api/reports/balance-sheet'),
      api('/api/reports/manufacturing-cost-analysis')
    ]);

    const currentYear = new Date().getFullYear();

    c.innerHTML = `
      <div class="page-header"><h2>📈 التقارير المالية</h2></div>
      <div class="alert alert-info">💡 التقارير مبنية على بيانات حقيقية من النظام - السنة المالية ${currentYear}</div>

      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card ${income.net_profit>=0?'success':'danger'}">
          <h3>💰 صافي الربح</h3>
          <div class="value">${fmt(income.net_profit)}</div>
        </div>
        <div class="stat-card success">
          <h3>📈 صافي المبيعات</h3>
          <div class="value">${fmt(income.revenue.net_sales)}</div>
        </div>
        <div class="stat-card">
          <h3>💵 إجمالي الأصول</h3>
          <div class="value">${fmt(balance.assets.total)}</div>
        </div>
        <div class="stat-card warning">
          <h3>🏭 تكلفة التصنيع</h3>
          <div class="value">${fmt(mfgAnalysis.summary.total_cost)}</div>
        </div>
      </div>

      <div class="form-grid">
        <div class="card">
          <h3>📊 قائمة الدخل (Income Statement)</h3>
          <table>
            <thead><tr><th>البند</th><th>المبلغ</th></tr></thead>
            <tbody>
              <tr class="table-header"><td colspan="2"><strong>الإيرادات</strong></td></tr>
              <tr><td>إجمالي المبيعات</td><td class="text-success">${fmt(income.revenue.gross_sales)}</td></tr>
              <tr><td>(-) خصومات المبيعات <span class="badge badge-warning">نقص إيراد</span></td><td class="text-warning">(${fmt(income.revenue.less_sales_discounts)})</td></tr>
              <tr class="table-highlight"><td class="font-bold">= صافي المبيعات</td><td class="text-success font-bold">${fmt(income.revenue.net_sales)}</td></tr>

              <tr class="table-header"><td colspan="2"><strong>تكلفة البضاعة المباعة</strong></td></tr>
              <tr><td>المشتريات</td><td class="text-danger">${fmt(income.cost_of_goods.purchases)}</td></tr>
              <tr><td>تكاليف التصنيع</td><td class="text-danger">${fmt(income.cost_of_goods.manufacturing)}</td></tr>
              <tr class="table-highlight"><td class="font-bold">= إجمالي تكلفة البضاعة</td><td class="text-danger font-bold">(${fmt(income.cost_of_goods.total)})</td></tr>

              <tr class="table-highlight" style="background:#e8f5e9"><td class="font-bold">= إجمالي الربح (Gross Profit)</td><td class="font-bold ${income.gross_profit>=0?'text-success':'text-danger'}">${fmt(income.gross_profit)}</td></tr>

              <tr class="table-header"><td colspan="2"><strong>مصروفات التشغيل</strong></td></tr>
              <tr><td>مصروفات متنوعة</td><td class="text-danger">(${fmt(income.expenses.total)})</td></tr>

              <tr class="table-highlight" style="background:${income.net_profit>=0?'#c8e6c9':'#ffcdd2'}">
                <td class="font-bold" style="font-size:1.1em">= صافي الربح (Net Profit)</td>
                <td class="font-bold ${income.net_profit>=0?'text-success':'text-danger'}" style="font-size:1.2em">${fmt(income.net_profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>📋 الميزانية العمومية (Balance Sheet)</h3>
          <table>
            <thead><tr><th>البند</th><th>المبلغ</th></tr></thead>
            <tbody>
              <tr class="table-header"><td colspan="2"><strong>الأصول (Assets)</strong></td></tr>
              <tr><td>💵 الصندوق (النقدية)</td><td>${fmt(balance.assets.cash)}</td></tr>
              <tr><td>🏦 البنك</td><td>${fmt(balance.assets.bank)}</td></tr>
              <tr><td>📝 شيكات تحت التحصيل</td><td>${fmt(balance.assets.checks)}</td></tr>
              <tr><td>📦 المخزون</td><td>${fmt(balance.assets.inventory)}</td></tr>
              <tr><td>👥 ديون العملاء (المدينون)</td><td>${fmt(balance.assets.clientsDebt)}</td></tr>
              <tr class="table-highlight"><td class="font-bold">= إجمالي الأصول</td><td class="text-success font-bold">${fmt(balance.assets.total)}</td></tr>

              <tr class="table-header"><td colspan="2"><strong>الخصوم (Liabilities)</strong></td></tr>
              <tr><td>🏭 ديون الموردين (الدائنون)</td><td class="text-danger">${fmt(balance.liabilities.total)}</td></tr>
              <tr class="table-highlight"><td class="font-bold">= إجمالي الخصوم</td><td class="text-danger font-bold">${fmt(balance.liabilities.total)}</td></tr>

              <tr class="table-header"><td colspan="2"><strong>حقوق الملكية (Equity)</strong></td></tr>
              <tr><td>💼 رأس المال</td><td>${fmt(balance.equity.capital)}</td></tr>
              <tr><td>📈 الأرباح المحتجزة</td><td>${fmt(income.net_profit)}</td></tr>
              <tr class="table-highlight"><td class="font-bold">= إجمالي حقوق الملكية</td><td class="font-bold">${fmt(balance.equity.total + income.net_profit)}</td></tr>

              <tr class="table-highlight" style="background:#e3f2fd">
                <td class="font-bold">= الخصوم + حقوق الملكية</td>
                <td class="font-bold">${fmt(balance.liabilities.total + balance.equity.total + income.net_profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>🏭 تحليل تكاليف التصنيع</h3>
        <div class="stats-grid" style="margin-bottom:15px">
          <div class="stat-card"><h3>📦 أوامر مكتملة</h3><div class="value">${mfgAnalysis.summary.total_orders}</div></div>
          <div class="stat-card"><h3>🧱 تكلفة المواد</h3><div class="value">${fmt(mfgAnalysis.summary.total_material_cost)}</div></div>
          <div class="stat-card"><h3>👷 تكلفة العمالة</h3><div class="value">${fmt(mfgAnalysis.summary.total_labor_cost)}</div></div>
          <div class="stat-card warning"><h3>⚙️ تكاليف غير مباشرة</h3><div class="value">${fmt(mfgAnalysis.summary.total_overhead_cost)}</div></div>
        </div>
        ${mfgAnalysis.orders.length > 0 ? `
        <div class="table-container">
          <table>
            <thead><tr><th>رقم الأمر</th><th>كود اللون</th><th>الخدمة</th><th>الصانع</th><th>الكمية</th><th>تكلفة الوحدة</th><th>التكلفة الإجمالية</th></tr></thead>
            <tbody>${mfgAnalysis.orders.slice(0,10).map(o => `<tr>
              <td class="font-bold">${o.order_number}</td>
              <td><span class="badge badge-primary">${o.color_code}</span></td>
              <td>${o.service_name}</td>
              <td>${o.artisan_name}</td>
              <td>${o.actual_output_quantity || o.expected_output_quantity}</td>
              <td>${fmt(o.unit_cost)}</td>
              <td class="font-bold">${fmt(o.total_cost)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
        ${mfgAnalysis.orders.length > 10 ? `<p class="text-muted">عرض أول 10 أوامر من ${mfgAnalysis.orders.length}</p>` : ''}
        ` : '<p class="text-muted">لا توجد أوامر تصنيع مكتملة</p>'}
      </div>

      <div class="card">
        <h3>📤 طباعة التقارير</h3>
        <button class="btn" onclick="window.print()">🖨️ طباعة الصفحة</button>
      </div>
    `;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      nav(item.dataset.page);
    });
  });
  nav('dashboard');
});
