import React, { useEffect, useMemo, useState } from 'react';
import '../App.css';

const STORAGE_KEY = 'rapitaxi-libros-contables';

const seedLibros = [
  {
    id: 1,
    nombre: 'Libro de Ingresos y Egresos 2025',
    categoria: 'Libro Contable',
    fechaDocumento: '2025-12-31',
    fechaCarga: '2026-01-05',
    tamano: '2.1 MB',
    descripcion: 'Registro contable general de ingresos, egresos y movimientos administrativos de la compañía.',
    archivoNombre: 'libro_ingresos_egresos_2025.pdf',
    archivoDataUrl: '',
  },
  {
    id: 2,
    nombre: 'Acta de Asamblea General 2025',
    categoria: 'Acta',
    fechaDocumento: '2025-11-18',
    fechaCarga: '2025-11-20',
    tamano: '1.4 MB',
    descripcion: 'Acta aprobada por la administración con decisiones claves de operación y presupuesto.',
    archivoNombre: 'acta_asamblea_general_2025.pdf',
    archivoDataUrl: '',
  },
  {
    id: 3,
    nombre: 'Informe Financiero Anual 2025',
    categoria: 'Informe',
    fechaDocumento: '2025-12-31',
    fechaCarga: '2026-01-10',
    tamano: '3.8 MB',
    descripcion: 'Resumen de resultados financieros, balances y conclusiones del cierre fiscal 2025.',
    archivoNombre: 'informe_financiero_2025.pdf',
    archivoDataUrl: '',
  },
];

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function LibrosContablesScreen() {
  const [libros, setLibros] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('Todos');
  const [showForm, setShowForm] = useState(false);
  const [selectedLibro, setSelectedLibro] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    nombre: '',
    categoria: 'Libro Contable',
    fechaDocumento: '',
    descripcion: '',
    archivoNombre: '',
    archivoDataUrl: '',
    tamano: '',
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLibros(parsed);
          return;
        }
      } catch {
        // Si el storage está corrupto, caemos al seed.
      }
    }

    setLibros(seedLibros);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedLibros));
  }, []);

  useEffect(() => {
    if (libros.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(libros));
    }
  }, [libros]);

  const filteredLibros = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return libros.filter((libro) => {
      const matchesText = !term || [libro.nombre, libro.descripcion, libro.archivoNombre]
        .some((value) => String(value || '').toLowerCase().includes(term));
      const matchesCategory = filterCategoria === 'Todos' || libro.categoria === filterCategoria;
      return matchesText && matchesCategory;
    });
  }, [libros, searchTerm, filterCategoria]);

  const stats = useMemo(() => ({
    total: libros.length,
    actas: libros.filter((libro) => libro.categoria === 'Acta').length,
    revisiones: libros.filter((libro) => libro.categoria === 'Revisión').length,
    contables: libros.filter((libro) => libro.categoria === 'Libro Contable').length,
  }), [libros]);

  const getCategoriaClass = (categoria) => {
    const classes = {
      Acta: 'badge-muted',
      Revisión: 'status-badge.mantenimiento',
      'Libro Contable': 'status-badge.completado',
      Informe: 'status-badge.programado',
    };
    return classes[categoria] || 'badge-muted';
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dataUrl = await readFileAsDataUrl(file);
    setForm((prev) => ({
      ...prev,
      archivoNombre: file.name,
      archivoDataUrl: dataUrl,
      tamano: formatBytes(file.size),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setError('El nombre del libro es obligatorio.');
      return;
    }

    const nuevoLibro = {
      id: Date.now(),
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      fechaDocumento: form.fechaDocumento || new Date().toISOString().slice(0, 10),
      fechaCarga: new Date().toISOString().slice(0, 10),
      tamano: form.tamano || 'N/A',
      descripcion: form.descripcion.trim(),
      archivoNombre: form.archivoNombre || `${form.nombre.trim()}.pdf`,
      archivoDataUrl: form.archivoDataUrl || '',
    };

    setLibros((prev) => [nuevoLibro, ...prev]);
  setSelectedLibro(nuevoLibro);
    setMessage('Libro cargado exitosamente.');
    setError('');
    setShowForm(false);
    setForm({
      nombre: '',
      categoria: 'Libro Contable',
      fechaDocumento: '',
      descripcion: '',
      archivoNombre: '',
      archivoDataUrl: '',
      tamano: '',
    });
    setTimeout(() => setMessage(''), 1800);
  };

  const handleDelete = (id) => {
    if (!confirm('¿Eliminar este libro? Esta acción no se puede deshacer.')) return;
    setLibros((prev) => prev.filter((libro) => libro.id !== id));
    if (selectedLibro?.id === id) setSelectedLibro(null);
  };

  const handleDownload = (libro) => {
    if (!libro.archivoDataUrl) {
      setMessage('Este libro no tiene archivo cargado.');
      setTimeout(() => setMessage(''), 1800);
      return;
    }

    const link = document.createElement('a');
    link.href = libro.archivoDataUrl;
    link.download = libro.archivoNombre || `${libro.nombre}.pdf`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="header">
        <div className="header-title">
          <h2>Libros Contables y Documentos</h2>
          <p>Archivo digital disponible para el administrador</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span>⬆️</span> Cargar Documento
        </button>
      </div>

      {message && <p style={{ color: '#166534', fontWeight: 600 }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="kpi-row-4">
        <div className="kpi-card"><div className="kpi-info"><p>Total Documentos</p><h3>{stats.total}</h3></div><div className="kpi-icon yellow">📚</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>Actas</p><h3>{stats.actas}</h3></div><div className="kpi-icon blue">📄</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>Revisiones</p><h3>{stats.revisiones}</h3></div><div className="kpi-icon blue">🔎</div></div>
        <div className="kpi-card"><div className="kpi-info"><p>Libros Contables</p><h3>{stats.contables}</h3></div><div className="kpi-icon green">💼</div></div>
      </div>

      <div className="search-container">
        <span>🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre o descripción..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select className="filter-btn" value={filterCategoria} onChange={(event) => setFilterCategoria(event.target.value)}>
          <option value="Todos">Todos</option>
          <option value="Acta">Acta</option>
          <option value="Revisión">Revisión</option>
          <option value="Libro Contable">Libro Contable</option>
          <option value="Informe">Informe</option>
        </select>
      </div>

      <div className="books-grid">
        {filteredLibros.map((libro) => (
          <div className="card book-card" key={libro.id}>
            <div className="book-top">
              <div className="book-icon">📘</div>
              <div className="book-head">
                <div className="book-title-row">
                  <h3>{libro.nombre}</h3>
                  <span className={`status-badge ${libro.categoria === 'Libro Contable' ? 'completado' : libro.categoria === 'Informe' ? 'pendiente' : libro.categoria === 'Revisión' ? 'mantenimiento' : 'abierto'}`}>
                    {libro.categoria}
                  </span>
                </div>
                <p>{libro.descripcion}</p>
              </div>
            </div>

            <div className="book-meta-grid">
              <div>
                <span>Fecha documento</span>
                <strong>{libro.fechaDocumento}</strong>
              </div>
              <div>
                <span>Fecha carga</span>
                <strong>{libro.fechaCarga}</strong>
              </div>
              <div>
                <span>Tamaño</span>
                <strong>{libro.tamano}</strong>
              </div>
            </div>

            <div className="book-file-line">
              <span>Archivo:</span>
              <strong>{libro.archivoNombre || 'Sin archivo adjunto'}</strong>
            </div>

            <div className="card-actions">
              <button className="btn-ghost" onClick={() => setSelectedLibro(libro)}>👁️ Vista previa</button>
              <button className="btn-ghost" onClick={() => handleDownload(libro)}>⬇️ Descargar</button>
              <button className="btn-ghost" onClick={() => handleDelete(libro.id)}>🗑️ Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {filteredLibros.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '56px 20px' }}>
          <p style={{ color: '#64748b' }}>No se encontraron documentos.</p>
        </div>
      )}

      {showForm && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <form className="form-card" onSubmit={handleSubmit}>
              <h3>Cargar nuevo documento</h3>
              <label>Nombre del libro</label>
              <input
                value={form.nombre}
                onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Ej: Libro de Ingresos y Egresos 2026"
              />

              <label>Categoría</label>
              <select value={form.categoria} onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value }))}>
                <option value="Acta">Acta</option>
                <option value="Revisión">Revisión</option>
                <option value="Libro Contable">Libro Contable</option>
                <option value="Informe">Informe</option>
              </select>

              <label>Fecha del documento</label>
              <input
                type="date"
                value={form.fechaDocumento}
                onChange={(event) => setForm((prev) => ({ ...prev, fechaDocumento: event.target.value }))}
              />

              <label>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                rows={4}
                placeholder="Breve descripción del contenido"
              />

              <label>Archivo PDF</label>
              <input type="file" accept=".pdf" onChange={handleFileChange} />

              <div className="form-actions">
                <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Cargar Documento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLibro && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '860px' }}>
            <div className="header" style={{ marginBottom: '20px' }}>
              <div className="header-title">
                <h2>{selectedLibro.nombre}</h2>
                <p>{selectedLibro.descripcion}</p>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedLibro(null)}>Cerrar</button>
            </div>

            <div className="book-preview-panel">
              <div className="book-preview-meta">
                <div><span>Categoría</span><strong>{selectedLibro.categoria}</strong></div>
                <div><span>Fecha documento</span><strong>{selectedLibro.fechaDocumento}</strong></div>
                <div><span>Fecha carga</span><strong>{selectedLibro.fechaCarga}</strong></div>
                <div><span>Tamaño</span><strong>{selectedLibro.tamano}</strong></div>
              </div>

              {selectedLibro.archivoDataUrl ? (
                <iframe
                  title={selectedLibro.nombre}
                  src={selectedLibro.archivoDataUrl}
                  className="book-preview-frame"
                />
              ) : (
                <div className="book-preview-empty">
                  <p>Este libro fue cargado como documento digital del sistema y no tiene vista previa embebida.</p>
                  <p>Si agregas un PDF desde el formulario, se podrá descargar y ver desde este mismo sitio.</p>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-outline" onClick={() => handleDownload(selectedLibro)}>Descargar</button>
              <button type="button" className="btn-primary" onClick={() => setSelectedLibro(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LibrosContablesScreen;