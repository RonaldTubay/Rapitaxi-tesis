import { useState, useEffect } from 'react';
import { BookOpen, Upload, Trash2, Loader2, AlertCircle, FileText, X, Search, Download } from 'lucide-react';
import { API_URL } from '../apiConfig';
import { showErrorToast, showSuccessToast } from '../utils/feedback';
import { confirmDialog } from '../utils/confirmDialog';
import { limitText } from '../utils/inputFormatters';
const LibrosContablesScreen = () => {
  const [libros, setLibros] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [file, setFile] = useState(null);
  
  const [formData, setFormData] = useState({
    titulo: '',
    mes_anio: '',
    descripcion: ''
  });

  const fetchLibros = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/libros-contables`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (response.ok) setLibros(await response.json());
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchLibros(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const formatters = {
      titulo: (input) => limitText(input, 80),
      mes_anio: (input) => limitText(input, 30),
      descripcion: (input) => limitText(input, 500),
    };
    setFormData({ ...formData, [name]: formatters[name] ? formatters[name](value) : value });
  };
  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setFormError('Debe seleccionar un archivo PDF.'); return; }
    
    setIsSubmitting(true);
    setFormError('');

    const data = new FormData();
    data.append('titulo', formData.titulo);
    data.append('mes_anio', formData.mes_anio);
    data.append('descripcion', formData.descripcion);
    data.append('documento', file);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/libros-contables`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        body: data
      });

      if (response.ok) {
        const result = await response.json();
        setLibros([result.libro, ...libros]);
        setIsModalOpen(false);
        setFile(null);
        setFormData({ titulo: '', mes_anio: '', descripcion: '' });
        showSuccessToast('Libro contable subido exitosamente.');
      } else {
        const errData = await response.json();
        setFormError(errData.message || 'Error al subir el archivo.');
      }
    } catch { setFormError('Error de conexión.'); }
    finally { setIsSubmitting(false); }
  };

  // El backend devuelve un enlace temporal (5 min) que apunta directo al
  // bucket en R2: el navegador abre el archivo ahi, no pasa por nuestro servidor.
  const verLibro = async (id) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/libros-contables/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('No se pudo abrir el documento.');

      const { url } = await response.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showErrorToast('No se pudo abrir el documento.');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog('¿Eliminar este libro contable permanentemente?'))) return;
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/libros-contables/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setLibros(libros.filter(l => l.id !== id));
      showSuccessToast('Libro contable eliminado exitosamente.');
    } catch { showErrorToast('Error al eliminar'); }
  };

  const librosFiltrados = libros.filter(l => 
    l.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.mes_anio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-slate-50 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Libros Contables</h2>
          <p className="text-slate-500 mt-1">Archivo digital de balances y reportes fiscales.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" placeholder="Buscar documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none"
            />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-slate-900 text-yellow-400 px-5 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-slate-800 shadow-md">
            <Upload className="w-5 h-5 mr-2" /> Subir PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-yellow-500" /></div>
      ) : librosFiltrados.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 sm:p-20 text-center text-slate-400">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">El archivo digital está vacío.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {librosFiltrados.map((libro) => (
            <div key={libro.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 group relative flex flex-col">
              <button onClick={() => handleDelete(libro.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-4 mb-4 flex-grow">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{libro.titulo}</h3>
                  <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md font-semibold">{libro.mes_anio}</span>
                </div>
              </div>
              <button type="button" onClick={() => verLibro(libro.id)} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl flex justify-center items-center">
                <Download className="w-4 h-4 mr-2" /> Visualizar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold">Subir Libro</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center font-bold"><AlertCircle className="w-4 h-4 mr-2" /> {formError}</div>}
              <input type="text" name="titulo" value={formData.titulo} onChange={handleInputChange} required maxLength="80" placeholder="Titulo" className="w-full px-4 py-3 bg-slate-100 rounded-xl outline-none" />
              <input type="text" name="mes_anio" value={formData.mes_anio} onChange={handleInputChange} required maxLength="30" placeholder="Mes/Ano" className="w-full px-4 py-3 bg-slate-100 rounded-xl outline-none" />
              <input type="file" onChange={handleFileChange} accept=".pdf" required className="w-full" />
              <textarea name="descripcion" value={formData.descripcion} onChange={handleInputChange} maxLength="500" placeholder="Descripcion..." className="w-full px-4 py-3 bg-slate-100 rounded-xl outline-none" />
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-900 text-yellow-400 rounded-2xl font-bold hover:bg-slate-800">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibrosContablesScreen;
