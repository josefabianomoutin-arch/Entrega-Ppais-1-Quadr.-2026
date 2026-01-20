import React, { useState, useEffect } from 'react';
import type { Supplier } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';
import EditSupplierModal from './EditSupplierModal';
import AdminGraphs from './AdminGraphs';
import AdminScheduleView from './AdminScheduleView';
import AdminInvoices from './AdminInvoices';
import AdminPerCapita from './AdminPerCapita';

type AdminTab = 'info' | 'register' | 'contracts' | 'analytics' | 'graphs' | 'schedule' | 'invoices' | 'perCapita';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, allowedWeeks: number[]) => Promise<void>;
  onUpdateSuppliers: (updatedSuppliers: Supplier[]) => void;
  onUpdateSupplier: (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]) => Promise<string | null>;
  onLogout: () => void;
  suppliers: Supplier[];
  onResetData: () => void;
  onRestoreData: (backupSuppliers: Supplier[]) => Promise<boolean>;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  registrationStatus: { success: boolean; message: string } | null;
  onClearRegistrationStatus: () => void;
  onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => Promise<void>;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Tipos para o estado da UI de Gestão por Item
interface SupplierSlot { supplierCpf: string; }
interface ItemCentricInput {
  id: string;
  name: string;
  suppliers: SupplierSlot[];
  // Campos para a UI de entrada
  ui_unit: 'kg' | 'dz' | 'un' | 'pacote' | 'balde' | 'saco';
  ui_quantity: string;
  ui_valuePerUnit: string;
  ui_kgConversion: string;
  ui_packageSize: string; // Reutilizado para pacotes, baldes e sacos
  // Campos de dados reais (calculados)
  totalKg: string;
  valuePerKg: string;
}


const initialSupplierSlot = (): SupplierSlot => ({ supplierCpf: '' });

const initialItemCentricInput = (): ItemCentricInput => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: '',
  suppliers: Array(15).fill(null).map(initialSupplierSlot),
  ui_unit: 'kg',
  ui_quantity: '',
  ui_valuePerUnit: '',
  ui_kgConversion: '1',
  ui_packageSize: '',
  totalKg: '',
  valuePerKg: '',
});


const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    onRegister, 
    onUpdateSuppliers,
    onUpdateSupplier,
    onLogout, 
    suppliers, 
    onResetData, 
    onRestoreData,
    activeTab,
    onTabChange,
    registrationStatus,
    onClearRegistrationStatus,
    onReopenInvoice
}) => {
  // Estados para aba de REGISTRO
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{ success: boolean; message: string } | null>(null);


  // Estados para aba de GESTÃO POR ITEM
  const [itemCentricContracts, setItemCentricContracts] = useState<ItemCentricInput[]>([initialItemCentricInput()]);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);
  const [contractError, setContractError] = useState('');
  const [contractSuccess, setContractSuccess] = useState('');

  // Estados para ZONA CRÍTICA (Backup/Restore)
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMessage, setRestoreMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (registrationStatus) {
      if (registrationStatus.success) {
        setRegName('');
        setRegCpf('');
        setSelectedWeeks([]);
      }
      const timer = setTimeout(() => {
        onClearRegistrationStatus();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [registrationStatus, onClearRegistrationStatus]);
  
  useEffect(() => {
    if (updateStatus) {
      const timer = setTimeout(() => {
        setUpdateStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus]);


  // Sincroniza o estado da UI de contratos com os dados mais recentes dos fornecedores
  useEffect(() => {
    if (activeTab !== 'contracts') return;

    const itemsMap = new Map<string, { totalKg: number; valuePerKg: number; supplierCpfs: string[]; order: number }>();

    suppliers.forEach(supplier => {
        (supplier.contractItems || []).forEach(item => {
            const order = item.order ?? Infinity;
            if (!itemsMap.has(item.name)) {
                itemsMap.set(item.name, { totalKg: 0, valuePerKg: item.valuePerKg, supplierCpfs: [], order: order });
            }
            const entry = itemsMap.get(item.name)!;
            entry.totalKg += item.totalKg;
            if (order < entry.order) entry.order = order;
            if (!entry.supplierCpfs.includes(supplier.cpf)) entry.supplierCpfs.push(supplier.cpf);
        });
    });

    const sortedItems = Array.from(itemsMap.entries()).sort(([, a], [, b]) => a.order - b.order);

    const uiState: ItemCentricInput[] = sortedItems.map(([name, data], index) => {
        const totalKgStr = String(data.totalKg);
        const valuePerKgStr = String(data.valuePerKg);
        return {
            id: `item-loaded-${index}-${name}`,
            name,
            totalKg: totalKgStr,
            valuePerKg: valuePerKgStr,
            suppliers: [
                ...data.supplierCpfs.map(cpf => ({ supplierCpf: cpf })),
                ...Array(Math.max(0, 15 - data.supplierCpfs.length)).fill(null).map(initialSupplierSlot)
            ],
            ui_unit: 'kg',
            ui_quantity: totalKgStr,
            ui_valuePerUnit: valuePerKgStr,
            ui_kgConversion: '1',
            ui_packageSize: '',
        };
    });

    if (uiState.length > 0) {
        setItemCentricContracts(uiState);
    } else {
        setItemCentricContracts([initialItemCentricInput()]);
    }
  }, [suppliers, activeTab]);


  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    await onRegister(regName, regCpf, selectedWeeks);
    setIsRegistering(false);
  };
  
  const handleSaveSupplierUpdate = async (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]): Promise<string | null> => {
    const errorMessage = await onUpdateSupplier(oldCpf, newName, newCpf, newAllowedWeeks);
    if (errorMessage) {
        setUpdateStatus({ success: false, message: errorMessage });
        return errorMessage;
    } else {
        setUpdateStatus({ success: true, message: 'Fornecedor atualizado com sucesso!' });
        setEditingSupplier(null);
        return null;
    }
  };

  const handleSaveContracts = (e: React.FormEvent) => {
    e.preventDefault(); setContractError(''); setContractSuccess('');

    const updatedSuppliers: Supplier[] = suppliers.map(p => ({ ...p, contractItems: [], initialValue: 0 }));
    const supplierMap = new Map(updatedSuppliers.map(p => [p.cpf, p]));

    for (let index = 0; index < itemCentricContracts.length; index++) {
        const uiItem = itemCentricContracts[index];
        const name = uiItem.name.trim().toUpperCase();
        if (!name) continue;

        const assignedSupplierCpfs = uiItem.suppliers.map(p => p.supplierCpf).filter(cpf => cpf !== '');
        
        if (assignedSupplierCpfs.length > 0) {
            const totalKg = parseFloat(uiItem.totalKg);
            const valuePerKg = parseFloat(uiItem.valuePerKg);
            
            if (isNaN(totalKg) || totalKg <= 0 || isNaN(valuePerKg) || valuePerKg < 0) { // value can be 0
                setContractError(`O item "${name}" possui valores inválidos para peso ou preço. Verifique os campos de quantidade, preço e conversão.`);
                return;
            }

            const kgPerSupplier = totalKg / assignedSupplierCpfs.length;

            for (const supplierCpf of assignedSupplierCpfs) {
                const supplier = supplierMap.get(supplierCpf);
                if (supplier) {
                    supplier.contractItems.push({ name, totalKg: kgPerSupplier, valuePerKg, order: index });
                }
            }
        }
    }

    updatedSuppliers.forEach(p => {
        p.initialValue = p.contractItems.reduce((sum, item) => sum + (item.totalKg * item.valuePerKg), 0);
    });

    onUpdateSuppliers(updatedSuppliers);
    setContractSuccess('Contratos salvos com sucesso!');
    setTimeout(() => setContractSuccess(''), 3000);
  };
  
  const handleItemUIChange = (index: number, field: keyof ItemCentricInput, value: any) => {
    const newItems = [...itemCentricContracts];
    let itemToUpdate = { ...newItems[index], [field]: value };
  
    if (field === 'ui_unit') {
      itemToUpdate.ui_kgConversion = value === 'kg' ? '1' : '';
      itemToUpdate.ui_packageSize = '';
      if (value === 'balde') itemToUpdate.ui_kgConversion = '18';
      if (value === 'saco') itemToUpdate.ui_kgConversion = '50';
    }
  
    if (field === 'ui_packageSize') {
      itemToUpdate.ui_kgConversion = value;
    }
  
    const unit = itemToUpdate.ui_unit;
    const quantity = parseFloat(String(itemToUpdate.ui_quantity).replace(',', '.')) || 0;
    const valuePerUnit = parseFloat(String(itemToUpdate.ui_valuePerUnit).replace(',', '.')) || 0;
    const kgConversion = parseFloat(String(itemToUpdate.ui_kgConversion).replace(',', '.')) || 0;
  
    if (unit === 'kg') {
      itemToUpdate.totalKg = String(quantity);
      itemToUpdate.valuePerKg = String(valuePerUnit);
      itemToUpdate.ui_kgConversion = '1';
    } else {
      if (quantity > 0 && kgConversion > 0) {
        itemToUpdate.totalKg = (quantity * kgConversion).toFixed(3);
        itemToUpdate.valuePerKg = (valuePerUnit / kgConversion).toFixed(3);
      } else {
        itemToUpdate.totalKg = '0';
        itemToUpdate.valuePerKg = '0';
      }
    }
  
    newItems[index] = itemToUpdate;
    setItemCentricContracts(newItems);
  };
  

  const handleSupplierSelectionChange = (itemIndex: number, slotIndex: number, supplierCpf: string) => {
    const newItems = [...itemCentricContracts];
    const newSuppliers = [...newItems[itemIndex].suppliers];
    newSuppliers[slotIndex] = { supplierCpf };
    newItems[itemIndex] = { ...newItems[itemIndex], suppliers: newSuppliers };
    setItemCentricContracts(newItems);
  };
  
  const handleAddItem = () => {
    if (itemCentricContracts.length < 100) {
        setItemCentricContracts([...itemCentricContracts, initialItemCentricInput()]);
        setExpandedItemIndex(itemCentricContracts.length);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (window.confirm('Excluir definitivamente este item de contrato?')) {
        const newItems = itemCentricContracts.filter((_, i) => i !== index);
        setItemCentricContracts(newItems);
    }
  };

  const handleResetClick = () => { onResetData(); };
  
  const handleBackupData = () => {
      const jsonData = JSON.stringify(suppliers, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup-fornecedores-ppais-2026-${date}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleRestoreClick = () => {
    if (!restoreFile) { setRestoreMessage({ type: 'error', text: 'Nenhum arquivo selecionado.' }); return; }
    if (!window.confirm('ATENÇÃO: A restauração irá APAGAR TODOS os dados da nuvem e substituí-los pelo conteúdo do arquivo de backup. Esta ação é irreversível e afetará todos os usuários. Deseja continuar?')) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backupSuppliers: Supplier[] = JSON.parse(content);
        if (!Array.isArray(backupSuppliers) || (backupSuppliers.length > 0 && !backupSuppliers[0].cpf)) throw new Error('Arquivo de backup inválido ou corrompido.');
        const success = await onRestoreData(backupSuppliers);
        if (success) {
          setRestoreMessage({ type: 'success', text: 'Dados restaurados com sucesso na nuvem!' }); setRestoreFile(null);
        } else {
           throw new Error('Falha na operação de restauração.');
        }
      } catch (error: any) { setRestoreMessage({ type: 'error', text: `Erro: ${error.message}` }); }
    };
    reader.onerror = () => { setRestoreMessage({ type: 'error', text: 'Erro ao ler o arquivo.' }); };
    reader.readAsText(restoreFile);
  };

  const TabButton: React.FC<{tab: AdminTab, label: string}> = ({ tab, label }) => (
      <button onClick={() => onTabChange(tab)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-blue-100' }`}>{label}</button>
  );

  return (
    <div className="min-h-screen text-gray-800">
       <header className="bg-white/90 backdrop-blur-md shadow-sm p-4 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-blue-900">Painel do Administrador</h1>
          <p className="text-xs text-gray-400 font-medium">Controle de Safra 2026</p>
        </div>
        <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-sm text-sm">Sair</button>
      </header>
      
      <main className="p-4 md:p-8">
        <div className="mb-8 flex justify-center border-b"><div className="flex flex-wrap justify-center space-x-2 p-1 bg-gray-100/50 rounded-xl">
                <TabButton tab="info" label="Backup e Segurança"/>
                <TabButton tab="register" label="Cadastro de Fornecedores"/>
                <TabButton tab="contracts" label="Cadastro de Itens"/>
                <TabButton tab="analytics" label="Gestão dos Fornecedores"/>
                <TabButton tab="graphs" label="Gestão dos Itens"/>
                <TabButton tab="schedule" label="Agenda de Entregas"/>
                <TabButton tab="invoices" label="Notas Fiscais"/>
                <TabButton tab="perCapita" label="Cálculo Per Capta"/>
        </div></div>

        {activeTab === 'info' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-blue-500">
                    <h2 className="text-2xl font-black mb-2 text-gray-700 uppercase tracking-tight">Como os Dados Funcionam?</h2>
                    <p className="text-gray-500 mb-6">Todos os dados agora são salvos em um <strong>banco de dados central na nuvem</strong>. A sincronização entre todos os computadores é <strong>automática e em tempo real</strong>.</p>
                    <p className="text-sm text-gray-500 mb-6">As ferramentas abaixo são para <strong>segurança e recuperação de desastres</strong>, não para o uso diário.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 p-4 rounded-xl border-l-4 border-blue-400">
                            <h3 className="font-bold text-gray-800 mb-2">1. Backup (Cópia de Segurança)</h3>
                            <p className="text-sm text-gray-600">Use o botão <strong>"Fazer Backup"</strong> para baixar uma cópia de todos os dados da nuvem para o seu computador. Guarde este arquivo em um local seguro.</p>
                        </div>
                         <div className="bg-gray-50 p-4 rounded-xl border-l-4 border-green-400">
                            <h3 className="font-bold text-gray-800 mb-2">2. Restaurar (Recuperação)</h3>
                            <p className="text-sm text-gray-600">Em caso de emergência (ex: dados corrompidos), use o botão <strong>"Restaurar Dados"</strong> para substituir os dados da nuvem por um arquivo de backup que você salvou anteriormente.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-red-50 p-6 rounded-2xl shadow-md border-2 border-dashed border-red-300">
                    <h3 className="text-lg font-bold mb-4 text-center text-red-800 uppercase tracking-tighter">Ferramentas de Gerenciamento</h3>
                    <div className="space-y-4">
                        <button onClick={handleBackupData} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm uppercase">Fazer Backup (Salvar cópia local)</button>
                        <div className="pt-2 border-t-2 border-red-200">
                           <div className="flex items-center space-x-2">
                                <label htmlFor="restore-input" className="w-full cursor-pointer text-center py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl transition-colors text-sm uppercase">Selecionar Arquivo de Backup</label>
                                <input id="restore-input" type="file" accept=".json" onChange={e => setRestoreFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                           </div>
                            {restoreFile && (
                                <div className="text-center mt-2 space-y-2">
                                    <p className="text-xs text-gray-600 truncate">Arquivo: <span className="font-mono">{restoreFile.name}</span></p>
                                    <button onClick={handleRestoreClick} className="w-full py-2 bg-red-600 text-white rounded-md text-xs font-bold uppercase">Restaurar Dados na Nuvem</button>
                                </div>
                            )}
                            {restoreMessage.text && <p className={`text-xs text-center mt-2 font-bold ${restoreMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{restoreMessage.text}</p>}
                        </div>
                        <button onClick={handleResetClick} className="w-full py-3 bg-red-800 hover:bg-red-900 text-white font-bold rounded-xl transition-colors text-sm uppercase mt-4">Resetar Tudo (Apaga dados da nuvem)</button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-green-500">
                    <h2 className="text-2xl font-black mb-6 text-gray-700 uppercase tracking-tight">Novo Fornecedor</h2>
                    <form className="space-y-6" onSubmit={handleRegisterSubmit}>
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Dados de Acesso</label>
                            <input value={regName} onChange={(e) => setRegName(e.target.value.toUpperCase())} required placeholder="NOME DO FORNECEDOR" className="input-field font-bold"/>
                            <input value={regCpf} onChange={(e) => setRegCpf(e.target.value.replace(/[^\d]/g, ''))} maxLength={14} required placeholder="CPF/CNPJ (SENHA)" className="input-field font-mono"/>
                        </div>
                        <div className="space-y-4 pt-2">
                            <h3 className="text-sm font-black text-gray-600 border-b pb-2 uppercase tracking-widest">Semanas Disponíveis</h3>
                            <WeekSelector selectedWeeks={selectedWeeks} onWeekToggle={(week) => setSelectedWeeks(p => p.includes(week) ? p.filter(w=>w!==week) : [...p,week])} />
                        </div>
                        {registrationStatus && (
                            <p className={`text-sm text-center p-2 rounded-lg font-bold ${registrationStatus.success ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                                {registrationStatus.message}
                            </p>
                        )}
                        <button type="submit" disabled={isRegistering} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 uppercase disabled:bg-gray-400 disabled:cursor-wait">
                           {isRegistering ? 'Cadastrando...' : 'Finalizar Cadastro'}
                        </button>
                    </form>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-blue-600 overflow-hidden">
                <h2 className="text-2xl font-black mb-2 text-gray-700 uppercase tracking-tight">Fornecedores Cadastrados ({suppliers.length})</h2>
                {updateStatus && ( <p className={`text-xs text-center p-2 my-2 rounded-lg font-bold ${updateStatus.success ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>{updateStatus.message}</p> )}
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {suppliers.length > 0 ? suppliers.map(p => (
                    <div key={p.cpf} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center text-sm border border-gray-100 hover:bg-white transition-colors group">
                        <div>
                            <p className="font-black text-gray-800 group-hover:text-blue-600 transition-colors">{p.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">CPF/CNPJ: ...{p.cpf.slice(-4)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-[10px] text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">{p.contractItems.length} itens</span>
                            <button onClick={() => setEditingSupplier(p)} className="text-gray-400 hover:text-blue-600 p-2 rounded-full transition-colors" aria-label={`Editar ${p.name}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                            </button>
                        </div>
                    </div>
                    )) : <div className="text-center py-20"><p className="text-gray-300 italic">Nenhum registro.</p></div>}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-5xl mx-auto border-t-8 border-blue-600 animate-fade-in">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Cadastro de Itens Contratados</h2>
                  <p className="text-gray-400 font-medium">Os itens abaixo permanecem na ordem exata de adição.</p>
                </div>
                
                <form className="space-y-10" onSubmit={handleSaveContracts}>
                    <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar p-2">
                        {itemCentricContracts.map((item, index) => {
                            const activeSuppliers = item.suppliers.filter(p => p.supplierCpf !== '');
                            const assignedCount = activeSuppliers.length;
                            const isExpanded = expandedItemIndex === index;
                            
                            const totalKgNum = parseFloat(item.totalKg) || 0;
                            const valKgNum = parseFloat(item.valuePerKg) || 0;
                            const totalItemValue = totalKgNum * valKgNum;
                            const kgPerProd = assignedCount > 0 ? totalKgNum / assignedCount : 0;
                            const valPerProd = assignedCount > 0 ? totalItemValue / assignedCount : 0;
                            const unitLabels = { kg: 'Kg', dz: 'Dúzia', un: 'Unidade', pacote: 'Pacote', balde: 'Balde', saco: 'Saco' };
                            const packageOptions = [
                                { label: '500g', value: '0.5' },
                                { label: '400g', value: '0.4' },
                                { label: '200g', value: '0.2' },
                                { label: '150g', value: '0.15' },
                            ];
                            
                            return (
                            <div key={item.id} className="p-6 border-2 rounded-2xl relative bg-white shadow-lg border-l-[12px] border-l-blue-600 transition-all hover:scale-[1.01]">
                                <div className="flex justify-between items-center mb-6 pb-3 border-b-2 border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <span className="bg-blue-600 text-white w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg shadow-blue-200 shadow-lg">{index + 1}</span>
                                        <h3 className="font-black text-2xl text-blue-950 uppercase tracking-tighter">{item.name || 'ITEM PENDENTE'}</h3>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-300 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Produto</label>
                                      <input value={item.name} onChange={(e) => handleItemUIChange(index, 'name', e.target.value.toUpperCase())} placeholder="EX: ARROZ AGULHINHA" className="input-field font-black text-blue-900 uppercase"/>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unidade</label>
                                        <select value={item.ui_unit} onChange={(e) => handleItemUIChange(index, 'ui_unit', e.target.value as ItemCentricInput['ui_unit'])} className="input-field font-bold">
                                            <option value="kg">Quilograma (Kg)</option>
                                            <option value="pacote">Pacote</option>
                                            <option value="balde">Balde</option>
                                            <option value="saco">Saco</option>
                                            <option value="dz">Dúzia</option>
                                            <option value="un">Unidade</option>
                                        </select>
                                    </div>
                                    {(item.ui_unit === 'pacote' || item.ui_unit === 'balde' || item.ui_unit === 'saco') && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                                {item.ui_unit === 'pacote' && 'Tamanho do Pacote'}
                                                {item.ui_unit === 'balde' && 'Tamanho do Balde'}
                                                {item.ui_unit === 'saco' && 'Tamanho do Saco'}
                                            </label>
                                            <select value={item.ui_packageSize} onChange={(e) => handleItemUIChange(index, 'ui_packageSize', e.target.value)} className="input-field font-bold">
                                                <option value="">-- Selecione --</option>
                                                {item.ui_unit === 'pacote' && packageOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                {item.ui_unit === 'balde' && <option value="18">18kg</option>}
                                                {item.ui_unit === 'saco' && <option value="50">50kg</option>}
                                            </select>
                                        </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Quantidade ({unitLabels[item.ui_unit]})</label>
                                          <input type="text" value={item.ui_quantity} onChange={(e) => handleItemUIChange(index, 'ui_quantity', e.target.value)} placeholder="0,00" className="input-field font-mono text-lg"/>
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço por {unitLabels[item.ui_unit]}</label>
                                          <input type="text" value={item.ui_valuePerUnit} onChange={(e) => handleItemUIChange(index, 'ui_valuePerUnit', e.target.value)} placeholder="0,00" className="input-field font-mono text-lg text-green-700"/>
                                      </div>
                                  </div>

                                  {(item.ui_unit === 'dz' || item.ui_unit === 'un') && (
                                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                          <label className="block text-[10px] font-black text-yellow-800 uppercase tracking-widest ml-1">Fator de Conversão</label>
                                          <p className="text-xs text-yellow-700 mb-1">Informe o peso de uma {unitLabels[item.ui_unit]} em Kg.</p>
                                          <input type="text" value={item.ui_kgConversion} onChange={(e) => handleItemUIChange(index, 'ui_kgConversion', e.target.value)} placeholder={`Ex: 0.6 para uma dúzia de ovos`} className="input-field text-sm font-mono"/>
                                      </div>
                                  )}

                                  <div className="mt-2 bg-gray-50 p-3 rounded-lg border text-xs">
                                      <p className="font-bold text-gray-600">Valores Calculados para Contrato:</p>
                                      <p>Peso Total: <span className="font-mono font-bold text-blue-700">{(parseFloat(item.totalKg) || 0).toFixed(2).replace('.',',')} Kg</span></p>
                                      <p>Preço por Kg: <span className="font-mono font-bold text-blue-700">{formatCurrency(parseFloat(item.valuePerKg) || 0)}</span></p>
                                  </div>
                                </div>


                                <div className="mt-8 bg-blue-50/50 border-2 border-blue-100 rounded-2xl overflow-hidden shadow-inner">
                                    <div className="bg-blue-100/50 px-4 py-2 border-b-2 border-blue-100 flex justify-between items-center">
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Resumo de Cálculos do Contrato</span>
                                        <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full shadow-sm">{assignedCount} FORNECEDORES</span>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="text-center md:border-r-2 border-blue-100/50">
                                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter mb-1">Valor Total</p>
                                            <p className="text-lg font-black text-gray-900">{formatCurrency(totalItemValue)}</p>
                                        </div>
                                        <div className="text-center md:border-r-2 border-blue-100/50">
                                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter mb-1">Peso Total</p>
                                            <p className="text-lg font-black text-gray-900">{totalKgNum.toLocaleString('pt-BR')} <span className="text-xs">Kg</span></p>
                                        </div>
                                        <div className="text-center md:border-r-2 border-blue-100/50">
                                            <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mb-1">Cota Valor / Forn</p>
                                            <p className="text-lg font-black text-blue-700">{formatCurrency(valPerProd)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mb-1">Cota Peso / Forn</p>
                                            <p className="text-lg font-black text-blue-700">{kgPerProd.toLocaleString('pt-BR')} <span className="text-xs">Kg</span></p>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="button" onClick={() => setExpandedItemIndex(isExpanded ? null : index)} className={`w-full text-xs font-black p-4 mt-6 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${isExpanded ? 'bg-blue-600 text-white shadow-xl translate-y-[-2px]' : 'bg-white text-blue-600 border-2 border-blue-200 hover:bg-blue-50'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                    {isExpanded ? 'Fechar Lista de Vinculados' : `Configurar Fornecedores (${assignedCount})`}
                                </button>

                                {isExpanded && (
                                    <div className="mt-4 pt-6 border-t-2 border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-down">
                                        {item.suppliers.map((slot, slotIndex) => (
                                            <div key={slotIndex} className="flex space-x-2 items-center group">
                                                <span className="text-[10px] font-black text-gray-300 w-5 group-hover:text-blue-500 transition-colors">{slotIndex + 1}</span>
                                                <select value={slot.supplierCpf} onChange={e => handleSupplierSelectionChange(index, slotIndex, e.target.value)} className="input-field py-2 text-xs font-bold border-gray-100 bg-gray-50/50 hover:border-blue-300 transition-all cursor-pointer">
                                                    <option value="">-- SELECIONAR --</option>
                                                    {suppliers.map(p => <option key={p.cpf} value={p.cpf}>{p.name}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>
                    
                    {itemCentricContracts.length < 100 && (
                        <button type="button" onClick={handleAddItem} className="w-full text-lg font-black text-blue-600 hover:bg-blue-50 py-5 rounded-2xl border-4 border-dashed border-blue-200 flex items-center justify-center space-x-3 transition-all hover:border-blue-400 group shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            <span className="uppercase tracking-widest">Adicionar Próximo Item</span>
                        </button>
                    )}
                    
                    <div className="space-y-4">
                        {contractError && ( <div className="bg-red-50 border-l-8 border-red-500 p-4 rounded-xl text-red-700 flex items-center gap-4 animate-shake"> <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg> <span className="font-black uppercase text-sm">{contractError}</span> </div> )}
                        {contractSuccess && ( <div className="bg-green-50 border-l-8 border-green-500 p-4 rounded-xl text-green-700 flex items-center gap-4 animate-fade-in"> <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> <span className="font-black uppercase text-sm">{contractSuccess}</span> </div> )}
                        <div className="flex justify-center pt-6">
                            <button type="submit" className="w-full max-w-2xl py-5 text-white bg-blue-700 hover:bg-blue-800 font-black text-xl rounded-2xl shadow-2xl transition-all transform hover:scale-105 active:scale-95 uppercase tracking-widest flex items-center justify-center gap-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                Salvar Tudo e Preservar Ordem
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        )}

        {activeTab === 'analytics' && <AdminAnalytics suppliers={suppliers} />}
        {activeTab === 'graphs' && <AdminGraphs suppliers={suppliers} />}
        {activeTab === 'schedule' && <AdminScheduleView suppliers={suppliers} />}
        {activeTab === 'invoices' && <AdminInvoices suppliers={suppliers} onReopenInvoice={onReopenInvoice} />}
        {activeTab === 'perCapita' && <AdminPerCapita suppliers={suppliers} />}
        {editingSupplier && ( <EditSupplierModal supplier={editingSupplier} suppliers={suppliers} onClose={() => setEditingSupplier(null)} onSave={handleSaveSupplierUpdate} /> )}
      </main>
      <style>{`
        .input-field { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 1rem; border: 2px solid #F3F4F6; border-radius: 1rem; background-color: #fff; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); } 
        .input-field:focus { border-color: #3B82F6; background-color: #fff; box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.15); }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: #F9FAFB; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; border: 2px solid #F9FAFB; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3B82F6; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .animate-slide-down { animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-shake { animation: shake 0.2s ease-in-out 3; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
