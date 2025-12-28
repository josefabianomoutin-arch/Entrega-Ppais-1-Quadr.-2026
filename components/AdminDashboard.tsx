import React, { useState, useEffect } from 'react';
import type { Producer, ContractItem, Supplier } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, allowedWeeks: number[]) => boolean;
  onUpdateProducers: (updatedProducers: Producer[]) => void;
  onLogout: () => void;
  producers: Producer[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Tipos para o estado da UI de Gestão por Item
interface SupplierInput { name: string; cpf: string; }
interface ProducerSlot { producerId: string; }
interface ItemCentricInput {
  name: string;
  totalKg: string;
  valuePerKg: string;
  producers: ProducerSlot[];
  suppliers: SupplierInput[];
}
const initialSupplierInput = (): SupplierInput => ({ name: '', cpf: '' });
const initialProducerSlot = (): ProducerSlot => ({ producerId: '' });
const initialItemCentricInput = (): ItemCentricInput => ({
  name: '', totalKg: '', valuePerKg: '',
  producers: Array(15).fill(null).map(initialProducerSlot),
  suppliers: Array(15).fill(null).map(initialSupplierInput),
});

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRegister, onUpdateProducers, onLogout, producers }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'contracts' | 'analytics'>('register');
  
  // Estados para aba de REGISTRO
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Estados para aba de GESTÃO POR ITEM
  const [itemCentricContracts, setItemCentricContracts] = useState<ItemCentricInput[]>([initialItemCentricInput()]);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);
  const [expandedSection, setExpandedSection] = useState<'producers' | 'suppliers' | null>('producers');
  const [contractError, setContractError] = useState('');
  const [contractSuccess, setContractSuccess] = useState('');

  useEffect(() => {
    if (activeTab === 'contracts') {
        const itemsMap = new Map<string, { totalKg: number; valuePerKg: number; producerIds: string[]; suppliers: Supplier[] }>();

        // Agrega dados de todos os produtores para criar uma visão centrada no item
        producers.forEach(producer => {
            producer.contractItems.forEach(item => {
                const mapEntry = itemsMap.get(item.name) || { totalKg: 0, valuePerKg: item.valuePerKg, producerIds: [], suppliers: item.suppliers };
                mapEntry.totalKg += item.totalKg;
                if (!mapEntry.producerIds.includes(producer.id)) {
                    mapEntry.producerIds.push(producer.id);
                }
                itemsMap.set(item.name, mapEntry);
            });
        });

        const uiState: ItemCentricInput[] = Array.from(itemsMap.entries()).map(([name, data]) => ({
            name,
            totalKg: String(data.totalKg),
            valuePerKg: String(data.valuePerKg),
            producers: [
                ...data.producerIds.map(id => ({ producerId: id })),
                ...Array(15 - data.producerIds.length).fill(null).map(initialProducerSlot)
            ],
            suppliers: [
                ...data.suppliers.map(s => ({ name: s.name, cpf: s.cpf })),
                ...Array(15 - data.suppliers.length).fill(null).map(initialSupplierInput)
            ]
        }));

        // FIX: Corrected typo from ui_state to uiState
        setItemCentricContracts(uiState.length > 0 ? uiState : [initialItemCentricInput()]);
        setExpandedItemIndex(0);
    }
  }, [producers, activeTab]);


  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setRegError(''); setRegSuccess('');
    if (onRegister(regName, regCpf, selectedWeeks)) {
        setRegSuccess(`Produtor "${regName}" cadastrado com sucesso!`);
        setRegName(''); setRegCpf(''); setSelectedWeeks([]);
    } else {
        setRegError('Nome de produtor ou CPF já cadastrado.');
    }
  };
  
  const handleSaveContracts = (e: React.FormEvent) => {
    e.preventDefault(); setContractError(''); setContractSuccess('');

    // FIX: Explicitly type `updatedProducers` to prevent type inference issues with `producerMap` below.
    const updatedProducers: Producer[] = producers.map(p => ({ ...p, contractItems: [], initialValue: 0 }));
    const producerMap = new Map(updatedProducers.map(p => [p.id, p]));

    for (const uiItem of itemCentricContracts) {
        if (!uiItem.name.trim()) continue;

        const totalKg = parseFloat(uiItem.totalKg);
        const valuePerKg = parseFloat(uiItem.valuePerKg);
        if (!uiItem.name.trim() || isNaN(totalKg) || totalKg <= 0 || isNaN(valuePerKg) || valuePerKg <= 0) {
            setContractError(`Item "${uiItem.name || 'em branco'}" tem dados inválidos. Preencha nome, Kg total e valor/Kg com números positivos.`);
            return;
        }

        const assignedProducerIds = uiItem.producers.map(p => p.producerId).filter(id => id);
        if (assignedProducerIds.length === 0) continue;
        
        const validSuppliers: Supplier[] = uiItem.suppliers
            .map(s => ({ name: s.name.trim(), cpf: s.cpf.replace(/[^\d]/g, '') }))
            .filter(s => s.name !== '' && s.cpf !== '');

        const kgPerProducer = totalKg / assignedProducerIds.length;

        for (const producerId of assignedProducerIds) {
            const producer = producerMap.get(producerId);
            if (producer) {
                producer.contractItems.push({
                    name: uiItem.name, totalKg: kgPerProducer, valuePerKg, suppliers: validSuppliers,
                });
            }
        }
    }

    updatedProducers.forEach(p => {
        p.initialValue = p.contractItems.reduce((sum, item) => sum + (item.totalKg * item.valuePerKg), 0);
    });

    onUpdateProducers(updatedProducers);
    setContractSuccess('Contratos salvos com sucesso!');
  };
  
  const handleItemChange = (index: number, field: 'name' | 'totalKg' | 'valuePerKg', value: string) => {
    const newItems = [...itemCentricContracts];
    newItems[index] = { ...newItems[index], [field]: value };
    setItemCentricContracts(newItems);
  };

  const handleProducerSelectionChange = (itemIndex: number, slotIndex: number, producerId: string) => {
    const newItems = [...itemCentricContracts];
    const newProducers = [...newItems[itemIndex].producers];
    newProducers[slotIndex] = { producerId };
    newItems[itemIndex] = { ...newItems[itemIndex], producers: newProducers };
    setItemCentricContracts(newItems);
  };
  
  const handleSupplierChange = (itemIndex: number, supplierIndex: number, field: 'name' | 'cpf', value: string) => {
    const newItems = [...itemCentricContracts];
    const newSuppliers = [...newItems[itemIndex].suppliers];
    const updatedValue = field === 'cpf' ? value.replace(/[^\d]/g, '') : value;
    newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: updatedValue };
    newItems[itemIndex] = { ...newItems[itemIndex], suppliers: newSuppliers };
    setItemCentricContracts(newItems);
  };

  const handleAddItem = () => {
    if (itemCentricContracts.length < 15) {
        setItemCentricContracts([...itemCentricContracts, initialItemCentricInput()]);
        setExpandedItemIndex(itemCentricContracts.length);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = itemCentricContracts.filter((_, i) => i !== index);
    setItemCentricContracts(newItems);
  };

  const TabButton: React.FC<{tab: 'register' | 'contracts' | 'analytics', label: string}> = ({ tab, label }) => (
      <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-blue-100' }`}>{label}</button>
  );

  return (
    <div className="min-h-screen text-gray-800">
       <header className="bg-white/80 backdrop-blur-sm shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-blue-800">Painel do Administrador</h1>
          <p className="text-sm text-gray-500">Gestão de Produtores e Contratos</p>
        </div>
        <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Sair</button>
      </header>
      
      <main className="p-4 md:p-8">
        <div className="mb-8 flex justify-center border-b"><div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
                <TabButton tab="register" label="Cadastro de Produtor"/>
                <TabButton tab="contracts" label="Gestão por Item"/>
                <TabButton tab="analytics" label="Análise Gráfica"/>
        </div></div>

        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Cadastrar Novo Produtor</h2>
              <form className="space-y-6" onSubmit={handleRegisterSubmit}>
                <div className="rounded-md shadow-sm space-y-3">
                    <input value={regName} onChange={(e) => setRegName(e.target.value.toUpperCase())} required placeholder="Nome completo (MAIÚSCULA)" className="input-field"/>
                    <input value={regCpf} onChange={(e) => setRegCpf(e.target.value.replace(/[^\d]/g, ''))} maxLength={11} required placeholder="CPF (será a senha) - apenas números" className="input-field"/>
                </div>
                <div className="space-y-4 pt-2">
                  <h3 className="text-lg font-medium text-gray-800 text-center border-b pb-2">Semanas de Entrega Permitidas</h3>
                  <p className="text-center text-xs text-gray-500">Selecione as semanas em que este produtor pode entregar.</p>
                  <WeekSelector selectedWeeks={selectedWeeks} onWeekToggle={(week) => setSelectedWeeks(p => p.includes(week) ? p.filter(w=>w!==week) : [...p,week])} />
                </div>
                {regError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{regError}</p>}
                {regSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{regSuccess}</p>}
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">Cadastrar Produtor</button>
              </form>
            </div>
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Produtores Cadastrados</h2>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">{producers.length > 0 ? producers.map(p => (<div key={p.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center text-sm shadow-sm"><div><p className="font-bold text-gray-800">{p.name}</p><p className="text-xs text-gray-500">CPF: {p.cpf}</p></div><span className="font-mono text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">{p.contractItems.length} {p.contractItems.length === 1 ? 'item' : 'itens'}</span></div>)) : <p className="text-center text-gray-500 italic mt-8">Nenhum produtor cadastrado.</p>}</div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Gestão de Contratos por Item</h2>
                <form className="space-y-6" onSubmit={handleSaveContracts}>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                            {itemCentricContracts.map((item, index) => {
                                const assignedProducersCount = item.producers.filter(p => p.producerId).length;
                                const activeSuppliersCount = item.suppliers.filter(s => s.name.trim() !== '' && s.cpf.trim() !== '').length;
                                const kgNum = parseFloat(item.totalKg) || 0;
                                const valKgNum = parseFloat(item.valuePerKg) || 0;
                                const kgPerProducer = assignedProducersCount > 0 ? kgNum / assignedProducersCount : 0;
                                const valPerProducer = assignedProducersCount > 0 ? kgPerProducer * valKgNum : 0;
                                
                                const isProducersExpanded = expandedItemIndex === index && expandedSection === 'producers';
                                const isSuppliersExpanded = expandedItemIndex === index && expandedSection === 'suppliers';
                                
                                return (
                                <div key={index} className="p-4 border rounded-lg relative bg-gray-50 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-gray-600">Item de Contrato {index + 1}</p>
                                        {itemCentricContracts.length > 1 && <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 text-2xl font-bold leading-none">&times;</button>}
                                    </div>
                                    <div className="space-y-3 mt-2">
                                        <input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="Nome do Item (Ex: Soja)" className="input-field"/>
                                        <div className="flex space-x-2">
                                            <input type="number" value={item.totalKg} onChange={(e) => handleItemChange(index, 'totalKg', e.target.value)} min="0.01" step="0.01" placeholder="Quantidade Total (Kg)" className="input-field w-1/2"/>
                                            <input type="number" value={item.valuePerKg} onChange={(e) => handleItemChange(index, 'valuePerKg', e.target.value)} min="0.01" step="0.01" placeholder="Valor por Kg (R$)" className="input-field w-1/2"/>
                                        </div>
                                    </div>
                                    {assignedProducersCount > 0 && <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-center"><p><span className="font-semibold">{kgPerProducer.toFixed(2)} Kg</span> | <span className="font-semibold">{formatCurrency(valPerProducer)}</span> por produtor</p></div>}
                                    
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                      <button type="button" onClick={() => { setExpandedItemIndex(isProducersExpanded ? null : index); setExpandedSection(isProducersExpanded ? null : 'producers'); }} className={`w-full text-left text-sm font-semibold p-2 rounded text-center transition-colors ${isProducersExpanded ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}>
                                          Produtores ({assignedProducersCount}/15) {isProducersExpanded ? '▲' : '▼'}
                                      </button>
                                      <button type="button" onClick={() => { setExpandedItemIndex(isSuppliersExpanded ? null : index); setExpandedSection(isSuppliersExpanded ? null : 'suppliers'); }} className={`w-full text-left text-sm font-semibold p-2 rounded text-center transition-colors ${isSuppliersExpanded ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'}`}>
                                          Fornecedores ({activeSuppliersCount}/15) {isSuppliersExpanded ? '▲' : '▼'}
                                      </button>
                                    </div>

                                    {isProducersExpanded && <div className="mt-3 pt-3 border-t space-y-3">{item.producers.map((slot, slotIndex) => <div key={slotIndex} className="flex space-x-2 items-center"><span className="text-xs text-gray-500 w-6 text-right">#{slotIndex + 1}</span><select value={slot.producerId} onChange={e => handleProducerSelectionChange(index, slotIndex, e.target.value)} className="input-field"><option value="">-- Selecione um Produtor --</option>{producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>)}</div>}
                                    {isSuppliersExpanded && <div className="mt-3 pt-3 border-t space-y-3">{item.suppliers.map((supplier, supIndex) => <div key={supIndex} className="flex space-x-2 items-center"><span className="text-xs text-gray-500 w-6 text-right">#{supIndex + 1}</span><input value={supplier.name} onChange={e => handleSupplierChange(index, supIndex, 'name', e.target.value)} placeholder="Nome do Fornecedor" className="input-field w-1/2"/><input value={supplier.cpf} onChange={e => handleSupplierChange(index, supIndex, 'cpf', e.target.value)} maxLength={11} placeholder="CPF do Fornecedor" className="input-field w-1/2"/></div>)}</div>}

                                </div>
                            )})}
                        </div>
                        {itemCentricContracts.length < 15 && <button type="button" onClick={handleAddItem} className="w-full text-sm font-medium text-green-600 hover:bg-green-50 py-2 px-4 rounded-md border-2 border-dashed border-green-300 transition-colors">+ Adicionar Item de Contrato</button>}
                    </div>
                    {contractError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded mt-4">{contractError}</p>}
                    {contractSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded mt-4">{contractSuccess}</p>}
                    <div className="mt-6"><button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">Salvar Alterações nos Contratos</button></div>
                </form>
            </div>
        )}

        {activeTab === 'analytics' && <AdminAnalytics producers={producers} />}
      </main>
      <style>{`.input-field { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; background-color: #fff; } .input-field:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #10B981; box-shadow: 0 0 0 2px #10B981; }`}</style>
    </div>
  );
};

export default AdminDashboard;