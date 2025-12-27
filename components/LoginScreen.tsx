import React, { useState } from 'react';
import type { Producer, ContractItem } from '../types';

interface LoginScreenProps {
  onLogin: (name: string, cpf: string) => boolean;
  onRegister: (name: string, cpf: string, contractItems: ContractItem[]) => boolean;
  producers: Producer[];
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister, producers }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Login State
  const [loginName, setLoginName] = useState('');
  const [loginCpf, setLoginCpf] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regContractItems, setRegContractItems] = useState([{ name: '', kg: '', value: '' }]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogin(loginName, loginCpf)) {
      setLoginError('Nome do produtor ou CPF inválido.');
    } else {
      setLoginError('');
    }
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

    if (onRegister(regName, regCpf, contractItems)) {
        setRegSuccess('Cadastro realizado com sucesso! Você já pode fazer o login.');
        setRegName('');
        setRegCpf('');
        setRegContractItems([{ name: '', kg: '', value: '' }]);
        setIsRegistering(false);
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

  const toggleForm = () => {
      setIsRegistering(!isRegistering);
      setLoginError('');
      setRegError('');
      setRegSuccess('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-800">Entrega Ppais 1º Quadr. 2026</h1>
          <p className="mt-2 text-gray-600">
            {isRegistering ? 'Cadastro de Novo Produtor' : 'Gestão de Entregas dos Produtores'}
          </p>
        </div>

        {isRegistering ? (
          <form className="mt-8 space-y-6" onSubmit={handleRegisterSubmit}>
            <div className="rounded-md shadow-sm space-y-3">
                <input value={regName} onChange={(e) => setRegName(e.target.value)} required placeholder="Nome completo do produtor" className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                <input value={regCpf} onChange={(e) => setRegCpf(e.target.value)} required placeholder="CPF (será sua senha)" className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            
            <div className="space-y-4 pt-2">
              <h3 className="text-lg font-medium text-gray-800 text-center border-b pb-2">Itens do Contrato</h3>
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
              {regContractItems.length < 15 && (
                <button type="button" onClick={handleAddItem} className="w-full text-sm font-medium text-green-600 hover:bg-green-50 py-2 px-4 rounded-md border-2 border-dashed border-green-300 transition-colors">+ Adicionar Item ao Contrato</button>
              )}
            </div>

            {regError && <p className="text-red-500 text-sm text-center">{regError}</p>}
            <div>
              <button type="submit" className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">Cadastrar Produtor</button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
            {regSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-md">{regSuccess}</p>}
            <div className="rounded-md shadow-sm -space-y-px">
              <select value={loginName} onChange={(e) => setLoginName(e.target.value)} required className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                <option value="" disabled>Selecione o Produtor</option>
                {producers.map(p => (<option key={p.id} value={p.name}>{p.name}</option>))}
              </select>
              <input type="password" autoComplete="current-password" required value={loginCpf} onChange={(e) => setLoginCpf(e.target.value)} placeholder="CPF (senha)" className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <div>
              <button type="submit" className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">Entrar</button>
            </div>
          </form>
        )}
        
        <div className="text-sm text-center">
          <button onClick={toggleForm} className="font-medium text-green-600 hover:text-green-500">
            {isRegistering ? 'Já tem uma conta? Entrar' : 'Não tem uma conta? Cadastre-se'}
          </button>
        </div>
      </div>
      <style>{`.input-field { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; background-color: #fff; } .input-field:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #10B981; box-shadow: 0 0 0 2px #10B981; }`}</style>
    </div>
  );
};

export default LoginScreen;