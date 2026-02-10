
import React, { useState, useMemo } from 'react';
import type { Supplier, ContractItem, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus } from '../types';
import AdminAnalytics from './AdminAnalytics';
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

type AdminTab = 'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse' | 'cleaning' | 'directorPerCapita' | 'menu';

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
  registrationStatus: { success: boolean; message: string } | null;
  onClearRegistrationStatus: () => void;
  onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => Promise<void>;
  onDeleteInvoice: (supplierCpf: string, invoiceNumber: string) => Promise<void>;
  onUpdateInvoiceItems: (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => Promise<{ success: boolean; message?: string }>;
  onManualInvoiceEntry: (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => Promise<{ success: boolean; message?: string }>;
  perCapitaConfig: PerCapitaConfig;
  onUpdatePerCapitaConfig: (config: PerCapitaConfig) => Promise<void>;
  onDeleteWarehouseEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
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
  activeTab?: string; // Mantido apenas para evitar quebra de contrato mas não usado mais internamente
  onTabChange?: (tab: any) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { 
    suppliers = [], 
    onRegister, 
    onPersistSuppliers, 
    onUpdateSupplier, 
    cleaningLogs = [],
    directorWithdrawals = [],
    onRegisterCleaningLog,
    onDeleteCleaningLog,
    onRegisterDirectorWithdrawal,
    onDeleteDirectorWithdrawal,
    onLogout,
    onResetData,
    perCapitaConfig,
    onUpdatePerCapitaConfig,
    warehouseLog = [],
    onDeleteWarehouseEntry,
    onReopenInvoice,
    onDeleteInvoice,
    onUpdateInvoiceItems,
    onManualInvoiceEntry,
    standardMenu,
    dailyMenus,
    onUpdateDailyMenu,
    onRegisterEntry,
    onRegisterWithdrawal,
    onCancelDeliveries
  } = props;

  // ESTADO INTERNO DE ABA - CURA DEFINITIVA PARA O TRAVAMENTO
  const [activeTab, setActiveTab] = useState<AdminTab>('register');
  
  const [supplierSearch, setSupplierSearch] = useState('');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regWeeks, setRegWeeks] = useState<number[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Gestão de fornecedores', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão por Item', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'invoices', name: 'Consultar Notas Fiscais', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'schedule', name: 'Agenda Geral', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'directorPerCapita', name: 'Cota Diretores', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> },
    { id: 'menu', name: 'Cardápio Padrão', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'cleaning', name: 'Higienização Câmara', icon: <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 1 1.69.9H20a2 2 0 0 1 2 2v5.5"></path><circle cx="18" cy="18" r="3"></circle><path d="M18 15l2 2-2 2"></path></svg> },
    { id: 'warehouse', name: 'Controle de Estoque', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-1 4a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm8-4a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" /><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1h12v12H4V4z" clipRule="evenodd" /></svg> },
    { id: 'analytics', name: 'Relatório Analítico', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 -1 1h-2a1 1 0 -1 -1V4z" /></svg> },
    { id: 'perCapita', name: 'Cálculo Per Capita', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg> },
    { id: 'info', name: 'Zona Crítica', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> },
  ];

  const totalValue = useMemo(() => {
    return (suppliers || []).reduce((s, p) => s + (p.initialValue || 0), 0);
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [suppliers, supplierSearch]);

  const renderContent = () => {
    switch (activeTab) {
      case 'register':
        return (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
              <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-tight">Cadastro de Novo Fornecedor</h2>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={async (e) => {
                e.preventDefault();
                await onRegister(regName, regCpf, regWeeks);
                setRegName(''); setRegCpf(''); setRegWeeks([]);
              }}>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Nome Fantasia / Razão Social</label>
                  <input type="text" placeholder="NOME DO FORNECEDOR" value={regName} onChange={e => setRegName(e.target.value.toUpperCase())} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-400 outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Documento (CPF ou CNPJ)</label>
                  <input type="text" placeholder="APENAS NÚMEROS" value={regCpf} onChange={e => setRegCpf(e.target.value.replace(/\D/g, ''))} className="w-full p-2 border rounded-lg font-mono focus:ring-2 focus:ring-green-400 outline-none" required />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Restrição de Semanas (Opcional)</label>
                  <WeekSelector selectedWeeks={regWeeks} onWeekToggle={(w) => setRegWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} />
                </div>
                <button type="submit" className="md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-sm">Registrar Fornecedor</button>
              </form>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Fornecedores Habilitados ({filteredSuppliers.length})</h2>
                <input type="text" placeholder="Pesquisar..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="w-full md:w-64 border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                      <th className="p-4 text-left">Fornecedor</th>
                      <th className="p-4 text-left">CPF/CNPJ</th>
                      <th className="p-4 text-right">Contratado</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSuppliers.map(s => (
                      <tr key={s.cpf} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-800 uppercase">{s.name}</td>
                        <td className="p-4 font-mono text-gray-500 text-xs">{s.cpf}</td>
                        <td className="p-4 text-right font-black text-green-600">{formatCurrency(s.initialValue)}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => setEditingSupplier(s)} className="text-blue-500 hover:underline font-bold text-xs uppercase">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'contracts': return <div className="p-10 text-center font-bold">Gestão de Contratos (Vincular Itens)</div>;
      case 'invoices': return <AdminInvoices suppliers={suppliers} onReopenInvoice={onReopenInvoice} onDeleteInvoice={onDeleteInvoice} onUpdateInvoiceItems={onUpdateInvoiceItems} onManualInvoiceEntry={onManualInvoiceEntry} />;
      case 'schedule': return <AdminScheduleView suppliers={suppliers} onCancelDeliveries={onCancelDeliveries} />;
      case 'directorPerCapita': return <AdminDirectorPerCapita suppliers={suppliers} logs={directorWithdrawals} onRegister={onRegisterDirectorWithdrawal} onDelete={onDeleteDirectorWithdrawal} />;
      case 'cleaning': return <AdminCleaningLog logs={cleaningLogs} onRegister={onRegisterCleaningLog} onDelete={onDeleteCleaningLog} />;
      case 'warehouse': return <AdminWarehouseLog suppliers={suppliers} warehouseLog={warehouseLog} onDeleteEntry={onDeleteWarehouseEntry} onRegisterEntry={onRegisterEntry} onRegisterWithdrawal={onRegisterWithdrawal} />;
      case 'analytics': return <AdminAnalytics suppliers={suppliers} warehouseLog={warehouseLog} />;
      case 'graphs': return <AdminGraphs suppliers={suppliers} />;
      case 'perCapita': return <AdminPerCapita suppliers={suppliers} perCapitaConfig={perCapitaConfig} onUpdatePerCapitaConfig={onUpdatePerCapitaConfig} />;
      case 'menu': return <AdminStandardMenu suppliers={suppliers} template={standardMenu} dailyMenus={dailyMenus} onUpdateDailyMenus={onUpdateDailyMenu} inmateCount={perCapitaConfig.inmateCount || 0} />;
      case 'info': return <div className="p-20 text-center space-y-4"><h2 className="text-3xl font-black text-red-600">Zona Crítica</h2><button onClick={onResetData} className="bg-red-600 text-white px-10 py-4 rounded-xl font-black uppercase">Apagar Todo o Banco de Dados</button></div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-white md:min-h-screen border-r shadow-xl z-30">
        <div className="p-6 border-b">
            <h1 className="text-xl font-black text-green-800 uppercase italic tracking-tighter">Admin v4.0</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Gestão 1º Quadr. 2026</p>
        </div>
        <nav className="p-4 overflow-y-auto max-h-[calc(100vh-100px)]">
          <ul className="space-y-1">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button 
                    onClick={() => setActiveTab(tab.id)} 
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-black uppercase tracking-tighter transition-all ${activeTab === tab.id ? 'bg-green-600 text-white shadow-lg translate-x-2' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    {tab.icon}
                    {tab.name}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={onLogout} className="w-full mt-10 p-3 bg-red-50 text-red-600 font-black rounded-xl uppercase text-xs hover:bg-red-100 transition-colors">Sair do Sistema</button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-50 min-h-screen">
          {renderContent()}
      </main>
      {editingSupplier && (<EditSupplierModal supplier={editingSupplier} suppliers={suppliers} onClose={() => setEditingSupplier(null)} onSave={async (old, name, cpf, weeks) => { const err = await onUpdateSupplier(old, name, cpf, weeks); if (!err) setEditingSupplier(null); return err; }} />)}
    </div>
  );
};

export default AdminDashboard;
