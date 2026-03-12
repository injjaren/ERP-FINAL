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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `خطأ (${res.status})`);
    Object.assign(err, body);
    err.status = res.status;
    throw err;
  }
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
    'color-management': loadColorManagement,
    'warehouses': loadWarehouses,
    'product-types': loadProductTypes,
    'service-types': loadServiceTypes,
    'inventory': loadInventory,
    'inventory-reports': loadInventoryReports,
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
    'traites': loadTraites,
    'treasury': loadTreasury,
    'expenses': loadExpenses,
    'clients': loadClients,
    'client-statement': loadClientStatement,
    'suppliers': loadSuppliers,
    'supplier-statement': loadSupplierStatement,
    'reports': loadReports,
    'journal': loadJournal,
    'trial-balance': loadTrialBalance,
    'ledger': loadLedger,
    'profit-loss':    loadProfitLoss,
    'balance-sheet':  loadBalanceSheet,
    'mfg-batches':       loadMfgBatches,
    'mfg-new':           loadMfgNew,
    'mfg-entries':       loadMfgEntries,
    'mfg-cost-analysis': loadMfgCostAnalysis,
    'mfg-jaab-efficiency': loadMfgJaabEfficiency,
    'mfg-batch-detail':  loadMfgBatchDetail,
    // v9 pages (legacy — kept for backward compat, nav redirects to color-management)
    'color-families':        loadColorManagement,
    'color-master':          loadColorManagement,
    'mfg-dashboard':         loadMfgDashboard,
    'mfg-sessions':          loadMfgSessions,
    'mfg-session-new':       loadMfgSessionNew,
    'mfg-session-screen':    loadMfgSessionScreen,
    'mfg-reports':           loadMfgReports,
    'mfg-artisan-rates':     loadMfgArtisanRates,
    'mfg-colors-below-zero': loadMfgColorsBelowZero,
    'mfg-colors-overview':   loadMfgColorsOverview,
    'color-analytics':       loadColorAnalytics,
    // ── TAILORING MODULE ──────────────────────────────────────────────────────
    'tailoring-pos':          loadTailoringPOS,
    'tailoring-orders':       loadTailoringOrders,
    'tailoring-order-detail': loadTailoringOrderDetail,
    'tailoring-catalog':      loadTailoringCatalog,
    'tailoring-artisan-board':loadTailoringArtisanBoard,
    // ── SUPPLIES POS MODULE ───────────────────────────────────────────────────
    'pos-supplies':           loadPOSSupplies,

  };

  if (pages[page]) pages[page](c);
  else c.innerHTML = '<div class="alert alert-warning">صفحة غير موجودة</div>';
}

// Dashboard
async function loadDashboard(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [d, sys] = await Promise.all([
      api('/api/dashboard'),
      api('/api/system/version').catch(() => null)
    ]);

    const envBadge = sys
      ? (sys.docker
          ? '<span style="background:#0ea5e9;color:#fff;padding:2px 10px;border-radius:12px;font-size:0.8rem;margin-right:8px">🐳 Docker Mode</span>'
          : '<span style="background:#10b981;color:#fff;padding:2px 10px;border-radius:12px;font-size:0.8rem;margin-right:8px">💻 Local Mode</span>')
      : '';
    const versionLabel = sys
      ? `${sys.version} | بناء: ${new Date(sys.build_time).toLocaleString('ar-MA')}`
      : '';

    c.innerHTML = `
      <div class="page-header"><h2>📊 لوحة التحكم</h2>
        <div style="margin-right:auto;display:flex;align-items:center;gap:6px">${envBadge}<small style="color:#6b7280">${versionLabel}</small></div>
      </div>
      <div class="alert alert-success">✅ النظام يعمل بنجاح</div>
      <div class="stats-grid">
        <div class="stat-card"><h3>💰 الصندوق</h3><div class="value">${fmt(d.cash)}</div></div>
        <div class="stat-card success"><h3>🏦 البنك</h3><div class="value">${fmt(d.bank)}</div></div>
        <div class="stat-card warning"><h3>📝 شيكات تحت التحصيل</h3><div class="value">${fmt(d.checksUnderCollection)}</div></div>
        <div class="stat-card success"><h3>💵 إجمالي السيولة</h3><div class="value">${fmt(d.totalLiquid)}</div></div>
        <div class="stat-card warning"><h3>📦 قيمة المخزون</h3><div class="value">${fmt(d.inventoryValue)}</div></div>
        <div class="stat-card success"><h3>📈 إجمالي المبيعات</h3><div class="value">${fmt(d.grossSales)}</div></div>
        <div class="stat-card warning"><h3>🏷️ خصومات المبيعات</h3><div class="value">${fmt(d.salesDiscounts)}</div><div class="subtext">نقص إيراد</div></div>
        <div class="stat-card success"><h3>✅ صافي المبيعات</h3><div class="value">${fmt(d.netSales)}</div></div>
        <div class="stat-card danger"><h3>📊 تكلفة البضاعة المباعة</h3><div class="value">${fmt(d.totalCOGS)}</div><div class="subtext">COGS من سجل المبيعات</div></div>
        <div class="stat-card danger"><h3>💸 المصروفات</h3><div class="value">${fmt(d.totalExpenses)}</div></div>
        <div class="stat-card ${d.netProfit>=0?'success':'danger'}"><h3>💰 صافي الربح</h3><div class="value">${fmt(d.netProfit)}</div><div class="subtext">المبيعات - التكلفة - المصروفات</div></div>
      </div>
      <div class="card" style="margin-top:20px;padding:16px">
        <h3 style="margin-bottom:14px;font-family:'Cairo',sans-serif">📦 ملخص المخزون</h3>
        <div class="stats-grid" style="margin-bottom:14px">
          <div class="stat-card">
            <h3>🏭 جملة (كجم)</h3>
            <div class="value">${(d.inventory?.wholesale_kg || 0).toLocaleString('ar-MA', {maximumFractionDigits:1})}</div>
            <div class="subtext">مخزون الجملة</div>
          </div>
          <div class="stat-card success">
            <h3>🛒 تجزئة (كجم)</h3>
            <div class="value">${(d.inventory?.retail_kg || 0).toLocaleString('ar-MA', {maximumFractionDigits:1})}</div>
            <div class="subtext">تجزئة كيلوغرام</div>
          </div>
          <div class="stat-card success">
            <h3>⚖️ تجزئة (أونصة)</h3>
            <div class="value">${(d.inventory?.retail_oz || 0).toLocaleString('ar-MA', {maximumFractionDigits:0})}</div>
            <div class="subtext">تجزئة أونصة</div>
          </div>
          <div class="stat-card warning">
            <h3>🧵 بكر خام</h3>
            <div class="value">${(d.inventory?.raw_bobbin || 0).toLocaleString('ar-MA', {maximumFractionDigits:0})}</div>
            <div class="subtext">بكر غير مصنعة</div>
          </div>
          <div class="stat-card ${(d.inventory?.low_stock_count || 0) > 0 ? 'danger' : 'success'}">
            <h3>⚠️ مخزون منخفض</h3>
            <div class="value">${d.inventory?.low_stock_count || 0}</div>
            <div class="subtext">أصناف أقل من 5 كجم</div>
          </div>
        </div>
        ${(d.inventory?.top_colors?.length > 0) ? `
        <div>
          <h4 style="font-family:'Cairo',sans-serif;font-size:.85rem;color:#6b7280;margin-bottom:8px">🎨 أعلى الألوان مخزوناً (جملة)</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${d.inventory.top_colors.map(tc => `
              <div style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-family:'Cairo',sans-serif;font-size:.8rem">
                ${tc.hex_code ? `<span style="width:14px;height:14px;border-radius:50%;background:${tc.hex_code};display:inline-block;border:1px solid #cbd5e1;flex-shrink:0"></span>` : ''}
                <span>${tc.color_name}</span>
                <strong style="color:#0ea5e9">${parseFloat(tc.total_kg).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</strong>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>
      <div id="dashboard-recent-payments" style="margin-top:16px"></div>
      ${sys ? `<div class="card" style="margin-top:16px;padding:16px">
        <h3 style="margin-bottom:12px">ℹ️ معلومات النظام</h3>
        <table style="width:auto;border-collapse:collapse">
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280">الإصدار</td><td><strong>${sys.version}</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280">وقت البناء</td><td>${new Date(sys.build_time).toLocaleString('ar-MA')}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280">البيئة</td><td>${sys.environment}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#6b7280">وضع التشغيل</td><td>${sys.docker ? '🐳 Docker' : '💻 محلي'}</td></tr>
        </table>
      </div>` : ''}`;
    // Recent payments — async after page renders
    api('/api/reports/recent-payments').then(payments => {
      const el = document.getElementById('dashboard-recent-payments');
      if (!el || !payments.length) return;
      el.innerHTML = `<div class="card" style="padding:16px">
        <h3 style="margin-bottom:12px;font-family:'Cairo',sans-serif">💳 آخر المدفوعات</h3>
        <div class="table-container"><table>
          <thead><tr><th>التاريخ</th><th>العميل</th><th>المرجع</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead>
          <tbody>${payments.map(p=>`<tr>
            <td>${fmtDate(p.payment_date)}</td>
            <td class="font-bold">${p.party_name}</td>
            <td style="color:#6b7280;font-size:.85rem">${p.reference||'—'}</td>
            <td><span class="badge badge-success">${p.method||'—'}</span></td>
            <td class="text-success font-bold">${fmt(p.amount)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
    }).catch(() => {});

  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Color Codes
// ============================================================
// v11: UNIFIED COLOR MANAGEMENT
// Single screen: color_families → colors → supplier codes
// ============================================================
async function loadColorManagement(c) {
  c.innerHTML = `<div style="padding:2rem;text-align:center;color:#94a3b8;font-family:'Cairo',sans-serif">⏳ جاري التحميل...</div>`;
  try {
    const [hierarchy, suppliers] = await Promise.all([
      api('/api/color-families/hierarchy'),
      api('/api/suppliers').catch(() => [])
    ]);

    window._cmHierarchy = hierarchy;
    window._cmSuppliers = suppliers;
    window._cmExpanded  = window._cmExpanded || {};

    function supOpts(selId) {
      return `<option value="">-- بدون مورد --</option>` +
        suppliers.map(s => `<option value="${s.id}" ${s.id == selId ? 'selected' : ''}>${s.name}</option>`).join('');
    }

    function famOpts(selId) {
      return hierarchy.map(f =>
        `<option value="${f.id}" ${f.id == selId ? 'selected' : ''}>${f.family_name_ar}</option>`
      ).join('');
    }

    // ── Supplier code row (2-tier: directly under family) ───
    function scRow(sc) {
      const bobbinBadge = sc.raw_bobbin_qty > 0
        ? `<span style="background:#fef3c7;color:#d97706;font-size:.7rem;font-weight:700;padding:.1rem .4rem;border-radius:99px;font-family:'Cairo',sans-serif">📦 ${parseFloat(sc.raw_bobbin_qty).toLocaleString('ar-MA')} بكرة</span>`
        : '';
      const kgBadge = sc.other_qty > 0
        ? `<span style="background:#dcfce7;color:#166534;font-size:.7rem;font-weight:700;padding:.1rem .4rem;border-radius:99px;font-family:'Cairo',sans-serif">⚖️ ${parseFloat(sc.other_qty).toLocaleString('ar-MA')} كجم</span>`
        : '';
      return `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:.4rem .75rem;width:28px">
            <div style="width:22px;height:22px;border-radius:4px;border:1px solid #e2e8f0;
                        background:${sc.hex_code||'#e5e7eb'};display:inline-block"></div>
          </td>
          <td style="padding:.4rem .75rem;font-family:monospace;font-size:.8rem;font-weight:700;color:#1e293b">${sc.code}</td>
          <td style="padding:.4rem .75rem;font-size:.85rem;color:#374151;font-family:'Cairo',sans-serif">${sc.internal_ar_name}</td>
          <td style="padding:.4rem .75rem;font-size:.8rem;color:#64748b;font-family:'Cairo',sans-serif">${sc.supplier_name||'—'}</td>
          <td style="padding:.4rem .75rem;font-size:.8rem;color:#64748b;font-family:'Cairo',sans-serif">${sc.shade_note||'—'}</td>
          <td style="padding:.4rem .75rem;font-size:.8rem">
            <div style="display:flex;gap:.25rem;flex-wrap:wrap">${bobbinBadge}${kgBadge}${(!bobbinBadge&&!kgBadge)?'<span style="color:#94a3b8;font-size:.75rem">—</span>':''}</div>
          </td>
          <td style="padding:.4rem .75rem;text-align:center;white-space:nowrap">
            <button onclick="window._cmEditSC(${sc.id})"
              style="padding:.2rem .45rem;font-size:.72rem;border:1px solid #e2e8f0;background:#fff;border-radius:4px;cursor:pointer;color:#475569;font-family:'Cairo',sans-serif">تعديل</button>
            <button onclick="window._cmDelSC(${sc.id})"
              style="padding:.2rem .45rem;font-size:.72rem;border:1px solid #fecaca;background:#fff;border-radius:4px;cursor:pointer;color:#dc2626;font-family:'Cairo',sans-serif">حذف</button>
          </td>
        </tr>`;
    }

    // ── Family card (2-tier: family expands to supplier codes) ─
    function familyCard(f) {
      const expanded  = !!window._cmExpanded[f.id];
      const totalRaw  = f.supplier_codes.reduce((s, sc) => s + (sc.raw_bobbin_qty || 0), 0);
      const totalKg   = f.supplier_codes.reduce((s, sc) => s + (sc.other_qty || 0), 0);
      const swatch    = f.visual_color || null;
      return `
        <div id="fam-card-${f.id}"
             style="background:#fff;border-radius:10px;border:1px solid #e8ecf0;
                    box-shadow:0 1px 6px rgba(0,0,0,.05);overflow:hidden;margin-bottom:.65rem">
          <div onclick="window._cmToggleFam(${f.id})"
               style="display:flex;align-items:center;gap:.75rem;padding:.9rem 1rem;
                      cursor:pointer;background:${expanded?'#F8FAFC':'#fff'};transition:background .1s"
               onmouseover="this.style.background='#f1f5f9'"
               onmouseout="this.style.background='${expanded?'#F8FAFC':'#fff'}'">
            ${swatch
              ? `<div style="width:28px;height:28px;border-radius:6px;background:${swatch};border:1.5px solid #e2e8f0;flex-shrink:0"></div>`
              : `<span style="font-size:1.3rem;flex-shrink:0">🎨</span>`}
            <div style="flex:1">
              <div style="font-weight:700;font-size:.95rem;color:#0f172a;font-family:'Cairo',sans-serif">${f.family_name_ar}</div>
              <div style="display:flex;gap:.4rem;margin-top:.15rem;align-items:center;flex-wrap:wrap">
                <span style="background:#dbeafe;color:#1d4ed8;font-size:.7rem;font-weight:700;padding:.1rem .45rem;border-radius:99px;font-family:'Cairo',sans-serif">${f.supplier_codes.length} كود</span>
                ${totalRaw > 0 ? `<span style="background:#fef3c7;color:#d97706;font-size:.7rem;font-weight:700;padding:.1rem .45rem;border-radius:99px;font-family:'Cairo',sans-serif">📦 ${totalRaw.toLocaleString('ar-MA')} بكرة</span>` : ''}
                ${totalKg  > 0 ? `<span style="background:#dcfce7;color:#166534;font-size:.7rem;font-weight:700;padding:.1rem .45rem;border-radius:99px;font-family:'Cairo',sans-serif">⚖️ ${parseFloat(totalKg).toLocaleString('ar-MA')} كجم</span>` : ''}
              </div>
            </div>
            <div onclick="event.stopPropagation()" style="display:flex;gap:.35rem">
              <button onclick="window._cmEditFam(${f.id})"
                style="padding:.25rem .55rem;font-size:.75rem;border:1px solid #e2e8f0;background:#fff;border-radius:6px;cursor:pointer;color:#374151;font-family:'Cairo',sans-serif;font-weight:600">تعديل</button>
              <button onclick="window._cmDelFam(${f.id})"
                style="padding:.25rem .55rem;font-size:.75rem;border:1px solid #fecaca;background:#fff;border-radius:6px;cursor:pointer;color:#dc2626;font-family:'Cairo',sans-serif;font-weight:600">حذف</button>
              <button onclick="window._cmAddSC(${f.id})"
                style="padding:.25rem .55rem;font-size:.75rem;border:1px solid #bfdbfe;background:#eff6ff;border-radius:6px;cursor:pointer;color:#2563eb;font-family:'Cairo',sans-serif;font-weight:600">+ كود</button>
            </div>
            <span style="color:#94a3b8;font-size:.82rem;transform:${expanded?'rotate(180deg)':'rotate(0)'};transition:transform .2s;flex-shrink:0">▼</span>
          </div>
          ${expanded ? `<div style="border-top:1px solid #e8ecf0">
            ${f.supplier_codes.length === 0
              ? `<div style="padding:1rem 1.5rem;color:#94a3b8;font-size:.85rem;font-family:'Cairo',sans-serif">لا توجد أكواد — اضغط "+ كود" لإضافة أول كود لون.</div>`
              : `<table style="width:100%;border-collapse:collapse;font-size:.82rem;direction:rtl">
                  <thead><tr style="background:#f8fafc">
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:center;width:28px">لون</th>
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:right">الكود</th>
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:right">الاسم</th>
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:right">المورد</th>
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:right">الدرجة</th>
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:right">المخزون</th>
                    <th style="padding:.35rem .75rem;color:#64748b;font-weight:600;font-family:'Cairo',sans-serif;text-align:center">إجراءات</th>
                  </tr></thead>
                  <tbody>${f.supplier_codes.map(scRow).join('')}</tbody>
                </table>`}
          </div>` : ''}
        </div>`;
    }

    function renderAll() {
      const totalSCs = hierarchy.reduce((s, f) => s + f.supplier_codes.length, 0);
      c.innerHTML = `
        <div style="background:#F8FAFC;min-height:100%;padding:1.5rem;font-family:'Cairo',sans-serif;direction:rtl">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.5rem">
            <div>
              <h2 style="margin:0;font-size:1.125rem;font-weight:700;color:#0f172a;font-family:'Cairo',sans-serif">🎨 إدارة الألوان</h2>
              <p style="margin:.25rem 0 0;font-size:.84rem;color:#64748b;font-family:'Cairo',sans-serif">
                ${hierarchy.length} عائلة &nbsp;·&nbsp; ${totalSCs} كود مورد
              </p>
            </div>
            <button onclick="window._cmAddFam()"
              style="padding:.5rem 1.1rem;background:#2563eb;color:#fff;border:none;border-radius:9px;cursor:pointer;
                     font-size:.875rem;font-weight:700;font-family:'Cairo',sans-serif;box-shadow:0 2px 6px rgba(37,99,235,.35)">
              + عائلة جديدة
            </button>
          </div>
          <div>
            ${hierarchy.length === 0
              ? `<div style="text-align:center;padding:4rem;color:#94a3b8;font-family:'Cairo',sans-serif">
                   <div style="font-size:3rem;margin-bottom:.75rem;opacity:.4">🎨</div>
                   لا توجد عائلات ألوان — ابدأ بإضافة عائلة.
                 </div>`
              : hierarchy.map(familyCard).join('')}
          </div>
        </div>`;
    }

    // ── Toggle family ────────────────────────────────────────
    window._cmToggleFam = (id) => {
      window._cmExpanded[id] = !window._cmExpanded[id];
      const card = document.getElementById('fam-card-' + id);
      if (card) {
        const f = window._cmHierarchy.find(x => x.id === id);
        if (f) { const t = document.createElement('div'); t.innerHTML = familyCard(f); card.replaceWith(t.firstElementChild); }
      }
    };

    // ── Add family ────────────────────────────────────────────
    window._cmAddFam = () => {
      modal('إضافة عائلة جديدة', `
        <div class="form-group"><label>اسم العائلة <span style="color:red">*</span></label><input id="af-name" class="form-control" placeholder="مثال: أحمر / وردي" /></div>
        <div class="form-group"><label>اللون البصري</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="af-color" type="color" value="#e2e8f0" style="width:56px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px" />
            <small style="color:#6b7280">اختر لوناً تعريفياً للعائلة</small>
          </div>
        </div>
        <div class="form-group"><label>الترتيب</label><input id="af-order" class="form-control" type="number" value="0" /></div>
        <button class="btn btn-primary" onclick="window._cmDoAddFam()">حفظ</button>`);
      window._cmDoAddFam = async () => {
        const name = document.getElementById('af-name').value.trim();
        if (!name) return toast('أدخل اسم العائلة', 'error');
        try {
          await api('/api/color-families', {method:'POST', body: JSON.stringify({
            family_name_ar: name,
            display_order: parseInt(document.getElementById('af-order').value) || 0,
            visual_color: document.getElementById('af-color').value
          })});
          toast('تمت الإضافة');
          document.getElementById('modal-container').innerHTML = '';
          window._cmExpanded = {};
          loadColorManagement(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Edit family ───────────────────────────────────────────
    window._cmEditFam = (id) => {
      const f = window._cmHierarchy.find(x => x.id === id);
      if (!f) return;
      modal('تعديل عائلة', `
        <div class="form-group"><label>الاسم</label><input id="ef-name" class="form-control" value="${f.family_name_ar}" /></div>
        <div class="form-group"><label>اللون البصري</label>
          <input id="ef-color" type="color" value="${f.visual_color||'#e2e8f0'}" style="width:56px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px" />
        </div>
        <div class="form-group"><label>الترتيب</label><input id="ef-order" class="form-control" type="number" value="${f.display_order}" /></div>
        <div class="form-group"><label>نشطة</label><select id="ef-active" class="form-control"><option value="1" ${f.active?'selected':''}>نعم</option><option value="0" ${!f.active?'selected':''}>لا</option></select></div>
        <button class="btn btn-primary" onclick="window._cmDoEditFam(${id})">حفظ</button>`);
      window._cmDoEditFam = async (fid) => {
        try {
          await api('/api/color-families/' + fid, {method:'PUT', body: JSON.stringify({
            family_name_ar: document.getElementById('ef-name').value.trim(),
            display_order:  parseInt(document.getElementById('ef-order').value) || 0,
            active:         parseInt(document.getElementById('ef-active').value),
            visual_color:   document.getElementById('ef-color').value
          })});
          toast('تم التحديث');
          document.getElementById('modal-container').innerHTML = '';
          window._cmExpanded = {};
          loadColorManagement(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Delete family ─────────────────────────────────────────
    window._cmDelFam = async (id) => {
      if (!confirm('حذف هذه العائلة؟')) return;
      try {
        await api('/api/color-families/' + id, {method:'DELETE'});
        toast('تم الحذف');
        window._cmExpanded = {};
        loadColorManagement(c);
      } catch(e) { toast(e.message, 'error'); }
    };

    // ── Add supplier code (directly under family) ─────────────
    window._cmAddSC = (famId) => {
      modal('إضافة كود لون', `
        <div class="form-group"><label>المورد</label><select id="sc-sup" class="form-control">${supOpts()}</select></div>
        <div class="form-group"><label>كود المورد <span style="color:red">*</span></label><input id="sc-code" class="form-control" placeholder="مثال: BM-101" /></div>
        <div class="form-group"><label>الاسم العربي <span style="color:red">*</span></label><input id="sc-name" class="form-control" placeholder="مثال: أبيض ثلجي" /></div>
        <div class="form-group"><label>ملاحظة الدرجة</label><input id="sc-shade" class="form-control" /></div>
        <div class="form-group"><label>لون HEX</label>
          <input id="sc-hex" type="color" value="#ffffff" style="width:56px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px" />
        </div>
        <button class="btn btn-primary" onclick="window._cmDoAddSC(${famId})">حفظ</button>`);
      window._cmDoAddSC = async (fid) => {
        const code = document.getElementById('sc-code').value.trim();
        const name = document.getElementById('sc-name').value.trim();
        if (!code || !name) return toast('كود ونوع اللون مطلوبان', 'error');
        try {
          await api('/api/color-master', {method:'POST', body: JSON.stringify({
            supplier_id:         document.getElementById('sc-sup').value || null,
            supplier_color_code: code,
            internal_ar_name:    name,
            shade_note:          document.getElementById('sc-shade').value.trim() || null,
            hex_code:            document.getElementById('sc-hex').value,
            family_id:           fid
          })});
          toast('تمت الإضافة');
          document.getElementById('modal-container').innerHTML = '';
          window._cmExpanded[fid] = true;
          loadColorManagement(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Edit supplier code ────────────────────────────────────
    window._cmEditSC = (id) => {
      let sc = null;
      for (const f of window._cmHierarchy) {
        sc = f.supplier_codes.find(x => x.id === id);
        if (sc) break;
      }
      if (!sc) return toast('لم يُعثر على الكود', 'error');
      modal('تعديل كود لون', `
        <div class="form-group"><label>المورد</label><select id="es-sup" class="form-control">${supOpts(sc.supplier_id)}</select></div>
        <div class="form-group"><label>كود المورد</label><input id="es-code" class="form-control" value="${sc.code}" /></div>
        <div class="form-group"><label>الاسم العربي</label><input id="es-name" class="form-control" value="${sc.internal_ar_name}" /></div>
        <div class="form-group"><label>ملاحظة الدرجة</label><input id="es-shade" class="form-control" value="${sc.shade_note||''}" /></div>
        <div class="form-group"><label>لون HEX</label>
          <input id="es-hex" type="color" value="${sc.hex_code||'#ffffff'}" style="width:56px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px" />
        </div>
        <div class="form-group"><label>العائلة</label><select id="es-fam" class="form-control">${famOpts(sc.family_id)}</select></div>
        <div class="form-group"><label>نشط</label><select id="es-active" class="form-control"><option value="1" ${sc.active?'selected':''}>نعم</option><option value="0" ${!sc.active?'selected':''}>لا</option></select></div>
        <button class="btn btn-primary" onclick="window._cmDoEditSC(${id})">حفظ</button>`);
      window._cmDoEditSC = async (sid) => {
        try {
          await api('/api/color-master/' + sid, {method:'PUT', body: JSON.stringify({
            supplier_id:         document.getElementById('es-sup').value || null,
            supplier_color_code: document.getElementById('es-code').value.trim(),
            internal_ar_name:    document.getElementById('es-name').value.trim(),
            shade_note:          document.getElementById('es-shade').value.trim() || null,
            hex_code:            document.getElementById('es-hex').value,
            family_id:           parseInt(document.getElementById('es-fam').value),
            active:              parseInt(document.getElementById('es-active').value)
          })});
          toast('تم التحديث');
          document.getElementById('modal-container').innerHTML = '';
          window._cmExpanded = {};
          loadColorManagement(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Delete supplier code ──────────────────────────────────
    window._cmDelSC = async (id) => {
      if (!confirm('حذف هذا الكود؟')) return;
      try {
        await api('/api/color-master/' + id, {method:'DELETE'});
        toast('تم الحذف');
        window._cmExpanded = {};
        loadColorManagement(c);
      } catch(e) { toast(e.message, 'error'); }
    };

    renderAll();
  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger" style="margin:1rem">${e.message}</div>`;
  }
}

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
        <td>
          <button class="btn btn-sm" onclick="editColorCode(${i.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="delColorCode(${i.id})">🗑️</button>
        </td>
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
    toast('تمت الإضافة'); nav('color-management');
  });
};

window.editColorCode = async (id) => {
  const items = await api('/api/color-codes');
  const item = items.find(i => i.id === id);
  if (!item) return toast('العنصر غير موجود', 'danger');
  modal('تعديل كود لون', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الكود</label><input name="code" value="${item.code}" required></div>
      <div class="form-group"><label class="required">اللون</label><input name="main_color" value="${item.main_color}" required></div>
      <div class="form-group"><label>الدرجة</label><input name="shade" value="${item.shade||''}"></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/color-codes/${id}`, {method: 'PUT', body: JSON.stringify({
      code: fd.get('code'), main_color: fd.get('main_color'), shade: fd.get('shade'), user: USER
    })});
    toast('تم التعديل'); nav('color-management');
  });
};

window.delColorCode = async (id) => {
  if (!confirm('حذف؟')) return;
  try { await api(`/api/color-codes/${id}`, {method:'DELETE', body: JSON.stringify({user:USER})}); toast('تم الحذف'); nav('color-management'); }
  catch(e) { toast(e.message, 'danger'); }
};

// Warehouses
async function loadWarehouses(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [items, branches] = await Promise.all([api('/api/warehouses'), api('/api/branches')]);
    const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));
    const stageLabels = {'raw_bobbin':'بكرات خام','wholesale_kg':'جملة كجم','retail_kg':'تجزئة كجم','retail_oz':'تجزئة أونصة','supplies':'لوازم'};
    c.innerHTML = `
      <div class="page-header"><h2>🏬 المخازن</h2>
      <button class="btn" onclick="addWarehouse()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>الفرع</th><th>المرحلة</th><th>الموقع</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => `<tr>
        <td>${i.code}</td><td>${i.name}</td>
        <td>${branchMap[i.branch_id] || '-'}</td>
        <td><span class="badge badge-info">${stageLabels[i.inventory_stage] || '-'}</span></td>
        <td>${i.location||'-'}</td>
        <td>
          <button class="btn btn-sm" onclick="editWarehouse(${i.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="delWarehouse(${i.id})">🗑️</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.addWarehouse = async () => {
  const branches = await api('/api/branches');
  const stageOptions = [
    {value:'raw_bobbin',label:'بكرات خام'},
    {value:'wholesale_kg',label:'جملة كجم'},
    {value:'retail_kg',label:'تجزئة كجم'},
    {value:'retail_oz',label:'تجزئة أونصة'},
    {value:'supplies',label:'لوازم'}
  ];
  modal('إضافة مخزن', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required></div>
      <div class="form-group"><label>الموقع</label><input name="location"></div>
      <div class="form-group"><label>الفرع</label><select name="branch_id">
        <option value="">-- اختر الفرع --</option>
        ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>مرحلة المخزون</label><select name="inventory_stage">
        <option value="">-- اختر المرحلة --</option>
        ${stageOptions.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}</select></div>
    </div>
    <div class="alert alert-info">💡 الكود سيتم توليده تلقائياً</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), location: fd.get('location'), active: 1, user: USER };
    if (fd.get('branch_id')) data.branch_id = parseInt(fd.get('branch_id'));
    if (fd.get('inventory_stage')) data.inventory_stage = fd.get('inventory_stage');
    await api('/api/warehouses', {method: 'POST', body: JSON.stringify(data)});
    toast('تمت الإضافة'); nav('warehouses');
  });
};

window.editWarehouse = async (id) => {
  const [items, branches] = await Promise.all([api('/api/warehouses'), api('/api/branches')]);
  const item = items.find(i => i.id === id);
  if (!item) return toast('العنصر غير موجود', 'danger');
  const stageOptions = [
    {value:'raw_bobbin',label:'بكرات خام'},
    {value:'wholesale_kg',label:'جملة كجم'},
    {value:'retail_kg',label:'تجزئة كجم'},
    {value:'retail_oz',label:'تجزئة أونصة'},
    {value:'supplies',label:'لوازم'}
  ];
  modal('تعديل مخزن', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label>الموقع</label><input name="location" value="${item.location||''}"></div>
      <div class="form-group"><label>الفرع</label><select name="branch_id">
        <option value="">-- اختر الفرع --</option>
        ${branches.map(b => `<option value="${b.id}" ${item.branch_id==b.id?'selected':''}>${b.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>مرحلة المخزون</label><select name="inventory_stage">
        <option value="">-- اختر المرحلة --</option>
        ${stageOptions.map(s => `<option value="${s.value}" ${item.inventory_stage===s.value?'selected':''}>${s.label}</option>`).join('')}</select></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), location: fd.get('location'), user: USER };
    if (fd.get('branch_id')) data.branch_id = parseInt(fd.get('branch_id'));
    if (fd.get('inventory_stage')) data.inventory_stage = fd.get('inventory_stage');
    await api(`/api/warehouses/${id}`, {method: 'PUT', body: JSON.stringify(data)});
    toast('تم التعديل'); nav('warehouses');
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
        <td>
          <button class="btn btn-sm" onclick="editProductType(${i.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="delProductType(${i.id})">🗑️</button>
        </td>
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

window.editProductType = async (id) => {
  const items = await api('/api/product-types');
  const item = items.find(i => i.id === id);
  if (!item) return toast('العنصر غير موجود', 'danger');
  modal('تعديل نوع منتج', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label>الفئة</label><select name="category">
        <option value="مواد_خام" ${item.category==='مواد_خام'?'selected':''}>مواد خام</option>
        <option value="منتجات_نهائية" ${item.category==='منتجات_نهائية'?'selected':''}>منتجات نهائية</option>
      </select></div>
      <div class="form-group"><label class="required">الوحدة</label><input name="unit" value="${item.unit}" required></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/product-types/${id}`, {method: 'PUT', body: JSON.stringify({
      name: fd.get('name'), category: fd.get('category'), unit: fd.get('unit'), user: USER
    })});
    toast('تم التعديل'); nav('product-types');
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
const _STAGE_LABELS = {'raw_bobbin':'بكرات خام','wholesale_kg':'جملة كجم','retail_kg':'تجزئة كجم','retail_oz':'تجزئة أونصة','supplies':'لوازم'};
const _STAGE_COLORS = {'raw_bobbin':'warning','wholesale_kg':'primary','retail_kg':'info','retail_oz':'success','supplies':'secondary'};
let _inventoryStageFilter = '';

async function loadInventory(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const url = _inventoryStageFilter ? `/api/inventory?stage=${_inventoryStageFilter}` : '/api/inventory';
    const items = await api(url);
    c.innerHTML = `
      <div class="page-header"><h2>📦 المخزون</h2>
      <button class="btn" onclick="addInventory()">➕ إضافة</button></div>
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
        <label style="font-weight:600">تصفية حسب المرحلة:</label>
        <select id="stageFilter" onchange="window._filterInventoryStage(this.value)" style="padding:6px 12px;border-radius:6px;border:1px solid #ddd">
          <option value="">الكل</option>
          ${Object.entries(_STAGE_LABELS).map(([k,v]) => `<option value="${k}" ${_inventoryStageFilter===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="table-container"><table><thead><tr>
        <th>المخزن</th><th>المرحلة</th><th>المنتج</th><th>لون المورد</th><th>الكمية</th><th>التكلفة</th><th>السعر</th><th>القيمة</th><th>إجراءات</th>
      </tr></thead><tbody>${items.map(i => {
        const stageBadge = _STAGE_LABELS[i.inventory_stage] || i.inventory_stage || '-';
        const stageColor = _STAGE_COLORS[i.inventory_stage] || 'secondary';
        const convertBtn = i.inventory_stage === 'retail_kg' && i.quantity > 0
          ? `<button class="btn btn-sm" onclick="window._convertToOz(${i.id}, ${i.quantity})" title="تحويل إلى أونصة">⚖️</button>` : '';
        return `<tr>
        <td>${i.warehouse_name}</td>
        <td><span class="badge badge-${stageColor}">${stageBadge}</span></td>
        <td>${i.product_name}</td>
        <td><span class="badge badge-${i.color_description ? 'primary' : 'secondary'}">${i.color_description || '-'}</span></td>
        <td class="font-bold">${i.quantity} ${i.unit}</td>
        <td>${fmt(i.unit_cost)}</td><td>${fmt(i.unit_price)}</td>
        <td class="text-success font-bold">${fmt(i.quantity * i.unit_cost)}</td>
        <td>${convertBtn}</td>
      </tr>`;}).join('')}</tbody></table></div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window._filterInventoryStage = (val) => {
  _inventoryStageFilter = val;
  nav('inventory');
};

window._convertToOz = (inventoryId, maxKg) => {
  modal('تحويل كجم → أونصة', `<form>
    <div class="alert alert-info">1 كجم = 32 أونصة (نسبة تجارية ثابتة)</div>
    <div class="form-grid">
      <div class="form-group"><label class="required">الكمية (كجم)</label>
        <input type="number" name="kg" step="0.01" min="0.01" max="${maxKg}" value="${maxKg}" required>
      </div>
      <div class="form-group"><label>الناتج (أونصة)</label>
        <input type="number" name="oz" value="${maxKg * 32}" readonly style="background:#f0f0f0">
      </div>
    </div>
    <button type="submit" class="btn btn-success">⚖️ تحويل</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const kg = parseFloat(fd.get('kg'));
    await api('/api/inventory/convert', {method:'POST', body: JSON.stringify({
      source_inventory_id: inventoryId, kg_quantity: kg, user: USER
    })});
    toast(`تم تحويل ${kg} كجم → ${kg * 32} أونصة`);
    nav('inventory');
  });
  // Live update oz field
  setTimeout(() => {
    const kgInput = document.querySelector('input[name="kg"]');
    const ozInput = document.querySelector('input[name="oz"]');
    if (kgInput && ozInput) kgInput.addEventListener('input', () => { ozInput.value = (parseFloat(kgInput.value)||0) * 32; });
  }, 100);
};

window.addInventory = async () => {
  const [wh, pt, cc, cf] = await Promise.all([
    api('/api/warehouses'), api('/api/product-types'),
    api('/api/color-codes'), api('/api/color-families')
  ]);
  const activeWh = wh.filter(w => !w.archived);
  modal('إضافة عنصر مخزون', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">المخزن</label><select name="warehouse_id" required>
        ${activeWh.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}</select></div>
      <div class="form-group"><label class="required">المنتج</label><select name="product_type_id" required>
        ${pt.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
    </div>

    <h4 style="margin: 15px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">🎨 كود اللون (اختياري)</h4>
    <div class="form-group">
      <select name="color_option" id="colorOptionSelect" onchange="toggleColorOptions()">
        <option value="none">❌ بدون لون</option>
        <option value="existing">📋 اختيار من الموجود</option>
        <option value="new">➕ إنشاء كود جديد في النظام</option>
      </select>
    </div>

    <div id="existingColorFields" class="hidden">
      <div class="form-group"><label>اختر كود اللون</label><select name="color_code_id">
        <option value="">اختر...</option>
        ${cc.map(c => `<option value="${c.id}">${c.code} — ${c.shade||c.main_color}${c.family_name_ar ? ' ('+c.family_name_ar+')' : ''}</option>`).join('')}</select></div>
    </div>

    <div id="newColorFields" class="hidden">
      <div class="alert alert-success" style="margin-bottom:10px">💡 سيتم تسجيل الكود في نظام إدارة الألوان وربطه تلقائياً بالمخزون</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="required">كود المورد <small style="color:#6b7280">(مثال: MF5210)</small></label>
          <input name="new_supplier_color_code" placeholder="MF5210" required />
        </div>
        <div class="form-group">
          <label class="required">عائلة اللون</label>
          <select name="new_family_id" required>
            <option value="">اختر عائلة...</option>
            ${cf.map(f => `<option value="${f.id}">${f.family_name_ar}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="required">الاسم الداخلي / الظل <small style="color:#6b7280">(بالعربية)</small></label>
          <input name="new_internal_ar_name" placeholder="مثال: أزرق غامق" required />
        </div>
        <div class="form-group">
          <label>لون العينة <small style="color:#6b7280">(اختياري)</small></label>
          <input type="color" name="new_hex_code" value="#808080" style="height:2.3rem;padding:.2rem .4rem" />
        </div>
      </div>
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
    } else if (colorOption === 'new') {
      const scCode = (fd.get('new_supplier_color_code') || '').trim();
      const familyId = fd.get('new_family_id');
      const nameAr = (fd.get('new_internal_ar_name') || '').trim();
      const hexCode = fd.get('new_hex_code');
      if (!scCode || !familyId || !nameAr) {
        toast('يرجى تعبئة جميع حقول اللون المطلوبة','error');
        return;
      }
      // Create the color in the system (color_master + color_codes + colors)
      const cmResp = await api('/api/color-master', {
        method: 'POST',
        body: JSON.stringify({ supplier_color_code: scCode, family_id: parseInt(familyId), internal_ar_name: nameAr, hex_code: hexCode })
      });
      data.color_code_id = cmResp.color_code_id;
    }

    await api('/api/inventory', {method: 'POST', body: JSON.stringify(data)});
    toast('تمت الإضافة'); nav('inventory');
  });
};

window.toggleColorOptions = () => {
  const option = document.getElementById('colorOptionSelect').value;
  document.getElementById('existingColorFields').classList.add('hidden');
  document.getElementById('newColorFields').classList.add('hidden');

  if (option === 'existing') document.getElementById('existingColorFields').classList.remove('hidden');
  else if (option === 'new') document.getElementById('newColorFields').classList.remove('hidden');
};

// ============================================================
// INVENTORY REPORTS
// Documented in docs/ERP_SCREEN_MAP.md (Inventory Reports screen)
// Stage breakdown, low stock alerts, recent movements
// ============================================================
async function loadInventoryReports(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('/api/reports/inventory-summary');
    const { stage_totals, low_stock, recent_movements } = data;

    const STAGE_LABELS = {
      raw_bobbin: 'بكرات خام', wholesale_kg: 'جملة (كجم)',
      retail_kg: 'تجزئة (كجم)', retail_oz: 'تجزئة (أونصة)', supplies: 'لوازم'
    };
    const STAGE_ICONS = {
      raw_bobbin: '🧵', wholesale_kg: '🏭', retail_kg: '🛒', retail_oz: '⚖️', supplies: '🧰'
    };
    const MVT_LABEL = { in: 'وارد', out: 'صادر' };
    const REF_LABELS = {
      purchase: 'مشتريات', sale: 'مبيعات', conversion: 'تحويل',
      adjustment: 'تسوية', production: 'إنتاج'
    };

    c.innerHTML = `
      <div class="page-header">
        <h2>📦 تقارير المخزون</h2>
        <button class="btn" onclick="nav('inventory')">← المخزون</button>
      </div>

      <h3 style="font-family:'Cairo',sans-serif;margin-bottom:12px">📊 المخزون حسب المرحلة</h3>
      <div class="stats-grid" style="margin-bottom:20px">
        ${stage_totals.map(s => `
          <div class="stat-card">
            <h3>${STAGE_ICONS[s.inventory_stage]||'📦'} ${STAGE_LABELS[s.inventory_stage]||s.inventory_stage}</h3>
            <div class="value">${parseFloat(s.total_qty||0).toLocaleString('ar-MA',{maximumFractionDigits:1})}</div>
            <div class="subtext">${s.item_count} صنف · قيمة: ${fmt(s.total_value)}</div>
          </div>`).join('')}
      </div>

      <!-- Low Stock Alerts -->
      <div class="card" style="margin-bottom:20px">
        <h3>⚠️ تنبيهات المخزون المنخفض <span class="badge badge-danger">${low_stock.length}</span></h3>
        ${low_stock.length === 0
          ? '<div class="alert alert-success">✅ لا توجد أصناف بمخزون منخفض</div>'
          : `<div class="table-container"><table>
              <thead><tr><th>اللون</th><th>المنتج</th><th>المستودع</th><th>المرحلة</th><th>الكمية</th></tr></thead>
              <tbody>${low_stock.map(i => `<tr>
                <td><span class="badge badge-primary">${i.color_code||'—'}</span> ${i.color_name}</td>
                <td>${i.product_name||'—'}</td>
                <td>${i.warehouse_name||'—'}</td>
                <td><span class="badge badge-info">${STAGE_LABELS[i.inventory_stage]||i.inventory_stage}</span></td>
                <td class="text-danger font-bold">${i.quantity}</td>
              </tr>`).join('')}</tbody>
            </table></div>`
        }
      </div>

      <!-- Recent Movements -->
      <div class="card">
        <h3>📋 آخر الحركات (30 حركة)</h3>
        ${recent_movements.length === 0
          ? '<div class="alert alert-warning">لا توجد حركات مخزون مسجلة.</div>'
          : `<div class="table-container"><table>
              <thead><tr><th>التاريخ</th><th>النوع</th><th>الصنف</th><th>المستودع</th><th>المرجع</th><th>الكمية</th></tr></thead>
              <tbody>${recent_movements.map(m => `<tr>
                <td>${fmtDate(m.movement_date)}</td>
                <td><span class="badge ${m.movement_type==='in'?'badge-success':'badge-danger'}">${MVT_LABEL[m.movement_type]||m.movement_type}</span></td>
                <td>${m.item_name}</td>
                <td style="color:#6b7280;font-size:.85rem">${m.warehouse_name||'—'}</td>
                <td><span class="badge badge-warning">${REF_LABELS[m.reference_type]||m.reference_type||'—'}</span></td>
                <td class="font-bold ${m.movement_type==='in'?'text-success':'text-danger'}">${m.movement_type==='in'?'+':'−'}${m.quantity}</td>
              </tr>`).join('')}</tbody>
            </table></div>`
        }
      </div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// ARTISAN MANAGEMENT (v13)
// Full CRUD with branch assignment, active/inactive filter,
// and artisan production rates for v9 sessions.
// Follows the same structure as clients and suppliers modules.
// ============================================================

async function loadArtisans(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [artisans, branches] = await Promise.all([
      api('/api/artisans'),
      api('/api/branches').catch(() => [])
    ]);

    // Track active filter via page-level state
    const filter = window._artisanFilter || 'active';

    const filtered = artisans.filter(a =>
      filter === 'all'      ? true :
      filter === 'active'   ? a.active === 1 :
      filter === 'inactive' ? a.active === 0 : true
    );

    const activeCount   = artisans.filter(a => a.active === 1).length;
    const inactiveCount = artisans.filter(a => a.active === 0).length;

    const CRAFT_LABELS = {
      'تعبئة':'تعبئة','سفيفة':'سفيفة','طراسن':'طراسن',
      'تطريز':'تطريز','خياطة':'خياطة','أخرى':'أخرى'
    };

    c.innerHTML = `
      <div class="page-header">
        <h2>👨‍🔧 الحرفيون</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn" onclick="addArtisan()">➕ إضافة حرفي</button>
          <button class="btn btn-secondary" onclick="nav('mfg-artisan-rates')">💰 أسعار الإنتاج</button>
        </div>
      </div>

      <!-- Filter tabs -->
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn ${filter==='active'?'btn-primary':''}" onclick="window._artisanFilter='active';loadArtisans(document.getElementById('main-content'))">
          🟢 نشط (${activeCount})
        </button>
        <button class="btn ${filter==='inactive'?'btn-primary':''}" onclick="window._artisanFilter='inactive';loadArtisans(document.getElementById('main-content'))">
          🔴 غير نشط (${inactiveCount})
        </button>
        <button class="btn ${filter==='all'?'btn-primary':''}" onclick="window._artisanFilter='all';loadArtisans(document.getElementById('main-content'))">
          📋 الكل (${artisans.length})
        </button>
      </div>

      ${filtered.length === 0
        ? `<div class="alert alert-warning">لا يوجد حرفيون ${filter === 'active' ? 'نشطون' : filter === 'inactive' ? 'غير نشطين' : ''}.</div>`
        : `<div class="table-container"><table>
            <thead><tr>
              <th>الكود</th><th>الاسم</th><th>نوع الصنعة</th><th>الهاتف</th>
              <th>الفرع</th><th>سعر التركيبة</th><th>الحالة</th><th>إجراءات</th>
            </tr></thead>
            <tbody>${filtered.map(a => `<tr>
              <td style="color:#6b7280;font-size:.85rem">${a.code}</td>
              <td class="font-bold">${a.name}${a.address ? `<br><small style="color:#6b7280;font-weight:normal">${a.address}</small>` : ''}</td>
              <td>${a.craft_type ? `<span class="badge badge-warning">${a.craft_type}</span>` : '—'}</td>
              <td>${a.phone || '—'}</td>
              <td>${a.branch_name ? `<span class="badge badge-info">${a.branch_name}</span>` : '—'}</td>
              <td class="font-bold">${a.rate_per_combination != null ? fmt(a.rate_per_combination) + '/تركيبة' : '—'}</td>
              <td><span class="badge ${a.active ? 'badge-success' : 'badge-danger'}">${a.active ? 'نشط' : 'غير نشط'}</span></td>
              <td>
                <button class="btn btn-sm" onclick="toggleArtisanActive(${a.id}, ${a.active})" title="${a.active ? 'تعطيل' : 'تفعيل'}">${a.active ? '🔴' : '🟢'}</button>
                <button class="btn btn-sm" onclick="editArtisan(${a.id})" title="تعديل">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="delArtisan(${a.id})" title="حذف">🗑️</button>
              </td>
            </tr>`).join('')}
            </tbody>
          </table></div>`
      }`;

    // Store branches for add/edit modals
    window._artisanBranches = branches;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Craft type options helper
function _craftTypeOptions(selected) {
  const types = ['تعبئة','سفيفة','طراسن','تطريز','خياطة','أخرى'];
  return `<option value="">— اختر نوع الصنعة —</option>` +
    types.map(t => `<option value="${t}" ${selected===t?'selected':''}>${t}</option>`).join('');
}

// Branch options helper
function _branchOptions(selected, branches) {
  return `<option value="">— بدون فرع —</option>` +
    (branches||[]).map(b => `<option value="${b.id}" ${b.id==selected?'selected':''}>${b.name}</option>`).join('');
}

window.addArtisan = async () => {
  const branches = window._artisanBranches || await api('/api/branches').catch(()=>[]);
  modal('إضافة حرفي', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" required placeholder="اسم الحرفي"></div>
      <div class="form-group"><label>الهاتف</label><input name="phone" placeholder="06xxxxxxxx"></div>
      <div class="form-group"><label>العنوان</label><input name="address" placeholder="العنوان الكامل"></div>
      <div class="form-group"><label>نوع الصنعة</label>
        <select name="craft_type">${_craftTypeOptions('')}</select>
      </div>
      <div class="form-group"><label>الفرع</label>
        <select name="branch_id">${_branchOptions('', branches)}</select>
      </div>
      <div class="form-group"><label>سعر التركيبة (درهم)</label>
        <input type="number" name="rate_per_combination" step="0.01" placeholder="0.00">
      </div>
      <div class="form-group"><label>مصروف يومي (اختياري)</label>
        <input type="number" name="daily_expense" step="0.01" placeholder="0.00">
      </div>
    </div>
    <div class="alert alert-info">💡 الكود يُولَّد تلقائياً (ART7000+)</div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const rate = fd.get('rate_per_combination');
    const data = {
      name:          fd.get('name'),
      phone:         fd.get('phone') || null,
      address:       fd.get('address') || null,
      craft_type:    fd.get('craft_type') || null,
      branch_id:     fd.get('branch_id') || null,
      daily_expense: fd.get('daily_expense') ? parseFloat(fd.get('daily_expense')) : null,
      user: USER
    };
    const result = await api('/api/artisans', {method:'POST', body: JSON.stringify(data)});
    // Save production rate if provided
    if (rate && parseFloat(rate) > 0) {
      await api('/api/artisan-rates', {method:'POST', body: JSON.stringify({
        artisan_id: result.id, rate_per_combination: parseFloat(rate), user: USER
      })}).catch(()=>{});
    }
    toast('تمت الإضافة'); nav('artisans');
  });
};

window.editArtisan = async (id) => {
  const [artisans, branches] = await Promise.all([
    api('/api/artisans'),
    api('/api/branches').catch(()=>[])
  ]);
  const item = artisans.find(a => a.id === id);
  if (!item) return toast('الحرفي غير موجود', 'danger');

  modal('تعديل حرفي', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone" value="${item.phone||''}"></div>
      <div class="form-group"><label>العنوان</label><input name="address" value="${item.address||''}"></div>
      <div class="form-group"><label>نوع الصنعة</label>
        <select name="craft_type">${_craftTypeOptions(item.craft_type)}</select>
      </div>
      <div class="form-group"><label>الفرع</label>
        <select name="branch_id">${_branchOptions(item.branch_id, branches)}</select>
      </div>
      <div class="form-group"><label>سعر التركيبة (درهم)</label>
        <input type="number" name="rate_per_combination" step="0.01"
          value="${item.rate_per_combination != null ? item.rate_per_combination : ''}" placeholder="0.00">
      </div>
      <div class="form-group"><label>مصروف يومي</label>
        <input type="number" name="daily_expense" step="0.01" value="${item.daily_expense||''}">
      </div>
      <div class="form-group"><label>مصروف أسبوعي</label>
        <input type="number" name="weekly_expense" step="0.01" value="${item.weekly_expense||''}">
      </div>
      <div class="form-group"><label>الحالة</label>
        <select name="active">
          <option value="1" ${item.active?'selected':''}>🟢 نشط</option>
          <option value="0" ${!item.active?'selected':''}>🔴 غير نشط</option>
        </select>
      </div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ التعديلات</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    const rate = fd.get('rate_per_combination');
    await api(`/api/artisans/${id}`, {method:'PUT', body: JSON.stringify({
      name:           fd.get('name'),
      phone:          fd.get('phone')    || null,
      address:        fd.get('address')  || null,
      craft_type:     fd.get('craft_type') || null,
      branch_id:      fd.get('branch_id') || null,
      daily_expense:  fd.get('daily_expense')  ? parseFloat(fd.get('daily_expense'))  : null,
      weekly_expense: fd.get('weekly_expense') ? parseFloat(fd.get('weekly_expense')) : null,
      active:         parseInt(fd.get('active')),
      user: USER
    })});
    // Update production rate
    if (rate !== null && rate !== '') {
      await api(`/api/artisan-rates/${id}`, {method:'PUT', body: JSON.stringify({
        rate_per_combination: parseFloat(rate), user: USER
      })}).catch(()=>{});
    }
    toast('تم التعديل'); nav('artisans');
  });
};

window.toggleArtisanActive = async (id, currentActive) => {
  const label = currentActive ? 'تعطيل هذا الحرفي؟' : 'تفعيل هذا الحرفي؟';
  if (!confirm(label)) return;
  try {
    await api(`/api/artisans/${id}/toggle-active`, {method:'PATCH', body: JSON.stringify({user: USER})});
    toast(currentActive ? 'تم التعطيل' : 'تم التفعيل');
    nav('artisans');
  } catch(e) { toast(e.message, 'danger'); }
};

window.delArtisan = async (id) => {
  if (!confirm('هل تريد حذف هذا الحرفي؟ (سيتم تعطيله وليس حذفاً دائماً)')) return;
  try {
    await api(`/api/artisans/${id}`, {method:'DELETE', body: JSON.stringify({user: USER})});
    toast('تم الحذف'); nav('artisans');
  } catch(e) { toast(e.message, 'danger'); }
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
  // Determine POS stage from branch context (default: wholesale_kg)
  const posStage = window._posStage || 'wholesale_kg';
  const stageParam = `?stage=${posStage}`;
  const posUnitLabel = posStage === 'retail_oz' ? 'أونصة' : 'كجم';

  const [invData, clients] = await Promise.all([api('/api/inventory/by-category' + stageParam), api('/api/clients')]);
  const { inventory, categories } = invData;

  // Store data globally — preserve cart across POS reloads
  window.posInventory = inventory;
  window.posClients = clients;
  if (!window._posKeepCart) {
    window.posCart = [];
    window.posPayments = [];
    window.posDiscount = 0;
    window.posClientId = null;
    window.posClientPhone = '';
    window.posClientName = '';
  }
  window._posKeepCart = false;
  window.posUnitLabel = posUnitLabel;
  window.posCurrentStage = posStage;

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
        <div style="display:flex;gap:10px;padding:10px 15px;background:#f0f4ff;align-items:center;border-bottom:1px solid #ddd">
          <label style="font-weight:700;white-space:nowrap">نوع البيع:</label>
          <select id="posStageSelect" onchange="window._switchPosStage(this.value)" style="padding:8px 14px;border-radius:8px;border:1px solid #ddd;font-family:Cairo;font-weight:600">
            <option value="wholesale_kg" ${posStage==='wholesale_kg'?'selected':''}>جملة (كجم)</option>
            <option value="retail_oz" ${posStage==='retail_oz'?'selected':''}>تجزئة (أونصة)</option>
          </select>
          <span class="badge badge-${posStage==='wholesale_kg'?'primary':'success'}" style="font-size:13px">${posUnitLabel}</span>
        </div>
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
                <div class="pos-product-color">🎨 ${item.color_code || 'بدون'}</div>
                <div class="pos-product-price">${fmt(item.unit_price)}</div>
                <div class="pos-product-qty">المتاح: ${item.quantity} ${posUnitLabel}</div>
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

window._switchPosStage = async (stage) => {
  window._posStage = stage;
  // Reload only the product grid — preserve cart, client, discount
  const savedCart = window.posCart || [];
  const savedDiscount = window.posDiscount || 0;
  const savedClientId = window.posClientId;
  const savedClientPhone = document.getElementById('posClientPhone')?.value || '';
  const savedClientName = document.getElementById('posClientName')?.value || '';
  const savedPrevDebt = window.posClientPreviousDebt || 0;

  const stageParam = `?stage=${stage}`;
  const posUnitLabel = stage === 'retail_oz' ? 'أونصة' : 'كجم';
  const invData = await api('/api/inventory/by-category' + stageParam);
  window.posInventory = invData.inventory;
  window.posUnitLabel = posUnitLabel;
  window.posCurrentStage = stage;

  // Rebuild product grid only
  const grid = document.getElementById('posProductsGrid');
  if (grid) {
    grid.innerHTML = invData.inventory.length === 0
      ? '<div class="pos-empty"><div class="pos-empty-icon">📦</div><p>لا توجد منتجات في المخزون</p></div>'
      : invData.inventory.map(item => `
          <div class="pos-product-card" data-category="${item.category || 'غير مصنف'}" data-name="${item.product_name}" onclick="addToCart(${item.id})">
            <div class="pos-product-icon">${getCategoryIcon(item.category)}</div>
            <div class="pos-product-name">${item.product_name}</div>
            <div class="pos-product-color">🎨 ${item.color_code || 'بدون'}</div>
            <div class="pos-product-price">${fmt(item.unit_price)}</div>
            <div class="pos-product-qty">المتاح: ${item.quantity} ${posUnitLabel}</div>
          </div>
        `).join('');
  }

  // Update stage badge
  const badgeParent = document.getElementById('posStageSelect')?.parentElement;
  if (badgeParent) {
    const badge = badgeParent.querySelector('.badge');
    if (badge) {
      badge.textContent = posUnitLabel;
      badge.className = `badge badge-${stage === 'wholesale_kg' ? 'primary' : 'success'}`;
    }
  }

  // Restore cart & client state
  window.posCart = savedCart;
  window.posDiscount = savedDiscount;
  window.posClientId = savedClientId;
  window.posClientPreviousDebt = savedPrevDebt;
  const phoneEl = document.getElementById('posClientPhone');
  const nameEl = document.getElementById('posClientName');
  if (phoneEl) phoneEl.value = savedClientPhone;
  if (nameEl) nameEl.value = savedClientName;

  renderPOSCart();
};

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
      color_code: item.color_code || 'بدون',
      color_code_id: item.color_code_id,
      unit_price: item.unit_price,
      quantity: 1,
      max_qty: item.quantity,
      unit: item.unit,
      inventory_stage: item.inventory_stage || window._posStage || 'wholesale_kg'
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
    container.innerHTML = window.posCart.map(item => {
      const iUnit = item.inventory_stage === 'retail_oz' ? 'أونصة' : 'كجم';
      return `
      <div class="pos-item">
        <div class="pos-item-info">
          <div class="pos-item-name">${item.product_name}</div>
          <div class="pos-item-details">🎨 ${item.color_code || 'بدون'} • ${fmt(item.unit_price)}/${iUnit}</div>
        </div>
        <div class="pos-item-qty">
          <button class="minus" onclick="updateCartQty(${item.inventory_id}, -1)">-</button>
          <span>${item.quantity} ${iUnit}</span>
          <button class="plus" onclick="updateCartQty(${item.inventory_id}, 1)">+</button>
        </div>
        <div class="pos-item-total">${fmt(item.quantity * item.unit_price)}</div>
      </div>`;
    }).join('');
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
        <option value="كمبيالة">📋 كمبيالة (سند دين)</option>
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
    <div class="form-group traite-fields-${idx} hidden">
      <input type="date" name="pay_traite_due_${idx}" title="تاريخ استحقاق الكمبيالة">
      <input type="text" name="pay_traite_ref_${idx}" placeholder="رقم مرجعي (اختياري)">
    </div>
    <div class="form-group">
      <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.payment-method-row').remove(); updatePaymentTotals()">🗑️</button>
    </div>
  `;
  container.appendChild(div);
};

window.togglePOSCheckFields = (select, idx) => {
  const checkFields  = document.querySelector(`.check-fields-${idx}`);
  const traiteFields = document.querySelector(`.traite-fields-${idx}`);
  if (select.value === 'شيك') {
    checkFields.classList.remove('hidden');
    if (traiteFields) traiteFields.classList.add('hidden');
  } else if (select.value === 'كمبيالة') {
    if (traiteFields) traiteFields.classList.remove('hidden');
    checkFields.classList.add('hidden');
  } else {
    checkFields.classList.add('hidden');
    if (traiteFields) traiteFields.classList.add('hidden');
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

  // NEW DEBT = previous_debt + invoice_total - total_paid
  // If overpaid: excess reduces previous debt (newDebt can be negative = credit)
  const newDebtEl = document.getElementById('newDebt');
  if (newDebtEl) {
    const invoiceTotal = window.posInvoiceTotal || 0;
    const newTotalDebt = previousDebt + invoiceTotal - totalPaid;
    if (newTotalDebt < -0.01) {
      newDebtEl.textContent = fmt(Math.abs(newTotalDebt)) + ' (رصيد لصالح العميل)';
      newDebtEl.style.color = '#28a745';
    } else {
      newDebtEl.textContent = fmt(Math.max(0, newTotalDebt));
      newDebtEl.style.color = newTotalDebt > 0.01 ? '#dc3545' : '#28a745';
    }
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
        payment.check_number   = row.querySelector(`input[name="pay_check_${i}"]`)?.value;
        payment.check_due_date = row.querySelector(`input[name="pay_due_${i}"]`)?.value;
        payment.bank           = row.querySelector(`input[name="pay_bank_${i}"]`)?.value;
      }
      if(type === 'كمبيالة') {
        payment.traite_due_date = row.querySelector(`input[name="pay_traite_due_${i}"]`)?.value;
        payment.traite_ref      = row.querySelector(`input[name="pay_traite_ref_${i}"]`)?.value || null;
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

  // Debt = remaining after actual payments (cash / check / transfer only)
  // آجل is NOT sent as a payment — the server computes remaining dynamically
  const debtAmount = finalTotal - totalPaid;
  const hasDebt = debtAmount > 0.01;

  // Phone required when any amount is left unpaid
  if(hasDebt && !clientPhone) {
    toast('رقم الهاتف إجباري للبيع بالدين', 'danger');
    return;
  }

  try {
    const items = window.posCart.map(c => ({
      inventory_id: c.inventory_id,
      product_name: c.product_name,
      color_code_id: c.color_code_id,
      quantity: c.quantity,
      unit_price: c.unit_price,
      total_price: c.quantity * c.unit_price,
      inventory_stage: c.inventory_stage
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
    window.posClientId = null;
    window.posClientPreviousDebt = 0;
    document.getElementById('posDiscountInput').value = 0;
    document.getElementById('posClientSelect').value = '';
    document.getElementById('posClientPhone').value = '';
    document.getElementById('posClientName').value = '';
    const debtInfoEl = document.getElementById('posClientDebtInfo');
    if (debtInfoEl) debtInfoEl.style.display = 'none';
    renderPOSCart();

    // Reload product grid to reflect updated quantities
    try {
      const stage = window._posStage || 'wholesale_kg';
      const invData = await api('/api/inventory/by-category?stage=' + stage);
      window.posInventory = invData.inventory;
      const posUL = stage === 'retail_oz' ? 'أونصة' : 'كجم';
      const grid = document.getElementById('posProductsGrid');
      if (grid) {
        grid.innerHTML = invData.inventory.length === 0
          ? '<div class="pos-empty"><div class="pos-empty-icon">📦</div><p>لا توجد منتجات في المخزون</p></div>'
          : invData.inventory.map(item => `
              <div class="pos-product-card" data-category="${item.category || 'غير مصنف'}" data-name="${item.product_name}" onclick="addToCart(${item.id})">
                <div class="pos-product-icon">${getCategoryIcon(item.category)}</div>
                <div class="pos-product-name">${item.product_name}</div>
                <div class="pos-product-color">🎨 ${item.color_code || 'بدون'}</div>
                <div class="pos-product-price">${fmt(item.unit_price)}</div>
                <div class="pos-product-qty">المتاح: ${item.quantity} ${posUL}</div>
              </div>
            `).join('');
      }
    } catch(e) {
      console.error('Failed to reload inventory:', e);
    }

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
    const openCount   = purchases.filter(p => p.status === 'OPEN').length;
    const closedCount = purchases.filter(p => p.status === 'CLOSED').length;
    const totalCredit = purchases.reduce((s, p) => s + (p.supplier_balance < 0 ? Math.abs(p.supplier_balance) : 0), 0);

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
        <div class="stat-card ${openCount > 0 ? 'danger' : 'success'}">
          <h3>📊 الحالة</h3>
          <div class="value" style="font-size:1.1rem">
            <span style="color:#e74c3c">🔴 ${openCount} مفتوح</span> &nbsp;
            <span style="color:#27ae60">✅ ${closedCount} مسدد</span>
          </div>
        </div>
      </div>
    `;

    // Render table
    document.getElementById('purchasesTable').innerHTML = `
      <div class="table-container"><table><thead><tr>
        <th>رقم الفاتورة</th><th>التاريخ</th><th>المورد / رصيده</th>
        <th>المبلغ</th><th>المدفوع</th><th>الباقي</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead><tbody>${purchases.length === 0 ? '<tr><td colspan="8" class="text-center">لا توجد مشتريات</td></tr>' : purchases.map(p => {
        const supplierLabel = p.supplier_name_resolved || p.supplier_name || '-';
        const balanceLabel  = p.supplier_balance > 0
          ? `<br><small style="color:#e74c3c">مديون: ${fmt(p.supplier_balance)}</small>`
          : p.supplier_balance < 0
            ? `<br><small style="color:#27ae60">رصيد دائن: ${fmt(Math.abs(p.supplier_balance))}</small>`
            : '';
        const creditLabel   = p.applied_credit > 0
          ? `<br><small style="color:#3498db">رصيد مطبّق: ${fmt(p.applied_credit)}</small>`
          : '';
        const statusBadge   = p.status === 'CLOSED'
          ? `<span class="badge badge-success">✅ مسدد</span>`
          : `<span class="badge badge-danger">🔴 مفتوح</span>`;
        return `<tr>
          <td class="font-bold">${p.invoice_number}</td>
          <td>${fmtDate(p.date)}</td>
          <td>${supplierLabel}${balanceLabel}</td>
          <td class="text-danger font-bold">${fmt(p.total_amount)}</td>
          <td>${fmt(p.total_paid)}${creditLabel}</td>
          <td class="${p.remaining > 0 ? 'text-warning' : 'text-success'} font-bold">${fmt(p.remaining)}</td>
          <td>${statusBadge}</td>
          <td><button class="btn btn-sm" onclick="viewPurchaseDetails(${p.id})">👁️</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>
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
        <td>${item.product_name || ('منتج #' + item.inventory_id)}${item.color_description ? ' <span class="badge badge-primary" style="font-size:0.75rem">' + item.color_description + '</span>' : ''}</td>
        <td>${item.quantity} ${item.product_unit || ''}</td>
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
  const [suppliers, productTypes, warehouses, colorSuggestions, availableChecks] = await Promise.all([
    api('/api/suppliers'),
    api('/api/product-types'),
    api('/api/warehouses'),
    api('/api/purchases/color-suggestions').catch(() => []),
    api('/api/checks/portfolio/available')
  ]);

  // Store globally so addPurchaseItem() can access them when adding rows dynamically
  window.purchaseProductTypes    = productTypes;
  window.purchaseColorSuggestions = colorSuggestions;
  window.purchaseAvailableChecks  = availableChecks;

  // Build product <option> list and color <datalist> options (shared across rows)
  const ptOptions   = productTypes.map(p => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('');
  const colorOpts   = colorSuggestions.map(c => `<option value="${c}"></option>`).join('');

  const buildItemRow = (idx) => `
    <div class="form-grid purchase-item-row" style="grid-template-columns:2fr 1.5fr 1fr 1fr 1fr auto;gap:6px;align-items:start">
      <div class="form-group" style="margin:0">
        <select name="product_type_id_${idx}" required style="width:100%">
          <option value="">اختر منتجاً...</option>
          ${ptOptions}
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <input name="color_input_${idx}" list="color-list-${idx}"
          placeholder="لون المورد (اختياري)" autocomplete="off" style="width:100%">
        <datalist id="color-list-${idx}">${colorOpts}</datalist>
      </div>
      <div class="form-group" style="margin:0">
        <input type="number" name="qty_${idx}" placeholder="الكمية" step="0.01" min="0.01"
          onchange="calcPurchaseTotal()" style="width:100%">
      </div>
      <div class="form-group" style="margin:0">
        <input type="number" name="cost_${idx}" placeholder="تكلفة الوحدة" step="0.01" min="0.01"
          onchange="calcPurchaseTotal()" style="width:100%">
      </div>
      <div class="form-group" style="margin:0">
        <input type="number" name="price_${idx}" placeholder="سعر البيع" step="0.01" min="0"
          style="width:100%">
      </div>
      <div class="form-group" style="margin:0">
        <button type="button" class="btn btn-sm btn-danger"
          onclick="this.closest('.purchase-item-row').remove(); calcPurchaseTotal()">🗑️</button>
      </div>
    </div>`;

  modal('إضافة فاتورة مشتريات', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">رقم الفاتورة</label><input name="invoice_number" value="PUR${Date.now()}" required></div>
      <div class="form-group"><label class="required">التاريخ</label><input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required></div>
      <div class="form-group"><label class="required">المخزن</label>
        <select name="warehouse_id" required>
          <option value="">اختر المخزن...</option>
          ${warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>المورد</label>
        <select name="supplier_id" onchange="fillSupplierName(this)">
          <option value="">غير محدد</option>
          ${suppliers.map(s => `<option value="${s.id}" data-name="${s.name}">${s.code} - ${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>اسم المورد</label><input name="supplier_name" id="supplierNameInput"></div>
    </div>

    <h4>📦 العناصر</h4>
    <div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:4px;font-size:0.8rem;color:#6b7280;padding:0 2px">
      <span>المنتج *</span><span>لون المورد</span><span>الكمية *</span><span>تكلفة الوحدة *</span><span>سعر البيع</span><span></span>
    </div>
    <div id="purchaseItems">
      ${buildItemRow(0)}
    </div>
    <button type="button" class="btn btn-sm" onclick="addPurchaseItem()">➕ إضافة صف</button>

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

    const warehouseId = fd.get('warehouse_id');
    if (!warehouseId) { toast('يرجى اختيار المخزن', 'danger'); return; }

    const items = [];
    document.querySelectorAll('.purchase-item-row').forEach((row, i) => {
      const ptId       = row.querySelector(`select[name="product_type_id_${i}"]`)?.value;
      const colorInput = (row.querySelector(`input[name="color_input_${i}"]`)?.value || '').trim();
      const qty        = row.querySelector(`input[name="qty_${i}"]`)?.value;
      const cost       = row.querySelector(`input[name="cost_${i}"]`)?.value;
      const price      = row.querySelector(`input[name="price_${i}"]`)?.value;
      if (ptId && qty && cost) {
        items.push({
          product_type_id: parseInt(ptId),
          color_input:     colorInput || null,          // null if empty — backend normalizes
          quantity:        parseFloat(qty),
          unit_cost:       parseFloat(cost),
          total_cost:      parseFloat(qty) * parseFloat(cost),
          unit_price:      price ? parseFloat(price) : null  // only sent when provided
        });
      }
    });

    if (items.length === 0) { toast('أضف عنصر واحد على الأقل', 'danger'); return; }

    const payments = [];
    document.querySelectorAll('.purchase-payment-row').forEach((row, i) => {
      const type = row.querySelector(`select[name="ptype_${i}"]`)?.value;
      const amt  = parseFloat(row.querySelector(`input[name="pamt_${i}"]`)?.value) || 0;
      if (type && amt > 0) {
        const payment = { payment_type: type, amount: amt };
        if (type === 'شيك') {
          payment.check_number  = row.querySelector(`input[name="pcheck_${i}"]`)?.value;
          payment.check_due_date = row.querySelector(`input[name="pdue_${i}"]`)?.value;
          payment.bank          = row.querySelector(`input[name="pbank_${i}"]`)?.value;
        } else if (type === 'شيك_مظهر') {
          const sourceCheckId = row.querySelector(`select[name="psource_${i}"]`)?.value;
          if (sourceCheckId) {
            payment.source_check_id = parseInt(sourceCheckId);
            const sourceCheck = window.purchaseAvailableChecks.find(c => c.id == sourceCheckId);
            if (sourceCheck) {
              payment.check_number   = sourceCheck.check_number;
              payment.check_due_date = sourceCheck.due_date;
              payment.bank           = sourceCheck.bank;
            }
          }
        }
        payments.push(payment);
      }
    });

    await api('/api/purchases', { method: 'POST', body: JSON.stringify({
      invoice_number: fd.get('invoice_number'),
      date:           fd.get('date'),
      warehouse_id:   parseInt(warehouseId),
      supplier_id:    fd.get('supplier_id') ? parseInt(fd.get('supplier_id')) : null,
      supplier_name:  fd.get('supplier_name'),
      items, payments, user: USER
    })});

    // Invalidate cached supplier list so next open refetches fresh balances
    window.purchaseSuppliers = null;
    toast('تمت الإضافة'); nav('purchases');
  });

  addPurchasePayment();
};

// Shows/hides "✨ new product" hint as user types in product input
window.checkNewProduct = (input, idx) => {
  const hint = document.getElementById(`item-hint-${idx}`);
  if (!hint) return;
  const val = input.value.trim();
  hint.style.display = (val && !window.purchaseInvMap[val]) ? 'inline' : 'none';
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
  const container  = document.getElementById('purchaseItems');
  const idx        = container.children.length;
  const pts        = window.purchaseProductTypes    || [];
  const colors     = window.purchaseColorSuggestions || [];

  const ptOptions  = pts.map(p => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('');
  const colorOpts  = colors.map(c => `<option value="${c}"></option>`).join('');

  const div = document.createElement('div');
  div.className = 'form-grid purchase-item-row';
  div.style.cssText = 'grid-template-columns:2fr 1.5fr 1fr 1fr 1fr auto;gap:6px;align-items:start';
  div.innerHTML = `
    <div class="form-group" style="margin:0">
      <select name="product_type_id_${idx}" required style="width:100%">
        <option value="">اختر منتجاً...</option>
        ${ptOptions}
      </select>
    </div>
    <div class="form-group" style="margin:0">
      <input name="color_input_${idx}" list="color-list-${idx}"
        placeholder="لون المورد (اختياري)" autocomplete="off" style="width:100%">
      <datalist id="color-list-${idx}">${colorOpts}</datalist>
    </div>
    <div class="form-group" style="margin:0">
      <input type="number" name="qty_${idx}" placeholder="الكمية" step="0.01" min="0.01"
        onchange="calcPurchaseTotal()" style="width:100%">
    </div>
    <div class="form-group" style="margin:0">
      <input type="number" name="cost_${idx}" placeholder="تكلفة الوحدة" step="0.01" min="0.01"
        onchange="calcPurchaseTotal()" style="width:100%">
    </div>
    <div class="form-group" style="margin:0">
      <input type="number" name="price_${idx}" placeholder="سعر البيع" step="0.01" min="0"
        style="width:100%">
    </div>
    <div class="form-group" style="margin:0">
      <button type="button" class="btn btn-sm btn-danger"
        onclick="this.closest('.purchase-item-row').remove(); calcPurchaseTotal()">🗑️</button>
    </div>
  `;
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

// ============================================================
// TRAITES (PROMISSORY NOTES)
// Documented in docs/WHOLESALE_SYSTEM.md
// ============================================================
async function loadTraites(c) {
  const STATUS_AR = { PENDING: 'قيد الانتظار', COLLECTED: 'محصلة', UNPAID: 'غير مدفوعة' };
  const STATUS_BADGE = { PENDING: 'badge-warning', COLLECTED: 'badge-success', UNPAID: 'badge-danger' };

  const renderTable = (items) => {
    if (!items.length) return '<div class="alert alert-warning">لا توجد سندات دين.</div>';
    return `<div class="table-container"><table>
      <thead><tr>
        <th>#</th><th>المرجع</th><th>العميل</th><th>المبلغ</th>
        <th>تاريخ الاستحقاق</th><th>الحالة</th><th>ملاحظات</th><th>إجراءات</th>
      </tr></thead>
      <tbody>${items.map(t => `<tr>
        <td>${t.id}</td>
        <td>${t.reference || '—'}</td>
        <td>${t.client_name || '—'} ${t.client_code ? `<small class="text-muted">${t.client_code}</small>` : ''}</td>
        <td class="font-bold">${fmt(t.amount)} DH</td>
        <td>${fmtDate(t.due_date)}</td>
        <td><span class="badge ${STATUS_BADGE[t.status]||'badge-secondary'}">${STATUS_AR[t.status]||t.status}</span></td>
        <td>${t.notes || '—'}</td>
        <td style="display:flex;gap:.3rem;flex-wrap:wrap">
          ${t.status === 'PENDING' ? `
            <button class="btn btn-sm btn-success" onclick="window._traiteMark(${t.id},'COLLECTED')">✓ محصلة</button>
            <button class="btn btn-sm btn-danger" onclick="window._traiteMark(${t.id},'UNPAID')">✗ غير مدفوعة</button>
          ` : ''}
          <button class="btn btn-sm" onclick="window._traiteEdit(${t.id})">✏️</button>
          ${t.status !== 'COLLECTED' ? `<button class="btn btn-sm btn-danger" onclick="window._traiteDelete(${t.id})">🗑️</button>` : ''}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  };

  const load = async (filter = 'PENDING') => {
    c.innerHTML = '<div class="loading">جاري التحميل...</div>';
    try {
      const [items, clients] = await Promise.all([
        api(`/api/traites${filter !== 'ALL' ? '?status='+filter : ''}`),
        api('/api/clients')
      ]);

      const totals = { PENDING: 0, COLLECTED: 0, UNPAID: 0 };
      items.forEach(t => { if (totals[t.status] !== undefined) totals[t.status] += t.amount; });

      const clientOpts = clients.map(cl => `<option value="${cl.id}">${cl.code} — ${cl.name}</option>`).join('');

      c.innerHTML = `
        <div class="page-header">
          <h2>📋 سندات الدين (الكمبيالات)</h2>
          <button class="btn btn-secondary btn-sm" onclick="window._traiteAdd()" title="الإنشاء اليدوي للحالات الاستثنائية فقط — تُنشأ تلقائياً عند اختيار 'كمبيالة' في الفاتورة">+ سند دين يدوي</button>
        </div>

        <!-- Stats -->
        <div class="stats-grid" style="margin-bottom:1rem">
          <div class="stat-card"><div class="stat-value text-warning">${fmt(totals.PENDING)} DH</div><div class="stat-label">قيد الانتظار</div></div>
          <div class="stat-card"><div class="stat-value text-success">${fmt(totals.COLLECTED)} DH</div><div class="stat-label">محصلة</div></div>
          <div class="stat-card"><div class="stat-value text-danger">${fmt(totals.UNPAID)} DH</div><div class="stat-label">غير مدفوعة</div></div>
        </div>

        <!-- Filter tabs -->
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
          ${['ALL','PENDING','COLLECTED','UNPAID'].map(s =>
            `<button class="btn ${filter===s?'btn-primary':'btn-secondary'} btn-sm" onclick="window._traiteFilter('${s}')">${s==='ALL'?'الكل':STATUS_AR[s]}</button>`
          ).join('')}
        </div>

        <div id="traites-table">${renderTable(items)}</div>

        <!-- Hidden client opts for modal -->
        <datalist id="traite-clients-list">${clientOpts}</datalist>
      `;

      window._traiteFilter = (f) => load(f);

      window._traiteAdd = () => {
        modal('إضافة سند دين يدوي', `
          <div class="alert alert-warning" style="margin-bottom:.75rem">⚠️ الإنشاء اليدوي للحالات الاستثنائية فقط. تُنشأ سندات الدين تلقائياً عند اختيار "كمبيالة" في نقطة البيع أو المبيعات.</div>
          <form id="traite-form">
            <div class="form-group"><label>العميل</label>
              <select id="t-client" class="form-control">
                <option value="">-- بدون عميل --</option>
                ${clientOpts}
              </select>
            </div>
            <div class="form-group"><label>المرجع (رقم الفاتورة أو ملاحظة)</label>
              <input id="t-ref" class="form-control" placeholder="مرجع استثنائي" />
            </div>
            <div class="form-group"><label>المبلغ (DH)</label>
              <input id="t-amount" class="form-control" type="number" step="0.01" min="0.01" required />
            </div>
            <div class="form-group"><label>تاريخ الاستحقاق</label>
              <input id="t-due" class="form-control" type="date" required />
            </div>
            <div class="form-group"><label>ملاحظات (اختياري)</label>
              <textarea id="t-notes" class="form-control" rows="2"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">حفظ</button>
          </form>
        `);
        document.getElementById('traite-form').onsubmit = async (e) => {
          e.preventDefault();
          const body = {
            client_id: document.getElementById('t-client').value || null,
            reference: document.getElementById('t-ref').value.trim() || null,
            amount: parseFloat(document.getElementById('t-amount').value),
            due_date: document.getElementById('t-due').value,
            notes: document.getElementById('t-notes').value.trim() || null
          };
          try {
            await api('/api/traites', { method: 'POST', body: JSON.stringify(body) });
            toast('تمت إضافة سند الدين', 'success');
            document.querySelector('.modal-overlay')?.remove();
            load(filter);
          } catch(err) { toast(err.message, 'error'); }
        };
      };

      window._traiteMark = async (id, status) => {
        const label = STATUS_AR[status];
        if (!confirm(`تأكيد تغيير الحالة إلى "${label}"؟`)) return;
        try {
          await api(`/api/traites/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
          toast(`تم تحديث الحالة: ${label}`, 'success');
          load(filter);
        } catch(err) { toast(err.message, 'error'); }
      };

      window._traiteEdit = async (id) => {
        const traite = items.find(t => t.id === id);
        if (!traite) return;
        modal('تعديل سند الدين', `
          <form id="traite-edit-form">
            <div class="form-group"><label>العميل</label>
              <select id="te-client" class="form-control">
                <option value="">-- بدون عميل --</option>
                ${clients.map(cl => `<option value="${cl.id}" ${cl.id==traite.client_id?'selected':''}>${cl.code} — ${cl.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>المرجع</label>
              <input id="te-ref" class="form-control" value="${traite.reference||''}" />
            </div>
            <div class="form-group"><label>المبلغ (DH)</label>
              <input id="te-amount" class="form-control" type="number" step="0.01" value="${traite.amount}" />
            </div>
            <div class="form-group"><label>تاريخ الاستحقاق</label>
              <input id="te-due" class="form-control" type="date" value="${traite.due_date}" />
            </div>
            <div class="form-group"><label>الحالة</label>
              <select id="te-status" class="form-control">
                ${Object.entries(STATUS_AR).map(([v,l]) => `<option value="${v}" ${v===traite.status?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>ملاحظات</label>
              <textarea id="te-notes" class="form-control" rows="2">${traite.notes||''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary">حفظ التعديلات</button>
          </form>
        `);
        document.getElementById('traite-edit-form').onsubmit = async (e) => {
          e.preventDefault();
          const body = {
            client_id: document.getElementById('te-client').value || null,
            reference: document.getElementById('te-ref').value.trim() || null,
            amount: parseFloat(document.getElementById('te-amount').value),
            due_date: document.getElementById('te-due').value,
            status: document.getElementById('te-status').value,
            notes: document.getElementById('te-notes').value.trim() || null
          };
          try {
            await api(`/api/traites/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            toast('تم تحديث سند الدين', 'success');
            document.querySelector('.modal-overlay')?.remove();
            load(filter);
          } catch(err) { toast(err.message, 'error'); }
        };
      };

      window._traiteDelete = async (id) => {
        if (!confirm('حذف سند الدين هذا؟')) return;
        try {
          await api(`/api/traites/${id}`, { method: 'DELETE' });
          toast('تم الحذف');
          load(filter);
        } catch(err) { toast(err.message, 'error'); }
      };

    } catch(err) { c.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
  };

  load('PENDING');
}

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
        <th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>إجراءات</th>
      </tr></thead><tbody>${clients.map(cl => `<tr>
        <td>${cl.code}</td><td class="font-bold">${cl.name}</td><td>${cl.phone||'-'}</td>
        <td class="${cl.balance>=0?'text-success':'text-danger'} font-bold">${fmt(cl.balance)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewClientStatement(${cl.id})">📋 كشف</button>
          <button class="btn btn-sm" onclick="editClient(${cl.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="delClient(${cl.id})">🗑️</button>
        </td>
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

window.editClient = async (id) => {
  const clients = await api('/api/clients');
  const item = clients.find(c => c.id === id);
  if (!item) return toast('العميل غير موجود', 'danger');
  modal('تعديل عميل', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone" value="${item.phone||''}"></div>
      <div class="form-group"><label>العنوان</label><input name="address" value="${item.address||''}"></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/clients/${id}`, {method: 'PUT', body: JSON.stringify({
      name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'), user: USER
    })});
    toast('تم التعديل'); nav('clients');
  });
};

window.delClient = async (id) => {
  if (!confirm('حذف هذا العميل؟')) return;
  try { await api(`/api/clients/${id}`, {method:'DELETE', body: JSON.stringify({user:USER})}); toast('تم الحذف'); nav('clients'); }
  catch(e) { toast(e.message, 'danger'); }
};

window.viewClientStatement = (id) => {
  window._statementClientId = id;
  nav('client-statement');
};

async function loadClientStatement(c) {
  const id = window._statementClientId;
  if (!id) { c.innerHTML = '<div class="alert alert-warning">لم يتم تحديد عميل. <button class="btn btn-sm btn-primary" onclick="nav(\'clients\')">العودة</button></div>'; return; }

  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [fromEl, toEl] = [
      document._stmtFrom || '',
      document._stmtTo   || ''
    ];
    const params = new URLSearchParams();
    if (window._stmtFrom) params.set('from', window._stmtFrom);
    if (window._stmtTo)   params.set('to',   window._stmtTo);
    const qs = params.toString() ? '?' + params.toString() : '';

    const data = await api(`/api/clients/${id}/statement${qs}`);
    const { client, transactions, closing_balance } = data;

    const TXN_LABEL = { invoice: 'فاتورة', payment: 'دفعة' };
    const TXN_CLASS = { invoice: 'text-danger', payment: 'text-success' };

    c.innerHTML = `
      <div class="page-header">
        <h2>📋 كشف حساب: ${client.name}</h2>
        <button class="btn" onclick="nav('clients')">← العودة للعملاء</button>
      </div>

      <!-- Client Info Card -->
      <div class="card" style="padding:14px;margin-bottom:16px;display:flex;gap:32px;flex-wrap:wrap;font-family:'Cairo',sans-serif">
        <div><span style="color:#6b7280">الكود:</span> <strong>${client.code}</strong></div>
        <div><span style="color:#6b7280">الهاتف:</span> <strong>${client.phone || '—'}</strong></div>
        <div><span style="color:#6b7280">العنوان:</span> <strong>${client.address || '—'}</strong></div>
        <div style="margin-right:auto"><span style="color:#6b7280">الرصيد الحالي:</span>
          <strong class="${client.balance >= 0 ? 'text-danger' : 'text-success'}" style="font-size:1.1rem">${fmt(client.balance)}</strong>
        </div>
      </div>

      <!-- Date Filter -->
      <div class="card" style="padding:12px;margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <label style="font-family:'Cairo',sans-serif">من: <input type="date" id="stmt-from" value="${window._stmtFrom||''}" style="margin-right:6px"></label>
        <label style="font-family:'Cairo',sans-serif">إلى: <input type="date" id="stmt-to" value="${window._stmtTo||''}" style="margin-right:6px"></label>
        <button class="btn btn-primary" onclick="_applyStmtFilter()">🔍 تطبيق</button>
        <button class="btn" onclick="_clearStmtFilter()">✖ إعادة تعيين</button>
      </div>

      ${transactions.length === 0
        ? '<div class="alert alert-warning">لا توجد حركات لهذا العميل في الفترة المحددة.</div>'
        : `<div class="table-container"><table>
          <thead><tr>
            <th>التاريخ</th><th>النوع</th><th>المرجع</th><th>البيان</th>
            <th>مدين (+)</th><th>دائن (−)</th><th>الرصيد</th>
          </tr></thead>
          <tbody>
            ${transactions.map(t => {
              const isInvoice = t.txn_type === 'invoice';
              const debit  = isInvoice ? fmt(Math.abs(t.amount)) : '—';
              const credit = !isInvoice ? fmt(Math.abs(t.amount)) : '—';
              return `<tr>
                <td>${fmtDate(t.txn_date)}</td>
                <td><span class="badge ${isInvoice ? 'badge-danger' : 'badge-success'}">${TXN_LABEL[t.txn_type]||t.txn_type}</span></td>
                <td class="font-bold">${t.reference||'—'}</td>
                <td style="color:#6b7280;font-size:.85rem">${t.note||'—'}</td>
                <td class="text-danger">${debit}</td>
                <td class="text-success">${credit}</td>
                <td class="font-bold ${t.running_balance>=0?'text-danger':'text-success'}">${fmt(t.running_balance)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr style="background:#f8fafc;font-weight:bold">
            <td colspan="6" style="text-align:right;font-family:'Cairo',sans-serif">الرصيد الختامي للفترة</td>
            <td class="font-bold ${closing_balance>=0?'text-danger':'text-success'}" style="font-size:1.05rem">${fmt(closing_balance)}</td>
          </tr></tfoot>
        </table></div>`
      }`;

    window._applyStmtFilter = () => {
      window._stmtFrom = document.getElementById('stmt-from').value || null;
      window._stmtTo   = document.getElementById('stmt-to').value   || null;
      loadClientStatement(c);
    };
    window._clearStmtFilter = () => {
      window._stmtFrom = null; window._stmtTo = null;
      loadClientStatement(c);
    };

  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

async function loadSuppliers(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const suppliers = await api('/api/suppliers');
    c.innerHTML = `
      <div class="page-header"><h2>🏭 الموردين</h2>
      <button class="btn" onclick="addSupplier()">➕ إضافة</button></div>
      <div class="table-container"><table><thead><tr>
        <th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>إجراءات</th>
      </tr></thead><tbody>${suppliers.map(s => `<tr>
        <td>${s.code}</td><td class="font-bold">${s.name}</td><td>${s.phone||'-'}</td>
        <td class="${s.computed_balance>0?'text-danger':s.computed_balance<0?'text-success':''} font-bold">${fmt(s.computed_balance)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewSupplierStatement(${s.id})">📋 كشف</button>
          <button class="btn btn-sm" onclick="editSupplier(${s.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="delSupplier(${s.id})">🗑️</button>
        </td>
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

window.editSupplier = async (id) => {
  const suppliers = await api('/api/suppliers');
  const item = suppliers.find(s => s.id === id);
  if (!item) return toast('المورد غير موجود', 'danger');
  modal('تعديل مورد', `<form>
    <div class="form-grid">
      <div class="form-group"><label class="required">الاسم</label><input name="name" value="${item.name}" required></div>
      <div class="form-group"><label>الهاتف</label><input name="phone" value="${item.phone||''}"></div>
      <div class="form-group"><label>العنوان</label><input name="address" value="${item.address||''}"></div>
    </div>
    <button type="submit" class="btn btn-success">💾 حفظ</button>
  </form>`, async (e) => {
    const fd = new FormData(e.target);
    await api(`/api/suppliers/${id}`, {method: 'PUT', body: JSON.stringify({
      name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'), user: USER
    })});
    toast('تم التعديل'); nav('suppliers');
  });
};

window.delSupplier = async (id) => {
  if (!confirm('حذف هذا المورد؟')) return;
  try { await api(`/api/suppliers/${id}`, {method:'DELETE', body: JSON.stringify({user:USER})}); toast('تم الحذف'); nav('suppliers'); }
  catch(e) { toast(e.message, 'danger'); }
};

window.viewSupplierStatement = (id) => {
  window._statementSupplierId = id;
  nav('supplier-statement');
};

async function loadSupplierStatement(c) {
  const id = window._statementSupplierId;
  if (!id) { c.innerHTML = '<div class="alert alert-warning">لم يتم تحديد مورد. <button class="btn btn-sm btn-primary" onclick="nav(\'suppliers\')">العودة</button></div>'; return; }

  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const params = new URLSearchParams();
    if (window._supplierStmtFrom) params.set('from', window._supplierStmtFrom);
    if (window._supplierStmtTo)   params.set('to',   window._supplierStmtTo);
    const qs = params.toString() ? '?' + params.toString() : '';

    const data = await api(`/api/suppliers/${id}/statement${qs}`);
    const { supplier, transactions, closing_balance } = data;

    const TXN_LABEL = { purchase: 'فاتورة شراء', payment: 'دفعة' };

    c.innerHTML = `
      <div class="page-header">
        <h2>📋 كشف حساب مورد: ${supplier.name}</h2>
        <button class="btn" onclick="nav('suppliers')">← العودة للموردين</button>
      </div>

      <div class="card" style="padding:14px;margin-bottom:16px;display:flex;gap:32px;flex-wrap:wrap;font-family:'Cairo',sans-serif">
        <div><span style="color:#6b7280">الكود:</span> <strong>${supplier.code}</strong></div>
        <div><span style="color:#6b7280">الهاتف:</span> <strong>${supplier.phone || '—'}</strong></div>
        <div><span style="color:#6b7280">العنوان:</span> <strong>${supplier.address || '—'}</strong></div>
        <div style="margin-right:auto"><span style="color:#6b7280">الرصيد الختامي:</span>
          <strong class="${closing_balance > 0 ? 'text-danger' : closing_balance < 0 ? 'text-success' : ''}" style="font-size:1.1rem">${fmt(closing_balance)}</strong>
          <small style="color:#6b7280;margin-right:6px">${closing_balance > 0 ? '(مستحق للمورد)' : closing_balance < 0 ? '(رصيد دائن)' : ''}</small>
        </div>
      </div>

      <div class="card" style="padding:12px;margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <label style="font-family:'Cairo',sans-serif">من: <input type="date" id="sup-stmt-from" value="${window._supplierStmtFrom||''}" style="margin-right:6px"></label>
        <label style="font-family:'Cairo',sans-serif">إلى: <input type="date" id="sup-stmt-to" value="${window._supplierStmtTo||''}" style="margin-right:6px"></label>
        <button class="btn btn-primary" onclick="_applySupplierStmtFilter()">🔍 تطبيق</button>
        <button class="btn" onclick="_clearSupplierStmtFilter()">✖ إعادة تعيين</button>
      </div>

      ${transactions.length === 0
        ? '<div class="alert alert-warning">لا توجد حركات لهذا المورد في الفترة المحددة.</div>'
        : `<div class="table-container"><table>
          <thead><tr>
            <th>التاريخ</th><th>النوع</th><th>المرجع</th><th>البيان</th>
            <th>مدين (+)</th><th>دائن (−)</th><th>الرصيد</th>
          </tr></thead>
          <tbody>
            ${transactions.map(t => {
              const isPurchase = t.txn_type === 'purchase';
              const debit  = isPurchase ? fmt(Math.abs(t.amount)) : '—';
              const credit = !isPurchase ? fmt(Math.abs(t.amount)) : '—';
              return `<tr>
                <td>${fmtDate(t.txn_date)}</td>
                <td><span class="badge ${isPurchase ? 'badge-danger' : 'badge-success'}">${TXN_LABEL[t.txn_type]||t.txn_type}</span></td>
                <td class="font-bold">${t.reference||'—'}</td>
                <td style="color:#6b7280;font-size:.85rem">${t.note||'—'}</td>
                <td class="text-danger">${debit}</td>
                <td class="text-success">${credit}</td>
                <td class="font-bold ${t.running_balance>0?'text-danger':t.running_balance<0?'text-success':''}">${fmt(t.running_balance)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr style="background:#f8fafc;font-weight:bold">
            <td colspan="6" style="text-align:right;font-family:'Cairo',sans-serif">الرصيد الختامي للفترة</td>
            <td class="font-bold ${closing_balance>0?'text-danger':closing_balance<0?'text-success':''}" style="font-size:1.05rem">${fmt(closing_balance)}</td>
          </tr></tfoot>
        </table></div>`
      }`;

    window._applySupplierStmtFilter = () => {
      window._supplierStmtFrom = document.getElementById('sup-stmt-from').value || null;
      window._supplierStmtTo   = document.getElementById('sup-stmt-to').value   || null;
      loadSupplierStatement(c);
    };
    window._clearSupplierStmtFilter = () => {
      window._supplierStmtFrom = null; window._supplierStmtTo = null;
      loadSupplierStatement(c);
    };

  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Reports
async function loadReports(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [income, balance, mfgAnalysis, custBalances, dailySales, suppBalances] = await Promise.all([
      api('/api/reports/income-statement'),
      api('/api/reports/balance-sheet'),
      api('/api/reports/manufacturing-cost-analysis').catch(() => ({ summary: { total_cost: 0, total_orders: 0, total_material_cost: 0, total_labor_cost: 0, total_overhead_cost: 0 }, orders: [] })),
      api('/api/reports/customer-balances').catch(() => ({ clients: [], total_receivable: 0 })),
      api('/api/reports/daily-sales').catch(() => []),
      api('/api/reports/supplier-balances').catch(() => ({ suppliers: [], total_payable: 0 }))
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

      <!-- Customer Balances (Receivables) -->
      <div class="card" style="margin-top:20px">
        <h3>👥 أرصدة العملاء (المديونيات)</h3>
        <div class="stats-grid" style="margin-bottom:14px">
          <div class="stat-card danger">
            <h3>💰 إجمالي المديونيات</h3>
            <div class="value">${fmt(custBalances.total_receivable)}</div>
            <div class="subtext">${custBalances.clients.length} عميل بديون مفتوحة</div>
          </div>
        </div>
        ${custBalances.clients.length === 0
          ? '<div class="alert alert-success">✅ لا توجد مديونيات مفتوحة</div>'
          : `<div class="table-container"><table>
              <thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد المستحق</th><th></th></tr></thead>
              <tbody>${custBalances.clients.map(cl => `<tr>
                <td>${cl.code}</td>
                <td class="font-bold">${cl.name}</td>
                <td>${cl.phone||'—'}</td>
                <td class="text-danger font-bold">${fmt(cl.balance)}</td>
                <td><button class="btn btn-sm btn-primary" onclick="viewClientStatement(${cl.id})">📋 كشف</button></td>
              </tr>`).join('')}</tbody>
            </table></div>`
        }
      </div>

      <!-- Supplier Balances (Payables) -->
      <div class="card" style="margin-top:20px">
        <h3>🏭 أرصدة الموردين (المستحقات)</h3>
        <div class="stats-grid" style="margin-bottom:14px">
          <div class="stat-card danger">
            <h3>💸 إجمالي المستحقات</h3>
            <div class="value">${fmt(suppBalances.total_payable)}</div>
            <div class="subtext">${suppBalances.suppliers.length} مورد بمستحقات مفتوحة</div>
          </div>
        </div>
        ${suppBalances.suppliers.length === 0
          ? '<div class="alert alert-success">✅ لا توجد مستحقات مفتوحة للموردين</div>'
          : `<div class="table-container"><table>
              <thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>المستحق</th><th></th></tr></thead>
              <tbody>${suppBalances.suppliers.map(s => `<tr>
                <td>${s.code}</td>
                <td class="font-bold">${s.name}</td>
                <td>${s.phone||'—'}</td>
                <td class="text-danger font-bold">${fmt(s.balance)}</td>
                <td><button class="btn btn-sm btn-primary" onclick="viewSupplierStatement(${s.id})">📋 كشف</button></td>
              </tr>`).join('')}</tbody>
            </table></div>`
        }
      </div>

      <!-- Daily Sales Report -->
      <div class="card" style="margin-top:20px">
        <h3>📅 تقرير المبيعات اليومية</h3>
        ${dailySales.length === 0
          ? '<div class="alert alert-warning">لا توجد مبيعات مسجلة.</div>'
          : `<div class="table-container"><table>
              <thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبيعات</th><th>المحصل</th><th>المتبقي</th></tr></thead>
              <tbody>${dailySales.slice(0,30).map(r => `<tr>
                <td class="font-bold">${fmtDate(r.date)}</td>
                <td>${r.invoice_count}</td>
                <td class="text-success font-bold">${fmt(r.total_sales)}</td>
                <td class="text-success">${fmt(r.total_paid)}</td>
                <td class="${r.total_remaining > 0 ? 'text-danger' : 'text-success'}">${fmt(r.total_remaining)}</td>
              </tr>`).join('')}</tbody>
              <tfoot><tr style="background:#f8fafc;font-weight:bold">
                <td>الإجمالي</td>
                <td>${dailySales.reduce((s,r)=>s+r.invoice_count,0)}</td>
                <td class="text-success">${fmt(dailySales.reduce((s,r)=>s+(r.total_sales||0),0))}</td>
                <td class="text-success">${fmt(dailySales.reduce((s,r)=>s+(r.total_paid||0),0))}</td>
                <td class="text-danger">${fmt(dailySales.reduce((s,r)=>s+(r.total_remaining||0),0))}</td>
              </tr></tfoot>
            </table></div>`
        }
      </div>

      <div class="card" style="margin-top:20px">
        <h3>📤 طباعة التقارير</h3>
        <button class="btn" onclick="window.print()">🖨️ طباعة الصفحة</button>
      </div>
    `;

    // Branch performance — async after page renders
    api('/api/reports/branch-performance').then(branches => {
      if (!branches.length) return;
      const BRANCH_TYPE_LABELS = { retail: 'تجزئة', wholesale: 'جملة', supplies: 'لوازم' };
      const el = document.createElement('div');
      el.className = 'card';
      el.style.marginTop = '20px';
      el.innerHTML = `
        <h3>🏢 أداء الفروع</h3>
        <div class="table-container"><table>
          <thead><tr>
            <th>الفرع</th><th>النوع</th><th>إجمالي المبيعات</th><th>عدد الفواتير</th>
            <th>المخزون (كمية)</th><th>قيمة المخزون</th><th>العملاء</th><th>المديونيات</th>
          </tr></thead>
          <tbody>${branches.map(b => `<tr>
            <td class="font-bold">${b.branch_name}</td>
            <td><span class="badge badge-info">${BRANCH_TYPE_LABELS[b.branch_type]||b.branch_type||'—'}</span></td>
            <td class="text-success font-bold">${fmt(b.total_sales)}</td>
            <td>${b.invoice_count}</td>
            <td>${parseFloat(b.total_qty).toLocaleString('ar-MA',{maximumFractionDigits:1})}</td>
            <td>${fmt(b.stock_value)}</td>
            <td>${b.client_count}</td>
            <td class="${b.receivables > 0 ? 'text-danger' : ''}">${fmt(b.receivables)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
      c.appendChild(el);
    }).catch(() => {});

  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// PRODUCTION REPORTS
// Documented in docs/PRODUCTION_SYSTEM.md
// By worker (productivity) and by color
// ============================================================
async function loadMfgReports(c) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0,7) + '-01';

  const render = async (from, to, view) => {
    c.querySelector('#mfg-rep-body').innerHTML = '<div class="loading">جاري التحميل...</div>';
    try {
      const endpoint = view === 'worker'
        ? `/api/manufacturing/reports/by-worker?from=${from}&to=${to}`
        : `/api/manufacturing/reports/by-color?from=${from}&to=${to}`;
      const rows = await api(endpoint);

      if (!rows.length) {
        c.querySelector('#mfg-rep-body').innerHTML = '<div class="alert alert-warning">لا توجد بيانات لهذه الفترة.</div>';
        return;
      }

      if (view === 'worker') {
        const totalKg = rows.reduce((s,r) => s + r.total_kg, 0);
        const totalCost = rows.reduce((s,r) => s + r.total_labor_cost, 0);
        c.querySelector('#mfg-rep-body').innerHTML = `
          <div class="stats-grid" style="margin-bottom:1rem">
            <div class="stat-card"><div class="stat-value">${fmt(totalKg)} كجم</div><div class="stat-label">إجمالي الإنتاج</div></div>
            <div class="stat-card warning"><div class="stat-value">${fmt(totalCost)} DH</div><div class="stat-label">إجمالي تكلفة العمل</div></div>
            <div class="stat-card info"><div class="stat-value">${rows.length}</div><div class="stat-label">عدد الحرفيين</div></div>
          </div>
          <div class="table-container"><table>
            <thead><tr>
              <th>#</th><th>الحرفي</th><th>الجلسات</th><th>التركيبات</th>
              <th>الكجم المنتج</th><th>معدل كجم/يوم</th><th>تكلفة العمل</th>
            </tr></thead>
            <tbody>${rows.map((r,i) => `<tr>
              <td>${i+1}</td>
              <td>${r.artisan_name} <small class="text-muted">${r.artisan_code}</small></td>
              <td>${r.total_sessions}</td>
              <td>${r.total_combinations}</td>
              <td class="font-bold">${fmt(r.total_kg)} كجم</td>
              <td>${r.avg_kg_per_day} كجم</td>
              <td>${fmt(r.total_labor_cost)} DH</td>
            </tr>`).join('')}</tbody>
          </table></div>`;
      } else {
        const totalKg = rows.reduce((s,r) => s + r.total_kg, 0);
        c.querySelector('#mfg-rep-body').innerHTML = `
          <div class="stats-grid" style="margin-bottom:1rem">
            <div class="stat-card"><div class="stat-value">${fmt(totalKg)} كجم</div><div class="stat-label">إجمالي الإنتاج</div></div>
            <div class="stat-card info"><div class="stat-value">${rows.length}</div><div class="stat-label">عدد الألوان المنتجة</div></div>
          </div>
          <div class="table-container"><table>
            <thead><tr>
              <th>#</th><th>اللون</th><th>العائلة</th><th>الجلسات</th>
              <th>التركيبات</th><th>الكجم المنتج</th>
            </tr></thead>
            <tbody>${rows.map((r,i) => `<tr>
              <td>${i+1}</td>
              <td>
                ${r.hex_code ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${r.hex_code};vertical-align:middle;margin-left:4px"></span>` : ''}
                ${r.supplier_color_code} — ${r.color_name}
              </td>
              <td>${r.family_name_ar || '—'}</td>
              <td>${r.total_sessions}</td>
              <td>${r.total_combinations}</td>
              <td class="font-bold">${fmt(r.total_kg)} كجم</td>
            </tr>`).join('')}</tbody>
          </table></div>`;
      }
    } catch(err) {
      c.querySelector('#mfg-rep-body').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  };

  c.innerHTML = `
    <div class="page-header"><h2>🏭 تقارير الإنتاج</h2></div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-end">
        <div class="form-group" style="width:160px"><label>من</label>
          <input id="mrep-from" class="form-control" type="date" value="${monthStart}" />
        </div>
        <div class="form-group" style="width:160px"><label>إلى</label>
          <input id="mrep-to" class="form-control" type="date" value="${today}" />
        </div>
        <div class="form-group" style="width:180px"><label>عرض حسب</label>
          <select id="mrep-view" class="form-control">
            <option value="worker">حسب الحرفي (إنتاجية)</option>
            <option value="color">حسب اللون</option>
          </select>
        </div>
        <div style="margin-bottom:1rem">
          <button class="btn btn-primary" onclick="window._mrepLoad()">عرض</button>
        </div>
      </div>
    </div>

    <div id="mfg-rep-body"><div class="alert alert-info">اختر نطاق التاريخ وانقر "عرض".</div></div>
  `;

  window._mrepLoad = () => {
    const from = document.getElementById('mrep-from').value;
    const to   = document.getElementById('mrep-to').value;
    const view = document.getElementById('mrep-view').value;
    render(from, to, view);
  };

  // Auto-load on open
  render(monthStart, today, 'worker');
}

// ============================================================
// PRODUCTION DASHBOARD
// ============================================================
async function loadMfgDashboard(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const d = await api('/api/manufacturing/dashboard');

    const colorSwatch = (hex) => hex
      ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${hex};vertical-align:middle;margin-left:4px;border:1px solid #cbd5e1"></span>`
      : '';

    c.innerHTML = `
      <div class="page-header"><h2>📊 لوحة الإنتاج</h2></div>

      <!-- Period stat cards -->
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card success">
          <h3>☀️ اليوم</h3>
          <div class="value">${(d.today_kg||0).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</div>
          <div class="subtext">إنتاج اليوم (معتمد)</div>
        </div>
        <div class="stat-card success">
          <h3>📅 هذا الأسبوع</h3>
          <div class="value">${(d.week_kg||0).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</div>
          <div class="subtext">آخر 7 أيام</div>
        </div>
        <div class="stat-card success">
          <h3>🗓️ هذا الشهر</h3>
          <div class="value">${(d.month_kg||0).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</div>
          <div class="subtext">من بداية الشهر</div>
        </div>
        <div class="stat-card">
          <h3>🏭 الإجمالي الكلي</h3>
          <div class="value">${(d.total_kg||0).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</div>
          <div class="subtext">${d.total_sessions} جلسة معتمدة</div>
        </div>
        <div class="stat-card ${d.open_sessions > 0 ? 'warning' : ''}">
          <h3>⏳ جلسات مفتوحة</h3>
          <div class="value">${d.open_sessions}</div>
          <div class="subtext">قيد التنفيذ حالياً</div>
        </div>
      </div>

      <div class="form-grid">
        <!-- Top workers this month -->
        <div class="card">
          <h3 style="margin-bottom:14px;font-family:'Cairo',sans-serif">🏆 أفضل الحرفيين (هذا الشهر)</h3>
          ${d.top_workers.length === 0
            ? '<div class="alert alert-warning">لا توجد بيانات إنتاج هذا الشهر.</div>'
            : `<table><thead><tr>
                <th>#</th><th>الحرفي</th><th>الجلسات</th><th>التركيبات</th><th>الكجم المنتج</th>
              </tr></thead>
              <tbody>${d.top_workers.map((w,i) => `<tr>
                <td><strong>${i+1}</strong></td>
                <td class="font-bold">${w.artisan_name} <small style="color:#6b7280">${w.artisan_code}</small></td>
                <td>${w.session_count}</td>
                <td>${w.month_combinations}</td>
                <td class="text-success font-bold">${(w.month_kg||0).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</td>
              </tr>`).join('')}</tbody>
              </table>`
          }
          <div style="margin-top:10px">
            <button class="btn btn-sm btn-primary" onclick="nav('mfg-reports')">📈 تقرير مفصل</button>
          </div>
        </div>

        <!-- Top colors this month -->
        <div class="card">
          <h3 style="margin-bottom:14px;font-family:'Cairo',sans-serif">🎨 أكثر الألوان إنتاجاً (هذا الشهر)</h3>
          ${d.top_colors.length === 0
            ? '<div class="alert alert-warning">لا توجد بيانات إنتاج هذا الشهر.</div>'
            : `<table><thead><tr>
                <th>#</th><th>اللون</th><th>العائلة</th><th>التركيبات</th><th>الكجم المنتج</th>
              </tr></thead>
              <tbody>${d.top_colors.map((col,i) => `<tr>
                <td><strong>${i+1}</strong></td>
                <td class="font-bold">
                  ${colorSwatch(col.hex_code)}${col.color_code}
                  <small style="color:#6b7280">${col.color_name||''}</small>
                </td>
                <td>${col.family_name}</td>
                <td>${col.month_combinations}</td>
                <td class="text-success font-bold">${(col.month_kg||0).toLocaleString('ar-MA',{maximumFractionDigits:1})} كجم</td>
              </tr>`).join('')}</tbody>
              </table>`
          }
          <div style="margin-top:10px">
            <button class="btn btn-sm btn-primary" onclick="nav('mfg-colors-overview')">🎨 مخزون الألوان</button>
          </div>
        </div>
      </div>
    `;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// Journal Viewer — Read-only display of accounting entries
// ============================================================
async function loadJournal(c) {
  const today          = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

  c.innerHTML = `
    <div class="page-header">
      <h2>📒 القيود المحاسبية</h2>
      <span class="badge badge-secondary" style="font-size:0.8rem;padding:4px 10px">عرض فقط — لا يمكن التعديل</span>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">من تاريخ</label>
          <input type="date" id="jnl-from" class="form-control" value="${thirtyDaysAgo}" style="width:160px">
        </div>
        <div>
          <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">إلى تاريخ</label>
          <input type="date" id="jnl-to" class="form-control" value="${today}" style="width:160px">
        </div>
        <div>
          <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">نوع المرجع</label>
          <select id="jnl-type" class="form-control" style="width:190px">
            <option value="">الكل</option>
            <option value="sale">sale</option>
            <option value="sale_payment">sale_payment</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="loadJournalData()">🔍 بحث</button>
        <button class="btn" onclick="
          document.getElementById('jnl-from').value='';
          document.getElementById('jnl-to').value='';
          document.getElementById('jnl-type').value='';
          loadJournalData();
        ">↺ إعادة تعيين</button>
      </div>
    </div>

    <div id="journal-results">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  loadJournalData();
}

async function loadJournalData() {
  const container = document.getElementById('journal-results');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const from = document.getElementById('jnl-from').value;
    const to   = document.getElementById('jnl-to').value;
    const type = document.getElementById('jnl-type').value;

    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to)   params.append('to', to);
    if (type) params.append('reference_type', type);

    const entries = await api(`/api/journal?${params.toString()}`);

    if (!Array.isArray(entries) || entries.length === 0) {
      container.innerHTML = '<div class="alert alert-info">لا توجد قيود محاسبية للفترة المحددة.</div>';
      return;
    }

    let grandDebit = 0, grandCredit = 0;

    const cards = entries.map(entry => {
      const totalDebit  = entry.lines.reduce((s, l) => s + (l.debit  || 0), 0);
      const totalCredit = entry.lines.reduce((s, l) => s + (l.credit || 0), 0);
      const balanced    = Math.abs(totalDebit - totalCredit) < 0.001;
      grandDebit  += totalDebit;
      grandCredit += totalCredit;

      const refBadge = entry.reference_type
        ? `<span class="badge badge-${entry.reference_type === 'sale' ? 'primary' : 'secondary'}" style="font-size:0.75rem">
             ${entry.reference_type} #${entry.reference_id}
           </span>`
        : '';

      const linesHtml = entry.lines.map(l => `
        <tr>
          <td style="padding:6px 10px;font-family:monospace;font-weight:600">${l.account_code}</td>
          <td style="padding:6px 10px;text-align:left;color:${l.debit  > 0 ? '#2d6a4f' : '#bbb'}">${l.debit  > 0 ? fmt(l.debit)  : '—'}</td>
          <td style="padding:6px 10px;text-align:left;color:${l.credit > 0 ? '#c0392b' : '#bbb'}">${l.credit > 0 ? fmt(l.credit) : '—'}</td>
        </tr>
      `).join('');

      return `
        <div class="card" style="margin-bottom:12px;border-right:4px solid ${balanced ? '#27ae60' : '#e74c3c'};padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <strong style="font-family:monospace;font-size:1.05rem">${entry.entry_number}</strong>
              ${refBadge}
            </div>
            <div style="display:flex;align-items:center;gap:14px">
              <span style="color:#666;font-size:0.85rem">📅 ${entry.entry_date}</span>
              ${!balanced ? '<span style="color:#e74c3c;font-weight:700;font-size:0.85rem">⚠️ غير متوازن</span>' : ''}
            </div>
          </div>

          ${entry.description ? `<div style="color:#555;font-size:0.88rem;margin-bottom:10px">📝 ${entry.description}</div>` : ''}

          <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:6px 10px;text-align:right;border-bottom:2px solid #ddd;font-weight:600">الحساب</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ddd;color:#2d6a4f;font-weight:600">مدين</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ddd;color:#c0392b;font-weight:600">دائن</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
            <tfoot>
              <tr style="background:#fafafa;border-top:2px solid ${balanced ? '#27ae60' : '#e74c3c'}">
                <td style="padding:6px 10px;font-weight:700">الإجمالي</td>
                <td style="padding:6px 10px;text-align:left;font-weight:700;color:#2d6a4f">${fmt(totalDebit)}</td>
                <td style="padding:6px 10px;text-align:left;font-weight:700;color:#c0392b">${fmt(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }).join('');

    const grandBalanced = Math.abs(grandDebit - grandCredit) < 0.001;
    const summary = `
      <div class="card" style="margin-bottom:16px;background:#f0f8ff;border:1px solid #3498db;padding:12px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <strong style="font-size:0.95rem">📊 ملخص الفترة — ${entries.length} قيد</strong>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <span style="font-size:0.9rem">مجموع المدين: <strong style="color:#2d6a4f">${fmt(grandDebit)}</strong></span>
            <span style="font-size:0.9rem">مجموع الدائن: <strong style="color:#c0392b">${fmt(grandCredit)}</strong></span>
            <span style="font-weight:700;color:${grandBalanced ? '#27ae60' : '#e74c3c'}">${grandBalanced ? '✅ متوازن' : '❌ غير متوازن'}</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = summary + cards;
  } catch(e) {
    container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ============================================================
// Trial Balance — ميزان المراجعة (Read-only)
// ============================================================
async function loadTrialBalance(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('/api/trial-balance');
    const { accounts, total_debit, total_credit, balanced } = data;

    const typeLabel = { ASSET: 'أصول', LIABILITY: 'خصوم', EQUITY: 'حقوق الملكية', REVENUE: 'إيرادات', EXPENSE: 'مصروفات' };

    const rows = accounts.map(a => `
      <tr>
        <td style="font-family:monospace;font-weight:600;padding:8px 12px">${a.code}</td>
        <td style="padding:8px 12px">${a.name}</td>
        <td style="padding:8px 12px">
          <span class="badge badge-secondary" style="font-size:0.75rem">${typeLabel[a.type] || a.type}</span>
        </td>
        <td style="padding:8px 12px;text-align:left;color:${a.total_debit  > 0 ? '#2d6a4f' : '#bbb'};font-weight:${a.total_debit  > 0 ? '600' : '400'}">
          ${a.total_debit  > 0 ? fmt(a.total_debit)  : '—'}
        </td>
        <td style="padding:8px 12px;text-align:left;color:${a.total_credit > 0 ? '#c0392b' : '#bbb'};font-weight:${a.total_credit > 0 ? '600' : '400'}">
          ${a.total_credit > 0 ? fmt(a.total_credit) : '—'}
        </td>
        <td style="padding:8px 12px;text-align:left;font-weight:600;color:${a.balance > 0 ? '#2d6a4f' : a.balance < 0 ? '#c0392b' : '#888'}">
          ${a.balance !== 0 ? fmt(Math.abs(a.balance)) + (a.balance < 0 ? ' <small style="color:#c0392b">(د)</small>' : ' <small style="color:#2d6a4f">(م)</small>') : '—'}
        </td>
      </tr>
    `).join('');

    const balanceAlert = balanced
      ? `<div class="alert" style="background:#d4edda;border:1px solid #27ae60;color:#155724;padding:10px 16px;border-radius:6px;font-weight:600">
           ✅ الميزان متوازن — مجموع المدين = مجموع الدائن = ${fmt(total_debit)}
         </div>`
      : `<div class="alert alert-danger" style="padding:10px 16px;font-weight:600">
           ❌ الميزان غير متوازن — المدين: ${fmt(total_debit)} | الدائن: ${fmt(total_credit)} | الفرق: ${fmt(Math.abs(total_debit - total_credit))}
         </div>`;

    c.innerHTML = `
      <div class="page-header">
        <h2>📊 ميزان المراجعة</h2>
        <span class="badge badge-secondary" style="font-size:0.8rem;padding:4px 10px">عرض فقط — لا يمكن التعديل</span>
      </div>

      ${balanceAlert}

      <div class="card" style="padding:0;overflow:hidden;margin-top:16px">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="background:#2c3e50;color:#fff">
              <th style="padding:10px 12px;text-align:right;font-weight:600">الكود</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600">الحساب</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600">النوع</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#a8e6cf">مدين</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#ffb3b3">دائن</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background:#2c3e50;color:#fff;border-top:3px solid #${balanced ? '27ae60' : 'e74c3c'}">
              <td colspan="3" style="padding:10px 12px;font-weight:700;font-size:1rem">الإجمالي</td>
              <td style="padding:10px 12px;text-align:left;font-weight:700;color:#a8e6cf;font-size:1rem">${fmt(total_debit)}</td>
              <td style="padding:10px 12px;text-align:left;font-weight:700;color:#ffb3b3;font-size:1rem">${fmt(total_credit)}</td>
              <td style="padding:10px 12px;font-weight:700;color:${balanced ? '#a8e6cf' : '#e74c3c'};font-size:1rem">
                ${balanced ? '✅ متوازن' : '⚠️ ' + fmt(Math.abs(total_debit - total_credit))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ============================================================
// General Ledger — دفتر الأستاذ (Read-only)
// ============================================================
async function loadLedger(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const tb = await api('/api/trial-balance');
    const accounts = tb.accounts || [];
    const today         = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

    c.innerHTML = `
      <div class="page-header">
        <h2>📘 دفتر الأستاذ</h2>
        <span class="badge badge-secondary" style="font-size:0.8rem;padding:4px 10px">عرض فقط — لا يمكن التعديل</span>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">الحساب</label>
            <select id="ldg-account" class="form-control" style="min-width:240px">
              <option value="">— اختر حساباً —</option>
              ${accounts.map(a =>
                `<option value="${a.code}">${a.code} — ${a.name}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">من تاريخ</label>
            <input type="date" id="ldg-from" class="form-control" value="${thirtyDaysAgo}" style="width:160px">
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">إلى تاريخ</label>
            <input type="date" id="ldg-to" class="form-control" value="${today}" style="width:160px">
          </div>
          <button class="btn btn-primary" onclick="loadLedgerData()">🔍 عرض</button>
          <button class="btn" onclick="
            document.getElementById('ldg-from').value='';
            document.getElementById('ldg-to').value='';
            loadLedgerData();
          ">↺ كل الفترات</button>
        </div>
      </div>

      <div id="ledger-results">
        <div class="alert alert-info">اختر حساباً لعرض حركاته.</div>
      </div>
    `;
  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

async function loadLedgerData() {
  const container = document.getElementById('ledger-results');
  if (!container) return;

  const code = document.getElementById('ldg-account').value;
  if (!code) {
    container.innerHTML = '<div class="alert alert-info">اختر حساباً لعرض حركاته.</div>';
    return;
  }

  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const from = document.getElementById('ldg-from').value;
    const to   = document.getElementById('ldg-to').value;
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to)   params.append('to', to);

    const data = await api(`/api/ledger/${code}?${params.toString()}`);
    const { account_name, account_type, opening_balance, entries,
            total_debit, total_credit, closing_balance } = data;

    if (!entries || entries.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:#888">
          <div style="font-size:2rem">📭</div>
          <div style="margin-top:8px">لا توجد حركات للحساب <strong>${code} — ${account_name}</strong> في الفترة المحددة.</div>
        </div>
      `;
      return;
    }

    const typeLabel = { ASSET: 'أصول', LIABILITY: 'خصوم', EQUITY: 'حقوق الملكية', REVENUE: 'إيرادات', EXPENSE: 'مصروفات' };
    const refColors = { sale: 'primary', sale_payment: 'secondary', purchase: 'warning', purchase_payment: 'info' };
    const closingColor = closing_balance >= 0 ? '#2d6a4f' : '#c0392b';
    const closingSign  = closing_balance >= 0 ? '(مدين)' : '(دائن)';

    const rows = entries.map(e => {
      const balColor = e.running_balance >= 0 ? '#2d6a4f' : '#c0392b';
      const refBadge = e.reference_type
        ? `<span class="badge badge-${refColors[e.reference_type] || 'secondary'}" style="font-size:0.7rem">${e.reference_type}</span>`
        : '';
      return `
        <tr>
          <td style="padding:7px 10px;white-space:nowrap">${e.entry_date}</td>
          <td style="padding:7px 10px;font-family:monospace;font-size:0.85rem">${e.entry_number}</td>
          <td style="padding:7px 10px">${refBadge}</td>
          <td style="padding:7px 10px;font-size:0.85rem;color:#444">${e.description || '—'}</td>
          <td style="padding:7px 10px;text-align:left;color:${e.debit  > 0 ? '#2d6a4f' : '#ccc'};font-weight:${e.debit  > 0 ? 600 : 400}">
            ${e.debit  > 0 ? fmt(e.debit)  : '—'}
          </td>
          <td style="padding:7px 10px;text-align:left;color:${e.credit > 0 ? '#c0392b' : '#ccc'};font-weight:${e.credit > 0 ? 600 : 400}">
            ${e.credit > 0 ? fmt(e.credit) : '—'}
          </td>
          <td style="padding:7px 10px;text-align:left;font-weight:700;color:${balColor}">
            ${fmt(Math.abs(e.running_balance))} <small>${e.running_balance >= 0 ? 'م' : 'د'}</small>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div class="card" style="flex:1;min-width:160px;background:#f0f8ff;border:1px solid #3498db;padding:14px 18px">
          <div style="font-size:0.78rem;color:#555;margin-bottom:4px">الرصيد الافتتاحي</div>
          <div style="font-size:1.1rem;font-weight:700;color:#2c3e50">${fmt(opening_balance)}</div>
        </div>
        <div class="card" style="flex:1;min-width:160px;background:#f0fff4;border:1px solid #2d6a4f;padding:14px 18px">
          <div style="font-size:0.78rem;color:#555;margin-bottom:4px">إجمالي المدين</div>
          <div style="font-size:1.1rem;font-weight:700;color:#2d6a4f">${fmt(total_debit)}</div>
        </div>
        <div class="card" style="flex:1;min-width:160px;background:#fff5f5;border:1px solid #c0392b;padding:14px 18px">
          <div style="font-size:0.78rem;color:#555;margin-bottom:4px">إجمالي الدائن</div>
          <div style="font-size:1.1rem;font-weight:700;color:#c0392b">${fmt(total_credit)}</div>
        </div>
        <div class="card" style="flex:1;min-width:160px;background:#fef9f0;border:2px solid #f39c12;padding:14px 18px">
          <div style="font-size:0.78rem;color:#555;margin-bottom:4px">الرصيد الختامي</div>
          <div style="font-size:1.1rem;font-weight:700;color:${closingColor}">${fmt(Math.abs(closing_balance))} <small>${closingSign}</small></div>
        </div>
      </div>

      <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-family:monospace;font-size:1.1rem;font-weight:700">${code}</span>
        <span style="font-size:1rem;font-weight:600">${account_name}</span>
        <span class="badge badge-secondary" style="font-size:0.75rem">${typeLabel[account_type] || account_type}</span>
        <span style="color:#888;font-size:0.85rem">(${entries.length} حركة)</span>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
          <thead>
            <tr style="background:#2c3e50;color:#fff">
              <th style="padding:9px 10px;text-align:right;font-weight:600">التاريخ</th>
              <th style="padding:9px 10px;text-align:right;font-weight:600">القيد</th>
              <th style="padding:9px 10px;text-align:right;font-weight:600">المرجع</th>
              <th style="padding:9px 10px;text-align:right;font-weight:600">البيان</th>
              <th style="padding:9px 10px;text-align:left;font-weight:600;color:#a8e6cf">مدين</th>
              <th style="padding:9px 10px;text-align:left;font-weight:600;color:#ffb3b3">دائن</th>
              <th style="padding:9px 10px;text-align:left;font-weight:600">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#f8f9fa;color:#888;font-style:italic">
              <td colspan="4" style="padding:7px 10px">رصيد أول المدة</td>
              <td colspan="2"></td>
              <td style="padding:7px 10px;font-weight:600;color:#2c3e50;font-style:normal">${fmt(opening_balance)}</td>
            </tr>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background:#2c3e50;color:#fff;border-top:3px solid #f39c12">
              <td colspan="4" style="padding:9px 10px;font-weight:700">الإجمالي</td>
              <td style="padding:9px 10px;text-align:left;font-weight:700;color:#a8e6cf">${fmt(total_debit)}</td>
              <td style="padding:9px 10px;text-align:left;font-weight:700;color:#ffb3b3">${fmt(total_credit)}</td>
              <td style="padding:9px 10px;font-weight:700;color:${closing_balance >= 0 ? '#a8e6cf' : '#ffb3b3'}">
                ${fmt(Math.abs(closing_balance))} <small>${closingSign}</small>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ============================================================
// Profit & Loss — قائمة الدخل (Read-only)
// ============================================================
async function loadProfitLoss(c) {
  const today         = new Date().toISOString().split('T')[0];
  const firstOfYear   = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

  c.innerHTML = `
    <div class="page-header">
      <h2>📊 قائمة الدخل</h2>
      <span class="badge badge-secondary" style="font-size:0.8rem;padding:4px 10px">عرض فقط</span>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">من تاريخ</label>
          <input type="date" id="pl-from" class="form-control" value="${firstOfYear}" style="width:160px">
        </div>
        <div>
          <label style="display:block;font-size:0.8rem;margin-bottom:4px;color:#555">إلى تاريخ</label>
          <input type="date" id="pl-to" class="form-control" value="${today}" style="width:160px">
        </div>
        <button class="btn btn-primary" onclick="loadProfitLossData()">🔍 عرض</button>
      </div>
    </div>

    <div id="pl-results">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  loadProfitLossData();
}

async function loadProfitLossData() {
  const container = document.getElementById('pl-results');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const from = document.getElementById('pl-from').value;
    const to   = document.getElementById('pl-to').value;
    if (!from || !to) { container.innerHTML = '<div class="alert alert-warning">حدد الفترة الزمنية.</div>'; return; }

    const data = await api(`/api/profit-loss?from=${from}&to=${to}`);
    const { revenue, expenses, total_revenue, total_expenses, net_profit } = data;

    const profitable = net_profit >= 0;
    const netColor   = profitable ? '#27ae60' : '#e74c3c';
    const netBg      = profitable ? '#d4edda' : '#f8d7da';
    const netBorder  = profitable ? '#27ae60' : '#e74c3c';
    const netLabel   = profitable ? '✅ ربح صافي' : '❌ خسارة صافية';

    const buildRows = (accounts, valueColor) =>
      accounts.length === 0
        ? `<tr><td colspan="2" style="padding:10px;color:#999;text-align:center;font-style:italic">لا توجد حركات في هذه الفترة</td></tr>`
        : accounts.map(a => `
            <tr style="border-bottom:1px solid #f0f0f0">
              <td style="padding:9px 14px">
                <span style="font-family:monospace;font-size:0.82rem;color:#888;margin-left:8px">${a.code}</span>
                ${a.name}
              </td>
              <td style="padding:9px 14px;text-align:left;font-weight:600;color:${valueColor}">
                ${a.value > 0 ? fmt(a.value) : '<span style="color:#bbb">—</span>'}
              </td>
            </tr>
          `).join('');

    container.innerHTML = `
      <div style="max-width:680px;margin:0 auto">

        <!-- Period header -->
        <div style="text-align:center;margin-bottom:20px;color:#555;font-size:0.9rem">
          الفترة: <strong>${from}</strong> ← <strong>${to}</strong>
        </div>

        <!-- Revenue section -->
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;border-top:4px solid #27ae60">
          <div style="background:#f0fff4;padding:12px 14px;border-bottom:1px solid #d4edda">
            <strong style="color:#2d6a4f;font-size:1rem">📈 الإيرادات</strong>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
            <tbody>${buildRows(revenue, '#2d6a4f')}</tbody>
            <tfoot>
              <tr style="background:#f0fff4;border-top:2px solid #27ae60">
                <td style="padding:11px 14px;font-weight:700;color:#2d6a4f">إجمالي الإيرادات</td>
                <td style="padding:11px 14px;text-align:left;font-weight:700;font-size:1.05rem;color:#27ae60">${fmt(total_revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Expenses section -->
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;border-top:4px solid #e74c3c">
          <div style="background:#fff5f5;padding:12px 14px;border-bottom:1px solid #f5c6cb">
            <strong style="color:#c0392b;font-size:1rem">📉 المصاريف</strong>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
            <tbody>${buildRows(expenses, '#c0392b')}</tbody>
            <tfoot>
              <tr style="background:#fff5f5;border-top:2px solid #e74c3c">
                <td style="padding:11px 14px;font-weight:700;color:#c0392b">إجمالي المصاريف</td>
                <td style="padding:11px 14px;text-align:left;font-weight:700;font-size:1.05rem;color:#e74c3c">${fmt(total_expenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Net Profit card -->
        <div style="background:${netBg};border:2px solid ${netBorder};border-radius:8px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:1.1rem;color:${netColor}">${netLabel}</strong>
          <span style="font-size:1.5rem;font-weight:700;color:${netColor}">${fmt(Math.abs(net_profit))}</span>
        </div>

      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ── Balance Sheet ────────────────────────────────────────────────────────────
async function loadBalanceSheet(c) {
  const today = new Date().toISOString().slice(0, 10);
  c.innerHTML = `
    <div class="page-header"><h1>📊 الميزانية العمومية</h1></div>
    <div class="card" style="padding:18px;margin-bottom:20px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <label style="font-weight:600">حتى تاريخ:</label>
        <input type="date" id="bs-to" value="${today}" class="form-control" style="max-width:180px">
        <button class="btn btn-primary" onclick="loadBalanceSheetData()">🔍 عرض</button>
      </div>
    </div>
    <div id="bs-results"></div>
  `;
  loadBalanceSheetData();
}

async function loadBalanceSheetData() {
  const container = document.getElementById('bs-results');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const to = document.getElementById('bs-to').value;
    if (!to) { container.innerHTML = '<div class="alert alert-warning">حدد التاريخ.</div>'; return; }

    const data = await api(`/api/balance-sheet?to=${to}`);
    const { assets, liabilities, equity, total_assets, total_liabilities, total_equity, balanced } = data;

    const badge = balanced
      ? `<span style="background:#d4edda;color:#27ae60;border:1px solid #27ae60;padding:4px 14px;border-radius:20px;font-weight:700;font-size:0.9rem">✅ متوازنة</span>`
      : `<span style="background:#f8d7da;color:#e74c3c;border:1px solid #e74c3c;padding:4px 14px;border-radius:20px;font-weight:700;font-size:0.9rem">❌ غير متوازنة</span>`;

    const buildRows = (accounts) =>
      accounts.length === 0
        ? `<tr><td colspan="2" style="padding:10px;color:#999;text-align:center;font-style:italic">لا يوجد</td></tr>`
        : accounts.map(a => `
            <tr style="border-bottom:1px solid #f0f0f0">
              <td style="padding:9px 14px">
                ${a.code !== 'NET' ? `<span style="font-family:monospace;font-size:0.82rem;color:#888;margin-left:8px">${a.code}</span>` : ''}
                ${a.name}
              </td>
              <td style="padding:9px 14px;text-align:left;font-weight:600;color:${a.balance >= 0 ? '#2c3e50' : '#e74c3c'}">
                ${fmt(a.balance)}
              </td>
            </tr>
          `).join('');

    const sectionCard = (titleAr, color, bg, border, rows, total) => `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;border-top:4px solid ${color}">
        <div style="background:${bg};padding:12px 14px;border-bottom:1px solid ${border}">
          <strong style="color:${color};font-size:1rem">${titleAr}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:${bg};border-top:2px solid ${color}">
              <td style="padding:11px 14px;font-weight:700;color:${color}">الإجمالي</td>
              <td style="padding:11px 14px;text-align:left;font-weight:700;font-size:1.05rem;color:${color}">${fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    container.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        ${badge}
        <span style="margin-right:12px;color:#666;font-size:0.9rem">حتى: <strong>${to}</strong></span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

        <!-- Column 1: Assets -->
        <div>
          <h3 style="font-size:1rem;color:#2980b9;margin-bottom:10px">الأصول</h3>
          ${sectionCard('🏦 الأصول', '#2980b9', '#ebf5fb', '#aed6f1',
              buildRows(assets), total_assets)}
        </div>

        <!-- Column 2: Liabilities + Equity -->
        <div>
          <h3 style="font-size:1rem;color:#8e44ad;margin-bottom:10px">الخصوم وحقوق الملكية</h3>
          ${sectionCard('📋 الخصوم', '#e74c3c', '#fff5f5', '#f5c6cb',
              buildRows(liabilities), total_liabilities)}
          ${sectionCard('💼 حقوق الملكية', '#8e44ad', '#f9f0ff', '#d7bde2',
              buildRows(equity), total_equity)}
          <div style="background:#f8f9fa;border:2px solid #aaa;border-radius:8px;padding:14px 18px;
                      display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <strong style="color:#333">إجمالي الخصوم + حقوق الملكية</strong>
            <strong style="font-size:1.1rem;color:#2c3e50">${fmt(total_liabilities + total_equity)}</strong>
          </div>
        </div>

      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ============================================================
// MANUFACTURING ENGINE — ERP-v8
// ============================================================

const JAAB_KG = 26; // 1 jaab bag = 26 KG

function mfgStatusBadge(status) {
  return status === 'closed'
    ? '<span class="badge badge-danger">مغلقة</span>'
    : '<span class="badge badge-success">مفتوحة</span>';
}

// ── Page: Batches List ──────────────────────────────────────
async function loadMfgBatches(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const batches = await api('/api/manufacturing/batches');
    c.innerHTML = `
      <div class="page-header">
        <h2>📦 الدُفعات الإنتاجية</h2>
        <button class="btn btn-success" onclick="nav('mfg-new')">➕ إنشاء دفعة</button>
      </div>
      ${batches.length === 0
        ? '<div class="alert alert-warning">لا توجد دفعات بعد. ابدأ بإنشاء دفعة جديدة.</div>'
        : `<div class="table-container"><table><thead><tr>
            <th>كود الدفعة</th>
            <th>الكمية (KG)</th>
            <th>التكلفة المباشرة</th>
            <th>الأعباء المخصصة</th>
            <th>التكلفة الكاملة</th>
            <th>الحالة</th>
            <th>تاريخ الإنشاء</th>
          </tr></thead><tbody>
          ${batches.map(b => `<tr style="cursor:pointer" onclick="window._mfgBatchId=${b.id};nav('mfg-batch-detail')">
            <td class="font-bold">${b.batch_code}</td>
            <td>${(+b.total_produced_kg).toLocaleString('ar-MA')}</td>
            <td>${fmt(b.total_direct_cost)}</td>
            <td>${fmt(b.overhead_allocated)}</td>
            <td>${fmt(b.full_cost)}</td>
            <td>${mfgStatusBadge(b.status)}</td>
            <td>${fmtDate(b.created_at)}</td>
          </tr>`).join('')}
          </tbody></table></div>`
      }`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ── Page: Batch Detail ──────────────────────────────────────
async function loadMfgBatchDetail(c) {
  const id = window._mfgBatchId;
  if (!id) return nav('mfg-batches');
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const b = await api(`/api/manufacturing/batches/${id}`);
    const closable = b.status === 'open' && b.total_produced_kg > 0;
    c.innerHTML = `
      <div class="page-header">
        <h2>📋 تفاصيل الدفعة: ${b.batch_code}</h2>
        <div style="display:flex;gap:8px">
          ${closable ? `<button class="btn btn-success" onclick="closeMfgBatch(${b.id})">🔒 إغلاق الدفعة</button>` : ''}
          <button class="btn" onclick="nav('mfg-batches')">← العودة</button>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><h3>⚖️ إجمالي الإنتاج</h3><div class="value">${(+b.total_produced_kg).toLocaleString('ar-MA')} KG</div></div>
        <div class="stat-card warning"><h3>📦 أكياس جعاب (نظرية)</h3><div class="value">${(+b.theoretical_jaab_bags).toLocaleString('ar-MA')}</div></div>
        <div class="stat-card"><h3>🧱 تكلفة المواد</h3><div class="value">${fmt(b.direct_material_cost)}</div></div>
        <div class="stat-card"><h3>👷 تكلفة العمل</h3><div class="value">${fmt(b.direct_labor_cost)}</div></div>
        <div class="stat-card"><h3>📦 تكلفة الجعاب</h3><div class="value">${fmt(b.jaab_cost)}</div></div>
        <div class="stat-card warning"><h3>📊 التكلفة المباشرة</h3><div class="value">${fmt(b.total_direct_cost)}</div></div>
        <div class="stat-card"><h3>🏗️ الأعباء العامة</h3><div class="value">${fmt(b.overhead_allocated)}</div></div>
        <div class="stat-card success"><h3>💰 التكلفة الكاملة</h3><div class="value">${fmt(b.full_cost)}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div class="card">
          <h3 style="margin-bottom:12px">👷 قيود الإنتاج (${b.entries.length})</h3>
          ${b.entries.length === 0 ? '<p style="color:#9ca3af">لا توجد قيود بعد</p>' :
            `<table><thead><tr><th>الصانع</th><th>KG</th><th>السعر/KG</th><th>تكلفة العمل</th><th>التاريخ</th></tr></thead>
            <tbody>${b.entries.map(e => `<tr>
              <td>${e.artisan_name || (e.artisan_id ? '#'+e.artisan_id : '—')}</td>
              <td>${(+e.produced_kg).toLocaleString('ar-MA')}</td>
              <td>${fmt(e.labor_rate_per_kg)}</td>
              <td>${fmt(e.labor_cost)}</td>
              <td>${fmtDate(e.created_at)}</td>
            </tr>`).join('')}</tbody></table>`}
        </div>
        <div class="card">
          <h3 style="margin-bottom:12px">🧱 المواد المستهلكة (${b.materials.length})</h3>
          ${b.materials.length === 0 ? '<p style="color:#9ca3af">لا توجد مواد مسجلة</p>' :
            `<table><thead><tr><th>المادة</th><th>الكمية</th><th>التكلفة</th></tr></thead>
            <tbody>${b.materials.map(m => `<tr>
              <td>${m.material_name || '—'}</td>
              <td>${(+m.quantity_used).toLocaleString('ar-MA')} ${m.material_unit||''}</td>
              <td>${fmt(m.cost_used)}</td>
            </tr>`).join('')}</tbody></table>`}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div style="display:flex;gap:8px;align-items:center">
          <span>${mfgStatusBadge(b.status)}</span>
          ${b.closed_at ? `<span style="color:#6b7280;font-size:0.9rem">أُغلقت في ${fmtDate(b.closed_at)}</span>` : ''}
        </div>
      </div>`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.closeMfgBatch = async (id) => {
  if (!confirm('إغلاق الدفعة وتخصيص الأعباء العامة؟')) return;
  try {
    const r = await api(`/api/manufacturing/batches/${id}/close`, { method: 'POST', body: JSON.stringify({}) });
    toast(`تم الإغلاق — تكلفة كاملة: ${fmt(r.full_cost)}`);
    nav('mfg-batch-detail');
  } catch(e) { toast(e.message, 'danger'); }
};

// ── Page: Create New Batch ──────────────────────────────────
async function loadMfgNew(c) {
  c.innerHTML = `
    <div class="page-header"><h2>➕ إنشاء دفعة إنتاجية</h2></div>
    <div class="card" style="max-width:500px">
      <div class="alert alert-info" style="margin-bottom:16px">🏭 الإنتاج مخصص لفرع <strong>الجملة</strong> فقط.</div>
      <form id="mfg-new-form">
        <div class="form-group">
          <label class="required">كود الدفعة</label>
          <input name="batch_code" required placeholder="مثال: BATCH-2026-001">
        </div>
        <button type="submit" class="btn btn-success">💾 إنشاء الدفعة</button>
        <button type="button" class="btn" onclick="nav('mfg-batches')" style="margin-right:8px">إلغاء</button>
      </form>
    </div>`;
  document.getElementById('mfg-new-form').onsubmit = async (e) => {
    e.preventDefault();
    const batch_code = new FormData(e.target).get('batch_code').trim();
    if (!batch_code) return toast('كود الدفعة مطلوب', 'danger');
    try {
      const r = await api('/api/manufacturing/batches', { method: 'POST', body: JSON.stringify({ batch_code }) });
      toast(`تم إنشاء الدفعة: ${r.batch_code}`);
      window._mfgBatchId = r.id;
      nav('mfg-batch-detail');
    } catch(e) { toast(e.message, 'danger'); }
  };
}

// ── Page: Add Production Entry ──────────────────────────────
async function loadMfgEntries(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const batches = await api('/api/manufacturing/batches');
    const openBatches = batches.filter(b => b.status === 'open');

    c.innerHTML = `
      <div class="page-header"><h2>👷 إدخال إنتاج</h2></div>
      ${openBatches.length === 0
        ? '<div class="alert alert-warning">لا توجد دفعات مفتوحة. أنشئ دفعة جديدة أولاً.</div>'
        : `<div class="card" style="max-width:560px">
          <form id="mfg-entry-form">
            <div class="form-group">
              <label class="required">الدفعة</label>
              <select name="batch_id" required>
                <option value="">— اختر الدفعة —</option>
                ${openBatches.map(b => `<option value="${b.id}">${b.batch_code} (${(+b.total_produced_kg).toLocaleString('ar-MA')} KG)</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>رقم الصانع (اختياري)</label>
              <input name="artisan_id" type="number" placeholder="رقم الصانع">
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="required">الكمية المنتجة (KG)</label>
                <input name="produced_kg" type="number" step="0.01" min="0.01" required placeholder="0.00"
                  oninput="updateMfgCalc()">
              </div>
              <div class="form-group">
                <label>سعر العمل / KG</label>
                <input name="labor_rate_per_kg" type="number" step="0.01" min="0" value="0" placeholder="0.00"
                  oninput="updateMfgCalc()">
              </div>
            </div>
            <div class="card" id="mfg-calc-preview" style="background:#f0fdf4;border:1px solid #bbf7d0;margin-bottom:16px;display:none">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.9rem">
                <div>💰 <strong>تكلفة العمل:</strong> <span id="calc-labor">—</span></div>
                <div>📦 <strong>أكياس جعاب (نظرية):</strong> <span id="calc-jaab">—</span></div>
              </div>
            </div>
            <button type="submit" class="btn btn-success">✅ تسجيل الإنتاج</button>
          </form>
        </div>
        <div id="mfg-entry-result"></div>`
      }`;

    if (openBatches.length > 0) {
      document.getElementById('mfg-entry-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const batch_id      = fd.get('batch_id');
        const artisan_id    = fd.get('artisan_id') ? Number(fd.get('artisan_id')) : null;
        const produced_kg   = parseFloat(fd.get('produced_kg'));
        const labor_rate_per_kg = parseFloat(fd.get('labor_rate_per_kg') || 0);
        if (!batch_id) return toast('اختر دفعة', 'danger');
        try {
          const r = await api(`/api/manufacturing/batches/${batch_id}/entries`, {
            method: 'POST',
            body: JSON.stringify({ artisan_id, produced_kg, labor_rate_per_kg })
          });
          toast('تم تسجيل الإنتاج');
          document.getElementById('mfg-entry-result').innerHTML = `
            <div class="card" style="margin-top:16px;background:#f0fdf4;border:1px solid #bbf7d0">
              <h3 style="margin-bottom:12px">✅ نتيجة التسجيل</h3>
              <div class="stats-grid">
                <div class="stat-card success"><h3>💰 تكلفة العمل</h3><div class="value">${fmt(r.labor_cost)}</div></div>
                <div class="stat-card warning"><h3>📦 أكياس جعاب (نظرية)</h3><div class="value">${r.jaab_bags_theoretical}</div></div>
                <div class="stat-card"><h3>⚖️ إجمالي إنتاج الدفعة</h3><div class="value">${(+r.batch.total_produced_kg).toLocaleString('ar-MA')} KG</div></div>
                <div class="stat-card warning"><h3>📊 التكلفة المباشرة</h3><div class="value">${fmt(r.batch.total_direct_cost)}</div></div>
              </div>
            </div>`;
          e.target.reset();
          document.getElementById('mfg-calc-preview').style.display = 'none';
        } catch(err) { toast(err.message, 'danger'); }
      };
    }
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

window.updateMfgCalc = () => {
  const kg   = parseFloat(document.querySelector('[name=produced_kg]')?.value) || 0;
  const rate = parseFloat(document.querySelector('[name=labor_rate_per_kg]')?.value) || 0;
  const prev = document.getElementById('mfg-calc-preview');
  if (!prev) return;
  if (kg > 0) {
    document.getElementById('calc-labor').textContent = fmt(kg * rate);
    document.getElementById('calc-jaab').textContent  = (kg / JAAB_KG).toFixed(4) + ' كيس';
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
};

// ── Page: Cost Analysis ─────────────────────────────────────
async function loadMfgCostAnalysis(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('/api/manufacturing/cost-analysis');
    const s = data.summary;
    c.innerHTML = `
      <div class="page-header"><h2>📊 تحليل التكلفة الإنتاجية</h2></div>
      <div class="stats-grid">
        <div class="stat-card"><h3>🏭 عدد الدفعات</h3><div class="value">${s.total_batches}</div></div>
        <div class="stat-card success"><h3>⚖️ إجمالي الإنتاج (KG)</h3><div class="value">${(+s.total_produced_kg).toLocaleString('ar-MA')}</div></div>
        <div class="stat-card"><h3>🧱 تكلفة المواد</h3><div class="value">${fmt(s.total_material_cost)}</div></div>
        <div class="stat-card"><h3>👷 تكلفة العمل</h3><div class="value">${fmt(s.total_labor_cost)}</div></div>
        <div class="stat-card warning"><h3>📦 تكلفة الجعاب</h3><div class="value">${fmt(s.total_jaab_cost)}</div></div>
        <div class="stat-card warning"><h3>🏗️ الأعباء العامة</h3><div class="value">${fmt(s.total_overhead)}</div></div>
        <div class="stat-card success"><h3>💰 التكلفة الكاملة</h3><div class="value">${fmt(s.total_full_cost)}</div></div>
      </div>
      ${data.batches.length === 0 ? '' : `
      <div class="table-container" style="margin-top:16px">
        <table><thead><tr>
          <th>كود الدفعة</th><th>KG</th>
          <th>مواد</th><th>عمل</th><th>جعاب</th>
          <th>مباشر</th><th>أعباء</th><th>كاملة</th>
          <th>تكلفة/KG</th><th>الحالة</th>
        </tr></thead><tbody>
        ${data.batches.map(b => `<tr style="cursor:pointer" onclick="window._mfgBatchId=${b.id};nav('mfg-batch-detail')">
          <td class="font-bold">${b.batch_code}</td>
          <td>${(+b.total_produced_kg).toLocaleString('ar-MA')}</td>
          <td>${fmt(b.direct_material_cost)}</td>
          <td>${fmt(b.direct_labor_cost)}</td>
          <td>${fmt(b.jaab_cost)}</td>
          <td>${fmt(b.total_direct_cost)}</td>
          <td>${fmt(b.overhead_allocated)}</td>
          <td>${fmt(b.full_cost)}</td>
          <td><strong>${fmt(b.cost_per_kg)}</strong></td>
          <td>${mfgStatusBadge(b.status)}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>`}`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ── Page: Jaab Efficiency ───────────────────────────────────
async function loadMfgJaabEfficiency(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('/api/manufacturing/jaab-efficiency');
    c.innerHTML = `
      <div class="page-header"><h2>📦 كفاءة الجعاب</h2></div>
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
          <div>📏 <strong>معيار الجعاب:</strong> ${data.jaab_kg_per_bag} KG / كيس</div>
          ${data.jaab_inventory.length > 0
            ? data.jaab_inventory.map(j =>
                `<div>📦 <strong>${j.product_name}:</strong> ${(+j.quantity).toLocaleString('ar-MA')} كيس | تكلفة وحدة: ${fmt(j.unit_cost)}</div>`
              ).join('')
            : '<div class="badge badge-warning">⚠️ لم يتم تحديد مخزون جعاب</div>'}
        </div>
      </div>
      ${data.batches.length === 0
        ? '<div class="alert alert-warning">لا توجد دفعات إنتاجية مسجلة.</div>'
        : `<div class="table-container">
          <table><thead><tr>
            <th>كود الدفعة</th>
            <th>KG</th>
            <th>أكياس جعاب (نظرية)</th>
            <th>أكياس جعاب (فعلية)</th>
            <th>انحراف %</th>
            <th>مراجعة؟</th>
          </tr></thead><tbody>
          ${data.batches.map(b => {
            const rowStyle = b.needs_review ? 'background:#fff5f5' : '';
            return `<tr style="${rowStyle};cursor:pointer" onclick="window._mfgBatchId=${b.batch_id};nav('mfg-batch-detail')">
              <td class="font-bold">${b.batch_code}</td>
              <td>${(+b.total_produced_kg).toLocaleString('ar-MA')}</td>
              <td>${b.theoretical_jaab_bags}</td>
              <td>${b.actual_jaab_bags_equiv !== null ? b.actual_jaab_bags_equiv : '—'}</td>
              <td>${b.deviation_pct !== null
                    ? `<span style="color:${Math.abs(b.deviation_pct)>5?'#dc2626':'#16a34a'}">${b.deviation_pct > 0 ? '+' : ''}${b.deviation_pct}%</span>`
                    : '—'}</td>
              <td>${b.needs_review
                    ? `<span class="badge badge-danger">⚠️ مراجعة</span><br><small style="color:#9ca3af">${b.suggestion||''}</small>`
                    : '<span class="badge badge-success">✅ طبيعي</span>'}</td>
            </tr>`;
          }).join('')}
          </tbody></table>
        </div>`}`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// ERP-v9: COLOR FAMILIES PAGE
// ============================================================
// ============================================================
// ERP-v9: COLOR FAMILIES — accordion with lazy-loaded shades
// ============================================================
async function loadColorFamilies(c) {
  c.innerHTML = `<div style="padding:2rem;text-align:center;color:#94a3b8;
    font-family:'Cairo',sans-serif">⏳ جاري التحميل...</div>`;
  try {
    // Load families + colors in parallel; group colors by family_id for counts
    const [families, allColors, suppliers] = await Promise.all([
      api('/api/color-families'),
      api('/api/color-master'),
      api('/api/suppliers').catch(() => [])
    ]);

    // Shade count per family
    const countMap = {};
    allColors.forEach(col => {
      if (col.family_id) countMap[col.family_id] = (countMap[col.family_id] || 0) + 1;
    });

    // State
    window._cfExpanded = window._cfExpanded || {};
    window._cfShades   = {};           // lazy-loaded shades: { familyId: [] }
    window._cfFamilies = families;
    window._cfAllColors = allColors;

    // ── Family icon (cycles through palette) ──────────────────
    const ICONS = ['🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🩷','🩵','🩶','🌸','🍋','🍀'];
    const familyIcon = f => ICONS[f.id % ICONS.length];

    // ── Render shade row ──────────────────────────────────────
    function shadeRow(s, rowBg) {
      return `
        <tr style="background:${rowBg};border-bottom:1px solid #f1f5f9;transition:background .1s"
            onmouseover="this.style.background='#EFF6FF'"
            onmouseout="this.style.background='${rowBg}'">
          <td style="padding:.45rem .75rem;text-align:center">
            <div style="width:26px;height:26px;border-radius:5px;display:inline-block;
                        background:${s.hex_code||'#e2e8f0'};border:1.5px solid #e2e8f0;
                        box-shadow:0 1px 3px rgba(0,0,0,.1)"
                 title="${s.hex_code||'بدون لون'}"></div>
          </td>
          <td style="padding:.45rem .75rem;font-family:monospace;font-size:.78rem;
                     font-weight:700;color:#1e293b;letter-spacing:.03em">${s.supplier_color_code}</td>
          <td style="padding:.45rem .75rem;font-weight:600;color:#1e293b;
                     font-family:'Cairo',sans-serif">${s.internal_ar_name}</td>
          <td style="padding:.45rem .75rem;color:#64748b;font-size:.8rem;
                     font-family:'Cairo',sans-serif">${s.shade_note||'—'}</td>
          <td style="padding:.45rem .75rem;text-align:center;color:#cbd5e1;font-size:.8rem"
              title="غير متوفر من الـ API الحالي">—</td>
          <td style="padding:.45rem .75rem;text-align:center;color:#cbd5e1;font-size:.8rem"
              title="غير متوفر من الـ API الحالي">—</td>
          <td style="padding:.45rem .75rem;text-align:center">
            <button onclick="window._cfEditShade(${s.id})"
              style="padding:.25rem .55rem;font-size:.72rem;border:1px solid #e2e8f0;
                     background:#fff;border-radius:5px;cursor:pointer;color:#475569;
                     font-family:'Cairo',sans-serif">تعديل</button>
          </td>
        </tr>`;
    }

    // ── Render shades panel ───────────────────────────────────
    function shadesPanel(familyId, shades) {
      const inner = shades.length === 0
        ? `<div style="padding:1rem 0;text-align:center;color:#94a3b8;font-size:.85rem;
                       font-family:'Cairo',sans-serif">لا توجد درجات لهذه العائلة بعد.</div>`
        : `<div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.855rem;
                          font-family:'Cairo',sans-serif;direction:rtl">
              <thead>
                <tr style="background:#1E3A5F">
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:center;
                             width:36px">اللون</th>
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:right">الكود</th>
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:right">الاسم</th>
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:right">الدرجة</th>
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:center"
                      title="عدد البوبينات الخام — غير متوفر حالياً">البوبينات ⓘ</th>
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:center"
                      title="KG المتاح — غير متوفر حالياً">متاح KG ⓘ</th>
                  <th style="padding:.55rem .75rem;color:rgba(255,255,255,.85);
                             font-size:.77rem;font-weight:600;text-align:center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${shades.map((s, i) => shadeRow(s, i % 2 === 0 ? '#fff' : '#F8FAFC')).join('')}
              </tbody>
            </table>
           </div>`;
      return `
        <div style="border-top:1px solid #e8ecf0;padding:.85rem 1.1rem .75rem">
          ${inner}
          <button onclick="window._cfAddShade(${familyId})"
            style="display:block;width:100%;margin-top:.65rem;padding:.45rem;
                   border:1.5px dashed #bfdbfe;border-radius:8px;background:#EFF6FF;
                   color:#2563eb;cursor:pointer;font-size:.82rem;
                   font-family:'Cairo',sans-serif;font-weight:600;transition:all .15s"
            onmouseover="this.style.background='#dbeafe'"
            onmouseout="this.style.background='#EFF6FF'">
            ＋ إضافة درجة لون لهذه العائلة
          </button>
        </div>`;
    }

    // ── Render a single family card ───────────────────────────
    function renderCard(f) {
      const count      = countMap[f.id] || 0;
      const expanded   = !!window._cfExpanded[f.id];
      const shades     = window._cfShades[f.id] || [];
      const safeNameJS = f.family_name_ar.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return `
        <div id="cf-card-${f.id}"
          style="background:#fff;border-radius:12px;border:1px solid #e8ecf0;
                 box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden">

          <!-- ─ Family header ──────────────────── -->
          <div onclick="window._cfToggle(${f.id})"
            style="display:flex;align-items:center;gap:.75rem;padding:1rem 1.1rem;
                   cursor:pointer;user-select:none;
                   background:${expanded ? '#F8FAFC' : '#fff'};
                   border-bottom:${expanded ? '1px solid #e8ecf0' : 'none'};
                   transition:background .15s"
            onmouseover="this.style.background='#F1F5F9'"
            onmouseout="this.style.background='${expanded ? '#F8FAFC' : '#fff'}'">

            <!-- icon -->
            <span style="font-size:1.5rem;flex-shrink:0">${familyIcon(f)}</span>

            <!-- name + meta -->
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.95rem;color:#0f172a;
                          font-family:'Cairo',sans-serif">${f.family_name_ar}</div>
              <div style="margin-top:.2rem;display:flex;gap:.4rem;align-items:center;
                          flex-wrap:wrap">
                <span style="background:${count > 0 ? '#dbeafe' : '#f1f5f9'};
                             color:${count > 0 ? '#1d4ed8' : '#94a3b8'};
                             font-size:.7rem;font-weight:700;padding:.15rem .55rem;
                             border-radius:99px;font-family:'Cairo',sans-serif">
                  ${count} درجة
                </span>
                <span style="font-size:.7rem;padding:.15rem .55rem;border-radius:99px;
                             font-weight:600;font-family:'Cairo',sans-serif;
                             background:${f.active ? '#dcfce7' : '#fef9c3'};
                             color:${f.active ? '#166534' : '#854d0e'}">
                  ${f.active ? '✓ نشطة' : '— مخفية'}
                </span>
              </div>
            </div>

            <!-- action buttons (stop propagation) -->
            <div style="display:flex;gap:.4rem;flex-shrink:0" onclick="event.stopPropagation()">
              <button onclick="window._cfEdit(${f.id},'${safeNameJS}',${f.display_order},${f.active})"
                style="padding:.3rem .6rem;font-size:.75rem;border:1px solid #e2e8f0;
                       background:#fff;border-radius:7px;cursor:pointer;color:#374151;
                       font-family:'Cairo',sans-serif;font-weight:600">تعديل</button>
              <button onclick="window._cfDelete(${f.id})"
                style="padding:.3rem .6rem;font-size:.75rem;border:1px solid #fecaca;
                       background:#fff;border-radius:7px;cursor:pointer;color:#dc2626;
                       font-family:'Cairo',sans-serif;font-weight:600">حذف</button>
            </div>

            <!-- chevron -->
            <span style="color:#94a3b8;font-size:.85rem;flex-shrink:0;
                         transition:transform .2s;
                         transform:${expanded ? 'rotate(180deg)' : 'rotate(0)'}">▼</span>
          </div>

          <!-- ─ Shades panel (only when expanded) ─ -->
          ${expanded ? shadesPanel(f.id, shades) : ''}
        </div>`;
    }

    // ── Full page render ──────────────────────────────────────
    function renderAll() {
      c.innerHTML = `
        <div style="background:#F8FAFC;min-height:100%;padding:1.5rem;
                    font-family:'Cairo',sans-serif;direction:rtl">

          <!-- Header -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;
                      margin-bottom:1.5rem">
            <div>
              <h2 style="margin:0;font-size:1.125rem;font-weight:700;color:#0f172a;
                         font-family:'Cairo',sans-serif">🎨 عائلات الألوان</h2>
              <p style="margin:.25rem 0 0;font-size:.84rem;color:#64748b;
                        font-family:'Cairo',sans-serif">
                ${families.length} عائلة &nbsp;·&nbsp; ${allColors.length} درجة إجمالاً
              </p>
            </div>
            <button onclick="window._cfShowAdd()"
              style="padding:.5rem 1.1rem;background:#2563eb;color:#fff;border:none;
                     border-radius:9px;cursor:pointer;font-size:.875rem;font-weight:700;
                     font-family:'Cairo',sans-serif;box-shadow:0 2px 6px rgba(37,99,235,.35);
                     transition:all .15s"
              onmouseover="this.style.background='#1d4ed8'"
              onmouseout="this.style.background='#2563eb'">+ إضافة عائلة</button>
          </div>

          <!-- Accordion list -->
          <div style="display:flex;flex-direction:column;gap:.75rem">
            ${families.length === 0
              ? `<div style="text-align:center;padding:4rem;color:#94a3b8;
                             font-family:'Cairo',sans-serif;font-size:.9rem">
                   <div style="font-size:3rem;margin-bottom:.75rem;opacity:.4">🎨</div>
                   لا توجد عائلات ألوان بعد. أضف العائلة الأولى.
                 </div>`
              : families.map(renderCard).join('')}
          </div>
        </div>`;
    }

    // ── Toggle family expand/collapse ─────────────────────────
    window._cfToggle = async (id) => {
      const opening = !window._cfExpanded[id];
      window._cfExpanded[id] = opening;
      // Lazy-load shades on first open
      if (opening && !window._cfShades[id]) {
        const card = document.getElementById('cf-card-' + id);
        if (card) {
          const chevron = card.querySelector('span[style*="rotate"]');
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
        try {
          window._cfShades[id] = await api('/api/color-master?family_id=' + id);
        } catch(_) { window._cfShades[id] = []; }
      }
      // Re-render just the one card
      const card = document.getElementById('cf-card-' + id);
      if (card) {
        const fam = window._cfFamilies.find(f => f.id === id);
        if (fam) {
          const tmp = document.createElement('div');
          tmp.innerHTML = renderCard(fam);
          card.replaceWith(tmp.firstElementChild);
        }
      }
    };

    // ── Add family ────────────────────────────────────────────
    window._cfShowAdd = () => {
      modal('إضافة عائلة جديدة', `
        <div class="form-group">
          <label>اسم العائلة بالعربية <span style="color:red">*</span></label>
          <input id="cf-name" class="form-control" placeholder="مثال: أحمر، أزرق، أصفر..." />
        </div>
        <div class="form-group">
          <label>الترتيب</label>
          <input id="cf-order" class="form-control" type="number" value="0" />
        </div>
        <button class="btn btn-primary" onclick="window._cfDoAdd()">حفظ</button>`);
      window._cfDoAdd = async () => {
        const name = document.getElementById('cf-name').value.trim();
        if (!name) return toast('أدخل اسم العائلة', 'error');
        try {
          await api('/api/color-families', {method:'POST', body: JSON.stringify({
            family_name_ar: name,
            display_order: parseInt(document.getElementById('cf-order').value) || 0
          })});
          toast('تمت الإضافة بنجاح');
          document.getElementById('modal-container').innerHTML = '';
          loadColorFamilies(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Edit family ───────────────────────────────────────────
    window._cfEdit = (id, name, order, active) => {
      modal('تعديل عائلة', `
        <div class="form-group">
          <label>الاسم</label>
          <input id="ef-name" class="form-control" value="${name}" />
        </div>
        <div class="form-group">
          <label>الترتيب</label>
          <input id="ef-order" class="form-control" type="number" value="${order}" />
        </div>
        <div class="form-group">
          <label>نشطة</label>
          <select id="ef-active" class="form-control">
            <option value="1" ${active ? 'selected' : ''}>نعم</option>
            <option value="0" ${!active ? 'selected' : ''}>لا</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="window._cfDoEdit(${id})">حفظ التعديل</button>`);
      window._cfDoEdit = async (fid) => {
        try {
          await api('/api/color-families/' + fid, {method:'PUT', body: JSON.stringify({
            family_name_ar: document.getElementById('ef-name').value.trim(),
            display_order:  parseInt(document.getElementById('ef-order').value) || 0,
            active:         parseInt(document.getElementById('ef-active').value)
          })});
          toast('تم التحديث');
          document.getElementById('modal-container').innerHTML = '';
          loadColorFamilies(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Delete family ─────────────────────────────────────────
    window._cfDelete = async (id) => {
      if (!confirm('حذف هذه العائلة؟ تأكد أنه لا توجد درجات مرتبطة بها.')) return;
      try {
        await api('/api/color-families/' + id, {method:'DELETE'});
        toast('تم الحذف');
        loadColorFamilies(c);
      } catch(e) { toast(e.message, 'error'); }
    };

    // ── Add shade (reuses loadColorMaster modal with family pre-set) ──
    window._cfAddShade = (familyId) => {
      // Build family & supplier options from cached data
      const famOpts = window._cfFamilies.map(f =>
        `<option value="${f.id}" ${f.id === familyId ? 'selected' : ''}>${f.family_name_ar}</option>`
      ).join('');
      modal('إضافة درجة لون', `
        <div class="form-group">
          <label>كود المورد <span style="color:red">*</span></label>
          <input id="ns-code" class="form-control" placeholder="مثال: BM101" />
        </div>
        <div class="form-group">
          <label>الاسم العربي <span style="color:red">*</span></label>
          <input id="ns-name" class="form-control" placeholder="مثال: أحمر فاتح" />
        </div>
        <div class="form-group">
          <label>ملاحظة الدرجة</label>
          <input id="ns-shade" class="form-control" placeholder="مثال: فاتح جداً" />
        </div>
        <div class="form-group">
          <label>العائلة</label>
          <select id="ns-fam" class="form-control">
            <option value="">-- بدون --</option>${famOpts}
          </select>
        </div>
        <div class="form-group">
          <label>لون HEX</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="ns-hex" type="color" value="#ffffff"
              style="width:60px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px"
              oninput="document.getElementById('ns-hex-prev').style.background=this.value" />
            <div id="ns-hex-prev" style="width:38px;height:38px;border-radius:5px;
                 border:1px solid #ccc;background:#ffffff"></div>
            <small style="color:#6b7280">اختر اللون</small>
          </div>
        </div>
        <button class="btn btn-primary" onclick="window._cfDoAddShade()">حفظ</button>`);
      window._cfDoAddShade = async () => {
        const body = {
          supplier_color_code: document.getElementById('ns-code').value.trim(),
          internal_ar_name:    document.getElementById('ns-name').value.trim(),
          shade_note:          document.getElementById('ns-shade').value.trim() || null,
          family_id:           document.getElementById('ns-fam').value || null,
          hex_code:            document.getElementById('ns-hex').value
        };
        if (!body.supplier_color_code || !body.internal_ar_name)
          return toast('كود ونوع اللون مطلوبان', 'error');
        try {
          await api('/api/color-master', {method:'POST', body: JSON.stringify(body)});
          toast('تمت إضافة الدرجة');
          document.getElementById('modal-container').innerHTML = '';
          // Invalidate shades cache for this family and reload
          delete window._cfShades[familyId];
          loadColorFamilies(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Edit shade from within families page ──────────────────
    window._cfEditShade = (shadeId) => {
      // Find the shade in our cached colors
      const s = window._cfAllColors.find(x => x.id === shadeId);
      if (!s) return toast('لم يُعثر على بيانات اللون', 'error');
      const famOpts = window._cfFamilies.map(f =>
        `<option value="${f.id}" ${f.id === s.family_id ? 'selected' : ''}>${f.family_name_ar}</option>`
      ).join('');
      modal('تعديل درجة اللون', `
        <div class="form-group">
          <label>الاسم العربي</label>
          <input id="es-name" class="form-control" value="${s.internal_ar_name}" />
        </div>
        <div class="form-group">
          <label>كود المورد</label>
          <input id="es-code" class="form-control" value="${s.supplier_color_code}" />
        </div>
        <div class="form-group">
          <label>ملاحظة الدرجة</label>
          <input id="es-shade" class="form-control" value="${s.shade_note||''}" />
        </div>
        <div class="form-group">
          <label>العائلة</label>
          <select id="es-fam" class="form-control">
            <option value="">-- بدون --</option>${famOpts}
          </select>
        </div>
        <div class="form-group">
          <label>لون HEX</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="es-hex" type="color" value="${s.hex_code||'#ffffff'}"
              style="width:60px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px"
              oninput="document.getElementById('es-hex-prev').style.background=this.value" />
            <div id="es-hex-prev" style="width:38px;height:38px;border-radius:5px;
                 border:1px solid #ccc;background:${s.hex_code||'#ffffff'}"></div>
          </div>
        </div>
        <div class="form-group">
          <label>نشط</label>
          <select id="es-active" class="form-control">
            <option value="1" ${s.active ? 'selected' : ''}>نعم</option>
            <option value="0" ${!s.active ? 'selected' : ''}>لا</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="window._cfDoEditShade(${shadeId})">حفظ</button>`);
      window._cfDoEditShade = async (sid) => {
        try {
          await api('/api/color-master/' + sid, {method:'PUT', body: JSON.stringify({
            internal_ar_name:    document.getElementById('es-name').value.trim(),
            supplier_color_code: document.getElementById('es-code').value.trim(),
            shade_note:          document.getElementById('es-shade').value.trim() || null,
            family_id:           document.getElementById('es-fam').value || null,
            hex_code:            document.getElementById('es-hex').value,
            active:              parseInt(document.getElementById('es-active').value)
          })});
          toast('تم التحديث');
          document.getElementById('modal-container').innerHTML = '';
          // Clear caches and reload
          window._cfShades = {};
          loadColorFamilies(c);
        } catch(e) { toast(e.message, 'error'); }
      };
    };

    // ── Initial render ────────────────────────────────────────
    renderAll();

  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger" style="margin:1rem">${e.message}</div>`;
  }
}

// ============================================================
// ERP-v9: COLOR MASTER PAGE
// ============================================================
async function loadColorMaster(c) {
  c.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const [colors, families, suppliers] = await Promise.all([
      api('/api/color-master'),
      api('/api/color-families'),
      api('/api/suppliers')
    ]);

    const famOpts = families.map(f => `<option value="${f.id}">${f.family_name_ar}</option>`).join('');
    const supOpts = `<option value="">-- بدون مورد --</option>` + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    c.innerHTML = `
      <div class="page-header"><h2>🖌️ كتالوج الألوان</h2>
        <div style="display:flex;gap:.5rem">
          <input id="cm-search" class="form-control" placeholder="بحث..." style="width:200px" oninput="window._filterColors()" />
          <button class="btn btn-primary" onclick="window._showAddColor()">+ إضافة لون</button>
        </div>
      </div>
      <div id="cm-list">
        ${_renderColorMasterTable(colors)}
      </div>`;

    window._allColors = colors;
    window._cmFamOpts = famOpts;
    window._cmSupOpts = supOpts;
    window._cmContainer = c;

    window._filterColors = async () => {
      const q = document.getElementById('cm-search').value.trim();
      const filtered = await api('/api/color-master' + (q ? '?q='+encodeURIComponent(q) : ''));
      document.getElementById('cm-list').innerHTML = _renderColorMasterTable(filtered);
    };

    window._showAddColor = () => {
      modal('إضافة لون جديد', `
        <div class="form-group"><label>المورد</label><select id="nc-sup" class="form-control">${window._cmSupOpts}</select></div>
        <div class="form-group"><label>كود المورد <span style="color:red">*</span></label><input id="nc-code" class="form-control" placeholder="مثال: 101" /></div>
        <div class="form-group"><label>الاسم العربي <span style="color:red">*</span></label><input id="nc-name" class="form-control" placeholder="مثال: أبيض ثلجي" /></div>
        <div class="form-group"><label>ملاحظة الدرجة</label><input id="nc-shade" class="form-control" placeholder="مثال: فاتح جداً" /></div>
        <div class="form-group"><label>العائلة</label><select id="nc-fam" class="form-control"><option value="">-- بدون --</option>${window._cmFamOpts}</select></div>
        <div class="form-group"><label>لون HEX</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="nc-hex" type="color" value="#ffffff" style="width:60px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px" oninput="document.getElementById('nc-hex-preview').style.background=this.value" />
            <div id="nc-hex-preview" style="width:40px;height:38px;border-radius:4px;border:1px solid #ccc;background:#ffffff"></div>
            <small style="color:#6b7280">اختر اللون</small>
          </div>
        </div>
        <button class="btn btn-primary" onclick="window._doAddColor()">حفظ</button>`);
      window._doAddColor = async () => {
        const body = {
          supplier_id: document.getElementById('nc-sup').value || null,
          supplier_color_code: document.getElementById('nc-code').value.trim(),
          internal_ar_name: document.getElementById('nc-name').value.trim(),
          shade_note: document.getElementById('nc-shade').value.trim() || null,
          family_id: document.getElementById('nc-fam').value || null,
          hex_code: document.getElementById('nc-hex').value
        };
        if (!body.supplier_color_code || !body.internal_ar_name) return toast('كود ونوع اللون مطلوبان','error');
        try {
          await api('/api/color-master',{method:'POST', body: JSON.stringify(body)});
          toast('تم إضافة اللون');
          document.getElementById('modal-container').innerHTML='';
          loadColorMaster(c);
        } catch(e) { toast(e.message,'error'); }
      };
    };

    window._editColor = (id) => {
      const color = window._allColors.find(x => x.id === id);
      if (!color) return;
      modal('تعديل لون', `
        <div class="form-group"><label>الاسم العربي</label><input id="ec-name" class="form-control" value="${color.internal_ar_name}" /></div>
        <div class="form-group"><label>كود المورد</label><input id="ec-code" class="form-control" value="${color.supplier_color_code}" /></div>
        <div class="form-group"><label>ملاحظة الدرجة</label><input id="ec-shade" class="form-control" value="${color.shade_note||''}" /></div>
        <div class="form-group"><label>العائلة</label><select id="ec-fam" class="form-control"><option value="">-- بدون --</option>${window._cmFamOpts.replace(`value="${color.family_id}"`,`value="${color.family_id}" selected`)}</select></div>
        <div class="form-group"><label>لون HEX</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="ec-hex" type="color" value="${color.hex_code||'#ffffff'}" style="width:60px;height:38px;cursor:pointer;border:1px solid #ccc;border-radius:4px" oninput="document.getElementById('ec-hex-preview').style.background=this.value" />
            <div id="ec-hex-preview" style="width:40px;height:38px;border-radius:4px;border:1px solid #ccc;background:${color.hex_code||'#ffffff'}"></div>
          </div>
        </div>
        <div class="form-group"><label>نشط</label><select id="ec-active" class="form-control"><option value="1" ${color.active?'selected':''}>نعم</option><option value="0" ${!color.active?'selected':''}>لا</option></select></div>
        <button class="btn btn-primary" onclick="window._doEditColor(${id})">حفظ</button>`);
      window._doEditColor = async (cid) => {
        try {
          await api('/api/color-master/'+cid,{method:'PUT', body: JSON.stringify({
            internal_ar_name: document.getElementById('ec-name').value.trim(),
            supplier_color_code: document.getElementById('ec-code').value.trim(),
            shade_note: document.getElementById('ec-shade').value.trim()||null,
            family_id: document.getElementById('ec-fam').value||null,
            hex_code: document.getElementById('ec-hex').value,
            active: parseInt(document.getElementById('ec-active').value)
          })});
          toast('تم التحديث'); document.getElementById('modal-container').innerHTML=''; loadColorMaster(c);
        } catch(e) { toast(e.message,'error'); }
      };
    };

    window._deleteColor = async (id) => {
      if (!confirm('حذف هذا اللون؟')) return;
      try { await api('/api/color-master/'+id,{method:'DELETE'}); toast('تم الحذف'); loadColorMaster(c); }
      catch(e) { toast(e.message,'error'); }
    };

  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

function _renderColorMasterTable(colors) {
  if (!colors || colors.length === 0) return '<div class="alert alert-warning">لا توجد ألوان مضافة.</div>';
  return `<div class="table-container"><table><thead><tr>
    <th>معاينة</th><th>كود المورد</th><th>الاسم العربي</th><th>الدرجة</th><th>العائلة</th><th>المورد</th><th>نشط</th><th>إجراءات</th>
  </tr></thead><tbody>
  ${colors.map(c => `
    <tr>
      <td><div style="width:32px;height:32px;border-radius:4px;border:1px solid #e5e7eb;background:${c.hex_code||'#f3f4f6'};display:inline-block" title="${c.hex_code||'بدون لون'}"></div></td>
      <td class="font-mono">${c.supplier_color_code}</td>
      <td class="font-bold">${c.internal_ar_name}</td>
      <td>${c.shade_note||'—'}</td>
      <td>${c.family_name_ar||'—'}</td>
      <td>${c.supplier_name||'—'}</td>
      <td><span class="badge ${c.active?'badge-success':'badge-warning'}">${c.active?'نشط':'مخفي'}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="window._editColor(${c.id})">تعديل</button>
        <button class="btn btn-sm btn-danger" onclick="window._deleteColor(${c.id})">حذف</button>
      </td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

// ============================================================
// ERP-v9: MANUFACTURING SESSIONS LIST
// ============================================================
async function loadMfgSessions(c) {
  c.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const sessions = await api('/api/manufacturing/sessions');
    c.innerHTML = `
      <div class="page-header">
        <h2>📋 جلسات الإنتاج</h2>
        <button class="btn btn-primary" onclick="nav('mfg-session-new')">+ جلسة جديدة</button>
      </div>
      ${sessions.length === 0 ? '<div class="alert alert-warning">لا توجد جلسات.</div>' :
        `<div class="table-container"><table><thead><tr>
          <th>#</th><th>التاريخ</th><th>الحرفي</th><th>الفرع</th><th>التركيبات</th><th>كجم منتج</th><th>تكلفة العمل</th><th>الحالة</th><th>إجراءات</th>
        </tr></thead><tbody>
        ${sessions.map(s => `<tr>
          <td>${s.id}</td>
          <td>${fmtDate(s.session_date)}</td>
          <td>${s.artisan_name} <small class="text-muted">${s.artisan_code}</small></td>
          <td>${s.branch_name}</td>
          <td class="font-bold">${s.total_combinations}</td>
          <td class="font-bold" style="color:#16a34a">${s.total_kg_produced ? (+s.total_kg_produced).toFixed(2) : '—'}</td>
          <td>${fmt(s.final_labor_cost)} ${s.labor_modified ? '<span class="badge badge-warning">يدوي</span>' : ''}</td>
          <td><span class="badge ${s.status==='OPEN'?'badge-success':s.status==='CLOSED'?'badge-info':'badge-danger'}">${s.status==='OPEN'?'مفتوحة':s.status==='CLOSED'?'مغلقة':'ملغاة'}</span></td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="window._openSession(${s.id})">
              ${s.status==='OPEN'?'فتح':'عرض'}
            </button>
          </td>
        </tr>`).join('')}
        </tbody></table></div>`}`;

    window._openSession = (id) => {
      window._currentSessionId = id;
      nav('mfg-session-screen');
    };
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// ERP-v9: NEW SESSION FORM
// ============================================================
async function loadMfgSessionNew(c) {
  c.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const [artisans, branches] = await Promise.all([
      api('/api/artisans'),
      api('/api/branches')
    ]);
    const today = new Date().toISOString().slice(0,10);
    // Rule 9: Only wholesale/workshop branches allowed for production
    const mfgBranches = branches.filter(b => b.branch_type === 'wholesale' || b.branch_type === 'workshop');
    const defaultBranch = mfgBranches.find(b => b.branch_type === 'wholesale') || mfgBranches[0];
    const activeArtisans = artisans.filter(a => a.active !== 0);
    c.innerHTML = `
      <div class="page-header"><h2>➕ جلسة إنتاج جديدة</h2></div>
      <div class="card" style="max-width:500px">
        <div class="form-group"><label>التاريخ <span style="color:red">*</span></label>
          <input id="ns-date" class="form-control" type="date" value="${today}" /></div>
        <div class="form-group"><label>الحرفي <span style="color:red">*</span></label>
          <select id="ns-artisan" class="form-control">
            <option value="">-- اختر حرفي --</option>
            ${activeArtisans.map(a => `<option value="${a.id}">${a.name} (${a.code})${a.rate_per_kg ? ` — ${a.rate_per_kg} DH/كجم` : ''}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>الفرع <span style="color:red">*</span></label>
          <select id="ns-branch" class="form-control">
            ${mfgBranches.length === 0
              ? '<option value="">لا يوجد فرع جملة أو ورشة</option>'
              : mfgBranches.map(b => `<option value="${b.id}" ${defaultBranch && b.id === defaultBranch.id ? 'selected' : ''}>${b.name} (${b.branch_type === 'wholesale' ? 'جملة' : 'ورشة'})</option>`).join('')}
          </select>
          <small style="color:#666">فروع الجملة والورشة فقط — التجزئة غير مسموح بها</small></div>
        <button class="btn btn-primary btn-block" onclick="window._createSession()">إنشاء الجلسة</button>
      </div>`;

    window._createSession = async () => {
      const session_date = document.getElementById('ns-date').value;
      const artisan_id = document.getElementById('ns-artisan').value;
      const branch_id = document.getElementById('ns-branch').value;
      if (!session_date || !artisan_id) return toast('التاريخ والحرفي مطلوبان','error');
      try {
        const r = await api('/api/manufacturing/sessions',{method:'POST', body: JSON.stringify({ session_date, artisan_id, branch_id })});
        toast('تم إنشاء الجلسة');
        window._currentSessionId = r.id;
        nav('mfg-session-screen');
      } catch(e) {
        if (e.status === 409 && e.existing_session_id) {
          // Duplicate OPEN session on same date — offer two options
          modal('⚠️ جلسة مفتوحة موجودة', `
            <p style="margin-bottom:1rem">للحرفي جلسة مفتوحة بتاريخ <strong>${e.existing_session_date}</strong>. اختر:</p>
            <div style="display:flex;gap:.75rem;flex-wrap:wrap">
              <button class="btn btn-primary" onclick="this.closest('.modal-container,.modal').remove(); window._currentSessionId=${e.existing_session_id}; nav('mfg-session-screen')">
                📂 فتح الجلسة الموجودة
              </button>
              <button class="btn btn-warning" style="background:#d97706;color:#fff" onclick="this.closest('.modal-container,.modal').remove(); window._forceCloseAndCreate(${e.existing_session_id})">
                🔒 إغلاق تلقائي وإنشاء جديدة
              </button>
            </div>`);
          window._pendingNewSession = { session_date, artisan_id, branch_id };
          window._forceCloseAndCreate = async (existingId) => {
            try {
              await api('/api/manufacturing/sessions/'+existingId+'/force-close', { method: 'POST' });
              const pend = window._pendingNewSession;
              const r2 = await api('/api/manufacturing/sessions', { method: 'POST', body: JSON.stringify(pend) });
              toast('تم إغلاق الجلسة السابقة وإنشاء الجديدة');
              window._currentSessionId = r2.id;
              nav('mfg-session-screen');
            } catch(e2) { toast(e2.message,'error'); }
          };
        } else {
          toast(e.message,'error');
        }
      }
    };
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// ERP-v15: SESSION SCREEN
// Workflow: Deliver combinations → Artisan works → Supervisor receives KG
// line_status: in_progress | completed | cancelled | transferred
// Close: auto carry-forward in_progress lines to new session
// ============================================================
async function loadMfgSessionScreen(c) {
  const sessionId = window._currentSessionId;
  if (!sessionId) { c.innerHTML = '<div class="alert alert-warning">لم يتم تحديد جلسة. <button class="btn btn-sm btn-primary" onclick="nav(\'mfg-sessions\')">العودة للقائمة</button></div>'; return; }
  c.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const [data, colors, artisans] = await Promise.all([
      api('/api/manufacturing/sessions/'+sessionId),
      api('/api/color-master?active=1'),
      api('/api/artisans')
    ]);
    const { session, lines } = data;
    const isOpen   = session.status === 'OPEN';
    const isClosed = session.status === 'CLOSED';

    const statusBadge = isOpen ? 'badge-success' : isClosed ? 'badge-info' : 'badge-danger';
    const statusLabel = isOpen ? 'مفتوحة' : isClosed ? 'مغلقة ✅' : 'ملغاة';
    const rateLabel   = `${session.rate_per_kg||0} DH/كجم`;

    const colorOpts = colors.map(clr =>
      `<option value="${clr.id}" data-hex="${clr.hex_code||'#f3f4f6'}">${clr.supplier_color_code} — ${clr.internal_ar_name}</option>`
    ).join('');

    // Stats: active = not cancelled/transferred
    const activeLines    = lines.filter(l => !['cancelled','transferred'].includes(l.line_status));
    const totalComb      = activeLines.reduce((s,l) => s + (l.combinations||0), 0);
    const totalBobbins   = totalComb * 4;
    const totalKg        = lines.filter(l=>l.line_status==='completed').reduce((s,l) => s+(l.actual_kg_produced||0), 0);
    const inProgressLines= lines.filter(l => l.line_status === 'in_progress');

    // Artisans for transfer modal (exclude current session's artisan)
    const otherArtisans  = artisans.filter(a => a.active !== 0 && a.id !== session.artisan_id);
    const artisanOpts    = otherArtisans.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('');

    c.innerHTML = `
      <div class="page-header">
        <h2>📋 جلسة #${session.id} — ${session.artisan_name} — ${fmtDate(session.session_date)}</h2>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="badge ${statusBadge} badge-lg">${statusLabel}</span>
          ${session.labor_modified ? '<span class="badge badge-warning">تكلفة يدوية</span>' : ''}
          <button class="btn btn-sm" onclick="nav('mfg-sessions')">← القائمة</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card">
          <div class="stat-value">${totalComb}</div>
          <div class="stat-label">التركيبات النشطة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalBobbins}</div>
          <div class="stat-label">البكرات (تلقائي ×4)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalKg.toFixed(2)} KG</div>
          <div class="stat-label">كجم مستلم (مكتمل)</div>
        </div>
        <div class="stat-card ${session.labor_modified?'warning':''}">
          <div class="stat-value">${fmt(session.final_labor_cost)}</div>
          <div class="stat-label">تكلفة العمل (${rateLabel})</div>
        </div>
      </div>

      <!-- Combinations table -->
      <div class="card" style="margin-bottom:1rem">
        <h3>أسطر الإنتاج</h3>
        <div id="sess-lines-table">
          ${_renderSessionLines(lines, !isOpen)}
        </div>

        ${isOpen ? `
        <hr />
        <h4>➕ تسليم تركيبات للحرفي</h4>
        <p style="color:#64748b;font-size:.85rem;margin-bottom:.75rem">سجّل التركيبات التي سُلِّمت للحرفي. ستظهر بحالة "قيد التنفيذ" حتى يتم استلام الإنتاج.</p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-end">
          <div class="form-group" style="flex:2;min-width:200px">
            <label>اللون</label>
            <select id="sl-color" class="form-control" onchange="window._slUpdateHex()">
              <option value="">-- اختر لون --</option>
              ${colorOpts}
            </select>
          </div>
          <div id="sl-hex-prev" style="width:38px;height:38px;border-radius:4px;border:1px solid #ccc;background:#f3f4f6;margin-bottom:1rem;flex-shrink:0"></div>
          <div class="form-group" style="width:120px">
            <label>التركيبات</label>
            <input id="sl-comb" class="form-control" type="number" min="1" value="1" oninput="window._slUpdateCalc()" />
          </div>
          <div class="form-group" style="width:110px">
            <label>بكرات <small style="color:#6b7280">(تلقائي)</small></label>
            <input id="sl-bobbins" class="form-control" type="number" min="0" value="4" title="القيمة الافتراضية: التركيبات × 4. يمكن تعديلها إذا كان الكرتون ناقصاً" />
          </div>
          <div class="form-group" style="width:110px">
            <label>سعر العمل (DH/كجم)</label>
            <input id="sl-rate" class="form-control" type="number" min="0" step="0.5" value="${session.rate_per_kg||6}" />
          </div>
          <div class="form-group" style="flex:1;min-width:140px">
            <label>ملاحظات</label>
            <input id="sl-notes" class="form-control" placeholder="اختياري" />
          </div>
          <div style="margin-bottom:1rem">
            <button class="btn btn-primary" onclick="window._addSessionLine()">تسليم</button>
          </div>
        </div>` : ''}
      </div>


      <!-- Close session (OPEN only) -->
      ${isOpen ? `
      <div class="card" style="background:#fef3c7;border:1px solid #f59e0b;margin-bottom:1rem">
        <h3>🔒 إغلاق الجلسة</h3>
        ${inProgressLines.length > 0 ? `
          <div class="alert alert-warning" style="margin-bottom:.75rem">
            ⚠️ <strong>${inProgressLines.length} تركيبة</strong> لم تكتمل — سيتم نقلها تلقائياً إلى جلسة جديدة للحرفي نفسه.
          </div>` : ''}
        <p>عند الإغلاق: يتم <strong>خصم البكرات</strong> من مخزون المواد الخام و<strong>إضافة الكيلوغرامات</strong> المستلمة إلى مخزون الجملة. هذه العملية <strong>لا يمكن التراجع عنها</strong>.</p>
        <button class="btn btn-warning" onclick="window._closeSession(${sessionId})">إغلاق الجلسة وتحديث المخزون</button>
      </div>` : ''}

      <!-- Closed status (CLOSED only) -->
      ${isClosed ? `
      <div class="card" style="background:#dcfce7;border:1px solid #16a34a">
        <h3>✅ الجلسة مغلقة — المخزون محدّث</h3>
        <p>تم إغلاق الجلسة وتحديث مخزون البكرات والكيلوغرامات.</p>
        ${session.closed_at ? `<small class="text-muted">وقت الإغلاق: ${fmtDate(session.closed_at)}</small>` : ''}
      </div>` : ''}

      <!-- Cancel (OPEN only) -->
      ${isOpen ? `
      <div class="card" style="background:#fef2f2;border:1px solid #ef4444;margin-top:.5rem">
        <h3>🗑️ إلغاء الجلسة</h3>
        <p>حذف الجلسة وجميع أسطرها. لا أثر على المخزون.</p>
        <button class="btn btn-danger" onclick="window._cancelSession(${sessionId})">حذف الجلسة</button>
      </div>` : ''}

      <!-- ── Modals ── -->
      <div id="sess-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;align-items:center;justify-content:center">
        <div id="sess-modal-box" style="background:#fff;border-radius:12px;padding:1.5rem;width:360px;max-width:95vw;direction:rtl;font-family:'Cairo',sans-serif"></div>
      </div>`;

    // ── Helpers ──────────────────────────────────────────────
    function _showModal(html) {
      const ov = document.getElementById('sess-modal-overlay');
      const bx = document.getElementById('sess-modal-box');
      if (ov && bx) { bx.innerHTML = html; ov.style.display = 'flex'; }
    }
    function _hideModal() {
      const ov = document.getElementById('sess-modal-overlay');
      if (ov) ov.style.display = 'none';
    }

    window._slUpdateHex = () => {
      const sel = document.getElementById('sl-color');
      const opt = sel?.options[sel.selectedIndex];
      const hex = opt ? (opt.getAttribute('data-hex') || '#f3f4f6') : '#f3f4f6';
      const p = document.getElementById('sl-hex-prev');
      if (p) p.style.background = hex;
    };
    window._slUpdateCalc = () => {
      const comb = parseInt(document.getElementById('sl-comb')?.value) || 0;
      const bob = document.getElementById('sl-bobbins');
      if (bob) bob.value = comb * 4;
    };

    // Add line (delivery only — no KG)
    window._addSessionLine = async () => {
      const color_id     = document.getElementById('sl-color').value;
      const combinations = parseInt(document.getElementById('sl-comb').value) || 0;
      const bobbins_consumed = parseInt(document.getElementById('sl-bobbins')?.value);
      const rate_per_kg  = parseFloat(document.getElementById('sl-rate')?.value) || (session.rate_per_kg || 6);
      const notes        = document.getElementById('sl-notes').value.trim();
      if (!color_id || combinations < 1) return toast('اختر لون وأدخل عدد تركيبات','error');
      // Warn (but don't block) if bobbins exceed the standard (combinations × 4)
      const defaultBobbins = combinations * 4;
      if (!isNaN(bobbins_consumed) && bobbins_consumed > defaultBobbins) {
        toast(`⚠️ عدد البكرات (${bobbins_consumed}) يتجاوز المعيار (${defaultBobbins}). تأكد من الكمية.`, 'info');
      }
      try {
        await api('/api/manufacturing/sessions/'+sessionId+'/lines', {
          method: 'POST', body: JSON.stringify({
            color_id, combinations, rate_per_kg,
            bobbins_consumed: isNaN(bobbins_consumed) ? defaultBobbins : bobbins_consumed,
            notes: notes||null
          })
        });
        toast('تم تسليم التركيبات للحرفي');
        loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    // Complete line — enter final produced KG (accumulates on top of partial)
    window._completeLine = (lid, combCount, priorKg, currentKg) => {
      const priorTxt = (priorKg > 0)
        ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:.5rem .75rem;margin-bottom:.5rem;font-size:.84rem">
             📦 أنتج حرفي سابق: <strong>${priorKg} كجم</strong></div>`
        : '';
      const partialTxt = (currentKg > 0)
        ? `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:.5rem .75rem;margin-bottom:.75rem;font-size:.84rem">
             ✅ مستلم جزئياً: <strong>${currentKg} كجم</strong> — أدخل الكمية الإضافية المستلمة الآن. الإجمالي سيُحسب تلقائياً.</div>`
        : '';
      const expectedKg = Math.round((combCount * 9.5 - (priorKg||0) - (currentKg||0)) * 2) / 2;
      _showModal(`
        <h3 style="margin:0 0 1rem;color:#0f172a">✅ استلام إنتاج</h3>
        ${priorTxt}${partialTxt}
        <div class="form-group">
          <label>الكمية المستلمة الآن (الدفعة الأخيرة) <span style="color:red">*</span></label>
          <input id="modal-kg" class="form-control" type="number" min="0.5" step="0.5"
                 placeholder="مثال: ${Math.max(0.5, expectedKg)}"
                 oninput="window._modalEffHint(${combCount},${currentKg||0})" autofocus />
        </div>
        <div id="modal-eff-hint" style="font-size:.82rem;margin-bottom:.75rem;min-height:1.2rem"></div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-primary" onclick="window._confirmComplete(${lid},${currentKg||0})">تأكيد الاستلام</button>
          <button class="btn btn-secondary" onclick="window._hideModalFn()">إلغاء</button>
        </div>`);
    };
    window._modalEffHint = (combCount, alreadyKg) => {
      const kg = parseFloat(document.getElementById('modal-kg')?.value) || 0;
      const el = document.getElementById('modal-eff-hint');
      if (!el || !kg || !combCount) return;
      const total = (alreadyKg||0) + kg;
      const ratio = total / combCount;
      if (ratio < 8.5)      { el.textContent = `⚠️ إنتاج منخفض: ${ratio.toFixed(1)} كجم/تركيبة (المتوقع ~9.5)`; el.style.color='#d97706'; }
      else if (ratio > 11)  { el.textContent = `⛔ يتجاوز الحد الأقصى: ${ratio.toFixed(1)} كجم/تركيبة`; el.style.color='#ef4444'; }
      else                  { el.textContent = `✅ طبيعي: ${ratio.toFixed(1)} كجم/تركيبة (الإجمالي: ${total} كجم)`; el.style.color='#16a34a'; }
    };
    window._confirmComplete = async (lid, alreadyKg) => {
      const kg = parseFloat(document.getElementById('modal-kg')?.value);
      if (!kg || kg <= 0) return toast('أدخل كمية صحيحة','error');
      // Client-side 0.5 increment validation
      if (Math.round(kg * 10) % 5 !== 0) return toast('يجب أن تكون الكمية بمضاعفات 0.5 كجم (مثال: 9، 9.5، 10)','error');
      _hideModal();
      try {
        const r = await api('/api/manufacturing/sessions/'+sessionId+'/lines/'+lid+'/complete', {
          method: 'POST', body: JSON.stringify({ produced_kg: kg })
        });
        toast(`تم استلام الإنتاج — الإجمالي: ${r.total_kg} كجم`,'success');
        loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    // Partial receive — record NEW partial KG (accumulates), line stays in_progress
    window._partialLine = (lid, currentKg, combCount, priorKg) => {
      // Store context for use in suggestion modal
      window._partialCtx = { lid, currentKg, combCount, priorKg };
      const alreadyTxt = currentKg > 0
        ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:.5rem .75rem;margin-bottom:.75rem;font-size:.84rem">
             📦 مستلم سابقاً: <strong>${currentKg} كجم</strong> — أدخل الكمية <u>الجديدة</u> المستلمة الآن.</div>`
        : '';
      _showModal(`
        <h3 style="margin:0 0 1rem;color:#0f172a">📥 استلام جزئي</h3>
        ${alreadyTxt}
        <p style="font-size:.85rem;color:#64748b;margin-bottom:.75rem">ستُضاف الكمية الجديدة إلى ما سبق. ستبقى التركيبة قيد التنفيذ.</p>
        <div class="form-group">
          <label>الكيلوغرامات الجديدة المستلمة الآن <span style="color:red">*</span></label>
          <input id="modal-partial-kg" class="form-control" type="number" min="0.5" step="0.5"
                 placeholder="مثال: 3.0" autofocus />
        </div>
        <div style="display:flex;gap:.5rem;margin-top:.75rem">
          <button class="btn btn-primary" onclick="window._confirmPartial(${lid})">تأكيد الإضافة</button>
          <button class="btn btn-secondary" onclick="window._hideModalFn()">إلغاء</button>
        </div>`);
    };
    window._confirmPartial = async (lid) => {
      const kg = parseFloat(document.getElementById('modal-partial-kg')?.value);
      if (!kg || kg <= 0) return toast('أدخل كمية صحيحة','error');
      // Client-side 0.5 increment validation
      if (Math.round(kg * 10) % 5 !== 0) return toast('يجب أن تكون الكمية بمضاعفات 0.5 كجم (مثال: 3، 3.5، 4)','error');
      _hideModal();
      try {
        const r = await api('/api/manufacturing/sessions/'+sessionId+'/lines/'+lid+'/partial', {
          method: 'POST', body: JSON.stringify({ produced_kg: kg })
        });
        toast(`تم تسجيل ${kg} كجم — المجموع: ${r.total_kg} كجم`);
        if (r.suggested_complete) {
          const ctx = window._partialCtx || {};
          _showModal(`
            <h3 style="margin:0 0 1rem;color:#16a34a">📦 اكتمال الإنتاج المتوقع</h3>
            <p style="margin-bottom:.75rem">
              تم استلام <strong>${r.total_kg} كجم</strong> من أصل
              <strong>${r.expected_kg} كجم</strong> متوقعة
              (${Math.round(r.total_kg / r.expected_kg * 100)}%).
            </p>
            <p style="font-size:.88rem;color:#475569;margin-bottom:1rem">هل تريد إغلاق هذه التركيبة نهائياً؟</p>
            <div style="display:flex;gap:.5rem">
              <button class="btn btn-success" onclick="
                window._hideModalFn();
                window._completeLine(${lid},${ctx.combCount||0},${ctx.priorKg||0},${r.total_kg})
              ">✅ نعم، أغلق التركيبة</button>
              <button class="btn btn-secondary" onclick="
                window._hideModalFn();
                loadMfgSessionScreen(c)
              ">لاحقاً</button>
            </div>`);
        } else {
          loadMfgSessionScreen(c);
        }
      } catch(e) { toast(e.message,'error'); }
    };

    // Transfer line to another artisan
    window._transferLine = (lid) => {
      if (!artisanOpts) return toast('لا يوجد حرفيون آخرون نشطون','error');
      _showModal(`
        <h3 style="margin:0 0 1rem;color:#0f172a">↔ تحويل التركيبة</h3>
        <div class="form-group">
          <label>اختر الحرفي المستهدف</label>
          <select id="modal-artisan" class="form-control">
            <option value="">-- اختر حرفي --</option>
            ${artisanOpts}
          </select>
        </div>
        <p style="font-size:.8rem;color:#64748b;margin:.5rem 0">سيتم البحث عن جلسة مفتوحة لهذا الحرفي أو إنشاء جلسة جديدة تلقائياً.</p>
        <div style="display:flex;gap:.5rem;margin-top:.75rem">
          <button class="btn btn-primary" onclick="window._confirmTransfer(${lid})">تأكيد التحويل</button>
          <button class="btn btn-secondary" onclick="window._hideModalFn()">إلغاء</button>
        </div>`);
    };
    window._confirmTransfer = async (lid) => {
      const artisan_id = document.getElementById('modal-artisan')?.value;
      if (!artisan_id) return toast('اختر حرفياً','error');
      _hideModal();
      try {
        const r = await api('/api/manufacturing/sessions/'+sessionId+'/lines/'+lid+'/transfer', {
          method: 'POST', body: JSON.stringify({ target_artisan_id: artisan_id })
        });
        toast(r.session_created ? `نُقل إلى جلسة جديدة #${r.target_session_id}` : `نُقل إلى جلسة #${r.target_session_id}`, 'success');
        loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    // Cancel line
    window._cancelLine = async (lid) => {
      if (!confirm('إلغاء هذه التركيبة؟')) return;
      try {
        await api('/api/manufacturing/sessions/'+sessionId+'/lines/'+lid+'/cancel', {
          method: 'POST', body: JSON.stringify({})
        });
        toast('تم إلغاء التركيبة');
        loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    // Delete line (in_progress only)
    window._deleteSessionLine = async (lid) => {
      if (!confirm('حذف هذا السطر نهائياً؟')) return;
      try {
        await api('/api/manufacturing/sessions/'+sessionId+'/lines/'+lid, {method:'DELETE'});
        toast('تم الحذف'); loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    window._overrideLabor = async () => {
      const val = parseFloat(document.getElementById('labor-override').value);
      if (isNaN(val)) return toast('أدخل قيمة صحيحة','error');
      try {
        await api('/api/manufacturing/sessions/'+sessionId+'/labor', {method:'PUT', body: JSON.stringify({ final_labor_cost: val })});
        toast('تم تعيين تكلفة العمل'); loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    window._closeSession = async (id) => {
      const warnTxt = inProgressLines.length > 0
        ? `\n\n⚠️ تنبيه: ${inProgressLines.length} تركيبة لم تكتمل وستُنقل تلقائياً إلى جلسة جديدة.`
        : '';
      if (!confirm(`تأكيد إغلاق الجلسة وتحديث المخزون؟${warnTxt}\n\nهذه العملية لا يمكن التراجع عنها.`)) return;
      try {
        const r = await api('/api/manufacturing/sessions/'+id+'/close', { method: 'POST', body: JSON.stringify({ user: USER }) });
        toast(r.message||'تم إغلاق الجلسة', 'success');
        loadMfgSessionScreen(c);
      } catch(e) { toast(e.message,'error'); }
    };

    window._cancelSession = async (id) => {
      if (!confirm('تأكيد: حذف الجلسة وجميع أسطرها؟')) return;
      try {
        await api('/api/manufacturing/sessions/'+id+'/cancel', { method: 'POST', body: JSON.stringify({}) });
        toast('تم حذف الجلسة');
        window._currentSessionId = null;
        nav('mfg-sessions');
      } catch(e) { toast(e.message,'error'); }
    };

    window._hideModalFn = _hideModal;

    // Close modal on overlay click
    document.getElementById('sess-modal-overlay')?.addEventListener('click', function(e) {
      if (e.target === this) _hideModal();
    });

  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Efficiency badge for completed lines (~10 KG/combination standard)
function _efficiencyBadge(kg, comb) {
  if (!comb || !kg || kg <= 0) return '';
  const ratio = kg / comb;
  if (ratio < 9)    return `<span style="color:#d97706;font-size:.75rem">⚠️ ${ratio.toFixed(1)} كجم/تركيبة</span>`;
  if (ratio > 10.5) return `<span style="color:#ef4444;font-size:.75rem">⚠️ ${ratio.toFixed(1)} كجم/تركيبة</span>`;
  return `<span style="color:#16a34a;font-size:.75rem">✅ ${ratio.toFixed(1)}</span>`;
}

// v15 session lines renderer — 3 groups: in_progress | completed | cancelled/transferred
function _renderSessionLines(lines, isLocked) {
  if (!lines || lines.length === 0) return '<div class="alert alert-warning">لا توجد أسطر بعد. سلّم تركيبات للحرفي أدناه.</div>';

  const inProgressLines  = lines.filter(l => l.line_status === 'in_progress');
  const completedLines   = lines.filter(l => l.line_status === 'completed');
  const otherLines       = lines.filter(l => ['cancelled','transferred'].includes(l.line_status));

  const STATUS_LABELS = {
    in_progress: { label: 'قيد التنفيذ', color: '#1d4ed8', bg: '#eff6ff' },
    completed:   { label: 'مكتملة',       color: '#16a34a', bg: '#dcfce7' },
    cancelled:   { label: 'ملغاة',        color: '#dc2626', bg: '#fef2f2' },
    transferred: { label: 'محوَّلة',      color: '#7c3aed', bg: '#f5f3ff' }
  };

  const colorCell = l => `
    <div style="display:flex;align-items:center;gap:.5rem">
      <div style="width:22px;height:22px;border-radius:3px;border:1px solid #e5e7eb;
                  background:${l.hex_code||'#f3f4f6'};flex-shrink:0"></div>
      <div><span class="font-bold">${l.color_name||'—'}</span><br>
           <small class="text-muted font-mono">${l.supplier_color_code||''}</small></div>
    </div>`;

  const statusBadge = (st) => {
    const s = STATUS_LABELS[st] || STATUS_LABELS.cancelled;
    return `<span style="background:${s.bg};color:${s.color};padding:.15rem .6rem;
                         border-radius:99px;font-size:.73rem;font-weight:700">${s.label}</span>`;
  };

  const AVG_KG_PER_COMB = 9.5; // expected output per combination

  const renderGroup = (grpLines, header, headerColor) => {
    if (grpLines.length === 0) return '';
    const isInProgress = header.includes('التنفيذ');
    const isCompleted  = header.includes('مكتملة');
    return `
      <h5 style="color:${headerColor};margin:10px 0 4px;font-size:.875rem">${header}</h5>
      <div class="table-container" style="margin-bottom:.5rem">
      <table><thead><tr>
        <th>اللون</th><th>التركيبات</th><th>البكرات</th>
        ${isInProgress ? '<th>جزئي مستلم</th><th>متبقي متوقع</th>' : ''}
        ${isCompleted  ? '<th>KG المستلم</th><th>الكفاءة</th><th>سعر (DH/كجم)</th><th>تكلفة العمل</th>' : ''}
        ${!isInProgress && !isCompleted ? '<th>ملاحظة</th>' : ''}
        <th>الحالة</th>
        ${!isLocked && isInProgress ? '<th>إجراءات</th>' : ''}
      </tr></thead><tbody>
      ${grpLines.map(l => {
        const priorKg   = l.prior_produced_kg || 0;
        const partialKg = l.actual_kg_produced || 0;
        const expected  = l.combinations * AVG_KG_PER_COMB;
        const remaining = Math.max(0, expected - priorKg - partialKg);
        const lineRate  = l.rate_per_kg || 6;
        const laborCost = isCompleted ? (partialKg * lineRate) : 0;

        const transferRef = l.line_status === 'transferred' && l.transferred_to_session_id
          ? `<br><small style="color:#7c3aed">→ جلسة #${l.transferred_to_session_id}${l.transfer_target_artisan ? ' ('+l.transfer_target_artisan+')' : ''}</small>` : '';
        const fromRef = l.transferred_from_line_id
          ? `<small style="color:#64748b;display:block;font-size:.75rem">
               من سطر #${l.transferred_from_line_id}${priorKg > 0 ? ` — سبق إنتاج ${priorKg} كجم` : ''}</small>` : '';

        return `<tr>
          <td>${colorCell(l)}${fromRef}</td>
          <td class="font-bold">${l.combinations}</td>
          <td>${l.bobbins_consumed}</td>
          ${isInProgress ? `
            <td>${partialKg > 0 ? `<span style="color:#d97706;font-weight:600">${partialKg} كجم</span>` : '—'}</td>
            <td><span style="color:#64748b;font-size:.82rem">~${remaining.toFixed(1)} كجم</span></td>` : ''}
          ${isCompleted ? `
            <td class="font-bold">${partialKg > 0 ? partialKg+' KG' : '—'}</td>
            <td>${_efficiencyBadge(partialKg, l.combinations)}</td>
            <td style="color:#475569">${lineRate} DH</td>
            <td style="color:#0f172a;font-weight:600">${fmt(laborCost)} DH</td>` : ''}
          ${!isInProgress && !isCompleted ? `<td>${transferRef || '—'}</td>` : ''}
          <td>${statusBadge(l.line_status)}${isInProgress ? '' : transferRef}</td>
          ${!isLocked && isInProgress ? `
            <td style="white-space:nowrap">
              <button class="btn btn-sm btn-success" onclick="window._completeLine(${l.id},${l.combinations},${priorKg},${partialKg})" title="استلام كامل">✅ كامل</button>
              <button class="btn btn-sm btn-secondary" onclick="window._partialLine(${l.id},${partialKg},${l.combinations},${priorKg})" title="استلام جزئي">📥 جزئي</button>
              <button class="btn btn-sm" style="background:#7c3aed;color:#fff" onclick="window._transferLine(${l.id})" title="تحويل">↔ تحويل</button>
              <button class="btn btn-sm btn-danger" onclick="window._cancelLine(${l.id})" title="إلغاء">❌</button>
            </td>` : ''}
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  };

  return renderGroup(inProgressLines, '⏳ قيد التنفيذ', '#1d4ed8')
       + renderGroup(completedLines,  '✅ مكتملة',      '#16a34a')
       + renderGroup(otherLines,      '🚫 ملغاة / محوَّلة', '#64748b');
}

// ============================================================
// ERP-v9: ARTISAN RATES PAGE
// ============================================================
async function loadMfgArtisanRates(c) {
  c.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const [rates, artisans] = await Promise.all([
      api('/api/artisan-rates'),
      api('/api/artisans')
    ]);

    const ratedIds = new Set(rates.map(r => r.artisan_id));
    const unrated = artisans.filter(a => !ratedIds.has(a.id));

    c.innerHTML = `
      <div class="page-header"><h2>💰 أسعار الحرفيين (DH/كجم)</h2></div>
      ${unrated.length > 0 ? `<div class="alert alert-warning">⚠️ ${unrated.length} حرفي بدون سعر محدد: ${unrated.map(a=>a.name).join('، ')}</div>` : ''}
      <div class="card" style="margin-bottom:1rem">
        <h3>تعيين/تعديل سعر لكل كيلوغرام</h3>
        <small style="color:#666;display:block;margin-bottom:.75rem">تكلفة العمالة = كجم منتج × السعر/كجم</small>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <select id="ar-artisan" class="form-control" style="flex:1;min-width:200px">
            <option value="">-- اختر حرفي --</option>
            ${artisans.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('')}
          </select>
          <input id="ar-rate" class="form-control" type="number" step="0.01" placeholder="السعر DH/كجم" style="width:180px" />
          <button class="btn btn-primary" onclick="window._saveArtisanRate()">حفظ</button>
        </div>
      </div>
      <div class="table-container">
        <table><thead><tr>
          <th>الحرفي</th><th>الكود</th><th>السعر DH/كجم</th><th>آخر تحديث</th><th>تعديل</th>
        </tr></thead><tbody>
        ${rates.length === 0 ? '<tr><td colspan="5" class="text-center">لا توجد أسعار مسجلة</td></tr>' :
          rates.map(r => `<tr>
            <td>${r.artisan_name}</td>
            <td class="font-mono">${r.artisan_code}</td>
            <td class="font-bold">${fmt(r.rate_per_kg || r.rate_per_combination || 0)} <small class="text-muted">DH/كجم</small></td>
            <td>${fmtDate(r.updated_at)}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="document.getElementById('ar-artisan').value='${r.artisan_id}';document.getElementById('ar-rate').value='${r.rate_per_kg || r.rate_per_combination || 0}'">تعديل</button></td>
          </tr>`).join('')}
        </tbody></table>
      </div>`;

    window._saveArtisanRate = async () => {
      const artisan_id = document.getElementById('ar-artisan').value;
      const rate = parseFloat(document.getElementById('ar-rate').value);
      if (!artisan_id || isNaN(rate)) return toast('اختر حرفي وأدخل السعر','error');
      try {
        await api('/api/artisan-rates',{method:'POST', body: JSON.stringify({ artisan_id, rate_per_kg: rate })});
        toast('تم الحفظ'); loadMfgArtisanRates(c);
      } catch(e) { toast(e.message,'error'); }
    };
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// ERP-v9: COLORS BELOW ZERO REPORT
// ============================================================
async function loadMfgColorsBelowZero(c) {
  c.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const rows = await api('/api/manufacturing/colors-below-zero');
    c.innerHTML = `
      <div class="page-header"><h2>⚠️ المخزون السالب — الألوان</h2></div>
      ${rows.length === 0
        ? '<div class="alert alert-success">✅ لا يوجد مخزون سالب.</div>'
        : `<div class="alert alert-danger">⚠️ ${rows.length} صنف بمخزون سالب</div>
           <div class="table-container"><table><thead><tr>
             <th>اللون</th><th>الكود</th><th>العائلة</th><th>المنتج</th><th>المخزن</th><th>الكمية</th>
           </tr></thead><tbody>
           ${rows.map(r => `<tr style="background:#fef2f2">
             <td>
               <div style="display:flex;align-items:center;gap:.5rem">
                 <div style="width:24px;height:24px;border-radius:3px;border:1px solid #e5e7eb;background:${r.hex_code||'#f3f4f6'}"></div>
                 <span>${r.color_name||'—'}</span>
               </div>
             </td>
             <td class="font-mono">${r.supplier_color_code||'—'}</td>
             <td>${r.family_name_ar||'—'}</td>
             <td>${r.product_name}</td>
             <td>${r.warehouse_name}</td>
             <td class="font-bold" style="color:#dc2626">${(+r.quantity).toLocaleString('ar-MA')}</td>
           </tr>`).join('')}
           </tbody></table></div>`}`;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// ============================================================
// ERP-v9: AUTO-CONTRAST BORDER HELPER
// Returns a border color that is visible against any background.
// Light backgrounds (lum > 0.75) → gray border; dark → transparent.
// ============================================================
function _hexContrast(hex) {
  if (!hex || hex.length < 7) return '#d1d5db';
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.75 ? '#9ca3af' : 'transparent';
  } catch { return '#d1d5db'; }
}

// ============================================================
// Color Intelligence Dashboard — /mfg-colors-overview  (v4 SaaS)
// ============================================================
async function loadMfgColorsOverview(c) {
  // Backend only accepts these discrete day values (0 = all time)
  const VALID_DAYS = [30, 60, 90, 180, 365];
  function snapDays(v) {
    if (!v || v <= 0) return 0;
    return VALID_DAYS.reduce((best, d) =>
      Math.abs(d - v) < Math.abs(best - v) ? d : best, VALID_DAYS[0]);
  }

  const state = {
    q: '', sort: 'available_kg', order: 'DESC',
    page: 1, perPage: 50, days: 0, status: '',
    branchId: 0, lowStockOnly: false,
    data: [], total: 0, pages: 1, summary: null, loading: false
  };

  // ── Status config ─────────────────────────────────────────
  const STATUS_MAP = {
    in_production: { label:'قيد التشغيل', icon:'🔵', bg:'#EFF6FF', color:'#1e40af', pillBg:'#2563eb', accent:'#3b82f6' },
    active:        { label:'نشط',          icon:'🟢', bg:'#F0FDF4', color:'#166534', pillBg:'#16a34a', accent:'#22c55e' },
    idle:          { label:'راكد',          icon:'🟡', bg:'#FEFCE8', color:'#854d0e', pillBg:'#ca8a04', accent:'#eab308' },
    dead:          { label:'ميت',           icon:'⚫', bg:'#F8FAFC', color:'#475569', pillBg:'#64748b', accent:'#94a3b8' },
    low_stock:     { label:'منخفض',         icon:'🔴', bg:'#FFF1F2', color:'#9f1239', pillBg:'#e11d48', accent:'#f43f5e' }
  };

  // ── Page skeleton ─────────────────────────────────────────
  c.innerHTML = `
    <div style="background:#F8FAFC;min-height:100%;padding:1.5rem;
                font-family:'Cairo',sans-serif;direction:rtl">

      <!-- ─── Header ─────────────────────────────────── -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;
                  margin-bottom:1.5rem">
        <div>
          <h2 style="margin:0;font-size:1.125rem;font-weight:700;color:#0f172a;
                     font-family:'Cairo',sans-serif;line-height:1.3">
            🎨 Color Intelligence
          </h2>
          <p style="margin:.2rem 0 0;font-size:.875rem;color:#64748b;
                    font-family:'Cairo',sans-serif">
            لوحة مخزون الألوان — تحليل حي
          </p>
        </div>
        <span id="cov-total-badge"
          style="background:#fff;color:#475569;font-size:.8rem;font-weight:700;
                 padding:.35rem 1rem;border-radius:99px;border:1.5px solid #e2e8f0;
                 box-shadow:0 1px 3px rgba(0,0,0,.06);font-family:'Cairo',sans-serif;
                 white-space:nowrap"></span>
      </div>

      <!-- ─── KPI Cards (5) ──────────────────────────── -->
      <div id="cov-cards"
        style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
               gap:1rem;margin-bottom:1.5rem">
        <div style="grid-column:1/-1;color:#94a3b8;font-size:.875rem;
                    font-family:'Cairo',sans-serif;padding:.5rem 0">
          ⏳ جاري التحميل...
        </div>
      </div>

      <!-- ─── Filter Pills ────────────────────────────── -->
      <div id="cov-pills"
        style="display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:1rem;
               align-items:center">
      </div>

      <!-- ─── Control bar ─────────────────────────────── -->
      <div style="background:#fff;border-radius:12px;border:1px solid #e8ecf0;
                  padding:.75rem 1.1rem;margin-bottom:1.25rem;
                  box-shadow:0 2px 8px rgba(0,0,0,.05);
                  display:flex;flex-wrap:wrap;gap:.65rem;align-items:center">

        <!-- Search -->
        <div style="position:relative;flex:1;min-width:150px;max-width:230px">
          <span style="position:absolute;top:50%;transform:translateY(-50%);
                       right:.65rem;font-size:.9rem;color:#94a3b8;pointer-events:none">🔍</span>
          <input id="cov-search" type="text" autocomplete="off"
            style="width:100%;padding:.45rem .65rem .45rem 0;padding-right:2rem;
                   border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;
                   font-family:'Cairo',sans-serif;color:#0f172a;outline:none;
                   background:#f8fafc;box-sizing:border-box"
            onfocus="this.style.borderColor='#3b82f6';this.style.background='#fff'"
            onblur="this.style.borderColor='#e2e8f0';this.style.background='#f8fafc'"
            placeholder="بحث بالكود أو الاسم..." />
        </div>

        <!-- X days input -->
        <div style="display:flex;align-items:center;gap:.4rem;
                    background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;
                    padding:.4rem .75rem;white-space:nowrap">
          <span style="font-size:.8rem;color:#64748b;font-family:'Cairo',sans-serif">
            الحركة خلال
          </span>
          <input id="cov-days-input" type="number" min="30" max="365"
            style="width:52px;border:none;background:transparent;text-align:center;
                   font-weight:700;color:#1e293b;font-size:.9rem;outline:none;
                   font-family:'Cairo',sans-serif"
            placeholder="∞"
            title="أدخل 30، 60، 90، 180، أو 365 يوم" />
          <span style="font-size:.8rem;color:#64748b;font-family:'Cairo',sans-serif">يوم</span>
          <button id="cov-days-clear" onclick="window._covClearDays()"
            style="font-size:.75rem;color:#cbd5e1;background:none;border:none;
                   cursor:pointer;padding:0 0 0 .15rem;line-height:1"
            title="إزالة فلتر الأيام">✕</button>
        </div>

        <!-- Branch -->
        <select id="cov-branch"
          style="padding:.45rem .65rem;border:1.5px solid #e2e8f0;border-radius:8px;
                 font-size:.875rem;font-family:'Cairo',sans-serif;color:#374151;
                 background:#f8fafc;outline:none;cursor:pointer;min-width:130px">
          <option value="0">🏪 كل الفروع</option>
        </select>

        <!-- Sort + per-page pushed to left -->
        <div style="display:flex;gap:.5rem;margin-right:auto">
          <select id="cov-sort-sel"
            style="padding:.45rem .65rem;border:1.5px solid #e2e8f0;border-radius:8px;
                   font-size:.825rem;font-family:'Cairo',sans-serif;color:#374151;
                   background:#f8fafc;outline:none;cursor:pointer;min-width:140px">
            <option value="available_kg">↕ متاح KG</option>
            <option value="total_kg">↕ كجم منتج</option>
            <option value="kg_sold">↕ كجم مباع</option>
            <option value="bobbins_purchased">↕ بوبينات مشتراة</option>
            <option value="bobbins_remaining">↕ بوبينات متبقية</option>
            <option value="days_since_activity">↕ أيام الخمول</option>
            <option value="status">↕ الحالة</option>
            <option value="supplier_color_code">↕ الكود</option>
            <option value="arabic_name">↕ الاسم</option>
            <option value="family_name">↕ العائلة</option>
          </select>
          <select id="cov-per-page"
            style="padding:.45rem .65rem;border:1.5px solid #e2e8f0;border-radius:8px;
                   font-size:.825rem;font-family:'Cairo',sans-serif;color:#374151;
                   background:#f8fafc;outline:none;cursor:pointer;min-width:85px">
            <option value="25">25 / ص</option>
            <option value="50" selected>50 / ص</option>
            <option value="100">100 / ص</option>
            <option value="200">200 / ص</option>
          </select>
        </div>

        <span id="cov-count"
          style="color:#94a3b8;font-size:.8rem;white-space:nowrap;
                 font-family:'Cairo',sans-serif"></span>
      </div>

      <!-- ─── Table wrapper ───────────────────────────── -->
      <div id="cov-body"
        style="background:#fff;border-radius:12px;overflow:hidden;
               box-shadow:0 2px 8px rgba(0,0,0,.08);
               border:1px solid #e8ecf0;min-height:180px"></div>

      <!-- ─── Pagination ──────────────────────────────── -->
      <div id="cov-pagination"
        style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;
               padding:.9rem 1.25rem;margin-top:.75rem;background:#fff;
               border-radius:12px;border:1px solid #e8ecf0;
               box-shadow:0 1px 4px rgba(0,0,0,.04)"></div>
    </div>`;

  // ── Load branches ─────────────────────────────────────────
  try {
    const br = await api('/api/branches');
    const list = Array.isArray(br) ? br : (br.data || []);
    const brSel = document.getElementById('cov-branch');
    if (brSel) {
      list.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name || b.branch_name || `فرع ${b.id}`;
        brSel.appendChild(opt);
      });
    }
  } catch (_) {}

  // ── Status badge ──────────────────────────────────────────
  function statusBadge(st) {
    const s = STATUS_MAP[st] || STATUS_MAP.dead;
    return `<span style="display:inline-flex;align-items:center;gap:.3rem;
      padding:.22rem .7rem;border-radius:999px;font-size:.73rem;font-weight:700;
      background:${s.bg};color:${s.color};white-space:nowrap;
      border:1px solid ${s.accent}33;font-family:'Cairo',sans-serif">
      ${s.icon} ${s.label}</span>`;
  }

  // ── KPI Cards ─────────────────────────────────────────────
  function renderCards(s) {
    const el = document.getElementById('cov-cards');
    if (!el || !s) return;
    const cards = [
      { key:'active',        v: s.active_count,        sm: STATUS_MAP.active        },
      { key:'idle',          v: s.idle_count,           sm: STATUS_MAP.idle          },
      { key:'dead',          v: s.dead_count,           sm: STATUS_MAP.dead          },
      { key:'in_production', v: s.in_production_count,  sm: STATUS_MAP.in_production },
      { key:'low_stock',     v: s.low_stock_count,      sm: STATUS_MAP.low_stock     }
    ];
    el.innerHTML = cards.map(card => `
      <div onclick="window._covPill('${card.key}')"
        style="background:#fff;border-radius:12px;padding:1.25rem 1.1rem 1rem;
               border:1.5px solid #e8ecf0;cursor:pointer;position:relative;
               overflow:hidden;text-align:right;
               box-shadow:0 2px 8px rgba(0,0,0,.06);
               transition:transform .15s,box-shadow .15s"
        onmouseover="this.style.transform='translateY(-3px)';
                     this.style.boxShadow='0 6px 20px rgba(0,0,0,.1)'"
        onmouseout="this.style.transform='';
                    this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'">
        <!-- watermark icon -->
        <div style="position:absolute;top:-4px;left:-4px;font-size:3.5rem;
                    opacity:.07;line-height:1;user-select:none">${card.sm.icon}</div>
        <!-- accent bar at bottom -->
        <div style="position:absolute;bottom:0;right:0;left:0;height:3px;
                    background:${card.sm.accent};border-radius:0 0 10px 10px"></div>
        <!-- small label on top -->
        <div style="font-size:.75rem;color:#94a3b8;font-weight:600;
                    margin-bottom:.5rem;font-family:'Cairo',sans-serif;
                    text-transform:uppercase;letter-spacing:.03em">
          ${card.sm.label}
        </div>
        <!-- big number -->
        <div style="font-size:2rem;font-weight:800;color:${card.sm.color};
                    line-height:1;font-family:'Cairo',sans-serif">
          ${card.v ?? 0}
        </div>
        <!-- sub-label -->
        <div style="font-size:.73rem;color:#94a3b8;margin-top:.35rem;
                    font-family:'Cairo',sans-serif">
          لون
        </div>
      </div>`).join('');
  }

  // ── Pills ─────────────────────────────────────────────────
  function renderPills() {
    const el = document.getElementById('cov-pills');
    if (!el) return;
    const activeKey = state.lowStockOnly ? 'low_stock'
                    : state.status === '' ? '' : state.status;
    const defs = [
      { v:'',             label:'الكل',         icon:'⬜' },
      { v:'active',       label:'نشط',          icon:'🟢' },
      { v:'idle',         label:'راكد',          icon:'🟡' },
      { v:'dead',         label:'ميت',           icon:'⚫' },
      { v:'in_production',label:'قيد التشغيل',  icon:'🔵' },
      { v:'low_stock',    label:'منخفض',         icon:'🔴' }
    ];
    const pillsHtml = defs.map(f => {
      const isActive = f.v === activeKey;
      const sm = STATUS_MAP[f.v];
      const activeBg    = sm ? sm.pillBg    : '#0f172a';
      const activeAccent= sm ? sm.accent    : '#334155';
      return `<button onclick="window._covPill('${f.v}')"
        style="padding:.35rem .9rem;border-radius:999px;font-size:.8rem;
               font-weight:${isActive ? 700 : 500};cursor:pointer;
               border:1.5px solid ${isActive ? activeBg : '#e2e8f0'};
               background:${isActive ? activeBg : '#fff'};
               color:${isActive ? '#fff' : '#64748b'};
               box-shadow:${isActive ? '0 2px 6px ' + activeAccent + '55' : 'none'};
               transition:all .15s;font-family:'Cairo',sans-serif">
        ${f.icon} ${f.label}</button>`;
    }).join('');
    el.innerHTML = `
      <span style="font-size:.78rem;color:#94a3b8;margin-left:.4rem;
                   font-family:'Cairo',sans-serif;font-weight:600">تصفية:</span>
      ${pillsHtml}`;
    if (state.lowStockOnly) {
      el.innerHTML += `
        <span style="font-size:.73rem;color:#9f1239;background:#fff1f2;
          padding:.25rem .7rem;border-radius:6px;border:1px solid #fecdd3;
          margin-right:.4rem;font-family:'Cairo',sans-serif">
          ⚠️ تصفية محلية — يعرض الألوان المنخفضة من الصفحة الحالية فقط</span>`;
    }
  }

  // ── Sort helpers ──────────────────────────────────────────
  function sortArrow(field) {
    if (state.sort !== field)
      return `<span style="opacity:.4;font-size:.55rem;margin-right:.2rem">⇅</span>`;
    return state.order === 'DESC'
      ? `<span style="color:#93c5fd;font-size:.58rem;margin-right:.2rem">▼</span>`
      : `<span style="color:#93c5fd;font-size:.58rem;margin-right:.2rem">▲</span>`;
  }

  function thC(label, field) {
    const active = state.sort === field;
    return `<th onclick="window._covSort('${field}')"
      style="padding:.7rem .9rem;text-align:right;white-space:nowrap;cursor:pointer;
             user-select:none;font-weight:600;font-size:.8rem;letter-spacing:.02em;
             color:${active ? '#93c5fd' : 'rgba(255,255,255,.82)'};
             background:${active ? 'rgba(0,0,0,.18)' : 'transparent'};
             font-family:'Cairo',sans-serif;transition:background .1s">
      ${label}${sortArrow(field)}</th>`;
  }

  // ── Table ─────────────────────────────────────────────────
  // NOTE (backend gap): The endpoint /api/manufacturing/colors-overview does NOT return
  // bobbin count (عدد البوبينات). The session_stock CTE aggregates KG only from
  // production_lines.actual_kg_produced. To show raw bobbin stock, a separate query
  // joining color_master to raw inventory table is needed in the backend.
  function renderTable() {
    const body = document.getElementById('cov-body');
    if (!body) return;
    const displayData = state.lowStockOnly
      ? state.data.filter(r => r.is_low_stock)
      : state.data;
    if (!displayData.length) {
      body.innerHTML = `
        <div style="padding:3rem 1.5rem;text-align:center;
                    font-family:'Cairo',sans-serif;color:#94a3b8;font-size:.9rem">
          <div style="font-size:2.5rem;margin-bottom:.75rem;opacity:.4">🎨</div>
          لا توجد ألوان مطابقة لفلتر البحث الحالي.
        </div>`;
      return;
    }
    body.innerHTML = `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.875rem;
                    font-family:'Cairo',sans-serif;direction:rtl">
        <thead>
          <tr style="background:#1E3A5F">
            <th style="padding:.7rem .75rem;width:40px;
                       border-bottom:none"></th>
            ${thC('الكود',           'supplier_color_code')}
            ${thC('الاسم',           'arabic_name')}
            ${thC('العائلة',        'family_name')}
            ${thC('الحالة',         'status')}
            ${thC('بوبينات',        'bobbins_purchased')}
            ${thC('متاح KG',        'available_kg')}
            ${thC('كجم منتج',       'total_kg')}
            ${thC('كجم مباع',       'kg_sold')}
            ${thC('كجم متبقي',      'kg_remaining')}
            ${thC('آخر نشاط',       'last_session_date')}
            ${thC('الأيام',         'days_since_activity')}
            <th style="padding:.7rem .75rem;text-align:center;
                       color:rgba(255,255,255,.6);font-size:.75rem;
                       font-weight:600;font-family:'Cairo',sans-serif">⚠️</th>
          </tr>
        </thead>
        <tbody>
          ${displayData.map((row, i) => {
            const avail    = +row.available_kg;
            const total    = +row.total_kg;
            const availColor = avail < 0  ? '#dc2626'
                             : avail === 0 ? '#d97706' : '#16a34a';
            const border   = _hexContrast(row.hex_code);
            const rowBg    = i % 2 === 0 ? '#ffffff' : '#F8FAFC';
            const daysVal  = row.days_since_activity;
            const daysColor= daysVal === null ? '#94a3b8'
                           : +daysVal > 90 ? '#dc2626'
                           : +daysVal > 30 ? '#d97706' : '#16a34a';
            const dateStr  = row.last_session_date
                           ? row.last_session_date.split('T')[0] : '—';
            return `
              <tr style="background:${rowBg};border-bottom:1px solid #f1f5f9;
                         transition:background .1s"
                  onmouseover="this.style.background='#EFF6FF'"
                  onmouseout="this.style.background='${rowBg}'">

                <!-- Color swatch -->
                <td style="padding:.55rem .75rem;text-align:center">
                  <div title="${row.hex_code || 'بدون لون'}"
                    style="width:28px;height:28px;border-radius:6px;
                           display:inline-block;
                           background:${row.hex_code || '#e2e8f0'};
                           border:2px solid ${border || '#e2e8f0'};
                           box-shadow:0 1px 4px rgba(0,0,0,.15)"></div>
                </td>

                <!-- Code -->
                <td style="padding:.55rem .9rem;font-family:monospace;font-size:.78rem;
                           font-weight:700;color:#1e293b;letter-spacing:.04em">
                  ${row.supplier_color_code}</td>

                <!-- Arabic name -->
                <td style="padding:.55rem .9rem;font-weight:600;color:#1e293b;
                           font-size:.875rem;font-family:'Cairo',sans-serif">
                  ${row.arabic_name}</td>

                <!-- Family -->
                <td style="padding:.55rem .9rem;color:#64748b;font-size:.82rem;
                           font-family:'Cairo',sans-serif">
                  ${row.family_name}</td>

                <!-- Status badge -->
                <td style="padding:.55rem .9rem">${statusBadge(row.status)}</td>

                <!-- Bobbins: purchased / consumed / remaining -->
                <td style="padding:.55rem .9rem;text-align:center;white-space:nowrap">
                  ${+row.bobbins_purchased > 0 ? `
                  <div style="font-size:.78rem;font-family:'Cairo',sans-serif;line-height:1.6">
                    <div style="color:#64748b" title="مشتراة">📦 ${(+row.bobbins_purchased).toLocaleString('ar-MA')}</div>
                    <div style="color:#d97706" title="مستهلكة">🔥 ${(+row.bobbins_consumed).toLocaleString('ar-MA')}</div>
                    <div style="color:${+row.bobbins_remaining >= 0 ? '#16a34a' : '#dc2626'};font-weight:700" title="متبقية">
                      ✅ ${(+row.bobbins_remaining).toLocaleString('ar-MA')}
                    </div>
                  </div>` : `<span style="color:#cbd5e1;font-size:.75rem">—</span>`}
                </td>

                <!-- Available KG -->
                <td style="padding:.55rem .9rem;font-weight:700;font-size:.9rem;
                           color:${availColor};text-align:left;
                           font-variant-numeric:tabular-nums;letter-spacing:-.01em">
                  ${avail.toLocaleString('ar-MA')}
                  <span style="font-size:.7rem;font-weight:500;opacity:.65"> Kg</span>
                </td>

                <!-- Total KG produced -->
                <td style="padding:.55rem .9rem;color:#374151;text-align:left;
                           font-weight:600;font-variant-numeric:tabular-nums;font-size:.82rem">
                  ${total.toLocaleString('ar-MA')}
                  <span style="font-size:.68rem;opacity:.7"> Kg</span>
                </td>

                <!-- KG sold -->
                <td style="padding:.55rem .9rem;text-align:left;
                           font-variant-numeric:tabular-nums;font-size:.82rem;
                           color:${+row.kg_sold > 0 ? '#7c3aed' : '#94a3b8'}">
                  ${+row.kg_sold > 0 ? `${(+row.kg_sold).toLocaleString('ar-MA')}<span style="font-size:.68rem;opacity:.7"> Kg</span>` : '—'}
                </td>

                <!-- KG remaining (stock after sales) -->
                <td style="padding:.55rem .9rem;text-align:left;
                           font-variant-numeric:tabular-nums;font-size:.82rem;font-weight:700;
                           color:${+row.kg_remaining > 0 ? '#0369a1' : +row.kg_remaining < 0 ? '#dc2626' : '#94a3b8'}">
                  ${(+row.kg_remaining).toLocaleString('ar-MA')}
                  <span style="font-size:.68rem;font-weight:500;opacity:.65"> Kg</span>
                </td>

                <!-- Last activity date -->
                <td style="padding:.55rem .9rem;color:#64748b;
                           white-space:nowrap;font-size:.8rem;
                           font-family:'Cairo',sans-serif">
                  ${dateStr}</td>

                <!-- Days since activity -->
                <td style="padding:.55rem .9rem;text-align:center;font-weight:700;
                           color:${daysColor};font-size:.82rem;
                           font-family:'Cairo',sans-serif">
                  ${daysVal !== null
                    ? `<span style="background:${daysColor}18;padding:.15rem .5rem;
                                   border-radius:99px">${daysVal} ي</span>`
                    : '<span style="color:#cbd5e1">—</span>'}</td>

                <!-- Low stock warning -->
                <td style="padding:.55rem .9rem;text-align:center">
                  ${row.is_low_stock
                    ? `<span title="مخزون منخفض — أقل من الحد الأدنى"
                             style="font-size:1.05rem">🔴</span>`
                    : `<span style="color:#e2e8f0;font-size:.65rem">●</span>`}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>`;
  }

  // ── Pagination ────────────────────────────────────────────
  function renderPagination() {
    const el = document.getElementById('cov-pagination');
    if (!el) return;
    const from = state.total === 0 ? 0 : (state.page - 1) * state.perPage + 1;
    const to   = Math.min(state.page * state.perPage, state.total);
    const btnStyle = (disabled) =>
      `padding:.4rem .9rem;border-radius:8px;font-size:.82rem;cursor:${disabled ? 'not-allowed' : 'pointer'};
       border:1.5px solid #e2e8f0;background:${disabled ? '#f8fafc' : '#fff'};
       color:${disabled ? '#cbd5e1' : '#374151'};font-family:'Cairo',sans-serif;
       font-weight:600;transition:all .15s`;
    el.innerHTML = `
      <button style="${btnStyle(state.page <= 1)}" ${state.page <= 1 ? 'disabled' : ''}
        onclick="window._covPage(${state.page - 1})">◀ السابق</button>
      <span style="color:#64748b;font-size:.85rem;font-family:'Cairo',sans-serif">
        ${from}–${to} من <strong style="color:#1e293b">${state.total}</strong>
        | صفحة <strong style="color:#1e293b">${state.page}</strong> / ${state.pages}
      </span>
      <button style="${btnStyle(state.page >= state.pages)}" ${state.page >= state.pages ? 'disabled' : ''}
        onclick="window._covPage(${state.page + 1})">التالي ▶</button>`;
  }

  // ── Fetch ─────────────────────────────────────────────────
  async function fetchData() {
    if (state.loading) return;
    state.loading = true;
    document.getElementById('cov-body').innerHTML = `
      <div style="padding:3rem;text-align:center;color:#94a3b8;
                  font-family:'Cairo',sans-serif;font-size:.9rem">
        ⏳ جاري تحميل البيانات...
      </div>`;
    try {
      const params = new URLSearchParams({
        q: state.q, sort: state.sort, order: state.order,
        page: state.page, per_page: state.perPage,
        days: state.days,
        status: state.lowStockOnly ? '' : state.status,
        branch_id: state.branchId
      });
      const resp = await api('/api/manufacturing/colors-overview?' + params.toString());
      state.data    = resp.data  || [];
      state.total   = resp.total || 0;
      state.pages   = resp.pages || 1;
      state.summary = resp.summary;
      renderCards(state.summary);
      renderPills();
      renderTable();
      renderPagination();
      const displayCount = state.lowStockOnly
        ? state.data.filter(r => r.is_low_stock).length : state.total;
      const countEl = document.getElementById('cov-count');
      if (countEl) countEl.textContent = state.lowStockOnly
        ? `${displayCount} منخفض (من ${state.total})`
        : `${state.total} لون`;
      const badge = document.getElementById('cov-total-badge');
      if (badge) badge.textContent = `${state.total} لون`;
    } catch (e) {
      document.getElementById('cov-body').innerHTML = `
        <div style="margin:1rem;padding:1rem;background:#fef2f2;border-radius:10px;
                    color:#991b1b;font-family:'Cairo',sans-serif;font-size:.9rem;
                    border:1px solid #fecaca">
          ❌ خطأ في تحميل البيانات: ${e.message}
        </div>`;
    }
    state.loading = false;
  }

  // ── Global callbacks ──────────────────────────────────────
  window._covSort = field => {
    if (state.loading) return;
    if (state.sort === field) {
      state.order = state.order === 'DESC' ? 'ASC' : 'DESC';
    } else {
      state.sort  = field;
      state.order = 'DESC';
    }
    state.page = 1;
    const sel = document.getElementById('cov-sort-sel');
    if (sel) sel.value = field;
    fetchData();
  };
  window._covPage = p => { if (!state.loading) { state.page = p; fetchData(); } };

  window._covPill = v => {
    if (state.loading) return;
    if (v === 'low_stock') {
      state.lowStockOnly = !state.lowStockOnly;
      state.status = '';
    } else {
      state.lowStockOnly = false;
      state.status = v;
    }
    state.page = 1;
    fetchData();
  };

  window._covClearDays = () => {
    const inp = document.getElementById('cov-days-input');
    if (inp) inp.value = '';
    state.days = 0; state.page = 1; fetchData();
  };

  // ── Wire controls ─────────────────────────────────────────
  let _covTimer;
  document.getElementById('cov-search')?.addEventListener('input', e => {
    clearTimeout(_covTimer);
    _covTimer = setTimeout(() => {
      state.q = e.target.value.trim(); state.page = 1; fetchData();
    }, 350);
  });

  const daysInp = document.getElementById('cov-days-input');
  if (daysInp) {
    const applyDays = () => {
      const snapped = snapDays(parseInt(daysInp.value) || 0);
      daysInp.value = snapped || '';
      state.days = snapped; state.page = 1; fetchData();
    };
    daysInp.addEventListener('change', applyDays);
    daysInp.addEventListener('keydown', e => { if (e.key === 'Enter') applyDays(); });
  }

  document.getElementById('cov-branch')?.addEventListener('change', e => {
    state.branchId = +e.target.value; state.page = 1; fetchData();
  });
  document.getElementById('cov-sort-sel')?.addEventListener('change', e => {
    if (!state.loading) {
      state.sort = e.target.value; state.order = 'DESC'; state.page = 1; fetchData();
    }
  });
  document.getElementById('cov-per-page')?.addEventListener('change', e => {
    state.perPage = +e.target.value; state.page = 1; fetchData();
  });

  // ── Initial load ──────────────────────────────────────────
  fetchData();
}

// ============================================================
// COLOR ANALYTICS (COLOR_SYSTEM.md)
// Most sold / least sold / low stock / not sold recently
// ============================================================
async function loadColorAnalytics(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const d = await api('/api/reports/color-analytics');

    const swatch = (hex) => hex
      ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${hex};vertical-align:middle;margin-left:4px;border:1px solid #cbd5e1;flex-shrink:0"></span>`
      : '';

    const colorTable = (rows, amtLabel, amtKey) => {
      if (!rows || !rows.length) return '<div class="alert alert-warning">لا توجد بيانات.</div>';
      return `<div class="table-container"><table>
        <thead><tr><th>#</th><th>اللون</th><th>${amtLabel}</th><th>عدد الفواتير</th></tr></thead>
        <tbody>${rows.map((r,i) => `<tr>
          <td>${i+1}</td>
          <td class="font-bold">${swatch(r.hex_code||'')}${r.color_code ? `<span style="font-family:monospace">${r.color_code}</span> — ` : ''}${r.color_name}</td>
          <td class="font-bold">${parseFloat(r[amtKey]||0).toLocaleString('ar-MA',{maximumFractionDigits:2})}</td>
          <td>${r.invoice_count||'—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    };

    const lowStockRows = d.low_stock?.length
      ? `<div class="table-container"><table>
          <thead><tr><th>اللون</th><th>المرحلة</th><th>الكمية</th></tr></thead>
          <tbody>${d.low_stock.map(r => `<tr>
            <td class="font-bold">${swatch(r.hex_code)}${r.color_name}</td>
            <td><span class="badge badge-warning">${r.inventory_stage}</span></td>
            <td class="text-danger font-bold">${r.quantity} كجم</td>
          </tr>`).join('')}</tbody>
         </table></div>`
      : '<div class="alert alert-success">✅ لا توجد ألوان بمخزون منخفض.</div>';

    const notRecentRows = d.not_recently_sold?.length
      ? `<div class="table-container"><table>
          <thead><tr><th>اللون</th><th>المخزون</th><th>آخر بيع</th><th>أيام بدون بيع</th></tr></thead>
          <tbody>${d.not_recently_sold.map(r => `<tr>
            <td class="font-bold">${swatch(r.hex_code)}${r.color_name}</td>
            <td>${r.quantity} كجم</td>
            <td>${r.last_sale_date ? fmtDate(r.last_sale_date) : '—'}</td>
            <td class="${!r.last_sale_date || r.days_since_sale > 60 ? 'text-danger' : 'text-warning'} font-bold">
              ${r.last_sale_date ? r.days_since_sale + ' يوم' : 'لم يباع قط'}
            </td>
          </tr>`).join('')}</tbody>
         </table></div>`
      : '<div class="alert alert-success">✅ جميع الألوان بيعت مؤخراً.</div>';

    c.innerHTML = `
      <div class="page-header"><h2>📊 تقارير الألوان</h2></div>

      <div class="form-grid" style="margin-bottom:20px">
        <div class="card">
          <h3 style="margin-bottom:12px;font-family:'Cairo',sans-serif">🏆 الألوان الأكثر مبيعاً</h3>
          ${colorTable(d.most_sold, 'الكمية المباعة', 'total_qty_sold')}
        </div>
        <div class="card">
          <h3 style="margin-bottom:12px;font-family:'Cairo',sans-serif">📉 الألوان الأقل مبيعاً</h3>
          ${colorTable(d.least_sold, 'الكمية المباعة', 'total_qty_sold')}
        </div>
      </div>

      <div class="form-grid">
        <div class="card">
          <h3 style="margin-bottom:12px;font-family:'Cairo',sans-serif">⚠️ ألوان بمخزون منخفض (أقل من 5 كجم)</h3>
          ${lowStockRows}
        </div>
        <div class="card">
          <h3 style="margin-bottom:12px;font-family:'Cairo',sans-serif">💤 ألوان لم تُباع مؤخراً (أكثر من 30 يوماً)</h3>
          ${notRecentRows}
        </div>
      </div>
    `;
  } catch(e) { c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      nav(item.dataset.page);
    });
  });

  // Branch context: show manufacturing sidebar only for wholesale branch
  try {
    const ctx = await api('/api/context');
    const mfgSection = document.getElementById('mfg-nav-section');
    if (mfgSection && ctx.branch_type === 'wholesale') {
      mfgSection.style.display = '';
      // Wire up click handlers for manufacturing nav items added dynamically
      mfgSection.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          nav(item.dataset.page);
        });
      });
    }
    // Admins see manufacturing regardless (no branch assigned yet)
    if (mfgSection && ctx.is_admin && !ctx.branch_type) {
      mfgSection.style.display = '';
      mfgSection.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          nav(item.dataset.page);
        });
      });
    }
  } catch(e) {
    // Context unavailable — hide manufacturing section
    const mfgSection = document.getElementById('mfg-nav-section');
    if (mfgSection) mfgSection.style.display = 'none';
  }

  nav('dashboard');
});

// ══════════════════════════════════════════════════════════════════════════════
// 🧵 TAILORING MODULE
// Five screens: POS, Orders List, Order Detail, Service Catalog, Artisan Board
// All API calls hit /api/tailoring/* endpoints (server/routes/tailoring.js)
// ══════════════════════════════════════════════════════════════════════════════

// ── Status helpers ────────────────────────────────────────────────────────────
const TAILORING_STATUS_LABELS = {
  NEW:           { ar: 'جديد',           cls: 'badge-info'    },
  IN_PRODUCTION: { ar: 'قيد الإنتاج',    cls: 'badge-warning' },
  PARTIAL_READY: { ar: 'جاهز جزئياً',    cls: 'badge-warning' },
  READY:         { ar: 'جاهز',           cls: 'badge-success' },
  DELIVERED:     { ar: 'تم التسليم',      cls: 'badge-success' },
  CANCELLED:     { ar: 'ملغى',           cls: 'badge-danger'  },
  ASSIGNED:      { ar: 'مُسنَد',          cls: 'badge-info'    },
  IN_PROGRESS:   { ar: 'قيد التنفيذ',    cls: 'badge-warning' },
  DONE:          { ar: 'منجز',           cls: 'badge-success' },
  PENDING:       { ar: 'في الانتظار',     cls: 'badge-info'    },
};
function tBadge(status) {
  const s = TAILORING_STATUS_LABELS[status] || { ar: status, cls: 'badge-info' };
  return `<span class="badge ${s.cls}">${s.ar}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1: TAILORING POS  (نقطة بيع الخياطة)
// Create order → add garment → add services + materials
// ─────────────────────────────────────────────────────────────────────────────
async function loadTailoringPOS(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [clients, catalog, branches, colors, productTypes] = await Promise.all([
      api('/api/clients').catch(() => []),
      api('/api/tailoring/catalog').catch(() => []),
      api('/api/branches').catch(() => []),
      api('/api/color-master').catch(() => []),
      api('/api/product-types').catch(() => []),
    ]);

    // State
    let garments = [];   // { garmentType, colorId, quantity, services:[], materials:[] }
    let currentGarmentIdx = null;

    function serviceRow(svc, gi, si) {
      return `<tr>
        <td>${svc.serviceType}</td>
        <td>${svc.quantity} ${svc.unit}</td>
        <td>${fmt(svc.price)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="window._tposSvcDel(${gi},${si})">🗑️</button></td>
      </tr>`;
    }
    function materialRow(mat, gi, mi) {
      const pt = productTypes.find(p => p.id == mat.productTypeId);
      return `<tr>
        <td>${pt ? pt.name : mat.productTypeId || '—'}</td>
        <td>${mat.quantity} ${mat.unit}</td>
        <td><button class="btn btn-sm btn-danger" onclick="window._tposMtlDel(${gi},${mi})">🗑️</button></td>
      </tr>`;
    }
    function garmentCard(g, gi) {
      const svcsTotal = g.services.reduce((s, sv) => s + (sv.price * sv.quantity), 0);
      return `<div class="card" style="margin-bottom:12px;padding:14px;border:2px solid ${gi===currentGarmentIdx?'#3b82f6':'#e2e8f0'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-family:'Cairo',sans-serif">🧥 ${g.garmentType} × ${g.quantity}</strong>
          <span style="color:#10b981;font-weight:700">${fmt(svcsTotal)}</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" onclick="window._tposSelectGarment(${gi})">✏️ تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="window._tposDelGarment(${gi})">🗑️</button>
          </div>
        </div>
        ${g.services.length ? `<table style="width:100%;font-size:.8rem;margin-bottom:6px"><thead><tr>
          <th>الخدمة</th><th>الكمية</th><th>السعر</th><th></th></tr></thead>
          <tbody>${g.services.map((sv,si) => serviceRow(sv,gi,si)).join('')}</tbody></table>` : '<p style="color:#94a3b8;font-size:.8rem;margin:0">لا توجد خدمات بعد</p>'}
        ${g.materials.length ? `<table style="width:100%;font-size:.8rem"><thead><tr>
          <th>المادة</th><th>الكمية</th><th></th></tr></thead>
          <tbody>${g.materials.map((m,mi) => materialRow(m,gi,mi)).join('')}</tbody></table>` : ''}
      </div>`;
    }

    function render() {
      const total = garments.reduce((s, g) => s + g.services.reduce((ss, sv) => ss + sv.price * sv.quantity, 0), 0);
      const cg    = currentGarmentIdx !== null ? garments[currentGarmentIdx] : null;

      c.innerHTML = `
      <div class="page-header"><h2>🛍️ نقطة بيع الخياطة</h2></div>
      <div style="display:grid;grid-template-columns:1fr 380px;gap:16px;align-items:start">

        <!-- LEFT: Customer + Garments -->
        <div>
          <!-- Customer -->
          <div class="card" style="padding:14px;margin-bottom:12px">
            <h3 style="margin-bottom:10px;font-family:'Cairo',sans-serif">👤 العميل</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>اختر عميلاً</label>
                <select id="tpos-client" class="form-control">
                  <option value="">-- زيارة عادية (بدون تسجيل) --</option>
                  ${clients.map(cl => `<option value="${cl.id}">${cl.name} ${cl.phone ? '| '+cl.phone : ''}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>أو أدخل اسم العميل</label>
                <input id="tpos-cname" class="form-control" placeholder="اسم العميل (اختياري)" />
              </div>
              <div class="form-group">
                <label>الفرع</label>
                <select id="tpos-branch" class="form-control">
                  ${branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Garments list -->
          <div class="card" style="padding:14px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <h3 style="margin:0;font-family:'Cairo',sans-serif">🧥 القطع (${garments.length})</h3>
              <button class="btn" onclick="window._tposAddGarment()">➕ إضافة قطعة</button>
            </div>
            <div id="tpos-garments">
              ${garments.length === 0
                ? '<div class="alert alert-info" style="margin:0">لم تُضف أي قطعة بعد. اضغط ➕ لإضافة أولى القطع.</div>'
                : garments.map((g, gi) => garmentCard(g, gi)).join('')}
            </div>
          </div>

          <!-- Add service / material panel for selected garment -->
          ${cg ? `<div class="card" style="padding:14px;border:2px solid #3b82f6">
            <h3 style="margin-bottom:10px;font-family:'Cairo',sans-serif">✂️ إضافة خدمة / مادة للقطعة: ${cg.garmentType}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <!-- service -->
              <div>
                <h4 style="font-size:.9rem;color:#374151;margin-bottom:8px">🪡 خدمة جديدة</h4>
                <div class="form-group"><label>الخدمة</label>
                  <select id="tpos-svc-type" class="form-control">
                    ${catalog.map(s => `<option value="${s.name}" data-price="${s.base_price}" data-unit="${s.unit}">${s.name_ar || s.name}</option>`).join('')}
                    <option value="__custom__">أخرى (يدوي)</option>
                  </select>
                </div>
                <div class="form-group"><label>الكمية</label><input id="tpos-svc-qty" class="form-control" type="number" value="1" min="0.1" step="0.1" /></div>
                <div class="form-group"><label>الوحدة</label><input id="tpos-svc-unit" class="form-control" value="unit" /></div>
                <div class="form-group"><label>السعر (DH)</label><input id="tpos-svc-price" class="form-control" type="number" value="0" step="0.01" /></div>
                <button class="btn btn-primary" style="width:100%" onclick="window._tposSvcAdd(${currentGarmentIdx})">➕ إضافة خدمة</button>
              </div>
              <!-- material -->
              <div>
                <h4 style="font-size:.9rem;color:#374151;margin-bottom:8px">🧶 مادة خام</h4>
                <div class="form-group"><label>نوع المنتج</label>
                  <select id="tpos-mat-pt" class="form-control">
                    <option value="">-- اختر --</option>
                    ${productTypes.map(pt => `<option value="${pt.id}">${pt.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group"><label>الكمية</label><input id="tpos-mat-qty" class="form-control" type="number" value="1" min="0.01" step="0.01" /></div>
                <div class="form-group"><label>الوحدة</label><input id="tpos-mat-unit" class="form-control" value="قياد" /></div>
                <button class="btn" style="width:100%;margin-top:28px" onclick="window._tposMtlAdd(${currentGarmentIdx})">➕ إضافة مادة</button>
              </div>
            </div>
          </div>` : ''}
        </div>

        <!-- RIGHT: Order summary + confirm -->
        <div>
          <div class="card" style="padding:16px;position:sticky;top:80px">
            <h3 style="margin-bottom:14px;font-family:'Cairo',sans-serif">📝 ملخص الطلب</h3>
            <table style="width:100%;border-collapse:collapse;font-size:.875rem;margin-bottom:12px">
              <tbody>
                ${garments.map((g,gi) => `
                  <tr><td style="padding:5px 0;font-family:'Cairo',sans-serif;color:#374151">${g.garmentType}</td>
                  <td style="text-align:left;color:#10b981;font-weight:600">${fmt(g.services.reduce((s,sv)=>s+sv.price*sv.quantity,0))}</td></tr>
                  ${g.services.map(sv => `<tr style="font-size:.8rem"><td style="padding:2px 0 2px 16px;color:#6b7280">${sv.serviceType} ${sv.quantity}${sv.unit}</td><td style="text-align:left;color:#6b7280">${fmt(sv.price)}</td></tr>`).join('')}
                `).join('')}
              </tbody>
            </table>
            <div style="border-top:2px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-weight:700;font-family:'Cairo',sans-serif">
              <span>الإجمالي</span><span style="color:#10b981">${fmt(total)}</span>
            </div>
            <button class="btn btn-success" style="width:100%;margin-top:14px;padding:12px;font-size:1rem;font-weight:700"
              onclick="window._tposSubmit()">✅ تأكيد الطلب</button>
            <button class="btn" style="width:100%;margin-top:8px" onclick="nav('tailoring-orders')">📋 قائمة الطلبات</button>
          </div>
        </div>
      </div>`;

      // Wire catalog select to auto-fill unit/price
      const svcSel = document.getElementById('tpos-svc-type');
      if (svcSel) svcSel.addEventListener('change', () => {
        const opt = svcSel.selectedOptions[0];
        const unitEl  = document.getElementById('tpos-svc-unit');
        const priceEl = document.getElementById('tpos-svc-price');
        if (unitEl && opt.dataset.unit)   unitEl.value  = opt.dataset.unit;
        if (priceEl && opt.dataset.price) priceEl.value = opt.dataset.price;
      });
    }

    // ── Window handlers ──────────────────────────────────────────────────────
    window._tposAddGarment = () => {
      const garmentTypes = ['كفطان','جلابة','برنوس','قفطان','تكشيطة','سلهام','أخرى'];
      modal('إضافة قطعة خياطة', `
        <div class="form-group"><label>نوع القطعة</label>
          <select id="ag-type" class="form-control">
            ${garmentTypes.map(g => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>أو أدخل يدوياً</label>
          <input id="ag-custom" class="form-control" placeholder="مثال: Caftan" /></div>
        <div class="form-group"><label>اللون</label>
          <select id="ag-color" class="form-control">
            <option value="">-- بدون لون --</option>
            ${colors.map(cl => `<option value="${cl.id}">${cl.internal_ar_name || cl.color_code}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>الكمية</label>
          <input id="ag-qty" class="form-control" type="number" value="1" min="1" /></div>
        <button class="btn btn-primary" onclick="window._tposDoAddGarment()">➕ إضافة</button>
      `);
    };

    window._tposDoAddGarment = () => {
      const custom = document.getElementById('ag-custom').value.trim();
      const type   = custom || document.getElementById('ag-type').value;
      const colorId = document.getElementById('ag-color').value;
      const qty = parseInt(document.getElementById('ag-qty').value) || 1;
      if (!type) return toast('اختر أو أدخل نوع القطعة', 'danger');
      garments.push({ garmentType: type, colorId: colorId || null, quantity: qty, services: [], materials: [] });
      currentGarmentIdx = garments.length - 1;
      document.getElementById('modal-container').innerHTML = '';
      render();
      toast(`تمت إضافة القطعة: ${type}`, 'success');
    };

    window._tposSelectGarment = (gi) => { currentGarmentIdx = gi; render(); };

    window._tposDelGarment = (gi) => {
      if (!confirm('حذف هذه القطعة؟')) return;
      garments.splice(gi, 1);
      if (currentGarmentIdx >= garments.length) currentGarmentIdx = garments.length ? garments.length - 1 : null;
      render();
    };

    window._tposSvcAdd = (gi) => {
      const typeEl  = document.getElementById('tpos-svc-type');
      const qty     = parseFloat(document.getElementById('tpos-svc-qty').value) || 1;
      const unit    = document.getElementById('tpos-svc-unit').value.trim() || 'unit';
      const price   = parseFloat(document.getElementById('tpos-svc-price').value) || 0;
      const svcType = typeEl.value === '__custom__'
        ? prompt('أدخل اسم الخدمة:') : typeEl.value;
      if (!svcType) return;
      garments[gi].services.push({ serviceType: svcType, quantity: qty, unit, price });
      render();
      toast('تمت إضافة الخدمة');
    };

    window._tposSvcDel = (gi, si) => { garments[gi].services.splice(si, 1); render(); };

    window._tposMtlAdd = (gi) => {
      const ptId = document.getElementById('tpos-mat-pt').value;
      const qty  = parseFloat(document.getElementById('tpos-mat-qty').value) || 1;
      const unit = document.getElementById('tpos-mat-unit').value.trim() || 'qiyad';
      garments[gi].materials.push({ productTypeId: ptId || null, quantity: qty, unit });
      render();
      toast('تمت إضافة المادة');
    };

    window._tposMtlDel = (gi, mi) => { garments[gi].materials.splice(mi, 1); render(); };

    window._tposSubmit = async () => {
      const branchId = parseInt(document.getElementById('tpos-branch').value);
      const clientId = document.getElementById('tpos-client').value;
      const clientName = document.getElementById('tpos-cname').value.trim();
      if (!branchId) return toast('اختر الفرع', 'danger');
      if (garments.length === 0) return toast('أضف قطعة واحدة على الأقل', 'danger');

      try {
        const result = await api('/api/tailoring/orders', {
          method: 'POST',
          body: JSON.stringify({
            branchId,
            clientId: clientId || null,
            clientName: clientName || null,
            createdBy: USER,
            garments: garments.map(g => ({
              garmentType: g.garmentType,
              colorId: g.colorId || null,
              quantity: g.quantity,
              services: g.services,
              materials: g.materials,
            })),
          }),
        });
        toast(`✅ تم إنشاء الطلب: ${result.orderNumber}`, 'success');
        garments = [];
        currentGarmentIdx = null;
        nav('tailoring-orders');
      } catch(err) {
        toast(err.message, 'danger');
      }
    };

    render();
  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2: TAILORING ORDERS LIST  (طلبات الخياطة)
// ─────────────────────────────────────────────────────────────────────────────
async function loadTailoringOrders(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const statusFilter = window._tailoringStatusFilter || '';
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const orders = await api('/api/tailoring/orders' + params);

    const statusTabs = ['', 'NEW', 'IN_PRODUCTION', 'PARTIAL_READY', 'READY', 'DELIVERED'];
    const tabLabels  = { '': 'الكل', NEW: 'جديد', IN_PRODUCTION: 'قيد الإنتاج', PARTIAL_READY: 'جاهز جزئياً', READY: 'جاهز', DELIVERED: 'مُسلَّم' };

    c.innerHTML = `
      <div class="page-header">
        <h2>📋 طلبات الخياطة</h2>
        <button class="btn btn-success" onclick="nav('tailoring-pos')">➕ طلب جديد</button>
      </div>

      <!-- Status filter tabs -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${statusTabs.map(s => `
          <button class="btn ${s === statusFilter ? 'btn-primary' : ''}"
            style="font-family:'Cairo',sans-serif;font-size:.8rem;padding:5px 14px"
            onclick="window._tailoringStatusFilter='${s}';loadTailoringOrders(document.getElementById('page-container'))">
            ${tabLabels[s]}
          </button>`).join('')}
      </div>

      ${orders.length === 0
        ? `<div class="alert alert-info">لا توجد طلبات${statusFilter ? ' بهذا الحالة' : ''}</div>`
        : `<div class="table-container"><table>
            <thead><tr>
              <th>رقم الطلب</th><th>العميل</th><th>التاريخ</th>
              <th>القطع</th><th>الإجمالي</th><th>الحالة</th><th>إجراءات</th>
            </tr></thead>
            <tbody>
              ${orders.map(o => `<tr>
                <td class="font-bold" style="font-family:monospace">${o.order_number}</td>
                <td>${o.client_name || o.client_name_resolved || '<span style="color:#94a3b8">—</span>'}</td>
                <td>${fmtDate(o.order_date)}</td>
                <td><span class="badge badge-info">${o.garment_count || 0}</span></td>
                <td class="font-bold" style="color:#10b981">${fmt(o.total_price)}</td>
                <td>${tBadge(o.status)}</td>
                <td>
                  <button class="btn btn-sm" onclick="window._tailoringViewOrder(${o.id})">👁️ تفاصيل</button>
                  ${o.status === 'READY' ? `<button class="btn btn-sm btn-success" onclick="window._tailoringDeliver(${o.id})">✅ تسليم</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>`}
    `;

    window._tailoringViewOrder = (id) => {
      window._tailoringDetailId = id;
      nav('tailoring-order-detail');
    };

    window._tailoringDeliver = async (id) => {
      if (!confirm('تأكيد تسليم الطلب؟')) return;
      try {
        await api(`/api/tailoring/orders/${id}/deliver`, { method: 'POST' });
        toast('تم تسليم الطلب ✅', 'success');
        loadTailoringOrders(c);
      } catch(err) { toast(err.message, 'danger'); }
    };

  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3: ORDER DETAIL  (تفاصيل الطلب)
// ─────────────────────────────────────────────────────────────────────────────
async function loadTailoringOrderDetail(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const orderId = window._tailoringDetailId;
  if (!orderId) { c.innerHTML = '<div class="alert alert-warning">لم يتم تحديد طلب. عد إلى قائمة الطلبات.</div>'; return; }
  try {
    const [order, artisans] = await Promise.all([
      api(`/api/tailoring/orders/${orderId}`),
      api('/api/tailoring/artisans').catch(() => []),
    ]);

    const svcStatusOpts = {
      ASSIGNED:    'مُسنَد',
      IN_PROGRESS: 'قيد التنفيذ',
      DONE:        'منجز',
    };

    function garmentBlock(g) {
      return `
        <div class="card" style="margin-bottom:14px;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <strong style="font-family:'Cairo',sans-serif">🧥 ${g.garment_type} × ${g.quantity}</strong>
            ${tBadge(g.status)}
          </div>
          <!-- Services -->
          ${g.services && g.services.length ? `
            <h4 style="font-size:.85rem;color:#6b7280;margin-bottom:6px">الخدمات</h4>
            <table style="width:100%;font-size:.82rem;margin-bottom:12px">
              <thead><tr><th>الخدمة</th><th>الكمية</th><th>السعر</th><th>الحرفي</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>${g.services.map(sv => `<tr>
                <td>${sv.service_type}</td>
                <td>${sv.quantity} ${sv.unit}</td>
                <td>${fmt(sv.price)}</td>
                <td>${sv.artisan_name || '<span style="color:#94a3b8">غير مُسنَد</span>'}</td>
                <td>${tBadge(sv.status)}</td>
                <td style="white-space:nowrap">
                  ${sv.status !== 'DONE' ? `
                    <select id="svc-artisan-${sv.id}" class="form-control" style="display:inline-block;width:auto;font-size:.75rem;padding:2px 6px;margin-left:4px">
                      <option value="">-- حرفي --</option>
                      ${artisans.map(a => `<option value="${a.id}" ${a.id == sv.artisan_id ? 'selected' : ''}>${a.name}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm" onclick="window._tAssign(${sv.id})">💾</button>
                    <select id="svc-status-${sv.id}" class="form-control" style="display:inline-block;width:auto;font-size:.75rem;padding:2px 6px;margin-left:4px">
                      ${Object.entries(svcStatusOpts).map(([k,v]) => `<option value="${k}" ${sv.status === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-success" onclick="window._tSetStatus(${sv.id})">✅</button>
                  ` : '<span style="color:#10b981;font-size:.8rem">✅ منتهي</span>'}
                </td>
              </tr>`).join('')}</tbody>
            </table>` : '<p style="color:#94a3b8;font-size:.8rem">لا توجد خدمات</p>'}

          <!-- Materials -->
          ${g.materials && g.materials.length ? `
            <h4 style="font-size:.85rem;color:#6b7280;margin-bottom:6px">المواد المستهلكة</h4>
            <table style="width:100%;font-size:.82rem">
              <thead><tr><th>المادة</th><th>الكمية</th><th>الوحدة</th><th>المستودع</th><th>الاستهلاك</th></tr></thead>
              <tbody>${g.materials.map(m => `<tr>
                <td>${m.product_name_resolved || m.product_name || '—'}</td>
                <td>${m.quantity}</td><td>${m.unit}</td>
                <td>${m.warehouse_name || '—'}</td>
                <td>${m.consumed ? '<span class="badge badge-success">مُستَهلَك</span>' : '<span class="badge badge-info">انتظار</span>'}</td>
              </tr>`).join('')}</tbody>
            </table>` : ''}
        </div>`;
    }

    c.innerHTML = `
      <div class="page-header">
        <h2>📄 تفاصيل الطلب</h2>
        <button class="btn" onclick="nav('tailoring-orders')">← العودة للقائمة</button>
      </div>

      <!-- Order header -->
      <div class="card" style="padding:14px;margin-bottom:14px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px" >
          <div><label style="color:#6b7280;font-size:.8rem">رقم الطلب</label><div class="font-bold" style="font-family:monospace">${order.order_number}</div></div>
          <div><label style="color:#6b7280;font-size:.8rem">العميل</label><div>${order.client_name || order.client_name_resolved || '—'}</div></div>
          <div><label style="color:#6b7280;font-size:.8rem">التاريخ</label><div>${fmtDate(order.order_date)}</div></div>
          <div><label style="color:#6b7280;font-size:.8rem">الإجمالي</label><div class="font-bold" style="color:#10b981">${fmt(order.total_price)}</div></div>
          <div><label style="color:#6b7280;font-size:.8rem">الحالة</label><div>${tBadge(order.status)}</div></div>
        </div>
        ${order.notes ? `<div style="margin-top:8px;font-size:.85rem;color:#374151;background:#f8fafc;padding:6px 10px;border-radius:6px">${order.notes}</div>` : ''}
        <div style="margin-top:10px;display:flex;gap:8px">
          ${order.status !== 'DELIVERED' ? `<button class="btn btn-success" onclick="window._tDeliverOrder(${order.id})">✅ تسليم الطلب</button>` : ''}
          <button class="btn" onclick="window._tAddGarmentToOrder(${order.id})">➕ إضافة قطعة</button>
        </div>
      </div>

      <!-- Garments -->
      <h3 style="font-family:'Cairo',sans-serif;margin-bottom:10px">القطع (${order.garments ? order.garments.length : 0})</h3>
      ${order.garments && order.garments.length ? order.garments.map(garmentBlock).join('') : '<div class="alert alert-info">لا توجد قطع</div>'}
    `;

    window._tAssign = async (svcId) => {
      const artisanId = document.getElementById(`svc-artisan-${svcId}`).value;
      if (!artisanId) return toast('اختر حرفياً', 'danger');
      try {
        await api(`/api/tailoring/services/${svcId}/assign`, { method: 'PUT', body: JSON.stringify({ artisanId: parseInt(artisanId) }) });
        toast('تم التعيين', 'success');
        loadTailoringOrderDetail(c);
      } catch(err) { toast(err.message, 'danger'); }
    };

    window._tSetStatus = async (svcId) => {
      const status = document.getElementById(`svc-status-${svcId}`).value;
      try {
        await api(`/api/tailoring/services/${svcId}/status`, { method: 'PUT', body: JSON.stringify({ status, createdBy: USER }) });
        toast(`الحالة: ${svcStatusOpts[status]}`, 'success');
        loadTailoringOrderDetail(c);
      } catch(err) { toast(err.message, 'danger'); }
    };

    window._tDeliverOrder = async (id) => {
      if (!confirm('تأكيد تسليم الطلب بالكامل؟')) return;
      try {
        await api(`/api/tailoring/orders/${id}/deliver`, { method: 'POST' });
        toast('تم التسليم ✅', 'success');
        loadTailoringOrderDetail(c);
      } catch(err) { toast(err.message, 'danger'); }
    };

    window._tAddGarmentToOrder = (id) => {
      modal('إضافة قطعة للطلب', `
        <div class="form-group"><label>نوع القطعة</label>
          <input id="ag2-type" class="form-control" placeholder="مثال: كفطان" /></div>
        <div class="form-group"><label>الكمية</label>
          <input id="ag2-qty" class="form-control" type="number" value="1" min="1" /></div>
        <button class="btn btn-primary" onclick="window._tDoAddGarment(${id})">إضافة</button>
      `);
    };

    window._tDoAddGarment = async (id) => {
      const garmentType = document.getElementById('ag2-type').value.trim();
      const quantity    = parseInt(document.getElementById('ag2-qty').value) || 1;
      if (!garmentType) return toast('أدخل نوع القطعة', 'danger');
      try {
        await api(`/api/tailoring/orders/${id}/garments`, { method: 'POST', body: JSON.stringify({ garmentType, quantity }) });
        toast('تمت الإضافة', 'success');
        document.getElementById('modal-container').innerHTML = '';
        loadTailoringOrderDetail(c);
      } catch(err) { toast(err.message, 'danger'); }
    };

  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4: SERVICE CATALOG  (كتالوج الخدمات)
// ─────────────────────────────────────────────────────────────────────────────
async function loadTailoringCatalog(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const catalog = await api('/api/tailoring/catalog');
    c.innerHTML = `
      <div class="page-header">
        <h2>📖 كتالوج خدمات الخياطة</h2>
        <button class="btn" onclick="window._tCatalogAdd()">➕ إضافة خدمة</button>
      </div>
      <div class="alert alert-info">
        💡 هذه الخدمات تظهر في نقطة البيع عند إضافة طلب خياطة.
      </div>
      <div class="table-container"><table>
        <thead><tr><th>الاسم</th><th>الاسم العربي</th><th>الوحدة</th><th>السعر الأساسي</th></tr></thead>
        <tbody>
          ${catalog.length === 0
            ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">لا توجد خدمات في الكتالوج</td></tr>`
            : catalog.map(s => `<tr>
                <td class="font-bold">${s.name}</td>
                <td>${s.name_ar || '—'}</td>
                <td><span class="badge badge-info">${s.unit}</span></td>
                <td class="font-bold" style="color:#10b981">${fmt(s.base_price)}</td>
              </tr>`).join('')}
        </tbody>
      </table></div>
    `;

    window._tCatalogAdd = () => {
      modal('إضافة خدمة للكتالوج', `<form>
        <div class="form-grid">
          <div class="form-group"><label class="required">الاسم (بالإنجليزية)</label><input name="name" class="form-control" placeholder="مثال: Sfifa" required /></div>
          <div class="form-group"><label>الاسم بالعربية</label><input name="nameAr" class="form-control" placeholder="مثال: سفيفة" /></div>
          <div class="form-group"><label>الوحدة</label>
            <select name="unit" class="form-control">
              <option value="meter">متر</option><option value="unit">وحدة</option>
              <option value="piece">قطعة</option>
            </select>
          </div>
          <div class="form-group"><label>السعر الأساسي</label><input name="basePrice" class="form-control" type="number" value="0" step="0.01" /></div>
        </div>
        <button type="submit" class="btn btn-success">💾 حفظ</button>
      </form>`, async (e) => {
        const fd = new FormData(e.target);
        await api('/api/tailoring/catalog', {
          method: 'POST',
          body: JSON.stringify({ name: fd.get('name'), nameAr: fd.get('nameAr'), unit: fd.get('unit'), basePrice: parseFloat(fd.get('basePrice')) || 0 }),
        });
        toast('تمت الإضافة');
        loadTailoringCatalog(c);
      });
    };
  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5: ARTISAN BOARD  (لوحة الحرفيين)
// Overview of all services, grouped by artisan and status
// ─────────────────────────────────────────────────────────────────────────────
async function loadTailoringArtisanBoard(c) {
  c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [artisans, orders] = await Promise.all([
      api('/api/tailoring/artisans'),
      api('/api/tailoring/orders?status=IN_PRODUCTION').catch(() =>
        api('/api/tailoring/orders').catch(() => [])),
    ]);

    // Flatten all services from all orders
    const services = [];
    for (const order of orders) {
      if (!order.garments) continue;
      for (const g of order.garments) {
        if (!g.services) continue;
        for (const sv of g.services) {
          services.push({ ...sv, order_number: order.order_number, orderId: order.id, garmentType: g.garment_type });
        }
      }
    }

    // Build per-artisan map
    const byArtisan = {};
    for (const sv of services) {
      const key = sv.artisan_id || '__unassigned__';
      if (!byArtisan[key]) byArtisan[key] = { artisan: sv.artisan_name || null, svcs: [] };
      byArtisan[key].svcs.push(sv);
    }

    // Summary counts
    const totals = { ASSIGNED: 0, IN_PROGRESS: 0, DONE: 0 };
    services.forEach(sv => { if (totals[sv.status] !== undefined) totals[sv.status]++; });

    c.innerHTML = `
      <div class="page-header"><h2>👨‍🎨 لوحة الحرفيين</h2></div>

      <!-- Summary -->
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card"><h3>📋 مُسنَد</h3><div class="value">${totals.ASSIGNED}</div></div>
        <div class="stat-card warning"><h3>⚙️ قيد التنفيذ</h3><div class="value">${totals.IN_PROGRESS}</div></div>
        <div class="stat-card success"><h3>✅ منجز</h3><div class="value">${totals.DONE}</div></div>
        <div class="stat-card"><h3>👷 حرفيون</h3><div class="value">${artisans.length}</div></div>
      </div>

      <!-- Per-artisan cards -->
      ${Object.keys(byArtisan).length === 0
        ? `<div class="alert alert-info">لا توجد طلبات قيد الإنتاج حالياً.</div>`
        : Object.entries(byArtisan).map(([key, grp]) => {
            const isUnassigned = key === '__unassigned__';
            const doneCount = grp.svcs.filter(s => s.status === 'DONE').length;
            return `<div class="card" style="margin-bottom:14px;padding:14px;${isUnassigned ? 'border:2px dashed #fbbf24' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <strong style="font-family:'Cairo',sans-serif;font-size:1rem">
                  ${isUnassigned ? '⚠️ غير مُسنَد' : `👷 ${grp.artisan}`}
                </strong>
                <span class="badge badge-info">${doneCount}/${grp.svcs.length} منجز</span>
              </div>
              <table style="width:100%;font-size:.82rem">
                <thead><tr><th>الطلب</th><th>القطعة</th><th>الخدمة</th><th>الكمية</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>
                  ${grp.svcs.map(sv => `<tr>
                    <td style="font-family:monospace;cursor:pointer;color:#3b82f6"
                        onclick="window._tailoringDetailId=${sv.orderId};nav('tailoring-order-detail')">${sv.order_number}</td>
                    <td>${sv.garmentType}</td>
                    <td>${sv.service_type}</td>
                    <td>${sv.quantity} ${sv.unit}</td>
                    <td>${tBadge(sv.status)}</td>
                    <td>
                      ${sv.status !== 'DONE' ? `
                        <button class="btn btn-sm ${sv.status === 'ASSIGNED' ? '' : 'btn-success'}"
                          onclick="window._tBrdAdvance(${sv.id}, '${sv.status}', document.getElementById('page-container'))">
                          ${sv.status === 'ASSIGNED' ? '▶ بدء' : '✅ إنجاز'}
                        </button>` : '✅'}
                    </td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
          }).join('')}
    `;

    window._tBrdAdvance = async (svcId, currentStatus, container) => {
      const nextStatus = currentStatus === 'ASSIGNED' ? 'IN_PROGRESS' : 'DONE';
      try {
        await api(`/api/tailoring/services/${svcId}/status`, { method: 'PUT', body: JSON.stringify({ status: nextStatus, createdBy: USER }) });
        toast(`تم التحديث: ${TAILORING_STATUS_LABELS[nextStatus].ar}`, 'success');
        loadTailoringArtisanBoard(container);
      } catch(err) { toast(err.message, 'danger'); }
    };

  } catch(e) {
    c.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POS SUPPLIES — نقطة بيع لوازم الخياطة
// Standard retail POS for the سewing supplies (لوازم الخياطة) branch.
// Uses inventory stage = 'supplies'. No sabra color logic.
// ══════════════════════════════════════════════════════════════════════════════
async function loadPOSSupplies(c) {
  const [invData, clients] = await Promise.all([
    api('/api/inventory/by-category?stage=supplies'),
    api('/api/clients')
  ]);
  const { inventory, categories } = invData;

  if (!window._psKeepCart) {
    window.psCart     = [];
    window.psClientId = null;
    window.psDiscount = 0;
  }
  window._psKeepCart = false;

  const allProducts = inventory || [];

  function renderPS() {
    const subtotal  = window.psCart.reduce((s, i) => s + i.qty * i.price, 0);
    const discount  = window.psDiscount || 0;
    const total     = Math.max(0, subtotal - discount);
    const cartHTML  = window.psCart.length === 0
      ? `<div class="pos-empty"><div class="pos-empty-icon">🛍️</div><p>السلة فارغة</p></div>`
      : window.psCart.map((item, idx) => `
          <div class="pos-item">
            <div class="pos-item-info">
              <div class="pos-item-name">${item.name}</div>
              <div class="pos-item-details">${item.price.toFixed(2)} د.م × ${item.qty}</div>
            </div>
            <div class="pos-item-qty">
              <button class="minus" onclick="psQty(${idx},-1)">−</button>
              <span>${item.qty}</span>
              <button class="plus" onclick="psQty(${idx},1)">+</button>
            </div>
            <div class="pos-item-total">${(item.qty * item.price).toFixed(2)}</div>
          </div>`).join('');

    document.getElementById('ps-cart-body').innerHTML  = cartHTML;
    document.getElementById('ps-subtotal').textContent = subtotal.toFixed(2) + ' د.م';
    document.getElementById('ps-discount').textContent = discount.toFixed(2) + ' د.م';
    document.getElementById('ps-total').textContent    = total.toFixed(2)    + ' د.م';
  }

  c.innerHTML = `
    <style>
      .ps-container { display: grid; grid-template-columns: 1fr 380px; gap: 16px; height: calc(100vh - 130px); }
      .ps-products  { display: flex; flex-direction: column; overflow: hidden; }
      .ps-search    { padding: 12px 0; }
      .ps-search input { width: 100%; padding: 10px 14px; border: 2px solid var(--border); border-radius: 25px; font-family: 'Cairo'; font-size: 14px; }
      .ps-search input:focus { border-color: var(--primary); outline: none; }
      .ps-grid      { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px,1fr)); gap: 10px; overflow-y: auto; padding: 4px 0; flex: 1; }
      .ps-card      { background: white; border-radius: 10px; padding: 14px; text-align: center; cursor: pointer; border: 2px solid var(--border); transition: all 0.2s; }
      .ps-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); border-color: var(--primary); }
      .ps-card-icon { font-size: 36px; margin-bottom: 6px; }
      .ps-card-name { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
      .ps-card-price{ font-weight: 900; color: var(--success); font-size: 13px; }
      .ps-card-qty  { font-size: 11px; color: #888; }
      .ps-receipt   { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
      .ps-receipt-hdr { background: linear-gradient(135deg,#0f3460,#1a1a2e); color: white; padding: 16px; text-align: center; }
      .ps-receipt-hdr h3 { font-size: 16px; margin: 0; }
      .ps-client    { padding: 12px; background: #f8f9fa; border-bottom: 1px dashed var(--border); }
      .ps-client select, .ps-client input { width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-family: 'Cairo'; margin-bottom: 6px; font-size: 13px; }
      .ps-items     { flex: 1; overflow-y: auto; padding: 8px; }
      .ps-totals    { padding: 12px; background: #f8f9fa; border-top: 2px dashed var(--border); }
      .ps-total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
      .ps-total-row.final { font-size: 18px; font-weight: 900; color: var(--primary); padding-top: 8px; border-top: 2px solid var(--primary); }
      .ps-actions   { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      .ps-pay-btn   { padding: 14px; border: none; border-radius: 10px; background: var(--success); color: white; font-weight: 700; font-size: 15px; font-family: 'Cairo'; cursor: pointer; }
      .ps-pay-btn:hover { background: #059669; }
      .ps-clear-btn { padding: 10px; border: none; border-radius: 8px; background: var(--danger); color: white; font-weight: 700; font-size: 13px; font-family: 'Cairo'; cursor: pointer; }
    </style>

    <div class="ps-container">
      <div class="ps-products">
        <div class="ps-search">
          <input id="ps-search-input" type="text" placeholder="🔍 بحث عن منتج..." oninput="psFilter(this.value)">
        </div>
        <div class="ps-grid" id="ps-grid">
          ${allProducts.map(p => `
            <div class="ps-card" onclick="psAdd(${p.id},'${(p.name||'').replace(/'/g,"\\'")}',${p.price||0})">
              <div class="ps-card-icon">🧺</div>
              <div class="ps-card-name">${p.name || '—'}</div>
              <div class="ps-card-price">${(p.price||0).toFixed(2)} د.م</div>
              <div class="ps-card-qty">المخزون: ${p.quantity || 0}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="ps-receipt">
        <div class="ps-receipt-hdr"><h3>🧺 نقطة بيع اللوازم</h3></div>
        <div class="ps-client">
          <select id="ps-client-sel" onchange="window.psClientId=+this.value||null">
            <option value="">— عميل زائر —</option>
            ${(clients||[]).map(cl => `<option value="${cl.id}">${cl.name}</option>`).join('')}
          </select>
          <input id="ps-discount-inp" type="number" placeholder="خصم (د.م)" min="0" step="0.5"
            oninput="window.psDiscount=+this.value||0; renderPS()">
        </div>
        <div class="ps-items" id="ps-cart-body"></div>
        <div class="ps-totals">
          <div class="ps-total-row"><span>المجموع الجزئي</span><span id="ps-subtotal">0.00 د.م</span></div>
          <div class="ps-total-row"><span>الخصم</span><span id="ps-discount">0.00 د.م</span></div>
          <div class="ps-total-row final"><span>الإجمالي</span><span id="ps-total">0.00 د.م</span></div>
        </div>
        <div class="ps-actions">
          <button class="ps-pay-btn" onclick="psCheckout()">💳 إتمام البيع</button>
          <button class="ps-clear-btn" onclick="psClear()">🗑️ مسح السلة</button>
        </div>
      </div>
    </div>`;

  // Expose globals needed by inline onclick handlers
  window._psAllProducts = allProducts;
  window._psContainer   = c;
  window.renderPS       = renderPS;

  window.psAdd = function(id, name, price) {
    const idx = window.psCart.findIndex(i => i.id === id);
    if (idx >= 0) window.psCart[idx].qty++;
    else window.psCart.push({ id, name, price, qty: 1 });
    renderPS();
  };

  window.psQty = function(idx, delta) {
    window.psCart[idx].qty += delta;
    if (window.psCart[idx].qty <= 0) window.psCart.splice(idx, 1);
    renderPS();
  };

  window.psClear = function() {
    window.psCart = []; window.psDiscount = 0;
    document.getElementById('ps-discount-inp').value = '';
    renderPS();
  };

  window.psFilter = function(q) {
    const lq = q.toLowerCase();
    const filtered = lq ? window._psAllProducts.filter(p => (p.name||'').toLowerCase().includes(lq)) : window._psAllProducts;
    document.getElementById('ps-grid').innerHTML = filtered.map(p => `
      <div class="ps-card" onclick="psAdd(${p.id},'${(p.name||'').replace(/'/g,"\\'")}',${p.price||0})">
        <div class="ps-card-icon">🧺</div>
        <div class="ps-card-name">${p.name || '—'}</div>
        <div class="ps-card-price">${(p.price||0).toFixed(2)} د.م</div>
        <div class="ps-card-qty">المخزون: ${p.quantity || 0}</div>
      </div>`).join('');
  };

  window.psCheckout = async function() {
    if (!window.psCart.length) { toast('السلة فارغة', 'warning'); return; }
    const subtotal = window.psCart.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = window.psDiscount || 0;
    const total    = Math.max(0, subtotal - discount);

    const payload = {
      client_id:    window.psClientId || null,
      items:        window.psCart.map(i => ({ inventory_id: i.id, quantity: i.qty, unit_price: i.price, total_price: i.qty * i.price })),
      subtotal,
      discount_amount: discount,
      final_amount: total,
      payment_method: 'cash',
      branch_id:    window.CURRENT_BRANCH_ID || null,
      created_by:   window.CURRENT_USER?.username || 'system'
    };

    try {
      await api('/api/sales/pos', { method: 'POST', body: JSON.stringify(payload) });
      toast('تم إتمام البيع بنجاح ✅', 'success');
      window._psKeepCart = false;
      window.psCart = []; window.psDiscount = 0;
      loadPOSSupplies(c);
    } catch(e) {
      toast(e.message || 'فشل إتمام البيع', 'danger');
    }
  };

  renderPS();
}


