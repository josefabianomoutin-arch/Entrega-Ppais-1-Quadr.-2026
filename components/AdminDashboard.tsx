import React, { useState } from 'react';
import type { Producer, ContractItem } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, contractItems: ContractItem[], allowedWeeks: number[]) => boolean;
  onLogout: () => void;
  producers: Producer[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRegister, onLogout, producers }) => {
  const [activeTab, setActiveTab] = useState<'register' | 'analytics'>('register');
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regContractItems, setRegContractItems] = useState([{ name: '', kg: '', value: '' }]);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

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
        if (!item.name.trim() || !item.kg.trim() || !item.value.trim()) {
            setRegError('Por favor, preencha todos os campos de todos os itens do contrato.');
            return;
        }
        const kgNumber = parseFloat(item.kg);
        const valueNumber = parseFloat(item.value);

        if (isNaN(kgNumber) || kgNumber <= 0 || isNaN(valueNumber) || valueNumber <= 0) {
            setRegError('Valores de quilograma e R$ devem ser números positivos.');
            return;
        }
        contractItems.push({ name: item.name, kg: kgNumber, value: valueNumber });
    }
    
    if (contractItems.length === 0) {
        setRegError('Adicione pelo menos um item ao contrato.');
        return;
    }

    if (onRegister(regName, regCpf, contractItems, selectedWeeks)) {
        setRegSuccess(`Produtor "${regName}" cadastrado com sucesso!`);
        setRegName('');
        setRegCpf('');
        setRegContractItems([{ name: '', kg: '', value: '' }]);
        setSelectedWeeks([]);
    } else {
        setRegError('Nome de produtor ou CPF já cadastrado.');
    }
  };
  
  const handleItemChange = (index: number, field: 'name' | 'kg' | 'value', value: string) => {
    const newItems = [...regContractItems];
    newItems[index][field] = value;
    setRegContractItems(newItems);
  };

  const handleAddItem = () => {
    if (regContractItems.length < 15) {
        setRegContractItems([...regContractItems, { name: '', kg: '', value: '' }]);
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
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                      {regContractItems.map((item, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3 relative bg-gray-50 shadow-sm">
                          <p className="font-semibold text-gray-600 text-sm">Item {index + 1}</p>
                           {regContractItems.length > 1 && (
                             <button type="button" onClick={() => handleRemoveItem(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-2xl font-bold leading-none">&times;</button>
                          )}
                          <input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="Nome do Item (Ex: Soja)" className="input-field"/>
                          <div className="flex space-x-2">
                            <input type="number" value={item.kg} onChange={(e) => handleItemChange(index, 'kg', e.target.value)} min="0.01" step="0.01" placeholder="Quilogramas (Kg)" className="input-field w-1/2"/>
                            <input type="number" value={item.value} onChange={(e) => handleItemChange(index, 'value', e.target.value)} min="0.01" step="0.01" placeholder="Valor (R$)" className="input-field w-1/2"/>
                          </div>
                        </div>
                      ))}
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