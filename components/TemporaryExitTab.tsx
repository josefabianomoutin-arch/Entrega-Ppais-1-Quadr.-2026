
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { TemporaryExitInmate, TemporaryExitLog, UserRole } from '../types';
import { Search, Upload, Download, FileText, Edit2, History, Trash2, CheckCircle, XCircle, Clock, Save, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface TemporaryExitTabProps {
  user: { name: string; cpf: string; role: UserRole };
  inmates: TemporaryExitInmate[];
  logs: TemporaryExitLog[];
  onSaveInmate: (inmate: TemporaryExitInmate) => Promise<{ success: boolean }>;
  onDeleteInmate: (id: string) => Promise<void>;
  onClearAllInmates: () => Promise<{ success: boolean }>;
  onRegisterLog: (log: Omit<TemporaryExitLog, 'id'>) => Promise<{ success: boolean }>;
  onBulkUpdateInmates: (inmates: TemporaryExitInmate[]) => Promise<{ success: boolean }>;
}

const TemporaryExitTab: React.FC<TemporaryExitTabProps> = ({ 
  user, 
  inmates, 
  logs, 
  onSaveInmate, 
  onDeleteInmate, 
  onClearAllInmates,
  onRegisterLog, 
  onBulkUpdateInmates 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'logs' | 'reports'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPavilion, setFilterPavilion] = useState<string>('ALL');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingInmate, setEditingInmate] = useState<TemporaryExitInmate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyInmateId, setHistoryInmateId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user.role === 'admin';
  const currentSector = user.role as 'simic' | 'seguranca' | 'peculio' | 'reintegracao';

  // Sector-based field permissions
  const canEditField = (field: string) => {
    if (isAdmin) return true;
    switch (user.role) {
      case 'simic':
        return ['pecExecucao', 'dataLapso', 'lapso', 'dataDelito'].includes(field);
      case 'seguranca':
        return ['nome', 'matricula', 'visitaAtiva', 'pavilhao'].includes(field);
      case 'peculio':
        return ['peculioDisponivel'].includes(field);
      case 'reintegracao':
        return ['endereco', 'cidade', 'estado', 'familiar', 'parentesco', 'transporte'].includes(field);
      default:
        return false;
    }
  };

  const calculateFinalStatus = (opinions?: TemporaryExitInmate['opinions']): TemporaryExitInmate['finalStatus'] => {
    const sectors: (keyof TemporaryExitInmate['opinions'])[] = ['simic', 'seguranca', 'peculio', 'reintegracao'];
    
    let hasDesfavoravel = false;
    let hasPending = false;
    let favoravelCount = 0;

    const safeOpinions = opinions || {};

    sectors.forEach(sector => {
      const opinion = safeOpinions[sector];
      if (!opinion || !opinion.status) {
        hasPending = true;
      } else if (opinion.status === 'Desfavorável') {
        hasDesfavoravel = true;
      } else if (opinion.status === 'Favorável') {
        favoravelCount++;
      }
    });

    if (hasDesfavoravel) return 'NÃO AUTORIZADO';
    if (favoravelCount === sectors.length) return 'AUTORIZADO';
    return 'PENDENTE';
  };

  const filteredInmates = useMemo(() => {
    return inmates.filter(inmate => {
      const matchesSearch = inmate.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           inmate.matricula.includes(searchTerm) ||
                           (inmate.pavilhao || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || inmate.finalStatus === filterStatus;
      const matchesPavilion = filterPavilion === 'ALL' || inmate.pavilhao === filterPavilion;
      return matchesSearch && matchesStatus && matchesPavilion;
    });
  }, [inmates, searchTerm, filterStatus, filterPavilion]);

  const pavilions = useMemo(() => {
    const p = new Set(inmates.map(i => i.pavilhao).filter(Boolean));
    return Array.from(p).sort();
  }, [inmates]);

  const parseExcelDate = (excelDate: any): string => {
    if (!excelDate) return '';
    if (typeof excelDate === 'number') {
      // Excel dates are days since 1899-12-30
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      // Adjust for timezone offset to prevent day shifting
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
      return adjustedDate.toISOString().split('T')[0];
    }
    
    // If it's already a string, try to parse it or return as is
    const strDate = String(excelDate).trim();
    if (strDate.includes('/')) {
      const parts = strDate.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return strDate;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setUploadProgress(10);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setUploadProgress(30);
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, any>[];
        setUploadProgress(50);

        const newInmates: TemporaryExitInmate[] = [];
        const existingInmatesMap = new Map<string, TemporaryExitInmate>(inmates.map(i => [i.matricula, i]));

        data.forEach((row, index) => {
          const matricula = String(row['MATRICULA'] || row['Matricula'] || '').trim();
          if (!matricula) return;

          const existing = existingInmatesMap.get(matricula);
          const inmate: TemporaryExitInmate = {
            id: existing?.id || `inmate-${Date.now()}-${index}`,
            nome: String(row['NOME'] || row['Nome'] || '').toUpperCase(),
            matricula: matricula,
            pavilhao: String(row['PAVILHAO'] || row['Pavilhão'] || existing?.pavilhao || ''),
            pecExecucao: String(row['PEC'] || row['PEC/EXECUÇÃO'] || existing?.pecExecucao || ''),
            dataLapso: parseExcelDate(row['DATA LAPSO']) || existing?.dataLapso || '',
            lapso: String(row['LAPSO'] || existing?.lapso || ''),
            dataDelito: parseExcelDate(row['DATA DELITO']) || existing?.dataDelito || '',
            peculioDisponivel: String(row['PECULIO'] || row['PECÚLIO'] || existing?.peculioDisponivel || ''),
            visitaAtiva: String(row['VISITA ATIVA'] || existing?.visitaAtiva || ''),
            endereco: String(row['ENDERECO'] || row['Endereço'] || existing?.endereco || ''),
            cidade: String(row['CIDADE'] || existing?.cidade || ''),
            estado: String(row['ESTADO'] || existing?.estado || ''),
            familiar: String(row['FAMILIAR'] || existing?.familiar || ''),
            parentesco: String(row['PARENTESCO'] || existing?.parentesco || ''),
            transporte: String(row['TRANSPORTE'] || existing?.transporte || ''),
            situacao: String(row['SITUACAO'] || row['Situação'] || existing?.situacao || ''),
            conclusao: String(row['CONCLUSAO'] || row['Conclusão'] || existing?.conclusao || ''),
            observacoesGerais: String(row['OBSERVACOES GERAIS'] || row['Observações Gerais'] || existing?.observacoesGerais || ''),
            opinions: existing?.opinions || {},
            finalStatus: existing?.finalStatus || 'PENDENTE',
          };
          
          inmate.finalStatus = calculateFinalStatus(inmate.opinions);
          newInmates.push(inmate);
        });

        setUploadProgress(80);
        await onBulkUpdateInmates(newInmates);
        await onRegisterLog({
          timestamp: new Date().toISOString(),
          user: user.name,
          action: 'UPLOAD EXCEL',
          details: `Importados/Atualizados ${newInmates.length} registros.`
        });
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 2000);
        alert('Upload concluído com sucesso!');
      } catch (err) {
        console.error(err);
        alert('Erro ao processar arquivo Excel.');
        setUploadProgress(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveOpinion = async () => {
    if (!editingInmate) return;

    const updatedInmate = { ...editingInmate };
    updatedInmate.finalStatus = calculateFinalStatus(updatedInmate.opinions);

    await onSaveInmate(updatedInmate);
    await onRegisterLog({
      timestamp: new Date().toISOString(),
      user: user.name,
      action: 'ATUALIZAÇÃO PARECER',
      details: `Inmate: ${updatedInmate.nome} (${updatedInmate.matricula}). Setor: ${user.role.toUpperCase()}.`
    });
    
    setIsEditModalOpen(false);
    setEditingInmate(null);
  };

  const exportToExcel = () => {
    const dataToExport = filteredInmates.map(i => ({
      'NOME': i.nome,
      'MATRÍCULA': i.matricula,
      'PEC/EXECUÇÃO': i.pecExecucao,
      'DATA LAPSO': i.dataLapso,
      'LAPSO': i.lapso,
      'DATA DELITO': i.dataDelito,
      'PECÚLIO DISPONÍVEL': i.peculioDisponivel,
      'SITUAÇÃO': i.situacao,
      'VISITA ATIVA': i.visitaAtiva,
      'ENDEREÇO': i.endereco,
      'CIDADE': i.cidade,
      'ESTADO': i.estado,
      'FAMILIAR': i.familiar,
      'PARENTESCO': i.parentesco,
      'TRANSPORTE': i.transporte,
      'CONCLUSÃO': i.conclusao,
      'OBSERVAÇÕES GERAIS': i.observacoesGerais,
      'STATUS FINAL': i.finalStatus,
      'SIMIC': i.opinions?.simic?.status || 'PENDENTE',
      'SEGURANÇA': i.opinions?.seguranca?.status || 'PENDENTE',
      'PECÚLIO': i.opinions?.peculio?.status || 'PENDENTE',
      'REINTEGRAÇÃO': i.opinions?.reintegracao?.status || 'PENDENTE',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SaidaTemporaria");
    XLSX.writeFile(wb, `SAIDA_TEMPORARIA_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generatePDF = (title: string, data: TemporaryExitInmate[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { text-align: center; font-size: 18px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; text-transform: uppercase; }
            .status-AUTORIZADO { color: green; font-weight: bold; }
            .status-NÃO-AUTORIZADO { color: red; font-weight: bold; }
            .status-PENDENTE { color: orange; font-weight: bold; }
            .header-info { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h2>Coordenadoria das Unidades Prisionais da Região Norte do Estado</h2>
            <h3>Relatório de Saída Temporária</h3>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <h1>${title}</h1>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th>PEC/Execução</th>
                <th>Data Lapso</th>
                <th>Lapso</th>
                <th>Data Delito</th>
                <th>Pecúlio Disp.</th>
                <th>Situação</th>
                <th>Visita Ativa</th>
                <th>Conclusão</th>
                <th>Status Final</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(i => `
                <tr>
                  <td>${i.nome}</td>
                  <td>${i.matricula}</td>
                  <td>${i.pecExecucao || '-'}</td>
                  <td>${i.dataLapso ? new Date(i.dataLapso + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                  <td>${i.lapso || '-'}</td>
                  <td>${i.dataDelito ? new Date(i.dataDelito + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                  <td>${i.peculioDisponivel || '-'}</td>
                  <td>${i.situacao || '-'}</td>
                  <td>${i.visitaAtiva || '-'}</td>
                  <td>${i.conclusao || '-'}</td>
                  <td class="status-${i.finalStatus.replace(' ', '-')}">${i.finalStatus}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="bg-white p-6 rounded-[2rem] shadow-xl border-t-8 border-indigo-900">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase italic tracking-tight">Saída Temporária</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gestão de Custodiados e Pareceres</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveSubTab('list')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
            >
              Lista de Custodiados
            </button>
            {isAdmin && (
              <>
                <button 
                  onClick={() => setActiveSubTab('logs')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'}`}
                >
                  Logs de Ações
                </button>
                <button 
                  onClick={() => setActiveSubTab('reports')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'}`}
                >
                  Relatórios
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeSubTab === 'list' && (
        <>
          {/* Controls & Filters */}
          <div className="bg-white p-6 rounded-[2rem] shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome, matrícula ou pavilhão..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 h-12 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-12 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-xs uppercase"
                >
                  <option value="ALL">Todos os Status</option>
                  <option value="AUTORIZADO">Autorizados</option>
                  <option value="NÃO AUTORIZADO">Não Autorizados</option>
                  <option value="PENDENTE">Pendentes</option>
                </select>

                <select 
                  value={filterPavilion}
                  onChange={(e) => setFilterPavilion(e.target.value)}
                  className="h-12 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-xs uppercase"
                >
                  <option value="ALL">Todos os Pavilhões</option>
                  {pavilions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                {isAdmin && (
                  <>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Upload className="h-4 w-4" /> Importar Excel
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm('TEM CERTEZA QUE DESEJA EXCLUIR TODOS OS DADOS IMPORTADOS? ESTA AÇÃO NÃO PODE SER DESFEITA.')) {
                          await onClearAllInmates();
                          await onRegisterLog({
                            timestamp: new Date().toISOString(),
                            user: user.name,
                            action: 'LIMPEZA GERAL',
                            details: 'Todos os registros de saída temporária foram excluídos.'
                          });
                          alert('Todos os dados foram excluídos com sucesso.');
                        }
                      }}
                      className="h-12 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" /> Limpar Dados
                    </button>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
              </div>
            </div>

            {uploadProgress !== null && (
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300 flex items-center justify-center text-[8px] text-white font-black"
                  style={{ width: `${uploadProgress}%` }}
                >
                  {uploadProgress}%
                </div>
              </div>
            )}
          </div>

          {/* Inmates List */}
          <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Nome</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Matrícula</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">PEC/Execução</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Data Lapso</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Lapso</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Data Delito</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Pecúlio Disp.</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Situação</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Visita Ativa</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Endereço</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Cidade</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Estado</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Familiar</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Parentesco</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Transporte</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Conclusão</th>
                    <th className="p-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Obs. Gerais</th>
                    <th className="p-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Status Final</th>
                    <th className="p-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Pareceres</th>
                    <th className="p-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap sticky right-0 bg-gray-50 z-10">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredInmates.map(inmate => (
                    <tr key={inmate.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 whitespace-nowrap font-black text-gray-800 text-xs">{inmate.nome}</td>
                      <td className="p-4 whitespace-nowrap font-mono text-gray-500 text-xs">{inmate.matricula}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.pecExecucao || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.dataLapso ? new Date(inmate.dataLapso + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.lapso || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.dataDelito ? new Date(inmate.dataDelito + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.peculioDisponivel || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.situacao || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.visitaAtiva || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs truncate max-w-[150px]" title={inmate.endereco}>{inmate.endereco || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.cidade || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.estado || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.familiar || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.parentesco || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.transporte || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs">{inmate.conclusao || '-'}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 text-xs truncate max-w-[150px]" title={inmate.observacoesGerais}>{inmate.observacoesGerais || '-'}</td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm ${
                          inmate.finalStatus === 'AUTORIZADO' ? 'bg-emerald-100 text-emerald-700' :
                          inmate.finalStatus === 'NÃO AUTORIZADO' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {inmate.finalStatus}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex justify-center gap-1">
                          {['simic', 'seguranca', 'peculio', 'reintegracao'].map(sector => {
                            const opinion = inmate.opinions?.[sector as keyof typeof inmate.opinions];
                            let color = 'bg-gray-200 text-gray-400';
                            if (opinion?.status === 'Favorável') color = 'bg-emerald-500 text-white';
                            if (opinion?.status === 'Desfavorável') color = 'bg-rose-500 text-white';
                            
                            return (
                              <div key={sector} title={`${sector.toUpperCase()}: ${opinion?.status || 'PENDENTE'}`} className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black uppercase ${color}`}>
                                {sector[0]}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap sticky right-0 bg-white z-10 border-l border-gray-50">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingInmate(inmate); setIsEditModalOpen(true); }}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            title="Editar Parecer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => { setHistoryInmateId(inmate.id); setIsHistoryModalOpen(true); }}
                            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-600 hover:text-white transition-all shadow-sm"
                            title="Histórico"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => { if(window.confirm('Excluir este custodiado?')) onDeleteInmate(inmate.id); }}
                              className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInmates.length === 0 && (
                    <tr>
                      <td colSpan={20} className="p-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Search className="h-12 w-12 text-gray-200" />
                          <p className="text-gray-400 font-black uppercase text-sm">Nenhum custodiado encontrado</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden animate-fade-in">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800 uppercase italic">Registro de Atividades</h3>
            <button onClick={() => {}} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Limpar Logs</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-6 text-left">Data/Hora</th>
                  <th className="p-6 text-left">Usuário</th>
                  <th className="p-6 text-left">Ação</th>
                  <th className="p-6 text-left">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.slice().reverse().map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-6 text-[11px] font-mono font-bold text-gray-500">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-6">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                        {log.user}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="font-black text-gray-800 text-xs uppercase">{log.action}</span>
                    </td>
                    <td className="p-6 text-xs text-gray-500 font-medium">
                      {log.details}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-gray-400 font-black uppercase text-sm">Nenhum log registrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-8 border-indigo-600 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase mb-2">Lista Geral</h3>
              <p className="text-xs text-gray-400 font-bold leading-relaxed mb-8">Gera um relatório completo com todos os custodiados e seus respectivos status.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportToExcel} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                <Download className="h-4 w-4" /> Excel
              </button>
              <button onClick={() => generatePDF('Lista Geral de Saída Temporária', inmates)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                <FileText className="h-4 w-4" /> PDF
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-8 border-emerald-600 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase mb-2">Autorizados</h3>
              <p className="text-xs text-gray-400 font-bold leading-relaxed mb-8">Relatório contendo apenas os custodiados com status final "AUTORIZADO".</p>
            </div>
            <button 
              onClick={() => generatePDF('Lista de Custodiados Autorizados', inmates.filter(i => i.finalStatus === 'AUTORIZADO'))}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Gerar Relatório PDF
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-8 border-rose-600 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-6">
                <XCircle className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase mb-2">Não Autorizados</h3>
              <p className="text-xs text-gray-400 font-bold leading-relaxed mb-8">Relatório contendo apenas os custodiados com status final "NÃO AUTORIZADO".</p>
            </div>
            <button 
              onClick={() => generatePDF('Lista de Custodiados Não Autorizados', inmates.filter(i => i.finalStatus === 'NÃO AUTORIZADO'))}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white h-12 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Gerar Relatório PDF
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-8 border-amber-600 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase mb-2">Pendências</h3>
              <p className="text-xs text-gray-400 font-bold leading-relaxed mb-8">Relatório de custodiados que ainda aguardam parecer de um ou mais setores.</p>
            </div>
            <button 
              onClick={() => generatePDF('Relatório de Pendências por Setor', inmates.filter(i => i.finalStatus === 'PENDENTE'))}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Gerar Relatório PDF
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingInmate && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-indigo-950 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Parecer Setorial</h3>
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-1">{editingInmate.nome} - {editingInmate.matricula}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar-main space-y-8">
              {/* Info Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* SIMIC SECTION */}
                <div className={`p-6 rounded-3xl border-2 ${user.role === 'simic' ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
                  <h4 className="text-xs font-black text-indigo-900 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> SIMIC
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">PEC/Execução</label>
                      <input 
                        type="text" 
                        value={editingInmate.pecExecucao || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, pecExecucao: e.target.value})}
                        disabled={!canEditField('pecExecucao')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Data Lapso</label>
                      <input 
                        type="date" 
                        value={editingInmate.dataLapso || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, dataLapso: e.target.value})}
                        disabled={!canEditField('dataLapso')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* SEGURANÇA SECTION */}
                <div className={`p-6 rounded-3xl border-2 ${user.role === 'seguranca' ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
                  <h4 className="text-xs font-black text-indigo-900 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Segurança
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Pavilhão</label>
                      <input 
                        type="text" 
                        value={editingInmate.pavilhao || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, pavilhao: e.target.value})}
                        disabled={!canEditField('pavilhao')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Visita Ativa</label>
                      <select 
                        value={editingInmate.visitaAtiva || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, visitaAtiva: e.target.value})}
                        disabled={!canEditField('visitaAtiva')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      >
                        <option value="">Selecione</option>
                        <option value="SIM">SIM</option>
                        <option value="NÃO">NÃO</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* PECÚLIO SECTION */}
                <div className={`p-6 rounded-3xl border-2 ${user.role === 'peculio' ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
                  <h4 className="text-xs font-black text-indigo-900 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Pecúlio
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Saldo Disponível</label>
                    <input 
                      type="text" 
                      value={editingInmate.peculioDisponivel || ''} 
                      onChange={(e) => setEditingInmate({...editingInmate, peculioDisponivel: e.target.value})}
                      disabled={!canEditField('peculioDisponivel')}
                      placeholder="R$ 0,00"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* REINTEGRAÇÃO SECTION */}
                <div className={`p-6 rounded-3xl border-2 ${user.role === 'reintegracao' ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/30'}`}>
                  <h4 className="text-xs font-black text-indigo-900 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Reintegração
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Endereço Completo</label>
                      <input 
                        type="text" 
                        value={editingInmate.endereco || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, endereco: e.target.value})}
                        disabled={!canEditField('endereco')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Cidade</label>
                      <input 
                        type="text" 
                        value={editingInmate.cidade || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, cidade: e.target.value})}
                        disabled={!canEditField('cidade')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Estado</label>
                      <input 
                        type="text" 
                        value={editingInmate.estado || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, estado: e.target.value})}
                        disabled={!canEditField('estado')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Familiar</label>
                      <input 
                        type="text" 
                        value={editingInmate.familiar || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, familiar: e.target.value})}
                        disabled={!canEditField('familiar')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Parentesco</label>
                      <input 
                        type="text" 
                        value={editingInmate.parentesco || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, parentesco: e.target.value})}
                        disabled={!canEditField('parentesco')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Transporte</label>
                      <input 
                        type="text" 
                        value={editingInmate.transporte || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, transporte: e.target.value})}
                        disabled={!canEditField('transporte')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* INFORMAÇÕES GERAIS SECTION */}
                <div className={`p-6 rounded-3xl border-2 ${isAdmin ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/30'} md:col-span-2`}>
                  <h4 className="text-xs font-black text-indigo-900 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Informações Gerais
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Situação</label>
                      <input 
                        type="text" 
                        value={editingInmate.situacao || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, situacao: e.target.value})}
                        disabled={!canEditField('situacao')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Conclusão</label>
                      <input 
                        type="text" 
                        value={editingInmate.conclusao || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, conclusao: e.target.value})}
                        disabled={!canEditField('conclusao')}
                        className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-[9px] font-black text-gray-400 uppercase">Observações Gerais</label>
                      <textarea 
                        value={editingInmate.observacoesGerais || ''} 
                        onChange={(e) => setEditingInmate({...editingInmate, observacoesGerais: e.target.value})}
                        disabled={!canEditField('observacoesGerais')}
                        className="w-full h-20 p-3 bg-white border border-gray-200 rounded-xl text-xs font-bold disabled:bg-gray-100 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>


              {/* OPINION INPUT (FOR CURRENT SECTOR) */}
              {!isAdmin && (
                <div className="bg-indigo-900 text-white p-8 rounded-[2rem] shadow-2xl space-y-6">
                  <h4 className="text-lg font-black uppercase italic tracking-tight border-b border-indigo-800 pb-4">Seu Parecer ({user.role.toUpperCase()})</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Decisão do Setor</label>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setEditingInmate({
                            ...editingInmate, 
                            opinions: {
                              ...(editingInmate.opinions || {}),
                              [currentSector]: { 
                                status: 'Favorável', 
                                observations: editingInmate.opinions?.[currentSector]?.observations || '',
                                timestamp: new Date().toISOString()
                              }
                            }
                          })}
                          className={`flex-1 h-14 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 ${
                            editingInmate.opinions?.[currentSector]?.status === 'Favorável' ? 'bg-emerald-500 text-white shadow-lg scale-105' : 'bg-indigo-800 text-indigo-400 hover:bg-indigo-700'
                          }`}
                        >
                          <CheckCircle className="h-5 w-5" /> Favorável
                        </button>
                        <button 
                          onClick={() => setEditingInmate({
                            ...editingInmate, 
                            opinions: {
                              ...(editingInmate.opinions || {}),
                              [currentSector]: { 
                                status: 'Desfavorável', 
                                observations: editingInmate.opinions?.[currentSector]?.observations || '',
                                timestamp: new Date().toISOString()
                              }
                            }
                          })}
                          className={`flex-1 h-14 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 ${
                            editingInmate.opinions?.[currentSector]?.status === 'Desfavorável' ? 'bg-rose-500 text-white shadow-lg scale-105' : 'bg-indigo-800 text-indigo-400 hover:bg-indigo-700'
                          }`}
                        >
                          <XCircle className="h-5 w-5" /> Desfavorável
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Observações do Setor</label>
                      <textarea 
                        value={editingInmate.opinions?.[currentSector]?.observations || ''}
                        onChange={(e) => setEditingInmate({
                          ...editingInmate,
                          opinions: {
                            ...(editingInmate.opinions || {}),
                            [currentSector]: {
                              ...(editingInmate.opinions?.[currentSector] || { status: '' as any, timestamp: '' }),
                              observations: e.target.value.toUpperCase()
                            }
                          }
                        })}
                        placeholder="DESCREVA O MOTIVO DO PARECER..."
                        className="w-full h-24 bg-indigo-800 border-none rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="bg-gray-50 p-8 rounded-[2rem] border-2 border-dashed border-gray-200">
                  <h4 className="text-sm font-black text-gray-800 uppercase mb-4">Resumo de Pareceres</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['simic', 'seguranca', 'peculio', 'reintegracao'].map(s => {
                      const op = editingInmate.opinions?.[s as keyof typeof editingInmate.opinions];
                      return (
                        <div key={s} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-1">{s}</p>
                          <p className={`text-[10px] font-black uppercase ${
                            op?.status === 'Favorável' ? 'text-emerald-600' :
                            op?.status === 'Desfavorável' ? 'text-rose-600' :
                            'text-amber-600'
                          }`}>
                            {op?.status || 'PENDENTE'}
                          </p>
                          {op?.observations && <p className="text-[8px] text-gray-400 mt-2 line-clamp-2 italic">"{op.observations}"</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
              <button onClick={() => setIsEditModalOpen(false)} className="px-8 h-14 rounded-2xl font-black text-[10px] uppercase text-gray-400 hover:bg-gray-100 transition-all">Cancelar</button>
              <button onClick={handleSaveOpinion} className="px-12 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 transition-all active:scale-95">
                <Save className="h-4 w-4" /> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyInmateId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase italic tracking-tight">Histórico de Alterações</h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar-main space-y-4">
              {logs.filter(l => l.details.includes(inmates.find(i => i.id === historyInmateId)?.matricula || '')).slice().reverse().map(log => (
                <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                    <p className="text-xs font-black text-slate-800 uppercase mt-1">{log.action}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{log.details}</p>
                    <p className="text-[9px] font-bold text-indigo-600 mt-2 uppercase">Por: {log.user}</p>
                  </div>
                </div>
              ))}
              {logs.filter(l => l.details.includes(inmates.find(i => i.id === historyInmateId)?.matricula || '')).length === 0 && (
                <div className="p-20 text-center text-gray-400 font-black uppercase text-sm">Nenhum histórico encontrado</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .custom-scrollbar-main::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-main::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default TemporaryExitTab;
