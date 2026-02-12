
import React, { useState, useMemo } from 'react';
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
  const { suppliers = [], onLogout, onResetData, perCapitaConfig, onUpdatePerCapitaConfig, warehouseLog = [], financialRecords = [], cleaningLogs = [], directorWithdrawals = [] } = props;
  const [activeTab, setActiveTab] = useState<AdminTab>('register');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regWeeks, setRegWeeks] = useState<number[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Fornecedores', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão por Item', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'finance', name: 'Financeiro', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'schedule', name: 'Agenda Geral', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'warehouse', name: 'Estoque', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-1 4a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm8-4a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" /><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1h12v12H4V4z" clipRule="evenodd" /></svg> },
    { id: 'menu', name: 'Cardápio', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'analytics', name: 'Auditoria', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 -1 1h-2a1 1 0 -1 -1V4z" /></svg> },
    { id: 'info', name: 'Formatar', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> },
  ];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [suppliers, supplierSearch]);

  const renderContent = () => {
    switch (activeTab) {
      case 'register':
        return (
          <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-green-500">
              <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tight">Cadastro de Produtor</h2>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={async (e) => { e.preventDefault(); await props.onRegister(regName, regCpf, regWeeks); setRegName(''); setRegCpf(''); setRegWeeks([]); }}>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome do Fornecedor</label>
                  <input type="text" placeholder="EX: JOÃO DA SILVA" value={regName} onChange={e => setRegName(e.target.value.toUpperCase())} className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-green-400 outline-none font-bold" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">CPF/CNPJ (Apenas números)</label>
                  <input type="text" placeholder="000.000.000-00" value={regCpf} onChange={e => setRegCpf(e.target.value.replace(/\D/g, ''))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-mono focus:ring-2 focus:ring-green-400 outline-none" required />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block ml-1">Janelas de Entrega (Semanas do Ano)</label>
                  <WeekSelector selectedWeeks={regWeeks} onWeekToggle={(w) => setRegWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} />
                </div>
                <button type="submit" className="md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl shadow-lg active:scale-95 uppercase tracking-widest text-sm transition-all">Salvar Novo Fornecedor</button>
              </form>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight italic">Produtores Habilitados ({filteredSuppliers.length})</h2>
                <input type="text" placeholder="Pesquisar por nome..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="w-full md:w-80 border-2 border-gray-50 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-green-400 font-bold bg-gray-50" />
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
      case 'info': return <div className="p-20 text-center space-y-4"><h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter italic">Zona Crítica</h2><button onClick={onResetData} className="bg-red-600 text-white px-10 py-4 rounded-xl font-black uppercase shadow-xl hover:scale-105 transition-all">Formatar Banco de Dados</button></div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-white md:min-h-screen border-r shadow-2xl z-50 sticky top-0 md:h-screen">
        <div className="p-6 border-b bg-green-900 text-white">
            <h1 className="text-xl font-black uppercase italic tracking-tighter">SISTEMA PPAIS</h1>
            <p className="text-[10px] text-green-300 font-bold uppercase tracking-widest mt-1">Administrador 2026</p>
        </div>
        <nav className="p-4 overflow-y-auto h-[calc(100vh-100px)] custom-scrollbar">
          <ul className="space-y-1">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab.id ? 'bg-green-600 text-white shadow-lg scale-105 z-10' : 'text-gray-500 hover:bg-gray-50'}`}>
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
