
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
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
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
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

// --- Edit Contract Item Modal Component ---
interface EditContractItemModalProps {
  supplier: Supplier;
  item: ContractItem;
  onClose: () => void;
  onSave: (supplierCpf: string, originalItemName: string, updatedItem: ContractItem) => void;
}

const EditContractItemModal: React.FC<EditContractItemModalProps> = ({ supplier, item, onClose, onSave }) => {
  const [updatedItem, setUpdatedItem] = useState<ContractItem>({ ...item });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof ContractItem, value: string) => {
    setUpdatedItem(prev => ({ ...prev, [field]: value }));
  };

  const handleNumericChange = (field: 'totalKg' | 'valuePerKg', value: string) => {
    const sanitizedValue = value.replace(/[^0-9,]/g, '');
    setUpdatedItem(prev => ({ ...prev, [field]: sanitizedValue as any }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const finalItem: ContractItem = {
      ...updatedItem,
      name: updatedItem.name.toUpperCase(),
      totalKg: parseFloat((String(updatedItem.totalKg) || '0').replace(',', '.')),
      valuePerKg: parseFloat((String(updatedItem.valuePerKg) || '0').replace(',', '.'))
    };
    onSave(supplier.cpf, item.name, finalItem);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 animate-fade-in-up">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Editar Item do Contrato</h2>
                <p className="text-sm text-gray-500">{supplier.name}</p>
            </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Descrição do Item</label>
                <input 
                    type="text" 
                    value={updatedItem.name || ''}
                    onChange={e => handleChange('name', e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                    required 
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Cód. SIAFEM</label>
                    <input 
                        type="text" 
                        value={updatedItem.siafemCode || ''}
                        onChange={e => handleChange('siafemCode', e.target.value)}
                        className="w-full p-2 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Cód. COMPRAS</label>
                    <input 
                        type="text" 
                        value={updatedItem.comprasCode || ''}
                        onChange={e => handleChange('comprasCode', e.target.value)}
                        className="w-full p-2 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Qtd Total (Kg)</label>
                    <input 
                        type="text" 
                        value={String(updatedItem.totalKg).replace('.',',')}
                        onChange={e => handleNumericChange('totalKg', e.target.value)}
                        className="w-full p-2 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-400"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Preço Unitário (R$)</label>
                    <input 
                        type="text" 
                        value={String(updatedItem.valuePerKg).replace('.',',')}
                        onChange={e => handleNumericChange('valuePerKg', e.target.value)}
                        className="w-full p-2 border rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-400"
                        required
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end space-x-3 border-t">
                <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
                    Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400">
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};


const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { 
    suppliers = [], 
    activeTab, 
    onTabChange, 
    onRegister, 
    onPersistSuppliers, 
    onUpdateSupplier, 
    registrationStatus, 
    onClearRegistrationStatus,
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
    warehouseLog,
    onDeleteWarehouseEntry,
    onReopenInvoice,
    onDeleteInvoice,
    onUpdateInvoiceItems,
    onManualInvoiceEntry,
    standardMenu,
    dailyMenus,
    onUpdateStandardMenu,
    onUpdateDailyMenu,
    onRegisterEntry,
    onRegisterWithdrawal,
    onCancelDeliveries
  } = props;

  const [supplierSearch, setSupplierSearch] = useState('');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regWeeks, setRegWeeks] = useState<number[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingItem, setEditingItem] = useState<{ supplier: Supplier; item: ContractItem } | null>(null);
  
  const [selectedSupplierCpf, setSelectedSupplierCpf] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemKg, setNewItemKg] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('kg-1');
  const [newItemSiafem, setNewItemSiafem] = useState('');
  const [newItemCompras, setNewItemCompras] = useState('');

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Gestão de fornecedores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão por Item', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'invoices', name: 'Consultar Notas Fiscais', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'schedule', name: 'Agenda Geral', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'directorPerCapita', name: 'Cota Diretores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> },
    { id: 'menu', name: 'Cardápio Padrão', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /><path d="M11 3.5v3a1 1 0 001 1h3m-6 4H7v2h3v-2zm0 3H7v2h3v-2z" /></svg> },
    { id: 'cleaning', name: 'Higienização Câmara', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 1 1.69.9H20a2 2 0 0 1 2 2v5.5"></path><circle cx="18" cy="18" r="3"></circle><path d="M18 15l2 2-2 2"></path></svg> },
    { id: 'warehouse', name: 'Controle de Estoque', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-1 4a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm8-4a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" /><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1h12v12H4V4z" clipRule="evenodd" /></svg> },
    { id: 'analytics', name: 'Relatório Analítico', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 -1 1h-2a1 1 0 -1 -1V4z" /></svg> },
    { id: 'perCapita', name: 'Cálculo Per Capita', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg> },
    { id: 'info', name: 'Zona Crítica', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> },
  ];

  const totalValue = useMemo(() => {
    return (suppliers || []).reduce((s, p) => s + (p.initialValue || 0), 0);
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers || !Array.isArray(suppliers)) return [];
    return suppliers.filter(s => {
      const name = s.name || '';
      return name.toLowerCase().includes(supplierSearch.toLowerCase());
    });
  }, [suppliers, supplierSearch]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierCpf || !newItemName) return;
    const kg = parseFloat(newItemKg.replace(',', '.'));
    const val = parseFloat(newItemValue.replace(',', '.'));
    if (isNaN(kg) || isNaN(val)) {
        alert("Por favor, insira valores válidos para peso e preço.");
        return;
    }
    const newItem: ContractItem = {
      name: newItemName.toUpperCase(),
      totalKg: kg,
      valuePerKg: val,
      unit: newItemUnit,
      siafemCode: newItemSiafem,
      comprasCode: newItemCompras,
    };
    const updatedSuppliers = (suppliers || []).map(s => {
      if (s.cpf === selectedSupplierCpf) {
        const items = [...(s.contractItems || []), newItem];
        const initialValue = items.reduce((acc, i) => acc + (i.totalKg * i.valuePerKg), 0);
        return { ...s, contractItems: items, initialValue };
      }
      return s;
    });
    onPersistSuppliers(updatedSuppliers);
    setNewItemName(''); setNewItemKg(''); setNewItemValue(''); setNewItemSiafem(''); setNewItemCompras('');
  };

  const handleUpdateItem = (supplierCpf: string, originalItemName: string, updatedItem: ContractItem) => {
    const updatedSuppliers = (suppliers || []).map(s => {
      if (s.cpf === supplierCpf) {
        const items = (s.contractItems || []).map(i => i.name === originalItemName ? updatedItem : i);
        const initialValue = items.reduce((acc, i) => acc + ((i.totalKg || 0) * (i.valuePerKg || 0)), 0);
        return { ...s, contractItems: items, initialValue };
      }
      return s;
    });
    onPersistSuppliers(updatedSuppliers);
    setEditingItem(null);
  };

  const handleRemoveItem = (supplierCpf: string, itemName: string) => {
    if (!window.confirm(`Excluir item "${itemName}"?`)) return;
    const updatedSuppliers = (suppliers || []).map(s => {
      if (s.cpf === supplierCpf) {
        const items = (s.contractItems || []).filter(i => i.name !== itemName);
        const initialValue = items.reduce((acc, i) => acc + (i.totalKg * i.valuePerKg), 0);
        return { ...s, contractItems: items, initialValue };
      }
      return s;
    });
    onPersistSuppliers(updatedSuppliers);
  };

  const handleDeleteSupplier = (cpf: string) => {
    if (!window.confirm('Excluir este fornecedor permanentemente? Todos os itens de contrato associados serão removidos.')) return;
    const updated = (suppliers || []).filter(s => s.cpf !== cpf);
    onPersistSuppliers(updated);
  };

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
              {registrationStatus && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-bold text-center ${registrationStatus.success ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                  {registrationStatus.message}
                  <button onClick={onClearRegistrationStatus} className="ml-2 underline text-xs">Fechar</button>
                </div>
              )}
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Fornecedores Habilitados ({filteredSuppliers.length})</h2>
                <div className="relative w-full md:w-64">
                  <input type="text" placeholder="Pesquisar por nome..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="w-full border p-2 pl-8 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-400" />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
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
                    {filteredSuppliers.length > 0 ? filteredSuppliers.map(s => (
                      <tr key={s.cpf} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-800 uppercase">{s.name}</td>
                        <td className="p-4 font-mono text-gray-500 text-xs">{s.cpf}</td>
                        <td className="p-4 text-right font-black text-green-600">{formatCurrency(s.initialValue)}</td>
                        <td className="p-4 text-center space-x-3">
                          <button onClick={() => setEditingSupplier(s)} className="text-blue-500 hover:text-blue-700 font-bold text-xs uppercase underline">Editar</button>
                          <button onClick={() => handleDeleteSupplier(s.cpf)} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase underline">Excluir</button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic font-medium">Nenhum fornecedor encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'contracts':
        return (
          <div className="space-y-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-500">
              <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-tight">Vincular Item ao Fornecedor</h2>
              <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end">
                <div className="lg:col-span-2 md:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Selecione o Fornecedor</label>
                  <select value={selectedSupplierCpf} onChange={e => setSelectedSupplierCpf(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400" required>
                    <option value="">-- SELECIONE --</option>
                    {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                  </select>
                </div>
                <div className="lg:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Descrição do Item</label>
                  <input type="text" placeholder="EX: ARROZ" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400" required />
                </div>
                <div className="lg:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Cód. SIAFEM</label>
                  <input type="text" placeholder="000000" value={newItemSiafem} onChange={e => setNewItemSiafem(e.target.value)} className="w-full p-2 border rounded-lg font-mono focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="lg:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Cód. COMPRAS</label>
                  <input type="text" placeholder="000000" value={newItemCompras} onChange={e => setNewItemCompras(e.target.value)} className="w-full p-2 border rounded-lg font-mono focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="lg:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Qtd Total (Kg)</label>
                  <input type="text" placeholder="0.00" value={newItemKg} onChange={e => setNewItemKg(e.target.value)} className="w-full p-2 border rounded-lg font-mono focus:ring-2 focus:ring-indigo-400" required />
                </div>
                <div className="lg:col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Preço Unitário (R$)</label>
                  <input type="text" placeholder="0.00" value={newItemValue} onChange={e => setNewItemValue(e.target.value)} className="w-full p-2 border rounded-lg font-mono focus:ring-2 focus:ring-indigo-400" required />
                </div>
                <div className="lg:col-span-7 flex justify-end">
                  <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-10 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-sm">Adicionar ao Contrato</button>
                </div>
              </form>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <h3 className="text-lg font-black text-gray-600 uppercase tracking-wider px-2">Detalhamento dos Contratos</h3>
              {suppliers.length > 0 ? (
                  suppliers.map(s => (
                      <div key={s.cpf} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 mb-4">
                          <div className="bg-gray-50 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center border-b gap-4">
                          <div>
                              <h3 className="font-black text-gray-800 uppercase text-lg">{s.name}</h3>
                              <p className="text-xs text-gray-500 font-mono tracking-widest">{s.cpf}</p>
                          </div>
                          <div className="text-left md:text-right bg-indigo-50 px-4 py-2 rounded-xl">
                              <p className="text-[10px] text-indigo-400 uppercase font-black">Valor do Contrato</p>
                              <p className="font-black text-indigo-700 text-xl leading-none">{formatCurrency(s.initialValue)}</p>
                          </div>
                          </div>
                          <div className="overflow-x-auto">
                          {(s.contractItems || []).length > 0 ? (
                              <table className="w-full text-xs">
                                  <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-widest">
                                  <tr>
                                      <th className="p-4 text-left">Descrição do Item</th>
                                      <th className="p-4 text-left">Cód. SIAFEM</th>
                                      <th className="p-4 text-left">Cód. COMPRAS</th>
                                      <th className="p-4 text-right">Peso Total</th>
                                      <th className="p-4 text-right">Preço p/ Kg</th>
                                      <th className="p-4 text-right">Subtotal</th>
                                      <th className="p-4 text-center">Ações</th>
                                  </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                  {s.contractItems.map((item, idx) => (
                                      <tr key={`${s.cpf}-${item.name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                      <td className="p-4 font-bold text-gray-700 uppercase">{item.name}</td>
                                      <td className="p-4 font-mono text-gray-500 text-xs">{item.siafemCode || '-'}</td>
                                      <td className="p-4 font-mono text-gray-500 text-xs">{item.comprasCode || '-'}</td>
                                      <td className="p-4 text-right font-mono">{(item.totalKg || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})} Kg</td>
                                      <td className="p-4 text-right font-mono text-gray-500">{formatCurrency(item.valuePerKg)}</td>
                                      <td className="p-4 text-right font-black text-gray-800">{formatCurrency((item.totalKg || 0) * (item.valuePerKg || 0))}</td>
                                      <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => setEditingItem({ supplier: s, item: item })} className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors" title="Editar item do contrato"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg></button>
                                            <button onClick={() => handleRemoveItem(s.cpf, item.name)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors" title="Remover item do contrato"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                      </td>
                                      </tr>
                                  ))}
                                  </tbody>
                              </table>
                          ) : (
                              <div className="p-10 text-center bg-gray-50/50"><p className="text-gray-400 text-xs italic">Este fornecedor ainda não possui itens vinculados ao contrato.</p></div>
                          )}
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="p-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed"><p className="text-gray-400 font-bold uppercase tracking-widest italic">Nenhum fornecedor cadastrado.</p></div>
              )}
            </div>
          </div>
        );
      case 'invoices': return <AdminInvoices suppliers={suppliers} onReopenInvoice={onReopenInvoice} onDeleteInvoice={onDeleteInvoice} onUpdateInvoiceItems={onUpdateInvoiceItems} onManualInvoiceEntry={onManualInvoiceEntry} />;
      /* Fix: handleCancelDeliveries should be onCancelDeliveries */
      case 'schedule': return <AdminScheduleView suppliers={suppliers} onCancelDeliveries={onCancelDeliveries} />;
      /* Fix: handleRegisterDirectorWithdrawal should be onRegisterDirectorWithdrawal and use prop-based delete function */
      case 'directorPerCapita': return <AdminDirectorPerCapita suppliers={suppliers} logs={directorWithdrawals} onRegister={onRegisterDirectorWithdrawal} onDelete={onDeleteDirectorWithdrawal} />;
      /* Fix: use props for cleaning log register/delete instead of local set/ref */
      case 'cleaning': return <AdminCleaningLog logs={cleaningLogs} onRegister={onRegisterCleaningLog} onDelete={onDeleteCleaningLog} />;
      /* Fix: handle... names should be correctly matched with props onRegisterEntry, onRegisterWithdrawal, etc */
      case 'warehouse': return <AdminWarehouseLog suppliers={suppliers} warehouseLog={warehouseLog} onDeleteEntry={onDeleteWarehouseEntry} onRegisterEntry={onRegisterEntry} onRegisterWithdrawal={onRegisterWithdrawal} />;
      case 'analytics': return <AdminAnalytics suppliers={suppliers} />;
      case 'graphs': return <AdminGraphs suppliers={suppliers} />;
      /* Fix: use prop onUpdatePerCapitaConfig instead of writeToDatabase/perCapitaConfigRef */
      case 'perCapita': return <AdminPerCapita suppliers={suppliers} perCapitaConfig={perCapitaConfig} onUpdatePerCapitaConfig={onUpdatePerCapitaConfig} />;
      case 'menu': return <AdminStandardMenu suppliers={suppliers} template={standardMenu} dailyMenus={dailyMenus} onUpdateDailyMenus={onUpdateDailyMenu} inmateCount={perCapitaConfig.inmateCount || 0} />;
      case 'info':
        return (
          <div className="bg-red-50 p-8 md:p-12 rounded-3xl border-2 border-red-200 text-center space-y-6 max-w-2xl mx-auto shadow-xl mt-10">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
            <h2 className="text-3xl font-black text-red-800 uppercase tracking-tighter">Zona Crítica de Dados</h2>
            <p className="text-red-600 font-medium">Estas ações são irreversíveis e apagarão permanentemente todo o histórico do banco de dados.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4"><button onClick={onResetData} className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-10 rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-sm">Apagar Todos os Dados</button></div>
          </div>
        );
      default: return <div className="p-10 text-center text-gray-500 italic">Selecione uma aba no menu lateral.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-20">
        <div><h1 className="text-xl md:text-2xl font-bold text-green-800">Painel Administrativo</h1><p className="text-sm text-gray-500">Gestão 1º Quadr. 2026</p></div>
        <div className="flex items-center gap-4"><div className="hidden md:block text-right"><p className="text-[10px] font-bold text-gray-400 uppercase">Total Contratado</p><p className="font-black text-green-700 text-lg leading-none">{formatCurrency(totalValue)}</p></div><button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">Sair</button></div>
      </header>
      <div className="flex flex-col md:flex-row">
        <aside className="w-full md:w-72 bg-white md:min-h-[calc(100vh-73px)] border-r"><nav className="p-4"><ul className="space-y-1">{tabs.map(tab => (<li key={tab.id}><button onClick={() => onTabChange(tab.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'} ${tab.id === 'info' ? '!text-red-600 hover:!bg-red-50' : ''}`}>{tab.icon}{tab.name}</button></li>))}</ul></nav></aside>
        <main className="flex-1 p-4 md:p-8 bg-gray-100">{renderContent()}</main>
      </div>
      {editingItem && (<EditContractItemModal supplier={editingItem.supplier} item={editingItem.item} onClose={() => setEditingItem(null)} onSave={handleUpdateItem} />)}
      {editingSupplier && (<EditSupplierModal supplier={editingSupplier} suppliers={suppliers} onClose={() => setEditingSupplier(null)} onSave={async (old, name, cpf, weeks) => { const err = await onUpdateSupplier(old, name, cpf, weeks); if (!err) setEditingSupplier(null); return err; }} />)}
    </div>
  );
};

export default AdminDashboard;
