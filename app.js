let transactions = [];
const CSV_FILE = 'data.csv';

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de fechas
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fecha').value = today;

  // Manejo de visibilidad del vencimiento según el tipo de operación
  const tipoSelect = document.getElementById('tipo');
  const vencimientoField = document.getElementById('vencimientoField');
  
  tipoSelect.addEventListener('change', () => {
    if (tipoSelect.value === 'Obligacion') {
      vencimientoField.style.display = 'flex';
      document.getElementById('fecha_vencimiento').required = true;
    } else {
      vencimientoField.style.display = 'none';
      document.getElementById('fecha_vencimiento').required = false;
    }
  });

  loadDataCSV();
  initListeners();
});

// Carga del CSV
async function loadDataCSV() {
  try {
    const res = await fetch(CSV_FILE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csvData = await res.text();
    processCSV(csvData);
  } catch (e) {
    console.warn('Carga directa vía fetch no completada. Usa el botón "Importar CSV".');
  }
}

function initListeners() {
  document.getElementById('txForm').addEventListener('submit', handleAddTransaction);
  document.getElementById('csvFileInput').addEventListener('change', handleImportCSV);
  document.getElementById('btnExport').addEventListener('click', handleExportCSV);
  document.getElementById('filterTipo').addEventListener('change', updateUI);
  document.getElementById('filterMoneda').addEventListener('change', updateUI);
}

// Parser adaptado a las columnas extendidas
function processCSV(text) {
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
  updateUI();
}

// Agregar nueva operación
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

  // Reset del formulario
  document.getElementById('categoria').value = '';
  document.getElementById('descripcion').value = '';
  document.getElementById('monto').value = '';
  document.getElementById('fecha_vencimiento').value = '';
}

// Alternar estado de pago de una obligación
function togglePaymentStatus(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;
  item.estado_pago = item.estado_pago === 'Pagado' ? 'Pendiente' : 'Pagado';
  updateUI();
}

// Eliminar registro
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  updateUI();
}

// Importar archivo manual
function handleImportCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => processCSV(event.target.result);
  reader.readAsText(file, 'UTF-8');
}

// Exportar CSV
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

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = CSV_FILE;
  a.click();
}

// Cálculo de días restantes
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

// Renderizado principal
function updateUI() {
  renderKPIs();
  renderObligations();
  renderTable();
}

// Render de tarjetas de balance PEN y USD
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

// Render de la sección del calendario / obligaciones
function renderObligations() {
  const container = document.getElementById('obligationsCardsList');
  container.innerHTML = '';

  const obligations = transactions.filter(t => t.es_obligatorio || t.tipo === 'Obligacion');
  const pendientes = obligations.filter(t => t.estado_pago === 'Pendiente');
  document.getElementById('pendientesCountBadge').textContent = `${pendientes.length} Pendiente(s)`;

  if (obligations.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim); grid-column: 1 / -1;">No hay compromisos u obligaciones fijas registradas.</p>`;
    return;
  }

  // Ordenar por fecha de vencimiento
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
      countdownText = 'Completado';
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
        <span>Vence: <strong>${ob.fecha_vencimiento || 'Sin fecha'}</strong></span>
        <span>Método: ${ob.metodo_pago}</span>
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

// Render de la tabla histórica
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
