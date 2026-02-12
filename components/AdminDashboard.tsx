
import React, { useState, useMemo, useRef } from 'react';
import type { Supplier, ContractItem, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus, FinancialRecord } from '../types';
import AdminAnalytics from './AdminAnalytics';
import AdminContractItems from './AdminContractItems';
import WeekSelector from './WeekSelector';
import EditSupplierModal from './EditSupplierModal';
import AdminScheduleView from './AdminScheduleView';
import AdminInvoices from './AdminInvoices';
import AdminPerCapita from './AdminPerCapita';
import AdminWarehouseLog from './AdminWarehouseLog';
import AdminCleaningLog from './AdminCleaningLog';
import AdminDirectorPerCapita from './AdminDirectorPerCapita';
import AdminGraphs from './AdminGraphs';
import AdminStandardMenu from './AdminStandardMenu';
import AdminFinancialManager from './AdminFinancialManager';

type AdminTab = 'info' | 'register' | 'contracts' | 'finance' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse' | 'cleaning' | 'directorPerCapita' | 'menu';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, allowedWeeks: number[]) => Promise<void>;
  onPersistSuppliers: (suppliersToPersist: Supplier[]) => void;
  onUpdateSupplier: (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]) => Promise<string | null>;
  onLogout: () => void;
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  cleaningLogs: CleaningLog[];
  directorWithdrawals: DirectorPerCapitaLog[];
  onResetData: () => void;
  onRestoreData: (backupSuppliers: Supplier[]) => Promise<boolean>;
  onRestoreFullBackup: (fullData: any) => Promise<boolean>;
  registrationStatus: { success: boolean; message: string } | null;
  onClearRegistrationStatus: () => void;
  onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => Promise<void>;
  onDeleteInvoice: (supplierCpf: string, invoiceNumber: string) => Promise<void>;
  onUpdateInvoiceItems: (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => Promise<{ success: boolean; message?: string }>;
  onManualInvoiceEntry: (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => Promise<{ success: boolean; message?: string }>;
  perCapitaConfig: PerCapitaConfig;
  onUpdatePerCapitaConfig: (config: PerCapitaConfig) => Promise<void>;
  onDeleteWarehouseEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
  onUpdateWarehouseEntry: (updatedEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
  onUpdateContractForItem: (itemName: string, assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string }[]) => Promise<{ success: boolean, message: string }>;
  onRegisterCleaningLog: (log: Omit<CleaningLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onDeleteCleaningLog: (id: string) => Promise<void>;
  onRegisterDirectorWithdrawal: (log: Omit<DirectorPerCapitaLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onDeleteDirectorWithdrawal: (id: string) => Promise<void>;
  standardMenu: StandardMenu;
  dailyMenus: DailyMenus;
  onUpdateStandardMenu: (menu: StandardMenu) => Promise<void>;
  onUpdateDailyMenu: (menus: DailyMenus) => Promise<void>;
  onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
  onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
  financialRecords: FinancialRecord[];
  onSaveFinancialRecord: (record: Omit<FinancialRecord, 'id'> & { id?: string }) => Promise<{ success: boolean; message?: string }>;
  onDeleteFinancialRecord: (id: string) => Promise<void>;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { suppliers = [], onLogout, onResetData, onRestoreFullBackup, perCapitaConfig, onUpdatePerCapitaConfig, warehouseLog = [], financialRecords = [], cleaningLogs = [], directorWithdrawals = [], standardMenu, dailyMenus } = props;
  const [activeTab, setActiveTab] = useState<AdminTab>('register');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regWeeks, setRegWeeks] = useState<number[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleExportFullBackup = () => {
    const fullBackup = {
      suppliers: suppliers.reduce((acc, s) => ({ ...acc, [s.cpf]: s }), {}),
      warehouseLog: warehouseLog.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      perCapitaConfig,
      cleaningLogs: cleaningLogs.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      directorWithdrawals: directorWithdrawals.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      standardMenu,
      dailyMenus,
      financialRecords: financialRecords.reduce((acc, r) => ({ ...acc, [r.id]: r }), {})
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BACKUP_SISTEMA_FINANCAS_2026_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('ATENÇÃO: Restaurar um backup substituirá TODOS os dados atuais do sistema. Deseja continuar?')) {
        if (backupInputRef.current) backupInputRef.current.value = '';
        return;
    }

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            const success = await onRestoreFullBackup(data);
            if (success) alert('Sistema restaurado com sucesso!');
            else alert('Falha ao restaurar dados no servidor.');
        } catch (err) {
            alert('Arquivo de backup inválido ou corrompido.');
        } finally {
            setIsRestoring(false);
            if (backupInputRef.current) backupInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Fornecedores', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão por Item', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 000-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'finance', name: 'Financeiro', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'schedule', name: 'Agenda Geral', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'invoices', name: 'Notas Fiscais', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" /><path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg> },
    { id: 'warehouse', name: 'Estoque', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-1 4a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm8-4a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" /><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1h12v12H4V4z" clipRule="evenodd" /></svg> },
    { id: 'menu', name: 'Cardápio', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'analytics', name: 'Auditoria', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 -1 1h-2a1 1 0 -1 -1V4z" /></svg> },
    { id: 'info', name: 'Format / Backup', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 11-2 0 1 1 0 012 0zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg> },
  ];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [suppliers, supplierSearch]);

  const renderContent = () => {
    switch (activeTab) {
      case 'register':
        return (
          <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-indigo-900">
              <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tight">Cadastro de Produtor</h2>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={async (e) => { e.preventDefault(); await props.onRegister(regName, regCpf, regWeeks); setRegName(''); setRegCpf(''); setRegWeeks([]); }}>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome do Fornecedor</label>
                  <input type="text" placeholder="EX: JOÃO DA SILVA" value={regName} onChange={e => setRegName(e.target.value.toUpperCase())} className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-400 outline-none font-bold" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">CPF/CNPJ (Apenas números)</label>
                  <input type="text" placeholder="000.000.000-00" value={regCpf} onChange={e => setRegCpf(e.target.value.replace(/\D/g, ''))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-mono focus:ring-2 focus:ring-indigo-400 outline-none" required />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block ml-1">Janelas de Entrega (Semanas do Ano)</label>
                  <WeekSelector selectedWeeks={regWeeks} onWeekToggle={(w) => setRegWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} />
                </div>
                <button type="submit" className="md:col-span-2 bg-indigo-900 hover:bg-black text-white font-black py-5 rounded-2xl shadow-lg active:scale-95 uppercase tracking-widest text-sm transition-all">Salvar Novo Fornecedor</button>
              </form>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight italic">Produtores Habilitados ({filteredSuppliers.length})</h2>
                <input type="text" placeholder="Pesquisar por nome..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="w-full md:w-80 border-2 border-gray-50 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 font-bold bg-gray-50" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                      <th className="p-4 text-left">Fornecedor</th>
                      <th className="p-4 text-center">Semanas Ativas</th>
                      <th className="p-4 text-right">Contratado</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredSuppliers.map(s => (
                      <tr key={s.cpf} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                            <p className="font-black text-gray-800 uppercase text-xs">{s.name}</p>
                            <p className="text-[10px] font-mono text-gray-400">{s.cpf}</p>
                        </td>
                        <td className="p-4 text-center">
                            <div className="flex flex-wrap justify-center gap-1">
                                {s.allowedWeeks && s.allowedWeeks.length > 0 ? (
                                    s.allowedWeeks.sort((a,b)=>a-b).slice(0,5).map(w => <span key={w} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[9px] font-black">S{w}</span>)
                                ) : <span className="text-[10px] text-green-600 font-black uppercase tracking-widest">Livre</span>}
                                {s.allowedWeeks?.length > 5 && <span className="text-[10px] font-bold text-gray-300">...</span>}
                            </div>
                        </td>
                        <td className="p-4 text-right font-black text-green-700">{formatCurrency(s.initialValue)}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => setEditingSupplier(s)} className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'contracts': return <AdminContractItems suppliers={suppliers} warehouseLog={warehouseLog} onUpdateContractForItem={props.onUpdateContractForItem} />;
      case 'finance': return <AdminFinancialManager records={financialRecords} onSave={props.onSaveFinancialRecord} onDelete={props.onDeleteFinancialRecord} />;
      case 'invoices': return <AdminInvoices suppliers={suppliers} onReopenInvoice={props.onReopenInvoice} onDeleteInvoice={props.onDeleteInvoice} onUpdateInvoiceItems={props.onUpdateInvoiceItems} onManualInvoiceEntry={props.onManualInvoiceEntry} />;
      case 'schedule': return <AdminScheduleView suppliers={suppliers} onCancelDeliveries={props.onCancelDeliveries} />;
      case 'warehouse': return <AdminWarehouseLog suppliers={suppliers} warehouseLog={warehouseLog} onDeleteEntry={props.onDeleteWarehouseEntry} onUpdateWarehouseEntry={props.onUpdateWarehouseEntry} onRegisterEntry={props.onRegisterEntry} onRegisterWithdrawal={props.onRegisterWithdrawal} />;
      case 'analytics': return <AdminAnalytics suppliers={suppliers} warehouseLog={warehouseLog} />;
      case 'menu': return <AdminStandardMenu suppliers={suppliers} template={props.standardMenu} dailyMenus={props.dailyMenus} onUpdateDailyMenus={props.onUpdateDailyMenu} inmateCount={perCapitaConfig.inmateCount || 0} />;
      case 'info': 
        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in p-4">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border-t-8 border-indigo-900">
                    <h2 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter mb-2">Central de Backup e Segurança</h2>
                    <p className="text-gray-500 font-medium italic">Gerencie a integridade dos dados e realize cópias de segurança completas.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                        <div className="bg-indigo-50 p-6 rounded-3xl border-2 border-indigo-100 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-black text-indigo-800 uppercase mb-2">Gerar Backup</h3>
                                <p className="text-xs text-indigo-600/70 mb-6 font-medium leading-relaxed">
                                    Baixa um arquivo JSON com todos os dados do sistema: Fornecedores, Contratos, Estoque, Financeiro e Cardápios.
                                </p>
                            </div>
                            <button onClick={handleExportFullBackup} className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Salvar Backup Completo
                            </button>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-black text-blue-800 uppercase mb-2">Restaurar Sistema</h3>
                                <p className="text-xs text-blue-600/70 mb-6 font-medium leading-relaxed">
                                    Recupere o sistema a partir de um arquivo de backup. <span className="text-red-600 font-bold">AVISO:</span> Isso sobrescreverá os dados atuais!
                                </p>
                            </div>
                            <button onClick={() => backupInputRef.current?.click()} disabled={isRestoring} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2 disabled:bg-gray-400">
                                {isRestoring ? 'Processando...' : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        Restaurar do Arquivo
                                    </>
                                )}
                            </button>
                            <input type="file" ref={backupInputRef} onChange={handleImportFullBackup} accept=".json" className="hidden" />
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 p-8 rounded-[2rem] shadow-xl border-2 border-red-100">
                    <h2 className="text-2xl font-black text-red-800 uppercase tracking-tighter mb-4 italic">Zona de Risco: Formatação Total</h2>
                    <p className="text-xs text-red-700/70 mb-8 font-medium leading-relaxed">
                        Esta ação apaga permanentemente todas as tabelas do banco de dados (Fornecedores, Estoque, Financeiro). Recomenda-se realizar um backup antes de prosseguir.
                    </p>
                    <button onClick={onResetData} className="bg-red-600 hover:bg-red-700 text-white px-10 py-5 rounded-2xl font-black uppercase shadow-xl hover:scale-105 transition-all text-sm tracking-widest w-full sm:w-auto">
                        Resetar Banco de Dados (Apagar Tudo)
                    </button>
                </div>
            </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-white md:min-h-screen border-r shadow-2xl z-50 sticky top-0 md:h-screen">
        <div className="p-6 border-b bg-indigo-950 text-white">
            <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">CONTROLE DE DADOS<br/>FINANÇAS 2026</h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Gestão Institucional</p>
        </div>
        <nav className="p-4 overflow-y-auto h-[calc(100vh-100px)] custom-scrollbar">
          <ul className="space-y-1">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {tab.icon} {tab.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-8 pt-6 border-t">
              <button onClick={onLogout} className="w-full p-4 bg-red-50 text-red-600 font-black rounded-2xl uppercase text-[9px] tracking-widest hover:bg-red-100 transition-colors border border-red-100">Encerrar Sessão</button>
          </div>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-10 overflow-y-auto bg-gray-100"> {renderContent()} </main>
      {editingSupplier && (<EditSupplierModal supplier={editingSupplier} suppliers={suppliers} onClose={() => setEditingSupplier(null)} onSave={async (old, name, cpf, weeks) => { const err = await props.onUpdateSupplier(old, name, cpf, weeks); if (!err) setEditingSupplier(null); return err; }} />)}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }`}</style>
    </div>
  );
};

export default AdminDashboard;
