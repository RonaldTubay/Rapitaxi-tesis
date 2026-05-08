import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';

export default function ActaView() {
  const [expedientes, setExpedientes] = useState([]);
  const [selectedExpId, setSelectedExpId] = useState('');
  const [acta, setActa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExpedientes();
  }, []);

  const fetchExpedientes = async () => {
    try {
      setExpedientes([
        { id: 1, codigo: 'EXP-00001', vehiculo: 'TAX-001', socio: 'Carlos Ramírez González' },
        { id: 2, codigo: 'EXP-00002', vehiculo: 'TAX-045', socio: 'María López Fernández' },
        { id: 3, codigo: 'EXP-00003', vehiculo: 'TAX-078', socio: 'Juan Pérez Santos' },
      ]);
    } catch (err) {
      console.error('Error cargando expedientes:', err);
    }
  };

  const loadActa = async (e) => {
    e.preventDefault();
    if (!selectedExpId) {
      setError('Selecciona un expediente');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await api.getActa(selectedExpId);
      setActa(res);
    } catch (err) {
      setError(err.message || 'Error al cargar el acta');
      setActa(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadActa = () => {
    if (!acta) return;
    const doc = new Blob(
      [JSON.stringify(acta, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(doc);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Acta-${acta.codigo}.json`;
    link.click();
  };

  return (
    <div className="main-content">
      <div className="header mb-8">
        <div className="header-title">
          <h2>Generación de Actas</h2>
          <p>Visualiza y descarga actas de expedientes vehiculares</p>
        </div>
      </div>

      {/* Selector de Expediente */}
      <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
        <div className="max-w-2xl">
          <h3 className="text-xl font-semibold text-[#0f172a] mb-6">Seleccionar Expediente</h3>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={loadActa} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Expediente *</label>
              <select
                value={selectedExpId}
                onChange={(e) => setSelectedExpId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#facc15] bg-white text-base"
              >
                <option value="">-- Selecciona un expediente --</option>
                {expedientes.map(exp => (
                  <option key={exp.id} value={exp.id}>
                    {exp.codigo} - {exp.vehiculo} ({exp.socio})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !selectedExpId}
                className="px-8 py-3 bg-[#0f172a] text-[#facc15] rounded-lg font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Eye size={18} /> {loading ? 'Cargando...' : 'Ver Acta'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Acta Generada */}
      {acta && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-lg">
          {/* Encabezado del Acta */}
          <div className="border-b-2 border-[#0f172a] pb-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-[#fef08a] rounded-lg">
                  <FileText size={32} color="#a16207" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#0f172a]">ACTA DE REVISIÓN</h2>
                  <p className="text-slate-600 text-sm mt-1">Código: {acta.codigo}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Fecha: {acta.fecha_emision}</p>
                <span className="inline-block px-4 py-2 bg-[#dcfce7] text-[#166534] rounded-full text-sm font-semibold mt-2">
                  Estado: {acta.estado}
                </span>
              </div>
            </div>

            {/* Información del Expediente */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Vehículo</p>
                <p className="text-lg font-semibold text-[#0f172a]">
                  {acta.numero_vehicular || 'TAX-001'} - {acta.marca || 'No especificado'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Socio / Propietario</p>
                <p className="text-lg font-semibold text-[#0f172a]">
                  {acta.socio_nombre || 'Carlos Ramírez González'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Placa</p>
                <p className="text-lg font-semibold text-[#0f172a]">
                  {acta.placa || 'MBG-5877'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Año de Modelo</p>
                <p className="text-lg font-semibold text-[#0f172a]">
                  {acta.anio_modelo || '2023'}
                </p>
              </div>
            </div>
          </div>

          {/* Detalles de Revisiones */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-4 flex items-center gap-2">
              <CheckCircle size={20} color="#16a34a" />
              Historial de Revisiones
            </h3>
            <div className="bg-slate-50 rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                <div>
                  <p className="font-semibold text-[#0f172a]">Última Revisión: {acta.fecha_ultima_revision || 'No disponible'}</p>
                  <p className="text-sm text-slate-600 mt-1">Resultado: Aprobado</p>
                </div>
                <span className="px-3 py-1 bg-[#dcfce7] text-[#166534] rounded-full text-sm font-semibold">
                  Aprobado
                </span>
              </div>
              <p className="text-sm text-slate-600 italic">
                Observación: {acta.observacion || 'Vehículo en condiciones óptimas para circular'}
              </p>
            </div>
          </div>

          {/* Observaciones */}
          <div className="mb-8 p-6 bg-slate-50 rounded-lg">
            <h4 className="font-semibold text-[#0f172a] mb-3">Observaciones Generales</h4>
            <p className="text-slate-700 leading-relaxed">
              {acta.observacion_general || 'El vehículo presenta condiciones aptas para seguir en operación. Se recomienda mantener el cronograma de mantenimiento preventivo.'}
            </p>
          </div>

          {/* Pie de Firma */}
          <div className="border-t-2 border-[#0f172a] pt-8">
            <div className="grid grid-cols-3 gap-12">
              <div className="text-center">
                <p className="mb-16 text-[#0f172a] font-semibold">__________________</p>
                <p className="text-xs font-semibold text-slate-700">Elaborado por</p>
                <p className="text-xs text-slate-600">Fecha: {new Date().toLocaleDateString()}</p>
              </div>
              <div className="text-center">
                <p className="mb-16 text-[#0f172a] font-semibold">__________________</p>
                <p className="text-xs font-semibold text-slate-700">Revisado por</p>
              </div>
              <div className="text-center">
                <p className="mb-16 text-[#0f172a] font-semibold">__________________</p>
                <p className="text-xs font-semibold text-slate-700">Autorizado por</p>
              </div>
            </div>
          </div>

          {/* Botón Descargar */}
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={downloadActa}
              className="px-8 py-3 bg-[#facc15] text-[#0f172a] rounded-lg font-semibold hover:bg-[#eab308] transition flex items-center gap-2"
            >
              <Download size={18} /> Descargar Acta
            </button>
            <button
              onClick={() => window.print()}
              className="px-8 py-3 border-2 border-[#0f172a] text-[#0f172a] rounded-lg font-semibold hover:bg-slate-50 transition"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>
      )}

      {/* Historial de Actas Recientes */}
      {!acta && (
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Actas Generadas Recientemente</h3>
          <div className="space-y-4">
            {[
              { codigo: 'EXP-00001', vehiculo: 'TAX-001', fecha: '2026-05-06', estado: 'Aprobado' },
              { codigo: 'EXP-00002', vehiculo: 'TAX-045', fecha: '2026-05-05', estado: 'Observado' },
              { codigo: 'EXP-00003', vehiculo: 'TAX-078', fecha: '2026-05-04', estado: 'Aprobado' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                <div className="flex items-center gap-4">
                  <FileText size={20} color="#a16207" />
                  <div>
                    <p className="font-semibold text-[#0f172a]">{item.codigo} - {item.vehiculo}</p>
                    <p className="text-sm text-slate-500">{item.fecha}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  item.estado === 'Aprobado' 
                    ? 'bg-[#dcfce7] text-[#166534]'
                    : 'bg-[#ffedd5] text-[#ea580c]'
                }`}>
                  {item.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
