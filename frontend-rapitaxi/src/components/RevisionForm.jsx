import { useState } from 'react';
import { Search, Plus, ClipboardCheck, Download, Eye, Calendar, AlertTriangle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';

export default function RevisionForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [selectedRevision, setSelectedRevision] = useState(null);

  const revisiones = [
    {
      id: 1,
      codigo: 'REV-2024-001',
      titulo: 'Inspeccion Tecnica Anual de Flota',
      tipo: 'Tecnica Vehicular',
      fecha: '2024-01-20',
      responsable: 'Ing. Roberto Mendez',
      resultado: 'Aprobado',
      puntosCriticos: 0,
      descripcion:
        'Revision completa del estado mecanico de todos los vehiculos de la flota. Sistemas de frenos, suspension, motor y elementos de seguridad.',
    },
    {
      id: 2,
      codigo: 'REV-2024-002',
      titulo: 'Auditoria Administrativa Q1',
      tipo: 'Administrativa',
      fecha: '2024-02-15',
      responsable: 'Lic. Carmen Rodriguez',
      resultado: 'Observaciones',
      puntosCriticos: 3,
      descripcion:
        'Evaluacion de procesos administrativos, gestion documental y cumplimiento de procedimientos internos.',
    },
    {
      id: 3,
      codigo: 'REV-2024-003',
      titulo: 'Revision Financiera Trimestral',
      tipo: 'Financiera',
      fecha: '2024-03-10',
      responsable: 'CPA Maria Santos',
      resultado: 'Aprobado',
      puntosCriticos: 0,
      descripcion:
        'Analisis de estados financieros, flujo de caja, cuentas por cobrar/pagar, y conciliaciones bancarias.',
    },
    {
      id: 4,
      codigo: 'REV-2024-004',
      titulo: 'Inspeccion de Seguros Vehiculares',
      tipo: 'Cumplimiento',
      fecha: '2024-03-25',
      responsable: 'Lic. Pedro Guzman',
      resultado: 'No Conforme',
      puntosCriticos: 5,
      descripcion:
        'Verificacion de vigencia de polizas de seguro, coberturas, y documentacion requerida por ley.',
    },
    {
      id: 5,
      codigo: 'REV-2024-005',
      titulo: 'Auditoria de Seguridad Operacional',
      tipo: 'Seguridad',
      fecha: '2024-04-05',
      responsable: 'Ing. Laura Fernandez',
      resultado: 'Observaciones',
      puntosCriticos: 2,
      descripcion:
        'Evaluacion de protocolos de seguridad, equipamiento de emergencia, capacitacion de conductores.',
    },
    {
      id: 6,
      codigo: 'REV-2024-006',
      titulo: 'Revision Tecnica de Vehiculos TAX-001 a TAX-050',
      tipo: 'Tecnica Vehicular',
      fecha: '2024-04-15',
      responsable: 'Ing. Roberto Mendez',
      resultado: 'Aprobado',
      puntosCriticos: 0,
      descripcion:
        'Inspeccion detallada del primer lote de vehiculos: estado de neumaticos, luces y sistema electrico.',
    },
    {
      id: 7,
      codigo: 'REV-2024-007',
      titulo: 'Auditoria de Cumplimiento Legal',
      tipo: 'Cumplimiento',
      fecha: '2024-04-22',
      responsable: 'Abg. Juan Martinez',
      resultado: 'Observaciones',
      puntosCriticos: 4,
      descripcion:
        'Verificacion de licencias de operacion, permisos municipales y cumplimiento de regulaciones de transporte.',
    },
  ];

  const filteredRevisiones = revisiones.filter(
    (rev) =>
      (rev.titulo.toLowerCase().includes(searchTerm.toLowerCase())
        || rev.codigo.toLowerCase().includes(searchTerm.toLowerCase())
        || rev.responsable.toLowerCase().includes(searchTerm.toLowerCase()))
      && (filterTipo === 'Todos' || rev.tipo === filterTipo),
  );

  const getResultadoBadge = (resultado) => {
    const variants = {
      Aprobado: 'bg-green-100 text-green-700',
      Observaciones: 'bg-yellow-100 text-yellow-700',
      'No Conforme': 'bg-red-100 text-red-700',
    };
    return variants[resultado];
  };

  const getTipoColor = (tipo) => {
    const colors = {
      'Tecnica Vehicular': 'bg-blue-100 text-blue-700',
      Administrativa: 'bg-violet-100 text-violet-700',
      Financiera: 'bg-green-100 text-green-700',
      Cumplimiento: 'bg-orange-100 text-orange-700',
      Seguridad: 'bg-red-100 text-red-700',
    };
    return colors[tipo];
  };

  const stats = {
    total: revisiones.length,
    aprobadas: revisiones.filter((r) => r.resultado === 'Aprobado').length,
    observaciones: revisiones.filter((r) => r.resultado === 'Observaciones').length,
    noConformes: revisiones.filter((r) => r.resultado === 'No Conforme').length,
  };

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-right" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Registro de Revisiones</h1>
          <p className="text-gray-600">
            Control de auditorias e inspecciones tecnicas y administrativas
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-yellow-400 text-gray-900 hover:bg-yellow-500">
              <Plus className="size-4 mr-2" />
              Nueva Revision
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Nueva Revision</DialogTitle>
              <DialogDescription>
                Complete la informacion de la revision o auditoria
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codigo">Codigo de Revision</Label>
                  <Input id="codigo" placeholder="REV-YYYY-XXX" />
                </div>
                <div>
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input id="fecha" type="date" />
                </div>
              </div>
              <div>
                <Label htmlFor="titulo">Titulo</Label>
                <Input id="titulo" placeholder="Titulo de la revision..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de Revision</Label>
                  <select
                    id="tipo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option>Tecnica Vehicular</option>
                    <option>Administrativa</option>
                    <option>Financiera</option>
                    <option>Cumplimiento</option>
                    <option>Seguridad</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="responsable">Responsable</Label>
                  <Input id="responsable" placeholder="Nombre del auditor..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="resultado">Resultado</Label>
                  <select
                    id="resultado"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option>Aprobado</option>
                    <option>Observaciones</option>
                    <option>No Conforme</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="puntos">Puntos Criticos</Label>
                  <Input id="puntos" type="number" placeholder="0" />
                </div>
              </div>
              <div>
                <Label htmlFor="descripcion">Descripcion</Label>
                <textarea
                  id="descripcion"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={4}
                  placeholder="Detalle de la revision y hallazgos..."
                />
              </div>
              <div>
                <Label htmlFor="archivo">Informe PDF</Label>
                <Input id="archivo" type="file" accept=".pdf" />
              </div>
            </div>
            <Button
              className="w-full bg-yellow-400 text-gray-900 hover:bg-yellow-500"
              onClick={() => {
                toast.success('Revision registrada exitosamente');
              }}
            >
              Registrar Revision
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Total Revisiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">{stats.aprobadas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Con Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-yellow-600">{stats.observaciones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">No Conformes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{stats.noConformes}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Buscar por titulo, codigo o responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="px-4 py-2 border border-gray-300 rounded-md"
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option>Todos</option>
              <option>Tecnica Vehicular</option>
              <option>Administrativa</option>
              <option>Financiera</option>
              <option>Cumplimiento</option>
              <option>Seguridad</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {filteredRevisiones.map((rev) => (
          <Card key={rev.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="p-3 bg-yellow-100 rounded-lg h-fit">
                    <ClipboardCheck className="size-6 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg text-gray-900">{rev.titulo}</h3>
                          <Badge className={getTipoColor(rev.tipo)}>{rev.tipo}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{rev.codigo}</p>
                      </div>
                      <Badge className={getResultadoBadge(rev.resultado)}>
                        {rev.resultado}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{rev.descripcion}</p>

                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-gray-400" />
                        <span className="text-gray-600">{rev.fecha}</span>
                      </div>
                      <div className="text-gray-600">
                        <span className="text-gray-500">Responsable: </span>
                        {rev.responsable}
                      </div>
                      {rev.puntosCriticos > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="size-4" />
                          <span>{rev.puntosCriticos} puntos criticos</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedRevision(rev)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Detalle de la Revision</DialogTitle>
                        <DialogDescription>
                          Informacion completa de la revision
                        </DialogDescription>
                      </DialogHeader>
                      {selectedRevision && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Codigo</Label>
                              <p className="text-gray-900 mt-1">{selectedRevision.codigo}</p>
                            </div>
                            <div>
                              <Label>Fecha</Label>
                              <p className="text-gray-900 mt-1">{selectedRevision.fecha}</p>
                            </div>
                            <div className="col-span-2">
                              <Label>Titulo</Label>
                              <p className="text-gray-900 mt-1">{selectedRevision.titulo}</p>
                            </div>
                            <div>
                              <Label>Tipo</Label>
                              <Badge className={`${getTipoColor(selectedRevision.tipo)} mt-1`}>
                                {selectedRevision.tipo}
                              </Badge>
                            </div>
                            <div>
                              <Label>Responsable</Label>
                              <p className="text-gray-900 mt-1">
                                {selectedRevision.responsable}
                              </p>
                            </div>
                            <div>
                              <Label>Resultado</Label>
                              <Badge
                                className={`${getResultadoBadge(selectedRevision.resultado)} mt-1`}
                              >
                                {selectedRevision.resultado}
                              </Badge>
                            </div>
                            <div>
                              <Label>Puntos Criticos</Label>
                              <p className="text-gray-900 mt-1">
                                {selectedRevision.puntosCriticos}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <Label>Descripcion</Label>
                              <p className="text-gray-900 mt-1">
                                {selectedRevision.descripcion}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toast.success(`Descargando ${rev.codigo}`)}
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRevisiones.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardCheck className="size-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No se encontraron revisiones</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
