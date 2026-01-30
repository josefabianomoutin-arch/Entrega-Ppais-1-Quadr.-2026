
import React, { useState, useMemo } from 'react';
import type { Supplier, ContractItem, WarehouseMovement, PerCapitaConfig, CleaningLog, DirectorPerCapitaLog } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';
import EditSupplierModal from './EditSupplierModal';
import AdminScheduleView from './AdminScheduleView';
import AdminInvoices from './AdminInvoices';
import AdminPerCapita from './AdminPerCapita';
import AdminWarehouseLog from './AdminWarehouseLog';
import AdminCleaningLog from './AdminCleaningLog';
import AdminDirectorPerCapita from './AdminDirectorPerCapita';

type AdminTab = 'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita' | 'warehouse' | 'cleaning' | 'directorPerCapita';

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
  perCapitaConfig: PerCapitaConfig;
  onUpdatePerCapitaConfig: (config: PerCapitaConfig) => Promise<void>;
  onDeleteWarehouseEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
  onRegisterCleaningLog: (log: Omit<CleaningLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onDeleteCleaningLog: (id: string) => Promise<void>;
  onRegisterDirectorWithdrawal: (log: Omit<DirectorPerCapitaLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  onDeleteDirectorWithdrawal: (id: string) => Promise<void>;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const { suppliers, activeTab, onTabChange, cleaningLogs, onRegisterCleaningLog, onDeleteCleaningLog, directorWithdrawals, onRegisterDirectorWithdrawal, onDeleteDirectorWithdrawal, onRegister, onPersistSuppliers, onUpdateSupplier, registrationStatus, onClearRegistrationStatus } = props;

  // Estados locais para abas de gestão
  const [supplierSearch, setSupplierSearch] = useState('');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regWeeks, setRegWeeks] = useState<number[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Estados para Gestão de Itens
  const [selectedSupplierCpf, setSelectedSupplierCpf] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemKg, setNewItemKg] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('kg-1');

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Gestão de fornecedores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão por Item', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'directorPerCapita', name: 'Cota Diretores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg> },
    { id: 'cleaning', name: 'Higienização Câmara', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5.5"></path><circle cx="18" cy="18" r="3"></circle><path d="M18 15l2 2-2 2"></path></svg> },
    { id: 'warehouse', name: 'Controle de Estoque', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-1 4a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1zm8-4a1 1 0 00-1-1h-2a1 1 0 100 2h2a1 1 0 001-1z" /><path fillRule="evenodd" d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1h12v12H4V4z" clipRule="evenodd" /></svg> },
    { id: 'analytics', name: 'Relatório Analítico', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg> },
    { id: 'perCapita', name: 'Cálculo Per Capita', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg> },
    { id: 'info', name: 'Zona Crítica', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> },
  ];

  const totalValue = useMemo(() => suppliers.reduce((s, p) => s + (p.initialValue || 0), 0), [suppliers]);

  const filteredSuppliers = useMemo(() => 
    suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())), 
  [suppliers, supplierSearch]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierCpf || !newItemName) return;

    const kg = parseFloat(newItemKg.replace(',', '.'));
    const val = parseFloat(newItemValue.replace(',', '.'));
    if (isNaN(kg) || isNaN(val)) return;

    const newItem: ContractItem = {
      name: newItemName.toUpperCase(),
      totalKg: kg,
      valuePerKg: val,
      unit: newItemUnit
    };

    const updatedSuppliers = suppliers.map(s => {
      if (s.cpf === selectedSupplierCpf) {
        const items = [...(s.contractItems || []), newItem];
        const initialValue = items.reduce((acc, i) => acc + (i.totalKg * i.valuePerKg), 0);
        return { ...s, contractItems: items, initialValue };
      }
      return s;
    });

    onPersistSuppliers(updatedSuppliers);
    setNewItemName('');
    setNewItemKg('');
    setNewItemValue('');
  };

  const handleRemoveItem = (supplierCpf: string, itemName: string) => {
    if (!window.confirm(`Excluir item "${itemName}"?`)) return;

    const updatedSuppliers = suppliers.map(s => {
      if (s.cpf === supplierCpf) {
        const items = s.contractItems.filter(i => i.name !== itemName);
        const initialValue = items.reduce((acc, i) => acc + (i.totalKg * i.valuePerKg), 0);
        return { ...s, contractItems: items, initialValue };
      }
      return s;
    });

    onPersistSuppliers(updatedSuppliers);
  };

  const handleDeleteSupplier = (cpf: string) => {
    if (!window.confirm('Excluir este fornecedor permanentemente?')) return;
    const updated = suppliers.filter(s => s.cpf !== cpf);
    onPersistSuppliers(updated);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white/90 backdrop-blur-sm shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-green-800">Gestão de Fornecedores 1º Quadr. 2026</h1>
          <p className="text-sm text-gray-500">Painel do Administrador</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-xs text-gray-500">Valor Total Contratado</p>
                <p className="font-bold text-green-700 text-lg">{formatCurrency(totalValue)}</p>
            </div>
            <button onClick={props.onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Sair</button>
        </div>
      </header>
      
      <div className="flex flex-col md:flex-row">
        <aside className="w-full md:w-64 bg-white md:min-h-[calc(100vh-73px)] border-r">
            <nav className="p-4">
                <ul className="space-y-1">
                    {tabs.map(tab => (
                        <li key={tab.id}>
                            <button onClick={() => onTabChange(tab.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'} ${tab.id === 'info' ? '!text-red-600 hover:!bg-red-50' : ''}`}>
                                {tab.icon}
                                {tab.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          {activeTab === 'register' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-green-500">
                <h2 className="text-xl font-bold mb-4">Novo Fornecedor</h2>
                <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={async (e) => {
                  e.preventDefault();
                  await onRegister(regName, regCpf, regWeeks);
                  setRegName(''); setRegCpf(''); setRegWeeks([]);
                }}>
                  <input type="text" placeholder="NOME DO FORNECEDOR" value={regName} onChange={e => setRegName(e.target.value.toUpperCase())} className="p-2 border rounded-lg" required />
                  <input type="text" placeholder="CPF/CNPJ (APENAS NÚMEROS)" value={regCpf} onChange={e => setRegCpf(e.target.value.replace(/\D/g, ''))} className="p-2 border rounded-lg font-mono" required />
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Semanas Permitidas (Opcional)</label>
                    <WeekSelector selectedWeeks={regWeeks} onWeekToggle={(w) => setRegWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])} />
                  </div>
                  <button type="submit" className="md:col-span-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors">Cadastrar Fornecedor</button>
                </form>
                {registrationStatus && (
                  <div className={`mt-4 p-3 rounded-lg text-sm font-bold text-center ${registrationStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {registrationStatus.message}
                    <button onClick={onClearRegistrationStatus} className="ml-2 underline text-xs">Fechar</button>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Fornecedores Cadastrados</h2>
                  <input type="text" placeholder="Pesquisar..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="border p-2 rounded-lg text-sm" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                        <th className="p-3 text-left">Fornecedor</th>
                        <th className="p-3 text-left">Documento</th>
                        <th className="p-3 text-right">Valor Total</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredSuppliers.map(s => (
                        <tr key={s.cpf} className="hover:bg-gray-50">
                          <td className="p-3 font-bold">{s.name}</td>
                          <td className="p-3 font-mono text-gray-500">{s.cpf}</td>
                          <td className="p-3 text-right font-bold text-green-600">{formatCurrency(s.initialValue)}</td>
                          <td className="p-3 text-center space-x-2">
                            <button onClick={() => setEditingSupplier(s)} className="text-blue-500 hover:text-blue-700 p-1">Editar</button>
                            <button onClick={() => handleDeleteSupplier(s.cpf)} className="text-red-500 hover:text-red-700 p-1">Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-indigo-500">
                <h2 className="text-xl font-bold mb-4">Adicionar Item ao Fornecedor</h2>
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div className="lg:col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Fornecedor</label>
                    <select value={selectedSupplierCpf} onChange={e => setSelectedSupplierCpf(e.target.value)} className="w-full p-2 border rounded-lg bg-white" required>
                      <option value="">-- Selecionar --</option>
                      {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Nome do Item</label>
                    <input type="text" placeholder="Ex: ARROZ" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 border rounded-lg" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Peso Total</label>
                    <input type="text" placeholder="Kg" value={newItemKg} onChange={e => setNewItemKg(e.target.value)} className="w-full p-2 border rounded-lg font-mono" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Valor p/ Kg (R$)</label>
                    <input type="text" placeholder="0.00" value={newItemValue} onChange={e => setNewItemValue(e.target.value)} className="w-full p-2 border rounded-lg font-mono" required />
                  </div>
                  <div className="lg:col-span-5 flex justify-end">
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-8 rounded-lg transition-colors">Vincular Item ao Contrato</button>
                  </div>
                </form>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {suppliers.filter(s => s.contractItems?.length > 0).map(s => (
                  <div key={s.cpf} className="bg-white rounded-xl shadow-md overflow-hidden border">
                    <div className="bg-gray-50 p-4 flex justify-between items-center border-b">
                      <div>
                        <h3 className="font-bold text-gray-800">{s.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{s.cpf}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase font-bold">Total do Fornecedor</p>
                        <p className="font-black text-indigo-600">{formatCurrency(s.initialValue)}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-wider">
                          <tr>
                            <th className="p-3 text-left">Item</th>
                            <th className="p-3 text-right">Peso Total</th>
                            <th className="p-3 text-right">Vlr p/ Kg</th>
                            <th className="p-3 text-right">Subtotal</th>
                            <th className="p-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {s.contractItems.map(item => (
                            <tr key={item.name} className="hover:bg-gray-50">
                              <td className="p-3 font-bold text-gray-700">{item.name}</td>
                              <td className="p-3 text-right font-mono">{item.totalKg.toLocaleString('pt-BR')} Kg</td>
                              <td className="p-3 text-right font-mono">{formatCurrency(item.valuePerKg)}</td>
                              <td className="p-3 text-right font-bold">{formatCurrency(item.totalKg * item.valuePerKg)}</td>
                              <td className="p-3 text-center">
                                <button onClick={() => handleRemoveItem(s.cpf, item.name)} className="text-red-500 hover:bg-red-50 p-1 rounded">Remover</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'directorPerCapita' && <AdminDirectorPerCapita suppliers={suppliers} logs={directorWithdrawals} onRegister={onRegisterDirectorWithdrawal} onDelete={onDeleteDirectorWithdrawal} />}
          {activeTab === 'cleaning' && <AdminCleaningLog logs={cleaningLogs} onRegister={onRegisterCleaningLog} onDelete={onDeleteCleaningLog} />}
          {activeTab === 'warehouse' && <AdminWarehouseLog suppliers={suppliers} warehouseLog={props.warehouseLog} onDeleteEntry={props.onDeleteWarehouseEntry} />}
          {activeTab === 'analytics' && <AdminAnalytics suppliers={suppliers} />}
          {activeTab === 'perCapita' && <AdminPerCapita suppliers={suppliers} perCapitaConfig={props.perCapitaConfig} onUpdatePerCapitaConfig={props.onUpdatePerCapitaConfig} />}
          {activeTab === 'info' && (
            <div className="bg-red-50 p-8 rounded-2xl border-2 border-red-200 text-center space-y-4">
              <h2 className="text-2xl font-black text-red-800 uppercase">Zona Crítica de Dados</h2>
              <p className="text-red-600 max-w-md mx-auto">Estas ações são irreversíveis e afetam permanentemente o banco de dados na nuvem.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <button onClick={props.onResetData} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:scale-105">Apagar Todos os Dados</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {editingSupplier && (
        <EditSupplierModal 
          supplier={editingSupplier} 
          suppliers={suppliers} 
          onClose={() => setEditingSupplier(null)} 
          onSave={async (old, name, cpf, weeks) => {
            const err = await onUpdateSupplier(old, name, cpf, weeks);
            if (!err) setEditingSupplier(null);
            return err;
          }} 
        />
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
