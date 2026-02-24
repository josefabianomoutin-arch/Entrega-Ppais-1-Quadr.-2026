
import React, { useState, useMemo, useRef } from 'react';
import type { Supplier, ContractItem, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog, StandardMenu, DailyMenus, FinancialRecord, Delivery, ThirdPartyEntryLog } from '../types';
import AdminAnalytics from './AdminAnalytics';
import AdminContractItems from './AdminContractItems';
import WeekSelector from './WeekSelector';
import EditSupplierModal from './EditSupplierModal';
import AdminScheduleView from './AdminScheduleView';
import AdminInvoices from './AdminInvoices';
import AdminPerCapita from './AdminPerCapita';
import AdminCleaningLog from './AdminCleaningLog';
import AdminDirectorPerCapita from './AdminDirectorPerCapita';
import AdminGraphs from './AdminGraphs';
import AdminStandardMenu from './AdminStandardMenu';
import AdminFinancialManager from './AdminFinancialManager';
import AdminThirdPartyEntry from './AdminThirdPartyEntry';

import WarehouseMovementForm from './WarehouseMovementForm';

type AdminTab = 'info' | 'register' | 'contracts' | 'finance' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'cleaning' | 'thirdPartyEntry' | 'directorPerCapita' | 'menu' | 'almoxarifado';

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
  thirdPartyEntries: ThirdPartyEntryLog[];
  onRegisterThirdPartyEntry: (log: Omit<ThirdPartyEntryLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onUpdateThirdPartyEntry: (log: ThirdPartyEntryLog) => Promise<{ success: boolean; message: string }>;
  onDeleteThirdPartyEntry: (id: string) => Promise<void>;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { suppliers = [], onLogout, onResetData, onRestoreFullBackup, perCapitaConfig, warehouseLog = [], financialRecords = [], cleaningLogs = [], thirdPartyEntries = [], directorWithdrawals = [], standardMenu, dailyMenus } = props;
  const [activeTab, setActiveTab] = useState<AdminTab>('register');
  const [supplierSubTab, setSupplierSubTab] = useState<'list' | 'new'>('list'); 
  const [supplierSearch, setSupplierSearch] = useState('');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regWeeks, setRegWeeks] = useState<number[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Fornecedores', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão/Item', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 000-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'finance', name: 'Financeiro', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'schedule', name: 'Agenda', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1-1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'perCapita', name: 'Per Capita', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'invoices', name: 'Notas Fiscais', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" /><path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg> },
    { id: 'cleaning', name: 'Limpeza', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg> },
    { id: 'thirdPartyEntry', name: 'Terceiros', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'menu', name: 'Cardápio', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'info', name: 'Sistema', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 11-2 0 1 1 0 012 0zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg> },
    { id: 'almoxarifado', name: 'Almoxarifado', icon: <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h1V6a1 1 0 012 0v1h2V6a1 1 0 112 0v1h1a1 1 0 110 2H6a1 1 0 01-1-1zm1 4a1 1 0 100 2h8a1 1 0 100-2H6z" /></svg> },
  ];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [suppliers, supplierSearch]);

  const handleExportFullBackup = () => {
    const fullBackup = {
      suppliers: suppliers.reduce((acc, s) => ({ ...acc, [s.cpf]: s }), {}),
      warehouseLog: warehouseLog.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      perCapitaConfig,
      cleaningLogs: cleaningLogs.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      thirdPartyEntries: thirdPartyEntries.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      directorWithdrawals: directorWithdrawals.reduce((acc, l) => ({ ...acc, [l.id]: l }), {}),
      standardMenu,
      dailyMenus,
      financialRecords: financialRecords.reduce((acc, r) => ({ ...acc, [r.id]: r }), {})
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BACKUP_FINANCAS_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'register':
        return (
          <div className="space-y-6 max-w-6xl mx-auto animate-fade-in p-2 md:p-0 pb-16">
            <div className="md:hidden flex bg-white p-1 rounded-2xl shadow-md mb-4 border border-indigo-100">
                <button onClick={() => setSupplierSubTab('list')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${supplierSubTab === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-400'}`}>Lista Ativos</button>
                <button onClick={() => setSupplierSubTab('new')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${supplierSubTab === 'new' ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-400'}`}>Novo Registro</button>
            </div>

            {(supplierSubTab === 'new' || !window.matchMedia("(max-width: 768px)").matches) && (
                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border-t-8 border-indigo-900">
                    <h2 className="text-xl md:text-2xl font-black text-gray-800 mb-6 uppercase tracking-tight italic">Novo Fornecedor</h2>
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={async (e) => { e.preventDefault(); await props.onRegister(regName, regCpf, regWeeks); setRegName(''); setRegCpf(''); setRegWeeks([]); setSupplierSubTab('list'); }}>
                        <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome Completo</label>
                        <input type="text" placeholder="JOÃO DA SILVA" value={regName} onChange={e => setRegName(e.target.value.toUpperCase())} className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-400 outline-none font-bold text-sm" required />
                        </div>
                        <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">CPF ou CNPJ</label>
                        <input type="text" placeholder="Apenas números" value={regCpf} onChange={e => setRegCpf(e.target.value.replace(/\D/g, ''))} className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl font-mono focus:ring-2 focus:ring-indigo-400 outline-none text-sm" required />
                        </div>
                        <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block ml-1">Semanas de Entrega</label>
                        <div className="bg-gray-50 rounded-2xl p-2 md:p-4 border-2 border-gray-100">
                            <WeekSelector selectedWeeks={regWeeks} onWeekToggle={(w) => setRegWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} />
                        </div>
                        </div>
                        <button type="submit" className="md:col-span-2 bg-indigo-950 hover:bg-black text-white font-black h-16 rounded-2xl shadow-lg active:scale-95 uppercase tracking-widest text-xs md:text-sm transition-all mt-2">Registrar Fornecedor</button>
                    </form>
                </div>
            )}
            
            {(supplierSubTab === 'list' || !window.matchMedia("(max-width: 768px)").matches) && (
                <div className="bg-white p-4 md:p-8 rounded-[2rem] shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-6">
                        <h2 className="text-xl md:text-2xl font-black text-gray-800 uppercase tracking-tight italic">Habilitados <span className="text-indigo-600">({filteredSuppliers.length})</span></h2>
                        <div className="relative w-full md:w-80">
                            <input type="text" placeholder="Filtrar produtor..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="w-full border-2 border-gray-50 h-14 px-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 font-bold bg-gray-50" />
                            <svg className="h-5 w-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>

                    <div className="block md:hidden space-y-4">
                        {filteredSuppliers.map(s => (
                        <div key={s.cpf} className="bg-slate-50 p-5 rounded-3xl border-2 border-white shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 pr-4">
                                    <p className="font-black text-gray-800 uppercase text-sm leading-tight break-words">{s.name}</p>
                                    <p className="text-[10px] font-mono text-gray-400 mt-1">ID: {s.cpf}</p>
                                </div>
                                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">{formatCurrency(s.initialValue)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 border-t border-gray-200 pt-3">
                                {s.allowedWeeks?.length > 0 ? s.allowedWeeks.sort((a,b)=>a-b).map(w => (
                                    <span key={w} className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md">S{w}</span>
                                )) : <span className="text-[9px] font-black text-green-600 uppercase">Calendário Livre</span>}
                            </div>
                            <button onClick={() => setEditingSupplier(s)} className="w-full mt-2 bg-white border-2 border-indigo-50 text-indigo-600 font-black h-12 rounded-xl text-[10px] uppercase shadow-sm active:bg-indigo-50">Editar Cadastro</button>
                        </div>
                        ))}
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 uppercase text-[10px] font-black tracking-widest border-b">
                            <th className="p-4 text-left">Fornecedor</th>
                            <th className="p-4 text-center">Semanas</th>
                            <th className="p-4 text-right">Contratado</th>
                            <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSuppliers.map(s => (
                            <tr key={s.cpf} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-4">
                                    <p className="font-black text-gray-800 uppercase text-xs">{s.name}</p>
                                    <p className="text-[10px] font-mono text-gray-400">{s.cpf}</p>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex flex-wrap justify-center gap-1">
                                        {s.allowedWeeks?.length > 0 ? s.allowedWeeks.sort((a,b)=>a-b).slice(0,6).map(w => <span key={w} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[9px] font-black">S{w}</span>) : <span className="text-[10px] text-green-600 font-black uppercase">Livre</span>}
                                    </div>
                                </td>
                                <td className="p-4 text-right font-black text-green-700">{formatCurrency(s.initialValue)}</td>
                                <td className="p-4 text-center">
                                <button onClick={() => setEditingSupplier(s)} className="bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm">Editar</button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>
            )}
          </div>
        );
      case 'contracts': return <AdminContractItems suppliers={suppliers} warehouseLog={warehouseLog} onUpdateContractForItem={props.onUpdateContractForItem} />;
      case 'finance': return <AdminFinancialManager records={financialRecords} onSave={props.onSaveFinancialRecord} onDelete={props.onDeleteFinancialRecord} />;
      case 'invoices': return <AdminInvoices suppliers={suppliers} onReopenInvoice={props.onReopenInvoice} onDeleteInvoice={props.onDeleteInvoice} onUpdateInvoiceItems={props.onUpdateInvoiceItems} onManualInvoiceEntry={props.onManualInvoiceEntry} />;
      case 'schedule': return <AdminScheduleView suppliers={suppliers} thirdPartyEntries={thirdPartyEntries} onCancelDeliveries={props.onCancelDeliveries} onDeleteThirdPartyEntry={props.onDeleteThirdPartyEntry} />;
      case 'perCapita': return <AdminPerCapita suppliers={suppliers} perCapitaConfig={perCapitaConfig} onUpdatePerCapitaConfig={props.onUpdatePerCapitaConfig} />;
      case 'cleaning': return <AdminCleaningLog logs={cleaningLogs} onRegister={props.onRegisterCleaningLog} onDelete={props.onDeleteCleaningLog} />;
      case 'thirdPartyEntry': return <AdminThirdPartyEntry logs={thirdPartyEntries} onRegister={props.onRegisterThirdPartyEntry} onUpdate={props.onUpdateThirdPartyEntry} onDelete={props.onDeleteThirdPartyEntry} />;
      case 'analytics': return <AdminAnalytics suppliers={suppliers} warehouseLog={warehouseLog} />;
      case 'menu': return <AdminStandardMenu suppliers={suppliers} template={props.standardMenu} dailyMenus={props.dailyMenus} onUpdateDailyMenus={props.onUpdateDailyMenu} inmateCount={perCapitaConfig.inmateCount || 0} />;
      case 'almoxarifado': return <WarehouseMovementForm suppliers={suppliers} warehouseLog={warehouseLog} onRegisterEntry={props.onRegisterEntry} onRegisterWithdrawal={props.onRegisterWithdrawal} />;
      case 'info': 
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-4 md:p-0 pb-16">
                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border-t-8 border-indigo-900">
                    <h2 className="text-2xl md:text-3xl font-black text-indigo-950 uppercase tracking-tighter mb-6">Configurações de Sistema</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-indigo-50 p-6 rounded-3xl border-2 border-indigo-100 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-black text-indigo-800 uppercase mb-2">Exportar Backup</h3>
                                <p className="text-xs text-indigo-600/70 mb-6 font-medium leading-relaxed">Baixa todos os dados em um único arquivo .json.</p>
                            </div>
                            <button onClick={handleExportFullBackup} className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black h-14 rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">Gerar Backup</button>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-100 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-black text-blue-800 uppercase mb-2">Importar Backup</h3>
                                <p className="text-xs text-blue-600/70 mb-6 font-medium leading-relaxed">Substituirá permanentemente todos os registros atuais.</p>
                            </div>
                            <button onClick={() => backupInputRef.current?.click()} disabled={isRestoring} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black h-14 rounded-2xl shadow-lg transition-all uppercase text-[10px] tracking-widest disabled:bg-gray-400">Restauração Total</button>
                            <input type="file" ref={backupInputRef} onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                    if(window.confirm('Substituir todos os dados do sistema agora?')) {
                                        setIsRestoring(true);
                                        const success = await props.onRestoreFullBackup(JSON.parse(ev.target?.result as string));
                                        if (success) alert('Sistema Restaurado!');
                                        setIsRestoring(false);
                                    }
                                };
                                reader.readAsText(file);
                            }} accept=".json" className="hidden" />
                        </div>
                    </div>
                </div>
            </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-72 bg-indigo-950 min-h-screen flex-col border-r shadow-2xl z-50 sticky top-0 h-screen">
        <div className="p-6 border-b border-indigo-900 bg-indigo-950 text-white">
            <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">Admin Painel</h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Gestão Institucional 2026</p>
        </div>
        <nav className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <ul className="space-y-1">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-300 hover:bg-indigo-900'}`}>
                    {tab.icon} {tab.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-indigo-900">
            <button onClick={onLogout} className="w-full p-4 bg-red-600/20 text-red-400 font-black rounded-2xl uppercase text-[9px] tracking-widest hover:bg-red-600 hover:text-white transition-colors border border-red-900">Sair da Gestão</button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-indigo-950 text-white p-4 sticky top-0 z-[100] shadow-lg flex justify-between items-center border-b border-indigo-800 flex-shrink-0">
          <div>
            <h1 className="text-sm font-black uppercase italic tracking-tighter">Finanças 2026</h1>
            <p className="text-[8px] text-indigo-400 font-bold uppercase">ADMINISTRADOR</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-indigo-900 rounded-xl active:bg-indigo-800">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"} /></svg>
          </button>
      </header>

      {/* Overlay Menu Mobile */}
      {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[90] bg-indigo-950 p-4 pt-20 animate-fade-in overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 pb-20">
                  {tabs.map(tab => (
                      <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center justify-center p-6 rounded-3xl text-[9px] font-black uppercase gap-3 border-2 transition-all active:scale-95 ${activeTab === tab.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-indigo-900/50 border-indigo-900 text-indigo-300'}`}>
                          {React.cloneElement(tab.icon as React.ReactElement, { className: "h-6 w-6" })}
                          {tab.name}
                      </button>
                  ))}
                  <button onClick={onLogout} className="col-span-2 mt-4 p-5 bg-red-600 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest active:bg-red-700">Encerrar Sessão</button>
              </div>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-2 md:p-10 overflow-y-auto bg-gray-100 custom-scrollbar-main"> 
        {renderContent()} 
      </main>

      {editingSupplier && (<EditSupplierModal supplier={editingSupplier} suppliers={suppliers} onClose={() => setEditingSupplier(null)} onSave={async (old, name, cpf, weeks) => { const err = await props.onUpdateSupplier(old, name, cpf, weeks); if (!err) setEditingSupplier(null); return err; }} />)}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #312e81; border-radius: 10px; }
        .custom-scrollbar-main::-webkit-scrollbar { width: 6px; } .custom-scrollbar-main::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
