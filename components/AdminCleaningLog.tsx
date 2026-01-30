
import React, { useState, useMemo } from 'react';
import type { CleaningLog } from '../types';

interface AdminCleaningLogProps {
  logs: CleaningLog[];
  onRegister: (log: Omit<CleaningLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<void>;
}

const AdminCleaningLog: React.FC<AdminCleaningLogProps> = ({ logs, onRegister, onDelete }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [responsible, setResponsible] = useState('');
  const [location, setLocation] = useState('Câmara fria de Resfriada');
  const [type, setType] = useState<'diaria' | 'semanal' | 'pesada'>('diaria');
  const [observations, setObservations] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    return logs
      .filter(l => 
        l.responsible.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.observations.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsible.trim()) {
        alert('Responsável é obrigatório.');
        return;
    }
    setIsSaving(true);
    const result = await onRegister({ date, responsible, location, type, observations });
    if (result.success) {
      setResponsible('');
      setObservations('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    setIsSaving(false);
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Responsável", "Local", "Tipo", "Observações"];
    const csvContent = [
      headers.join(";"),
      ...logs.map(l => [
        new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        l.responsible,
        l.location,
        l.type.toUpperCase(),
        `"${l.observations.replace(/"/g, '""')}"`
      ].join(";"))
    ].join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `controle_higienizacao_camara_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-cyan-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Registro de Higienização da Câmara Fria</h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Responsável</label>
            <input type="text" value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Nome do funcionário" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Local</label>
            <select value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="Câmara fria de Resfriada">Câmara fria de Resfriada</option>
              <option value="Câmara Fria de Congelados">Câmara Fria de Congelados</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Limpeza</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="diaria">Diária (Superficial)</option>
              <option value="semanal">Semanal (Média)</option>
              <option value="pesada">Pesada (Completa)</option>
            </select>
          </div>
          <div className="lg:col-span-3 space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Observações / Produtos Utilizados</label>
            <input type="text" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ex: Hipoclorito, Quaternário, Degelo realizado..." className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <button type="submit" disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-lg transition-colors h-[42px] disabled:bg-gray-400">
            {isSaving ? 'Salvando...' : 'Registrar'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-bold text-gray-800">Histórico de Higienização</h3>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Filtrar responsável, local..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exportar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Local</th>
                <th className="p-3 text-left">Responsável</th>
                <th className="p-3 text-left">Observações</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length > 0 ? filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-mono">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      log.type === 'diaria' ? 'bg-blue-100 text-blue-700' :
                      log.type === 'semanal' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700 font-medium">{log.location}</td>
                  <td className="p-3 font-semibold text-gray-700">{log.responsible}</td>
                  <td className="p-3 text-gray-500 italic max-w-xs truncate" title={log.observations}>{log.observations || '-'}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => { if(window.confirm('Excluir registro?')) onDelete(log.id); }} className="text-red-400 hover:text-red-600 p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Nenhum registro encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCleaningLog;
