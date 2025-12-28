import React, { useState, useEffect } from 'react';
import type { Producer, ContractItem, Supplier } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, allowedWeeks: number[]) => boolean;
  onUpdateContract: (producerId: string, newContractItems: ContractItem[]) => void;
  onLogout: () => void;
  producers: Producer[];
}

// Helper para formatação de moeda
const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


// Tipos e Funções para o estado do formulário de contrato
interface SupplierInput { name: string; cpf: string; }
interface ContractItemInput {
  name: string;
  totalKg: string;
  valuePerKg: string;
  suppliers: SupplierInput[];
}
const initialSupplierInput = (): SupplierInput => ({ name: '', cpf: '' });
const initialContractItemInput = (): ContractItemInput => ({
  name: '',
  totalKg: '',
  valuePerKg: '',
  suppliers: Array(15).fill(null).map(initialSupplierInput)
});

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRegister, onUpdateContract, onLogout, producers }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'contracts' | 'analytics'>('register');
  
  // Estados para aba de REGISTRO
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Estados para aba de CONTRATOS
  const [selectedProducerId, setSelectedProducerId] = useState<string>('');
  const [contractItems, setContractItems] = useState<ContractItemInput[]>([initialContractItemInput()]);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);
  const [contractError, setContractError] = useState('');
  const [contractSuccess, setContractSuccess] = useState('');
  
  useEffect(() => {
    if (selectedProducerId) {
        const producer = producers.find(p => p.id === selectedProducerId);
        if (producer) {
            const formattedItems = producer.contractItems.map(item => ({
                name: item.name,
                totalKg: String(item.totalKg),
                valuePerKg: String(item.valuePerKg),
                suppliers: [
                    ...item.suppliers,
                    ...Array(Math.max(0, 15 - item.suppliers.length)).fill(null).map(initialSupplierInput)
                ]
            }));
            setContractItems(formattedItems.length > 0 ? formattedItems : [initialContractItemInput()]);
            setExpandedItemIndex(0);
        }
    } else {
        setContractItems([initialContractItemInput()]);
    }
  }, [selectedProducerId, producers]);


  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (onRegister(regName, regCpf, selectedWeeks)) {
        setRegSuccess(`Produtor "${regName}" cadastrado com sucesso!`);
        setRegName('');
        setRegCpf('');
        setSelectedWeeks([]);
    } else {
        setRegError('Nome de produtor ou CPF já cadastrado.');
    }
  };
  
  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();
    setContractError('');
    setContractSuccess('');

    if (!selectedProducerId) {
        setContractError('Por favor, selecione um produtor antes de salvar.');
        return;
    }

    const newContractItems: ContractItem[] = [];
    for (const item of contractItems) {
        if (!item.name.trim() && !item.totalKg.trim() && !item.valuePerKg.trim()) {
            continue; // Ignora itens completamente vazios
        }
        if (!item.name.trim() || !item.totalKg.trim() || !item.valuePerKg.trim()) {
            setContractError('Para os itens preenchidos, todos os campos (nome, Kg total, valor/Kg) são obrigatórios.');
            return;
        }
        const totalKgNumber = parseFloat(item.totalKg);
        const valuePerKgNumber = parseFloat(item.valuePerKg);

        if (isNaN(totalKgNumber) || totalKgNumber <= 0 || isNaN(valuePerKgNumber) || valuePerKgNumber <= 0) {
            setContractError('Valores de quantidade e R$/kg devem ser números positivos.');
            return;
        }

        const validSuppliers: Supplier[] = item.suppliers
          .map(s => ({ name: s.name.trim(), cpf: s.cpf.replace(/[^\d]/g, '') }))
          .filter(s => s.name !== '' && s.cpf !== '');
        
        if (validSuppliers.length === 0) {
          setContractError(`O item "${item.name}" deve ter pelo menos um fornecedor com nome e CPF preenchidos.`);
          return;
        }

        newContractItems.push({ 
          name: item.name, 
          totalKg: totalKgNumber, 
          valuePerKg: valuePerKgNumber,
          suppliers: validSuppliers
        });
    }

    onUpdateContract(selectedProducerId, newContractItems);
    setContractSuccess('Contrato do produtor salvo com sucesso!');
  };
  
  const handleItemChange = (index: number, field: 'name' | 'totalKg' | 'valuePerKg', value: string) => {
    const newItems = [...contractItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setContractItems(newItems);
  };

  const handleSupplierChange = (itemIndex: number, supplierIndex: number, field: 'name' | 'cpf', value: string) => {
    const newItems = [...contractItems];
    const newSuppliers = [...newItems[itemIndex].suppliers];
    const updatedValue = field === 'cpf' ? value.replace(/[^\d]/g, '') : value;
    newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: updatedValue };
    newItems[itemIndex] = { ...newItems[itemIndex], suppliers: newSuppliers };
    setContractItems(newItems);
  };

  const handleAddItem = () => {
    if (contractItems.length < 15) {
        setContractItems([...contractItems, initialContractItemInput()]);
        setExpandedItemIndex(contractItems.length);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = contractItems.filter((_, i) => i !== index);
    setContractItems(newItems);
  };

  const TabButton: React.FC<{tab: 'register' | 'contracts' | 'analytics', label: string}> = ({ tab, label }) => (
      <button
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === tab 
            ? 'bg-blue-600 text-white shadow' 
            : 'text-gray-600 hover:bg-blue-100'
        }`}
      >
        {label}
      </button>
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
        <div className="mb-8 flex justify-center border-b">
            <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
                <TabButton tab="register" label="Cadastro de Produtor"/>
                <TabButton tab="contracts" label="Gestão de Contratos"/>
                <TabButton tab="analytics" label="Análise Gráfica"/>
            </div>
        </div>

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
                  <p className="text-center text-xs text-gray-500">Selecione as semanas em que este produtor pode entregar. Se nenhuma for selecionada, todas serão permitidas.</p>
                  <WeekSelector selectedWeeks={selectedWeeks} onWeekToggle={(week) => setSelectedWeeks(p => p.includes(week) ? p.filter(w=>w!==week) : [...p,week])} />
                </div>

                {regError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{regError}</p>}
                {regSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{regSuccess}</p>}
                
                <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">Cadastrar Produtor</button>
              </form>
            </div>
            
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Produtores Cadastrados</h2>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {producers.length > 0 ? producers.map(p => (
                    <div key={p.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center text-sm shadow-sm">
                      <div>
                        <p className="font-bold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">CPF: {p.cpf}</p>
                      </div>
                      <span className="font-mono text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">{p.contractItems.length} {p.contractItems.length === 1 ? 'item' : 'itens'}</span>
                    </div>
                )) : <p className="text-center text-gray-500 italic mt-8">Nenhum produtor cadastrado.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Gerenciar Contrato do Produtor</h2>
                <form className="space-y-6" onSubmit={handleSaveContract}>
                    <div>
                        <label htmlFor="producer-select" className="block text-sm font-medium text-gray-700 mb-2">Selecione o Produtor</label>
                        <select id="producer-select" value={selectedProducerId} onChange={e => setSelectedProducerId(e.target.value)} className="input-field">
                            <option value="">-- Escolha um produtor --</option>
                            {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {selectedProducerId && (
                        <div className="space-y-4 pt-2 border-t mt-6">
                            <h3 className="text-lg font-medium text-gray-800 text-center pt-4">Itens do Contrato</h3>
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                {contractItems.map((item, index) => {
                                    const activeSuppliersCount = item.suppliers.filter(s => s.name.trim() !== '' && s.cpf.trim() !== '').length;
                                    const kgNum = parseFloat(item.totalKg) || 0;
                                    const valKgNum = parseFloat(item.valuePerKg) || 0;
                                    const kgPerSupplier = activeSuppliersCount > 0 ? kgNum / activeSuppliersCount : 0;
                                    const valPerSupplier = activeSuppliersCount > 0 ? (kgNum * valKgNum) / activeSuppliersCount : 0;
                                    const isExpanded = expandedItemIndex === index;
                                    return (
                                    <div key={index} className="p-4 border rounded-lg relative bg-gray-50 shadow-sm">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold text-gray-600">Item {index + 1}</p>
                                            {contractItems.length > 1 && <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 text-2xl font-bold leading-none">&times;</button>}
                                        </div>
                                        <div className="space-y-3 mt-2">
                                            <input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="Nome do Item (Ex: Soja)" className="input-field"/>
                                            <div className="flex space-x-2">
                                                <input type="number" value={item.totalKg} onChange={(e) => handleItemChange(index, 'totalKg', e.target.value)} min="0.01" step="0.01" placeholder="Quantidade Total (Kg)" className="input-field w-1/2"/>
                                                <input type="number" value={item.valuePerKg} onChange={(e) => handleItemChange(index, 'valuePerKg', e.target.value)} min="0.01" step="0.01" placeholder="Valor por Kg (R$)" className="input-field w-1/2"/>
                                            </div>
                                        </div>
                                        {activeSuppliersCount > 0 && <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-center"><p><span className="font-semibold">{kgPerSupplier.toFixed(2)} Kg</span> | <span className="font-semibold">{formatCurrency(valPerSupplier)}</span> por fornecedor</p></div>}
                                        <button type="button" onClick={() => setExpandedItemIndex(isExpanded ? null : index)} className="w-full text-left mt-4 text-sm font-semibold text-blue-600">
                                            {isExpanded ? 'Ocultar' : 'Mostrar'} Fornecedores ({activeSuppliersCount}/15) {isExpanded ? '▲' : '▼'}
                                        </button>
                                        {isExpanded && <div className="mt-3 pt-3 border-t space-y-3">{item.suppliers.map((supplier, supIndex) => <div key={supIndex} className="flex space-x-2 items-center"><span className="text-xs text-gray-500 w-6 text-right">#{supIndex + 1}</span><input value={supplier.name} onChange={e => handleSupplierChange(index, supIndex, 'name', e.target.value)} placeholder="Nome do Fornecedor" className="input-field w-1/2"/><input value={supplier.cpf} onChange={e => handleSupplierChange(index, supIndex, 'cpf', e.target.value)} maxLength={11} placeholder="CPF do Fornecedor" className="input-field w-1/2"/></div>)}</div>}
                                    </div>
                                )})}
                            </div>
                            {contractItems.length < 15 && <button type="button" onClick={handleAddItem} className="w-full text-sm font-medium text-green-600 hover:bg-green-50 py-2 px-4 rounded-md border-2 border-dashed border-green-300 transition-colors">+ Adicionar Item</button>}
                        </div>
                    )}
                    {contractError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded mt-4">{contractError}</p>}
                    {contractSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded mt-4">{contractSuccess}</p>}
                    <div className="mt-6">
                        <button type="submit" disabled={!selectedProducerId} className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Salvar Contrato</button>
                    </div>
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