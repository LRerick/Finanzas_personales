let transactions = [];
let fixedExpenses = [];

const CSV_TX_FILE = 'data.csv';
const CSV_FIJOS_FILE = 'gastos_fijos.csv';

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar fecha actual
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('fecha').value = todayStr;

  setupTabs();
  setupListeners();
  loadAllData();
});

// 1. Manejo de Pestañas
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Mostrar campo vencimiento sólo si es Obligación
  const tipoSelect = document.getElementById('tipo');
  const vencField = document.getElementById('vencimientoField');
  tipoSelect.addEventListener('change', () => {
    if (tipoSelect.value === 'Obligacion') {
      vencField.style.display = 'flex';
      document.getElementById('fecha_vencimiento').required = true;
    } else {
      vencField.style.display = 'none';
      document.getElementById('fecha_vencimiento').required = false;
    }
  });
}

// 2. Configurar Listeners
function setupListeners() {
  document.getElementById('txForm').addEventListener('submit', handleAddTransaction);
  document.getElementById('fijosForm').addEventListener('submit', handleAddFixedExpense);
  document.getElementById('csvFileInput').addEventListener('change', handleImportCSV);
  document.getElementById('btnExport').addEventListener('click', handleExportCSV);
  document.getElementById('btnExportFijos').addEventListener('click', handleExportFijosCSV);
  document.getElementById('btnSyncFijos').addEventListener('click', () => {
    autoGenerateMonthlyCommitments();
    updateUI();
  });
  document.getElementById('filterTipo').addEventListener('change', updateUI);
  document.getElementById('filterMoneda').addEventListener('change', updateUI);
}

// 3. Cargar ambos archivos CSV
async function loadAllData() {
  try {
    const resTx = await fetch(CSV_TX_FILE);
    if (resTx.ok) {
      const textTx = await resTx.text();
      parseTxCSV(textTx);
    }
  } catch (e) {
    console.warn('data.csv no cargado directamente por fetch.');
  }

  try {
    const resFijos = await fetch(CSV_FIJOS_FILE);
    if (resFijos.ok) {
      const textFijos = await resFijos.text();
      parseFijosCSV(textFijos);
    }
  } catch (e) {
    console.warn('gastos_fijos.csv no cargado directamente por fetch.');
  }

  // Generar automáticamente las obligaciones del mes basándose en los gastos fijos
  autoGenerateMonthlyCommitments();
  updateUI();
}

// Parser de data.csv
function parseTxCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length <= 1) return;

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 7) {
      parsed.push({
        id: parseInt(cols[0], 10),
        fecha: cols[1],
        tipo: cols[2],
        categoria: cols[3],
        descripcion: cols[4],
        monto: parseFloat(cols[5]) || 0,
        moneda: cols[6] || 'PEN',
        metodo_pago: cols[7] || '',
        es_obligatorio: parseInt(cols[8], 10) === 1 || cols[2] === 'Obligacion',
        fecha_vencimiento: cols[9] || '',
        estado_pago: cols[10] || (cols[2] === 'Obligacion' ? 'Pendiente' : '')
      });
    }
  }
  transactions = parsed;
}

// Parser de gastos_fijos.csv
function parseFijosCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length <= 1) return;

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 6) {
      parsed.push({
        id: parseInt(cols[0], 10),
        dia_mes: parseInt(cols[1], 10),
        categoria: cols[2],
        descripcion: cols[3],
        monto: parseFloat(cols[4]) || 0,
        moneda: cols[5] || 'PEN',
        metodo_pago: cols[6] || 'Débito Automático',
        activo: cols[7] !== undefined ? parseInt(cols[7], 10) === 1 : true
      });
    }
  }
  fixedExpenses = parsed;
}

// 4. GENERACIÓN AUTOMÁTICA DE COMPROMISOS MENSUALES
function autoGenerateMonthlyCommitments() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  fixedExpenses.filter(f => f.activo).forEach(fijo => {
    const day = String(fijo.dia_mes).padStart(2, '0');
    const targetDueDate = `${year}-${month}-${day}`;

    // Validar si ya existe este mes para evitar duplicados
    const alreadyExists = transactions.some(t => 
      t.es_obligatorio && 
      t.fecha_vencimiento === targetDueDate && 
      t.descripcion.trim().toLowerCase() === fijo.descripcion.trim().toLowerCase()
    );

    if (!alreadyExists) {
      const nextId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
      transactions.unshift({
        id: nextId,
        fecha: targetDueDate,
        tipo: 'Obligacion',
        categoria: fijo.categoria,
        descripcion: fijo.descripcion,
        monto: fijo.monto,
        moneda: fijo.moneda,
        metodo_pago: fijo.metodo_pago,
        es_obligatorio: true,
        fecha_vencimiento: targetDueDate,
        estado_pago: 'Pendiente'
      });
    }
  });
}

// 5. Agregar Transacción Puntual (Formulario Pestaña 1)
function handleAddTransaction(e) {
  e.preventDefault();
  const nextId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
  const tipo = document.getElementById('tipo').value;
  const esObligacion = tipo === 'Obligacion';
  const vencimiento = document.getElementById('fecha_vencimiento').value;

  const newTx = {
    id: nextId,
    fecha: document.getElementById('fecha').value,
    tipo: tipo,
    categoria: document.getElementById('categoria').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    monto: parseFloat(document.getElementById('monto').value),
    moneda: document.getElementById('moneda').value,
    metodo_pago: document.getElementById('metodo_pago').value,
    es_obligatorio: esObligacion,
    fecha_vencimiento: esObligacion ? vencimiento : '',
    estado_pago: esObligacion ? 'Pendiente' : ''
  };

  transactions.unshift(newTx);
  updateUI();

  document.getElementById('categoria').value = '';
  document.getElementById('descripcion').value = '';
  document.getElementById('monto').value = '';
  document.getElementById('fecha_vencimiento').value = '';
}

// 6. Agregar Gasto Fijo Recurrente (Formulario Pestaña 2)
function handleAddFixedExpense(e) {
  e.preventDefault();
  const nextId = fixedExpenses.length > 0 ? Math.max(...fixedExpenses.map(f => f.id)) + 1 : 1;

  const newFijo = {
    id: nextId,
    dia_mes: parseInt(document.getElementById('fijo_dia').value, 10),
    categoria: document.getElementById('fijo_categoria').value.trim(),
    descripcion: document.getElementById('fijo_descripcion').value.trim(),
    monto: parseFloat(document.getElementById('fijo_monto').value),
    moneda: document.getElementById('fijo_moneda').value,
    metodo_pago: document.getElementById('fijo_metodo').value,
    activo: true
  };

  fixedExpenses.push(newFijo);
  autoGenerateMonthlyCommitments();
  updateUI();

  document.getElementById('fijosForm').reset();
}

function togglePaymentStatus(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;
  item.estado_pago = item.estado_pago === 'Pagado' ? 'Pendiente' : 'Pagado';
  updateUI();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  updateUI();
}

function deleteFixedExpense(id) {
  fixedExpenses = fixedExpenses.filter(f => f.id !== id);
  updateUI();
}

function handleImportCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    parseTxCSV(event.target.result);
    autoGenerateMonthlyCommitments();
    updateUI();
  };
  reader.readAsText(file, 'UTF-8');
}

function handleExportCSV() {
  const headers = ['id', 'fecha', 'tipo', 'categoria', 'descripcion', 'monto', 'moneda', 'metodo_pago', 'es_obligatorio', 'fecha_vencimiento', 'estado_pago'];
  const rows = transactions.map(t => [
    t.id,
    t.fecha,
    t.tipo,
    `"${t.categoria}"`,
    `"${t.descripcion}"`,
    t.monto.toFixed(2),
    t.moneda,
    `"${t.metodo_pago}"`,
    t.es_obligatorio ? 1 : 0,
    t.fecha_vencimiento || '',
    t.estado_pago || ''
  ].join(','));

  downloadFile([headers.join(','), ...rows].join('\n'), CSV_TX_FILE);
}

function handleExportFijosCSV() {
  const headers = ['id', 'dia_mes', 'categoria', 'descripcion', 'monto', 'moneda', 'metodo_pago', 'activo'];
  const rows = fixedExpenses.map(f => [
    f.id,
    f.dia_mes,
    `"${f.categoria}"`,
    `"${f.descripcion}"`,
    f.monto.toFixed(2),
    f.moneda,
    `"${f.metodo_pago}"`,
    f.activo ? 1 : 0
  ].join(','));

  downloadFile([headers.join(','), ...rows].join('\n'), CSV_FIJOS_FILE);
}

function downloadFile(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

function getDaysRemaining(targetDateStr) {
  if (!targetDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 7. RENDERIZADO GLOBAL
function updateUI() {
  renderKPIs();
  renderObligations();
  renderTable();
  renderFixedExpensesTable();
}

function renderKPIs() {
  let ingPen = 0, egPen = 0;
  let ingUsd = 0, egUsd = 0;

  transactions.forEach(t => {
    const isIncome = t.tipo === 'Ingreso';
    if (t.moneda === 'PEN') {
      if (isIncome) ingPen += t.monto;
      else egPen += t.monto;
    } else if (t.moneda === 'USD') {
      if (isIncome) ingUsd += t.monto;
      else egUsd += t.monto;
    }
  });

  const netoPen = ingPen - egPen;
  const netoUsd = ingUsd - egUsd;

  document.getElementById('kpiIngresosPen').textContent = `S/ ${ingPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  document.getElementById('kpiEgresosPen').textContent = `S/ ${egPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  
  const netoPenNode = document.getElementById('kpiNetoPen');
  netoPenNode.textContent = `S/ ${netoPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  netoPenNode.className = `kpi-num ${netoPen >= 0 ? 'text-success' : 'text-danger'}`;

  document.getElementById('kpiIngresosUsd').textContent = `$ ${ingUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  document.getElementById('kpiEgresosUsd').textContent = `$ ${egUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  
  const netoUsdNode = document.getElementById('kpiNetoUsd');
  netoUsdNode.textContent = `$ ${netoUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  netoUsdNode.className = `kpi-num ${netoUsd >= 0 ? 'text-success' : 'text-danger'}`;
}

function renderObligations() {
  const container = document.getElementById('obligationsCardsList');
  container.innerHTML = '';

  const obligations = transactions.filter(t => t.es_obligatorio || t.tipo === 'Obligacion');
  const pendientes = obligations.filter(t => t.estado_pago === 'Pendiente');
  document.getElementById('pendientesCountBadge').textContent = `${pendientes.length} Pendiente(s)`;

  if (obligations.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim); grid-column: 1 / -1;">No hay compromisos u obligaciones programadas.</p>`;
    return;
  }

  obligations.sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''));

  obligations.forEach(ob => {
    const card = document.createElement('div');
    const daysLeft = getDaysRemaining(ob.fecha_vencimiento);
    const isPaid = ob.estado_pago === 'Pagado';

    let countdownClass = 'count-green';
    let countdownText = `${daysLeft} días restantes`;

    if (daysLeft < 0) {
      countdownClass = 'count-red';
      countdownText = `Venció hace ${Math.abs(daysLeft)} días`;
    } else if (daysLeft === 0) {
      countdownClass = 'count-red';
      countdownText = '¡Vence Hoy!';
    } else if (daysLeft <= 4) {
      countdownClass = 'count-yellow';
      countdownText = `Vence en ${daysLeft} días`;
    }

    if (isPaid) {
      countdownClass = 'count-green';
      countdownText = 'Pagado';
    }

    const urgencyClass = isPaid ? 'pagado' : (daysLeft <= 3 ? 'urgente' : '');
    card.className = `obligation-card ${urgencyClass}`;
    const sym = ob.moneda === 'USD' ? '$' : 'S/';

    card.innerHTML = `
      <div class="ob-header">
        <div>
          <span class="ob-title">${ob.categoria}</span>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${ob.descripcion}</div>
        </div>
        <span class="ob-badge-countdown ${countdownClass}">${countdownText}</span>
      </div>

      <div class="ob-details">
        <span>Límite: <strong>${ob.fecha_vencimiento || 'S/F'}</strong></span>
        <span>${ob.metodo_pago}</span>
      </div>

      <div class="ob-footer">
        <span class="ob-amount">${sym} ${ob.monto.toLocaleString(ob.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}</span>
        <button class="btn-toggle-pay" onclick="togglePaymentStatus(${ob.id})">
          ${isPaid ? 'Marcar Pendiente' : 'Marcar Pagado'}
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderTable() {
  const filterTipo = document.getElementById('filterTipo').value;
  const filterMoneda = document.getElementById('filterMoneda').value;
  const tbody = document.getElementById('txTableBody');
  tbody.innerHTML = '';

  const filtered = transactions.filter(t => {
    const matchTipo = (filterTipo === 'Todos') || (t.tipo === filterTipo);
    const matchMoneda = (filterMoneda === 'Todos') || (t.moneda === filterMoneda);
    return matchTipo && matchMoneda;
  });

  filtered.forEach(t => {
    const row = document.createElement('tr');
    const badgeMap = {
      'Ingreso': 'tag-ingreso',
      'Gasto': 'tag-gasto',
      'Obligacion': 'tag-obligacion',
      'Inversion': 'tag-inversion'
    };
    const badgeClass = badgeMap[t.tipo] || 'tag-gasto';
    const sym = t.moneda === 'USD' ? '$' : 'S/';

    const estadoDetalle = t.es_obligatorio
      ? `<span style="font-size:0.75rem;">${t.fecha_vencimiento || 'S/F'} &bull; <strong>${t.estado_pago}</strong></span>`
      : `<span style="color:var(--text-dim); font-size:0.75rem;">N/A</span>`;

    row.innerHTML = `
      <td>#${t.id}</td>
      <td>${t.fecha}</td>
      <td><span class="tag-badge ${badgeClass}">${t.tipo}</span></td>
      <td>${t.categoria}</td>
      <td>${t.descripcion}</td>
      <td><strong>${sym} ${t.monto.toLocaleString(t.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}</strong> <small style="color:var(--text-dim);">${t.moneda}</small></td>
      <td>${t.metodo_pago}</td>
      <td>${estadoDetalle}</td>
      <td>
        <button class="btn-delete" onclick="deleteTransaction(${t.id})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderFixedExpensesTable() {
  const tbody = document.getElementById('fijosTableBody');
  tbody.innerHTML = '';

  fixedExpenses.forEach(f => {
    const row = document.createElement('tr');
    const sym = f.moneda === 'USD' ? '$' : 'S/';

    row.innerHTML = `
      <td>#${f.id}</td>
      <td>Día <strong>${f.dia_mes}</strong> de cada mes</td>
      <td>${f.categoria}</td>
      <td>${f.descripcion}</td>
      <td><strong>${sym} ${f.monto.toLocaleString(f.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}</strong></td>
      <td>${f.metodo_pago}</td>
      <td><span class="tag-badge tag-ingreso">Activo</span></td>
      <td>
        <button class="btn-delete" onclick="deleteFixedExpense(${f.id})">Eliminar Regla</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}
