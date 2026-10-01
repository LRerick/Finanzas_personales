let transactions = [];
const CSV_FILENAME = 'data.csv';

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar fecha al día corriente
  const dateInput = document.getElementById('fecha');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  loadDataCSV();
  initListeners();
});

// Carga directa mediante fetch del archivo data.csv
async function loadDataCSV() {
  try {
    const response = await fetch(CSV_FILENAME);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const csvContent = await response.text();
    processCSV(csvContent);
  } catch (err) {
    console.warn('Lectura fetch directa bloqueada o archivo inexistente aún en localhost. Usa el botón "Importar CSV".');
  }
}

// Configuración de listeners
function initListeners() {
  document.getElementById('txForm').addEventListener('submit', onAddTransaction);
  document.getElementById('csvFileInput').addEventListener('change', onImportFile);
  document.getElementById('btnExport').addEventListener('click', onExportFile);
  document.getElementById('filterTipo').addEventListener('change', updateUI);
}

// Procesamiento de texto CSV
function processCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length <= 1) return;

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parseo por comas respetando celdas sin comillas compuestas
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 8) {
      parsed.push({
        id: parseInt(cols[0], 10),
        fecha: cols[1],
        tipo: cols[2],
        categoria: cols[3],
        descripcion: cols[4],
        monto: parseFloat(cols[5]) || 0,
        moneda: cols[6],
        metodo_pago: cols[7]
      });
    }
  }

  transactions = parsed;
  updateUI();
}

// Registro de nuevo item
function onAddTransaction(e) {
  e.preventDefault();

  const nextId = transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1;

  const newTx = {
    id: nextId,
    fecha: document.getElementById('fecha').value,
    tipo: document.getElementById('tipo').value,
    categoria: document.getElementById('categoria').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    monto: parseFloat(document.getElementById('monto').value),
    moneda: 'PEN',
    metodo_pago: document.getElementById('metodo_pago').value
  };

  transactions.unshift(newTx);
  updateUI();

  // Reset del formulario
  document.getElementById('categoria').value = '';
  document.getElementById('descripcion').value = '';
  document.getElementById('monto').value = '';
}

// Eliminación de item
function removeTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  updateUI();
}

// Subida manual vía FileReader
function onImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => processCSV(event.target.result);
  reader.readAsText(file, 'UTF-8');
}

// Generación y descarga directa del data.csv actualizado
function onExportFile() {
  const headers = ['id', 'fecha', 'tipo', 'categoria', 'descripcion', 'monto', 'moneda', 'metodo_pago'];
  const rows = transactions.map(t => [
    t.id,
    t.fecha,
    t.tipo,
    `"${t.categoria}"`,
    `"${t.descripcion}"`,
    t.monto.toFixed(2),
    t.moneda,
    `"${t.metodo_pago}"`
  ].join(','));

  const csvPayload = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvPayload], { type: 'text/csv;charset=utf-8;' });
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = URL.createObjectURL(blob);
  downloadAnchor.download = CSV_FILENAME;
  downloadAnchor.click();
}

// Renderizado reactivo de la interfaz
function updateUI() {
  const filter = document.getElementById('filterTipo').value;
  const tbody = document.getElementById('txTableBody');
  tbody.innerHTML = '';

  let totalIngresos = 0;
  let totalGastos = 0;
  let totalInversiones = 0;

  transactions.forEach(t => {
    if (t.tipo === 'Ingreso') totalIngresos += t.monto;
    if (t.tipo === 'Gasto') totalGastos += t.monto;
    if (t.tipo === 'Inversion') totalInversiones += t.monto;
  });

  const saldoDisponible = totalIngresos - (totalGastos + totalInversiones);

  document.getElementById('kpiIngresos').textContent = `S/ ${totalIngresos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  document.getElementById('kpiGastos').textContent = `S/ ${totalGastos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  document.getElementById('kpiInversiones').textContent = `S/ ${totalInversiones.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  
  const balanceNode = document.getElementById('kpiBalance');
  balanceNode.textContent = `S/ ${saldoDisponible.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  balanceNode.className = `kpi-num ${saldoDisponible >= 0 ? 'text-success' : 'text-danger'}`;

  const filtered = filter === 'Todos'
    ? transactions
    : transactions.filter(t => t.tipo === filter);

  filtered.forEach(t => {
    const row = document.createElement('tr');
    const badgeClass = t.tipo === 'Ingreso' ? 'tag-ingreso' : (t.tipo === 'Gasto' ? 'tag-gasto' : 'tag-inversion');

    row.innerHTML = `
      <td>#${t.id}</td>
      <td>${t.fecha}</td>
      <td><span class="tag-badge ${badgeClass}">${t.tipo}</span></td>
      <td>${t.categoria}</td>
      <td>${t.descripcion}</td>
      <td>${t.metodo_pago}</td>
      <td><strong>S/ ${t.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></td>
      <td>
        <button class="btn-delete" onclick="removeTransaction(${t.id})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}
