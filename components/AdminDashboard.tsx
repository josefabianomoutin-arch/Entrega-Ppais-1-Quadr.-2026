import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Supplier, ContractItem } from '../types';
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
  onLiveUpdate: (updatedSuppliers: Supplier[]) => void;
  onPersistSuppliers: (suppliersToPersist: Supplier[]) => void;
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
  ui_compositeUnit: string;
  ui_unit: 'kg' | 'dz' | 'un' | 'pacote' | 'pote' | 'balde' | 'saco' | 'embalagem' | 'litro' | 'caixa';
  ui_quantity: string;
  ui_valuePerUnit: string;
  ui_kgConversion: string;
  // Campos de dados reais (calculados)
  totalKg: string; // Para 'un', é o peso total. Para outros, é a quantidade de unidades (dúzias, baldes, sacos, etc).
  valuePerKg: string; // Para 'un', é o valor/kg. Para outros, é o valor por unidade.
}


const initialSupplierSlot = (): SupplierSlot => ({ supplierCpf: '' });

const initialItemCentricInput = (): ItemCentricInput => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: '',
  suppliers: Array(15).fill(null).map(initialSupplierSlot),
  ui_compositeUnit: 'kg-1',
  ui_unit: 'kg',
  ui_quantity: '',
  ui_valuePerUnit: '',
  ui_kgConversion: '1',
  totalKg: '',
  valuePerKg: '',
});

const unitOptions = [
    { value: 'saco-50', label: 'Saco (50 Kg)' },
    { value: 'saco-25', label: 'Saco (25 Kg)' },
    { value: 'balde-18', label: 'Balde (18 Kg)' },
    { value: 'embalagem-10', label: 'Embalagem (10 Kg)' },
    { value: 'embalagem-5', label: 'Embalagem (5 Kg)' },
    { value: 'embalagem-3', label: 'Embalagem (3 Kg)' },
    { value: 'embalagem-2', label: 'Embalagem (2 Kg)' },
    { value: 'kg-1', label: 'Quilograma (Kg)' },
    { value: 'litro-1', label: 'Litros (Lts)' },
    { value: 'embalagem-1', label: 'Embalagem Plástica (1 Litro)' },
    { value: 'caixa-1', label: 'Caixa (1 Litro)' },
    { value: 'embalagem-0.9', label: 'Embalagem (900ml)' },
    { value: 'embalagem-0.7', label: 'Embalagem (700ml)' },
    { value: 'pacote-0.5', label: 'Pacote (500g)' },
    { value: 'pacote-0.4', label: 'Pacote (400g)' },
    { value: 'pacote-0.3', label: 'Pacote (300g)' },
    { value: 'pote-0.2', label: 'Pote (200g)' },
    { value: 'pacote-0.15', label: 'Pacote (150g)' },
    { value: 'pacote-0.03', label: 'Pacote (30g)' },
    { value: 'dz-auto', label: 'Dúzia' },
    { value: 'un-auto', label: 'Unidade' },
];


const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
    onRegister, 
    onLiveUpdate,
    onPersistSuppliers,
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
  const isInternalUpdate = useRef(false); // Ref para controlar o loop de renderização

  // Estados para ZONA CRÍTICA (Backup/Restore)
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMessage, setRestoreMessage] = useState({ type: '', text: '' });

  // Memoiza uma lista estável de CPFs e nomes para evitar loops de re-renderização
  const supplierIdentities = useMemo(() => suppliers.map(s => ({ cpf: s.cpf, name: s.name, allowedWeeks: s.allowedWeeks || [], deliveries: s.deliveries || [] })), [suppliers]);

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

    // Se a atualização dos 'suppliers' foi causada por uma edição interna,
    // não reinicializa o formulário para evitar a perda de foco e o "pisca-pisca".
    if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
    }

    const itemsMap = new Map<string, { totalQty: number; valuePerUnit: number; supplierCpfs: string[]; order: number, unit: string }>();

    suppliers.forEach(supplier => {
        (supplier.contractItems || []).forEach(item => {
            const order = item.order ?? Infinity;
            if (!itemsMap.has(item.name)) {
                itemsMap.set(item.name, { totalQty: 0, valuePerUnit: item.valuePerKg, supplierCpfs: [], order: order, unit: item.unit || 'kg-1' });
            }
            const existing = itemsMap.get(item.name)!;
            existing.totalQty += item.totalKg;
            existing.supplierCpfs.push(supplier.cpf);
        });
    });
    
    // Se não há contratos, inicia com um item em branco
    if (itemsMap.size === 0) {
        setItemCentricContracts([initialItemCentricInput()]);
        setExpandedItemIndex(0);
        return;
    }

    const sortedItems = [...itemsMap.entries()].sort((a, b) => a[1].order - b[1].order);

    const newItemCentricContracts = sortedItems.map(([name, data]) => {
        const item: ItemCentricInput = {
            id: `item-${name}-${Math.random()}`,
            name,
            suppliers: Array(15).fill(null).map((_, i) => ({
                supplierCpf: data.supplierCpfs[i] || ''
            })),
            ui_compositeUnit: data.unit,
            ui_unit: data.unit.split('-')[0] as ItemCentricInput['ui_unit'],
            ui_quantity: String(data.totalQty),
            ui_valuePerUnit: String(data.valuePerUnit),
            ui_kgConversion: '', // Será preenchido se for 'un-auto'
            totalKg: String(data.totalQty),
            valuePerKg: String(data.valuePerUnit),
        };
        
        // Recalcula o estado da UI para 'un-auto' para exibir os valores corretamente
        if(data.unit === 'un-auto') {
            const totalKg = data.totalQty;
            const valuePerKg = data.valuePerUnit;
            item.ui_quantity = '';
            item.ui_valuePerUnit = '';
            item.totalKg = String(totalKg);
            item.valuePerKg = String(valuePerKg);
        }

        return item;
    });

    setItemCentricContracts(newItemCentricContracts);
    setExpandedItemIndex(0);

}, [suppliers, activeTab]);

// Efeito para atualizar o estado global em tempo real enquanto o admin edita os contratos
useEffect(() => {
    if (activeTab !== 'contracts') return;
  
    const newSuppliersState: Supplier[] = supplierIdentities.map(identity => ({
      ...identity,
      contractItems: [],
      initialValue: 0,
    }));
  
    try {
      itemCentricContracts.forEach((item, itemIndex) => {
        const totalNum = parseFloat(item.totalKg);
        const valueNum = parseFloat(item.valuePerKg);
  
        if (!item.name.trim() || isNaN(totalNum) || isNaN(valueNum) || totalNum <= 0) {
          return; // Ignora itens incompletos ou inválidos sem gerar erro
        }
  
        const participatingSuppliers = item.suppliers.filter(s => s.supplierCpf);
        if (participatingSuppliers.length === 0) {
          return; // Ignora itens sem fornecedor
        }
  
        const numPerSupplier = totalNum / participatingSuppliers.length;
  
        participatingSuppliers.forEach(slot => {
          const supplier = newSuppliersState.find(p => p.cpf === slot.supplierCpf);
          if (supplier) {
            supplier.contractItems.push({
              name: item.name.trim(),
              totalKg: numPerSupplier,
              valuePerKg: valueNum,
              unit: item.ui_compositeUnit,
              order: itemIndex,
            });
          }
        });
      });
  
      newSuppliersState.forEach(p => {
        p.initialValue = p.contractItems.reduce((sum, item) => {
          const [unitType] = (item.unit || 'kg-1').split('-');
          if (unitType === 'un') {
            return sum + (item.totalKg * item.valuePerKg);
          }
          return sum + (item.totalKg * item.valuePerKg);
        }, 0);
      });
  
      // Marca a próxima atualização como interna para quebrar o ciclo de renderização
      isInternalUpdate.current = true;
      onLiveUpdate(newSuppliersState);
      setContractError(''); // Limpa erros se a lógica passar
    } catch (e: any) {
      console.error("Erro ao processar atualização de contrato em tempo real:", e);
      setContractError('Erro ao calcular totais. Verifique os dados dos itens.');
    }
  }, [itemCentricContracts, supplierIdentities, onLiveUpdate, activeTab]);


  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    await onRegister(regName, regCpf, selectedWeeks);
    setIsRegistering(false);
  };
  
  const handleEditSupplierSave = async (oldCpf: string, newName: string, newCpf: string, newAllowedWeeks: number[]) => {
      const error = await onUpdateSupplier(oldCpf, newName, newCpf, newAllowedWeeks);
      if (error) {
          return error; // Retorna a mensagem de erro para o modal
      } else {
          setEditingSupplier(null); // Fecha o modal em caso de sucesso
          setUpdateStatus({ success: true, message: `Dados de "${newName}" atualizados com sucesso!` });
          return null;
      }
  };

  const handleItemCentricChange = (id: string, field: keyof ItemCentricInput, value: any) => {
      setItemCentricContracts(prev =>
          prev.map(item => {
              if (item.id !== id) return item;

              const updatedItem = { ...item, [field]: value };
              
              if (field === 'ui_compositeUnit' && value.endsWith('-auto')) {
                  updatedItem.ui_kgConversion = ''; 
              }

              if (field.startsWith('ui_')) {
                  const [unit, kgConversionFactorStr] = updatedItem.ui_compositeUnit.split('-');
                  const quantity = parseFloat(updatedItem.ui_quantity.replace(',', '.')) || 0;
                  const valuePerUnit = parseFloat(updatedItem.ui_valuePerUnit.replace(',', '.')) || 0;

                  if (unit === 'un') { 
                      const kgPerUnit = parseFloat(updatedItem.ui_kgConversion.replace(',', '.')) || 0;
                      updatedItem.totalKg = (quantity * kgPerUnit).toFixed(3);
                      updatedItem.valuePerKg = kgPerUnit > 0 ? (valuePerUnit / kgPerUnit).toFixed(3) : '0';
                  } else {
                      updatedItem.totalKg = String(quantity);
                      updatedItem.valuePerKg = String(valuePerUnit);
                  }
              }

              return updatedItem;
          })
      );
  };

  const handleAddItem = () => {
    setItemCentricContracts(prev => [...prev, initialItemCentricInput()]);
    setExpandedItemIndex(itemCentricContracts.length);
  };

  const handleRemoveItem = (id: string) => {
    if (itemCentricContracts.length > 1) {
        setItemCentricContracts(prev => prev.filter(item => item.id !== id));
    } else {
        alert("Não é possível remover o último item.");
    }
  };

  const handleSaveContracts = () => {
    // A lógica de cálculo já foi feita pelo useEffect. Aqui, apenas validamos e persistimos.
    setContractError('');
    setContractSuccess('');

    // Validação final antes de salvar
    const hasInvalidItems = itemCentricContracts.some(item => {
        if (!item.name.trim()) return true;
        const totalNum = parseFloat(item.totalKg);
        const valueNum = parseFloat(item.valuePerKg);
        if (isNaN(totalNum) || isNaN(valueNum) || totalNum <= 0) return true;
        const participatingSuppliers = item.suppliers.filter(s => s.supplierCpf);
        if (participatingSuppliers.length === 0) return true;
        return false;
    });

    if (hasInvalidItems && itemCentricContracts.length > 1) { // Permite salvar se for apenas um item em branco
         setContractError('Existem itens incompletos ou com valores inválidos que não serão salvos.');
    }

    onPersistSuppliers(suppliers);
    setContractSuccess('Contratos salvos na nuvem com sucesso!');
    setTimeout(() => setContractSuccess(''), 4000);
  };

  const handleBackup = () => {
      const dataStr = JSON.stringify(suppliers, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `backup_fornecedores_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
  };

  const handleRestore = () => {
      if (!restoreFile) {
        setRestoreMessage({ type: 'error', text: 'Por favor, selecione um arquivo de backup.' });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);
          if (Array.isArray(backupData) && backupData.every(s => s.name && s.cpf)) {
            if (window.confirm(`Você tem certeza que deseja restaurar os dados com o arquivo "${restoreFile.name}"? TODOS os dados atuais serão substituídos.`)) {
                const success = await onRestoreData(backupData);
                if (success) {
                    setRestoreMessage({ type: 'success', text: 'Dados restaurados com sucesso!' });
                } else {
                    setRestoreMessage({ type: 'error', text: 'Falha ao restaurar. Verifique o console.' });
                }
            }
          } else {
            throw new Error('Formato de arquivo inválido.');
          }
        } catch (error) {
          setRestoreMessage({ type: 'error', text: 'Erro ao ler o arquivo. Certifique-se de que é um backup válido.' });
        } finally {
            setRestoreFile(null);
            const fileInput = document.getElementById('restore-file-input') as HTMLInputElement;
            if(fileInput) fileInput.value = '';
        }
      };
      reader.readAsText(restoreFile);
  };
  
  const totalContractedValue = suppliers.reduce((sum, p) => sum + p.initialValue, 0);

  const tabs: { id: AdminTab; name: string; icon: React.ReactElement }[] = [
    { id: 'register', name: 'Gestão de Fornecedores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" /></svg> },
    { id: 'contracts', name: 'Gestão por Item', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg> },
    { id: 'schedule', name: 'Agenda', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> },
    { id: 'invoices', name: 'Notas Fiscais', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg> },
    { id: 'analytics', name: 'Relatório Analítico', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg> },
    { id: 'graphs', name: 'Gráficos', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a1 1 0 001 1h8a1 1 0 100-2H5V5a1 1 0 00-2 0V3zm12 1a1 1 0 011 1v10h1.5a.5.5 0 010 1H14a1 1 0 01-1-1V5a1 1 0 011-1zm-4 3a1 1 0 011 1v6h1.5a.5.5 0 010 1H10a1 1 0 01-1-1V8a1 1 0 011-1z" clipRule="evenodd" /></svg> },
    { id: 'perCapita', name: 'Cálculo Per Capta', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg> },
    { id: 'info', name: 'Zona Crítica', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> },
  ];
  
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
                <p className="font-bold text-green-700 text-lg">{formatCurrency(totalContractedValue)}</p>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Sair
            </button>
        </div>
      </header>
      
      <div className="flex flex-col md:flex-row">
        <aside className="w-full md:w-64 bg-white md:min-h-[calc(100vh-73px)] border-r">
            <nav className="p-4">
                <ul className="space-y-1">
                    {tabs.map(tab => (
                        <li key={tab.id}>
                            <button
                                onClick={() => onTabChange(tab.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${
                                    activeTab === tab.id ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'
                                } ${tab.id === 'info' ? '!text-red-600 hover:!bg-red-50' + (activeTab === 'info' ? ' !bg-red-100' : '') : ''}`}
                            >
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
            <div className="space-y-10">
                <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
                    <h2 className="text-2xl font-bold mb-6 text-gray-700">Cadastrar Novo Fornecedor</h2>
                     {registrationStatus && (
                        <div className={`p-4 mb-4 rounded-md text-sm ${registrationStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {registrationStatus.message}
                        </div>
                    )}
                    <form onSubmit={handleRegisterSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Nome do Fornecedor</label>
                                <input type="text" value={regName} onChange={(e) => setRegName(e.target.value.toUpperCase())} required placeholder="NOME EM MAIÚSCULO" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"/>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">CPF/CNPJ (será a senha)</label>
                                <input type="text" value={regCpf} onChange={(e) => setRegCpf(e.target.value.replace(/[^\d]/g, ''))} maxLength={14} required placeholder="APENAS NÚMEROS" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 font-mono"/>
                            </div>
                        </div>
                         <div className="space-y-2 pt-4 border-t">
                            <label className="block text-sm font-medium text-gray-700">Restringir Semanas para Agendamento</label>
                            <WeekSelector 
                                selectedWeeks={selectedWeeks} 
                                onWeekToggle={(week) => setSelectedWeeks(p => p.includes(week) ? p.filter(w => w !== week) : [...p, week])}
                            />
                             <p className="text-xs text-gray-500 mt-1">Selecione as semanas em que este fornecedor poderá agendar entregas. Se nenhuma for selecionada, todas as semanas serão permitidas.</p>
                        </div>
                        <div className="text-right">
                            <button type="submit" disabled={isRegistering} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400">
                                {isRegistering ? 'Cadastrando...' : 'Cadastrar'}
                            </button>
                        </div>
                    </form>
                </div>

                 <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-1 text-gray-700">Fornecedores Cadastrados</h2>
                    <p className="text-sm text-gray-400 mb-4">Total: {suppliers.length}</p>
                     {updateStatus && (
                        <div className={`p-4 mb-4 rounded-md text-sm ${updateStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {updateStatus.message}
                        </div>
                    )}
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {suppliers.length > 0 ? [...suppliers].sort((a,b)=> a.name.localeCompare(b.name)).map(p => (
                            <div key={p.cpf} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
                                <div>
                                    <p className="font-semibold text-gray-800">{p.name}</p>
                                    <p className="text-sm text-gray-500 font-mono">{p.cpf}</p>
                                </div>
                                 <button onClick={() => setEditingSupplier(p)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-3 py-1 rounded-full transition-colors">
                                    Editar
                                 </button>
                            </div>
                        )) : (
                            <p className="text-center text-gray-400 italic py-8">Nenhum fornecedor cadastrado.</p>
                        )}
                    </div>
                 </div>
            </div>
          )}

          {activeTab === 'contracts' && (
              <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-indigo-500">
                  <h2 className="text-3xl font-black text-indigo-900 uppercase tracking-tighter mb-2">Gestão de Contratos (por Item)</h2>
                  <p className="text-gray-400 font-medium mb-6">Defina os itens do contrato e distribua as quantidades entre os fornecedores.</p>

                  {contractError && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm font-semibold">{contractError}</div>}
                  {contractSuccess && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm font-semibold">{contractSuccess}</div>}

                  <div className="space-y-4">
                      {itemCentricContracts.map((item, index) => {
                          const isExpanded = index === expandedItemIndex;
                          const [unit, kgConversionFactorStr] = item.ui_compositeUnit.split('-');
                          const isUnit = unit === 'un';

                          const quantity = parseFloat(item.ui_quantity.replace(',', '.')) || 0;
                          const valuePerUnit = parseFloat(item.ui_valuePerUnit.replace(',', '.')) || 0;
                          const conversionFactor = isUnit ? (parseFloat(item.ui_kgConversion.replace(',', '.')) || 0) : (parseFloat(kgConversionFactorStr) || 1);

                          const totalDisplayWeight = isUnit ? (quantity * conversionFactor) : (quantity * conversionFactor);
                          const totalDisplayUnits = quantity;
                          
                          const unitLabel = unitOptions.find(opt => opt.value === item.ui_compositeUnit)?.label.split(' (')[0] || unit;
                          const displayUnitAbbreviation = isUnit ? 'Kg' : (unit === 'dz' ? 'Dz' : (unit === 'kg' ? 'Kg' : (unit === 'litro' ? 'Lts' : 'Unid.')));

                          return (
                              <div key={item.id} className={`border rounded-xl transition-all ${isExpanded ? 'bg-white ring-2 ring-indigo-400' : 'bg-gray-50'}`}>
                                  <div className="p-4 cursor-pointer flex justify-between items-center" onClick={() => setExpandedItemIndex(isExpanded ? null : index)}>
                                      <div className="flex-grow">
                                        <p className="text-xs text-gray-400">Item #{index + 1}</p>
                                        <p className="font-bold text-gray-800">{item.name || 'Novo Item (não salvo)'}</p>
                                      </div>
                                       <div className="flex items-center gap-4">
                                          <div className="text-right">
                                            <p className="text-xs text-gray-500">{isUnit ? 'Peso Total (Kg)' : 'Qtd. Total'}</p>
                                            <p className="font-mono font-semibold text-indigo-700">
                                              {isUnit ? totalDisplayWeight.toLocaleString('pt-BR') : totalDisplayUnits.toLocaleString('pt-BR')} {displayUnitAbbreviation}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-gray-500">{isUnit ? 'Valor/Kg' : `Valor/${unitLabel}`}</p>
                                            <p className="font-mono font-semibold text-green-700">{formatCurrency(isUnit ? (parseFloat(item.valuePerKg) || 0) : valuePerUnit)}</p>
                                          </div>
                                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="p-6 border-t bg-white space-y-6">
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <input type="text" placeholder="Nome do Item" value={item.name} onChange={(e) => handleItemCentricChange(item.id, 'name', e.target.value.toUpperCase())} className="lg:col-span-2 w-full p-2 border rounded-md" />
                                        <select value={item.ui_compositeUnit} onChange={(e) => handleItemCentricChange(item.id, 'ui_compositeUnit', e.target.value)} className="w-full p-2 border rounded-md bg-gray-50">
                                            {unitOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                        <input type="text" placeholder={`Qtd. de ${unitLabel}`} value={item.ui_quantity} onChange={(e) => handleItemCentricChange(item.id, 'ui_quantity', e.target.value)} className="w-full p-2 border rounded-md font-mono" />
                                        <input type="text" placeholder={`Valor por ${unitLabel}`} value={item.ui_valuePerUnit} onChange={(e) => handleItemCentricChange(item.id, 'ui_valuePerUnit', e.target.value)} className="w-full p-2 border rounded-md font-mono" />
                                        {isUnit && <input type="text" placeholder={`Peso da Unidade (Kg)`} value={item.ui_kgConversion} onChange={(e) => handleItemCentricChange(item.id, 'ui_kgConversion', e.target.value)} className="w-full p-2 border rounded-md font-mono" />}
                                      </div>
                                      
                                      <div>
                                          <h4 className="font-semibold mb-2">Fornecedores ({item.suppliers.filter(s => s.supplierCpf).length} selecionados)</h4>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                              {item.suppliers.map((slot, sIndex) => (
                                                  <select key={sIndex} value={slot.supplierCpf} onChange={(e) => {
                                                      const newSuppliers = [...item.suppliers];
                                                      newSuppliers[sIndex] = { supplierCpf: e.target.value };
                                                      handleItemCentricChange(item.id, 'suppliers', newSuppliers);
                                                  }} className="w-full p-2 border rounded-md bg-gray-50 text-xs">
                                                      <option value="">-- Fornecedor {sIndex + 1} --</option>
                                                      {suppliers.map(p => <option key={p.cpf} value={p.cpf}>{p.name}</option>)}
                                                  </select>
                                              ))}
                                          </div>
                                      </div>
                                      <div className="text-right">
                                         <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Remover Item</button>
                                      </div>
                                    </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>

                  <div className="mt-6 pt-6 border-t flex justify-between items-center">
                      <button onClick={handleAddItem} className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold py-2 px-4 rounded-lg transition-colors text-sm">Adicionar Novo Item</button>
                      <button onClick={handleSaveContracts} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">Salvar Todos os Itens</button>
                  </div>
              </div>
          )}
          
          {activeTab === 'schedule' && <AdminScheduleView suppliers={suppliers} />}
          {activeTab === 'invoices' && <AdminInvoices suppliers={suppliers} onReopenInvoice={onReopenInvoice} />}
          {activeTab === 'analytics' && <AdminAnalytics suppliers={suppliers} />}
          {activeTab === 'graphs' && <AdminGraphs suppliers={suppliers} />}
          {activeTab === 'perCapita' && <AdminPerCapita suppliers={suppliers} />}


          {activeTab === 'info' && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-red-500 space-y-8">
              <h2 className="text-2xl font-bold text-red-700">Zona Crítica</h2>
              
              <div className="p-4 border border-red-200 rounded-lg">
                <h3 className="font-bold text-red-600">Apagar Todos os Dados</h3>
                <p className="text-sm text-gray-600 my-2">Esta ação apagará permanentemente todos os dados de fornecedores, contratos e entregas da nuvem. Use com extrema cautela. Recomenda-se fazer um backup antes.</p>
                <button onClick={onResetData} className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Apagar Tudo</button>
              </div>

              <div className="p-4 border border-yellow-300 rounded-lg space-y-3">
                 <h3 className="font-bold text-yellow-800">Backup e Restauração</h3>
                 <p className="text-sm text-gray-600">Faça o download de um backup de segurança ou restaure os dados a partir de um arquivo.</p>
                 
                 {restoreMessage.text && (
                    <div className={`p-3 rounded-md text-sm font-semibold ${restoreMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {restoreMessage.text}
                    </div>
                  )}

                 <div className="flex items-center gap-4 flex-wrap">
                    <button onClick={handleBackup} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Fazer Backup (JSON)</button>
                    
                    <div className="flex items-center gap-2">
                      <input type="file" id="restore-file-input" accept=".json" onChange={(e) => setRestoreFile(e.target.files ? e.target.files[0] : null)} className="text-sm"/>
                      <button onClick={handleRestore} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm" disabled={!restoreFile}>Restaurar</button>
                    </div>
                 </div>
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
                onSave={handleEditSupplierSave}
            />
        )}

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
        `}</style>
    </div>
  );
};

export default AdminDashboard;