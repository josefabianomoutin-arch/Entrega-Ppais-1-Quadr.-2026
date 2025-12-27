import React, { useState } from 'react';
import type { Producer, ContractItem, Supplier } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, contractItems: ContractItem[], allowedWeeks: number[]) => boolean;
  onLogout: () => void;
  producers: Producer[];
}

// Helper para formatação de moeda
const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


// Tipos para o estado do formulário
interface SupplierInput { name: string; cpf: string; }
interface ContractItemInput {
  name: string;
  totalKg: string;
  valuePerKg: string;
  suppliers: SupplierInput[];
}

// Funções para criar estados iniciais
const initialSupplierInput = (): SupplierInput => ({ name: '', cpf: '' });
const initialContractItemInput = (): ContractItemInput => ({
  name: '',
  totalKg: '',
  valuePerKg: '',
  suppliers: Array(15).fill(null).map(initialSupplierInput)
});

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRegister, onLogout, producers }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'analytics'>('register');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regContractItems, setRegContractItems] = useState<ContractItemInput[]>([initialContractItemInput()]);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);


  const handleWeekToggle = (weekNumber: number) => {
    setSelectedWeeks(prev =>
        prev.includes(weekNumber)
            ? prev.filter(w => w !== weekNumber)
            : [...prev, weekNumber]
    );
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const contractItems: ContractItem[] = [];
    for (const item of regContractItems) {
        if (!item.name.trim() || !item.totalKg.trim() || !item.valuePerKg.trim()) {
            setRegError('Por favor, preencha nome, quantidade total e valor por kg para todos os itens do contrato.');
            return;
        }
        const totalKgNumber = parseFloat(item.totalKg);
        const valuePerKgNumber = parseFloat(item.valuePerKg);

        if (isNaN(totalKgNumber) || totalKgNumber <= 0 || isNaN(valuePerKgNumber) || valuePerKgNumber <= 0) {
            setRegError('Valores de quantidade e R$/kg devem ser números positivos.');
            return;
        }

        const validSuppliers: Supplier[] = item.suppliers
          .map(s => ({ name: s.name.trim(), cpf: s.cpf.replace(/[^\d]/g, '') }))
          .filter(s => s.name !== '' && s.cpf !== '');
        
        if (validSuppliers.length === 0) {
          setRegError(`O item "${item.name}" deve ter pelo menos um fornecedor com nome e CPF preenchidos.`);
          return;
        }

        contractItems.push({ 
          name: item.name, 
          totalKg: totalKgNumber, 
          valuePerKg: valuePerKgNumber,
          suppliers: validSuppliers
        });
    }
    
    if (contractItems.length === 0) {
        setRegError('Adicione pelo menos um item ao contrato.');
        return;
    }

    if (onRegister(regName, regCpf, contractItems, selectedWeeks)) {
        setRegSuccess(`Produtor "${regName}" cadastrado com sucesso!`);
        setRegName('');
        setRegCpf('');
        setRegContractItems([initialContractItemInput()]);
        setSelectedWeeks([]);
        setExpandedItemIndex(0);
    } else {
        setRegError('Nome de produtor ou CPF já cadastrado.');
    }
  };
  
  const handleItemChange = (index: number, field: 'name' | 'totalKg' | 'valuePerKg', value: string) => {
    const newItems = [...regContractItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setRegContractItems(newItems);
  };

  const handleSupplierChange = (itemIndex: number, supplierIndex: number, field: 'name' | 'cpf', value: string) => {
    const newItems = [...regContractItems];
    const newSuppliers = [...newItems[itemIndex].suppliers];
    const updatedValue = field === 'cpf' ? value.replace(/[^\d]/g, '') : value;
    newSuppliers[supplierIndex] = { ...newSuppliers[supplierIndex], [field]: updatedValue };
    newItems[itemIndex] = { ...newItems[itemIndex], suppliers: newSuppliers };
    setRegContractItems(newItems);
  };

  const handleAddItem = () => {
    if (regContractItems.length < 15) {
        setRegContractItems([...regContractItems, initialContractItemInput()]);
        setExpandedItemIndex(regContractItems.length); // Expande o novo item
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = regContractItems.filter((_, i) => i !== index);
    setRegContractItems(newItems);
  };

  const TabButton: React.FC<{tab: 'register' | 'analytics', label: string}> = ({ tab, label }) => (
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
          <p className="text-sm text-gray-500">Gestão de Produtores</p>
        </div>
        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Sair
        </button>
      </header>
      
      <main className="p-4 md:p-8">
        <div className="mb-8 flex justify-center border-b">
            <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
                <TabButton tab="register" label="Cadastro e Lista"/>
                <TabButton tab="analytics" label="Análise Gráfica"/>
            </div>
        </div>

        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Registration Form */}
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Cadastrar Novo Produtor</h2>
              <form className="space-y-6" onSubmit={handleRegisterSubmit}>
                <div className="rounded-md shadow-sm space-y-3">
                    <input value={regName} onChange={(e) => setRegName(e.target.value.toUpperCase())} required placeholder="Nome completo do produtor (MAIÚSCULA)" className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                    <input value={regCpf} onChange={(e) => setRegCpf(e.target.value.replace(/[^\d]/g, ''))} maxLength={11} required placeholder="CPF (será a senha) - apenas números sem pontos" className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                </div>
                
                <div className="space-y-4 pt-2">
                  <h3 className="text-lg font-medium text-gray-800 text-center border-b pb-2">Itens do Contrato</h3>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                      {regContractItems.map((item, index) => {
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
                             {regContractItems.length > 1 && (
                               <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 text-2xl font-bold leading-none">&times;</button>
                            )}
                          </div>
                          <div className="space-y-3 mt-2">
                             <input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="Nome do Item (Ex: Soja)" className="input-field"/>
                            <div className="flex space-x-2">
                              <input type="number" value={item.totalKg} onChange={(e) => handleItemChange(index, 'totalKg', e.target.value)} min="0.01" step="0.01" placeholder="Quantidade Total (Kg)" className="input-field w-1/2"/>
                              <input type="number" value={item.valuePerKg} onChange={(e) => handleItemChange(index, 'valuePerKg', e.target.value)} min="0.01" step="0.01" placeholder="Valor por Kg (R$)" className="input-field w-1/2"/>
                            </div>
                          </div>
                          
                          {activeSuppliersCount > 0 && (
                            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-center">
                                <p>
                                    <span className="font-semibold">{kgPerSupplier.toFixed(2)} Kg</span> por fornecedor | <span className="font-semibold">{formatCurrency(valPerSupplier)}</span> por fornecedor
                                </p>
                            </div>
                          )}

                          <button type="button" onClick={() => setExpandedItemIndex(isExpanded ? null : index)} className="w-full text-left mt-4 text-sm font-semibold text-blue-600">
                            {isExpanded ? 'Ocultar' : 'Mostrar'} Fornecedores do Item ({activeSuppliersCount} / 15) {isExpanded ? '▲' : '▼'}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t space-y-3">
                              {item.suppliers.map((supplier, supIndex) => (
                                <div key={supIndex} className="flex space-x-2 items-center">
                                  <span className="text-xs text-gray-500 w-6 text-right">#{supIndex + 1}</span>
                                  <input value={supplier.name} onChange={e => handleSupplierChange(index, supIndex, 'name', e.target.value)} placeholder="Nome do Fornecedor" className="input-field w-1/2"/>
                                  <input value={supplier.cpf} onChange={e => handleSupplierChange(index, supIndex, 'cpf', e.target.value)} maxLength={11} placeholder="CPF do Fornecedor" className="input-field w-1/2"/>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )})}
                  </div>
                  {regContractItems.length < 15 && (
                    <button type="button" onClick={handleAddItem} className="w-full text-sm font-medium text-green-600 hover:bg-green-50 py-2 px-4 rounded-md border-2 border-dashed border-green-300 transition-colors">+ Adicionar Item ao Contrato</button>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-lg font-medium text-gray-800 text-center border-b pb-2">Semanas de Entrega Permitidas</h3>
                  <p className="text-center text-xs text-gray-500">Clique em qualquer dia para selecionar/desmarcar a semana inteira. Se nenhuma semana for selecionada, todas serão permitidas.</p>
                  <WeekSelector selectedWeeks={selectedWeeks} onWeekToggle={handleWeekToggle} />
                </div>

                {regError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{regError}</p>}
                {regSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded">{regSuccess}</p>}
                
                <div>
                  <button type="submit" className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">Cadastrar Produtor</button>
                </div>
              </form>
            </div>
            
            {/* Producer List */}
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 text-center text-gray-700">Produtores Cadastrados</h2>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {producers.length > 0 ? (
                  producers.map(producer => (
                    <div key={producer.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center text-sm shadow-sm">
                      <div>
                        <p className="font-bold text-gray-800">{producer.name}</p>
                        <p className="text-xs text-gray-500">CPF: {producer.cpf}</p>
                      </div>
                      <span className="font-mono text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {producer.contractItems.length} {producer.contractItems.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 italic mt-8">Nenhum produtor cadastrado ainda.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && <AdminAnalytics producers={producers} />}
      </main>
      <style>{`.input-field { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; background-color: #fff; } .input-field:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #10B981; box-shadow: 0 0 0 2px #10B981; }`}</style>
    </div>
  );
};

export default AdminDashboard;