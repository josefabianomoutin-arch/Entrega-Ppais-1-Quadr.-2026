
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
  const [type, setType] = useState<'diaria' | 'semanal' | 'pesada' | 'preventiva' | 'corretiva'>('diaria');
  const [observations, setObservations] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    return logs
      .filter(l => 
        l.responsible.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.observations.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.maintenanceDetails || '').toLowerCase().includes(searchTerm.toLowerCase())
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
    const result = await onRegister({ 
      date, 
      responsible, 
      location, 
      type, 
      observations, 
      maintenanceDetails 
    });
    if (result.success) {
      setResponsible('');
      setObservations('');
      setMaintenanceDetails('');
      setDate(new Date().toISOString().split('T')[0]);
    }
    setIsSaving(false);
  };

  const handlePrintReport = () => {
    if (logs.length === 0) {
      alert('Não há registros para gerar o relatório.');
      return;
    }

    const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const printContent = `
      <html>
        <head>
          <title>Relatório de Higienização e Manutenção</title>
          <style>
            @page { 
                size: A4; 
                margin: 0; 
            }
            @media print {
                header, footer { display: none !important; }
            }
            body { 
                font-family: Arial, sans-serif; 
                padding: 20mm; 
                color: #333; 
                line-height: 1.4; 
                margin: 0;
            }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header-sap { font-size: 14px; margin-bottom: 2px; }
            .header-unit { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .header-address { font-size: 11px; }
            .header-contact { font-size: 11px; }
            .report-title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 10px; }
            th { background-color: #f5f5f5; font-weight: bold; text-transform: uppercase; }
            .footer { margin-top: 60px; display: flex; justify-content: space-around; }
            .sig { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: bold; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-sap">Secretaria da Administração Penitenciária</div>
            <div class="header-unit">Polícia Penal - Penitenciária de Taiúva</div>
            <div class="header-address">Rodovia Brigadeiro Faria Lima, SP 326, KM 359,6 Taiúva/SP - CEP: 14.720-000</div>
            <div class="header-contact">Fone: (16) 3247-6261 - E-mail: dg@ptaiuva.sap.gov.br</div>
          </div>
          
          <div class="report-title">Relatório de Higienização e Manutenção</div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Local</th>
                <th>Responsável</th>
                <th>Observações</th>
                <th>Manutenção</th>
              </tr>
            </thead>
            <tbody>
              ${sortedLogs.map(log => `
                <tr>
                  <td>${new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td style="text-transform: uppercase;">${log.type}</td>
                  <td>${log.location}</td>
                  <td>${log.responsible}</td>
                  <td>${log.observations || '-'}</td>
                  <td>${log.maintenanceDetails || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div class="sig">
              ${sortedLogs.length > 0 ? sortedLogs[0].responsible.toUpperCase() : ''}<br/>
              <span style="font-weight: normal; font-size: 10px;">Responsável (Unidade)</span>
            </div>
            <div class="sig">
              <br/>
              CHEFE DE DEPARTAMENTO
            </div>
          </div>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Responsável", "Local", "Tipo de Serviço", "Observações", "Manutenção"];
    const csvContent = [
      headers.join(";"),
      ...logs.map(l => [
        new Date(l.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        l.responsible,
        l.location,
        l.type.toUpperCase(),
        `"${l.observations.replace(/"/g, '""')}"`,
        `"${(l.maintenanceDetails || '').replace(/"/g, '""')}"`
      ].join(";"))
    ].join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `controle_atividades_camara_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-cyan-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 uppercase tracking-tight">Registro de Higienização e Manutenção</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Responsável</label>
              <input type="text" value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Nome do funcionário" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Local</label>
              <select value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500">
                <option value="Câmara fria de Resfriada">Câmara fria de Resfriada</option>
                <option value="Câmara Fria de Congelados">Câmara Fria de Congelados</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tipo de Serviço</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-500">
                <option value="diaria">Diária (Superficial)</option>
                <option value="semanal">Semanal (Média)</option>
                <option value="pesada">Pesada (Completa)</option>
                <option value="preventiva">Manutenção Preventiva</option>
                <option value="corretiva">Manutenção Corretiva</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Observações / Produtos Utilizados</label>
              <input type="text" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ex: Hipoclorito, Quaternário, Degelo realizado..." className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Manutenções Realizadas (Opcional)</label>
              <input type="text" value={maintenanceDetails} onChange={e => setMaintenanceDetails(e.target.value)} placeholder="Ex: Troca de vedação, reparo no compressor, ajuste de termostato..." className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isSaving} className="w-full md:w-auto bg-cyan-600 hover:bg-cyan-700 text-white font-black py-3 px-10 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-sm disabled:bg-gray-400">
              {isSaving ? 'Registrando...' : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Histórico de Atividades</h3>
            <p className="text-xs text-gray-500">Acompanhamento de higienização e manutenção</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input type="text" placeholder="Filtrar registros..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 sm:w-64 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500" />
            <button onClick={handlePrintReport} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Imprimir
            </button>
            <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exportar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-xl shadow-inner">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b">
              <tr>
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Tipo de Serviço</th>
                <th className="p-4 text-left">Local</th>
                <th className="p-4 text-left">Responsável</th>
                <th className="p-4 text-left">Observações</th>
                <th className="p-4 text-left">Manutenção</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length > 0 ? filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-gray-700">{new Date(log.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      log.type === 'diaria' ? 'bg-blue-100 text-blue-700' :
                      log.type === 'semanal' ? 'bg-orange-100 text-orange-700' :
                      log.type === 'pesada' ? 'bg-purple-100 text-purple-700' :
                      log.type === 'preventiva' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {log.type === 'preventiva' ? 'Preventiva' : log.type === 'corretiva' ? 'Corretiva' : log.type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700 font-medium">{log.location}</td>
                  <td className="p-4 font-bold text-gray-700">{log.responsible}</td>
                  <td className="p-4 text-xs text-gray-500 italic max-w-xs truncate" title={log.observations}>{log.observations || '-'}</td>
                  <td className="p-4 text-xs text-indigo-600 font-semibold max-w-xs truncate" title={log.maintenanceDetails}>{log.maintenanceDetails || '-'}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => { if(window.confirm('Deseja excluir este registro permanentemente?')) onDelete(log.id); }} className="text-red-400 hover:text-red-600 p-2 rounded-full transition-colors" title="Excluir Registro">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-20 text-center text-gray-400 italic font-medium">Nenhum registro localizado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminCleaningLog;
