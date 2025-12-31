import React, { useState, useEffect, useRef } from 'react';
import type { Producer, ContractItem } from '../types';
import AdminAnalytics from './AdminAnalytics';
import WeekSelector from './WeekSelector';

interface AdminDashboardProps {
  onRegister: (name: string, cpf: string, allowedWeeks: number[]) => Promise<boolean>;
  onUpdateProducers: (updatedProducers: Producer[]) => void;
  onLogout: () => void;
  producers: Producer[];
  onResetData: () => void;
  onRestoreData: (backupProducers: Producer[]) => Promise<boolean>;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Tipos para o estado da UI de Gestão por Item
interface ProducerSlot { producerId: string; }
interface ItemCentricInput {
  name: string;
  totalKg: string;
  valuePerKg: string;
  producers: ProducerSlot[];
  id: string; // Adicionado para rastrear a ordem de criação
}

const initialProducerSlot = (): ProducerSlot => ({ producerId: '' });
const initialItemCentricInput = (): ItemCentricInput => ({
  name: '', 
  totalKg: '', 
  valuePerKg: '',
  producers: Array(15).fill(null).map(initialProducerSlot),
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
});

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRegister, onUpdateProducers, onLogout, producers, onResetData, onRestoreData }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'register' | 'contracts' | 'analytics'>('info');
  
  // Estados para aba de REGISTRO
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Estados para aba de GESTÃO POR ITEM
  const [itemCentricContracts, setItemCentricContracts] = useState<ItemCentricInput[]>([initialItemCentricInput()]);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(0);
  const [contractError, setContractError] = useState('');
  const [contractSuccess, setContractSuccess] = useState('');
  const contractsInitialized = useRef(false);

  // Estados para ZONA CRÍTICA (Backup/Restore)
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMessage, setRestoreMessage] = useState({ type: '', text: '' });


  // Sincroniza o estado da UI com os dados dos produtores ao abrir a aba, mantendo a ordem
  useEffect(() => {
    if (activeTab !== 'contracts') {
        contractsInitialized.current = false;
        return;
    }

    if (contractsInitialized.current) {
        return;
    }
      
    const itemsMap = new Map<string, { totalKg: number; valuePerKg: number; producerIds: string[]; order: number }>();

    producers.forEach(producer => {
        (producer.contractItems || []).forEach(item => {
            const order = item.order ?? Infinity; // Default para itens antigos sem ordem
            
            if (!itemsMap.has(item.name)) {
                itemsMap.set(item.name, { totalKg: 0, valuePerKg: item.valuePerKg, producerIds: [], order: order });
            }

            const entry = itemsMap.get(item.name)!;
            entry.totalKg += item.totalKg;

            // Mantém o menor número de 'order' encontrado para um item, que representa sua criação original
            if (order < entry.order) {
                entry.order = order;
            }

            if (!entry.producerIds.includes(producer.id)) {
                entry.producerIds.push(producer.id);
            }
        });
    });

    // Converte o Map para um array e ordena pela propriedade 'order'
    const sortedItems = Array.from(itemsMap.entries()).sort(([, a], [, b]) => a.order - b.order);

    // Reconstrói o estado da UI a partir dos itens ordenados
    const uiState: ItemCentricInput[] = sortedItems.map(([name, data], index) => {
        return {
            id: `item-loaded-${index}-${name}`,
            name,
            totalKg: String(data.totalKg),
            valuePerKg: String(data.valuePerKg),
            producers: [
                ...data.producerIds.map(id => ({ producerId: id })),
                ...Array(Math.max(0, 15 - data.producerIds.length)).fill(null).map(initialProducerSlot)
            ]
        };
    });

    if (uiState.length > 0) {
        setItemCentricContracts(uiState);
    } else {
        setItemCentricContracts([initialItemCentricInput()]);
    }
    
    contractsInitialized.current = true;
  }, [producers, activeTab]);


  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setRegError(''); setRegSuccess('');
    if (await onRegister(regName, regCpf, selectedWeeks)) {
        setRegSuccess(`Produtor "${regName}" cadastrado com sucesso!`);
        setRegName(''); setRegCpf(''); setSelectedWeeks([]);
    } else {
        setRegError('Nome de produtor ou CPF já cadastrado.');
    }
  };
  
  const handleSaveContracts = (e: React.FormEvent) => {
    e.preventDefault(); setContractError(''); setContractSuccess('');

    const updatedProducers: Producer[] = producers.map(p => ({ ...p, contractItems: [], initialValue: 0 }));
    const producerMap = new Map(updatedProducers.map(p => [p.id, p]));

    for (let index = 0; index < itemCentricContracts.length; index++) {
        const uiItem = itemCentricContracts[index];
        const name = uiItem.name.trim().toUpperCase();
        if (!name) continue;

        const assignedProducerIds = uiItem.producers.map(p => p.producerId).filter(id => id !== '');
        
        if (assignedProducerIds.length > 0) {
            const totalKg = parseFloat(uiItem.totalKg);
            const valuePerKg = parseFloat(uiItem.valuePerKg);
            
            if (isNaN(totalKg) || totalKg <= 0 || isNaN(valuePerKg) || valuePerKg <= 0) {
                setContractError(`O item "${name}" (atribuído a produtores) possui valores inválidos.`);
                return;
            }

            const kgPerProducer = totalKg / assignedProducerIds.length;

            for (const producerId of assignedProducerIds) {
                const producer = producerMap.get(producerId);
                if (producer) {
                    producer.contractItems.push({
                        name,
                        totalKg: kgPerProducer,
                        valuePerKg,
                        order: index // Salva a posição do item na lista como 'order'
                    });
                }
            }
        }
    }

    // Recalcula o valor inicial total de cada produtor
    updatedProducers.forEach(p => {
        p.initialValue = p.contractItems.reduce((sum, item) => sum + (item.totalKg * item.valuePerKg), 0);
    });

    onUpdateProducers(updatedProducers);
    setContractSuccess('Contratos salvos com sucesso!');
    setTimeout(() => setContractSuccess(''), 3000);
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
  
  const handleAddItem = () => {
    if (itemCentricContracts.length < 50) {
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

  const handleResetClick = () => {
      onResetData();
  };
  
  const handleBackupData = () => {
      const jsonData = JSON.stringify(producers, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup-ppais-2026-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleRestoreClick = () => {
    if (!restoreFile) {
      setRestoreMessage({ type: 'error', text: 'Nenhum arquivo selecionado.' });
      return;
    }
    
    if (!window.confirm('ATENÇÃO: A restauração irá APAGAR TODOS os dados da nuvem e substituí-los pelo conteúdo do arquivo de backup. Esta ação é irreversível e afetará todos os usuários. Deseja continuar?')) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backupProducers: Producer[] = JSON.parse(content);
        
        // Validação simples do arquivo
        if (!Array.isArray(backupProducers) || (backupProducers.length > 0 && !backupProducers[0].cpf)) {
           throw new Error('Arquivo de backup inválido ou corrompido.');
        }

        const success = await onRestoreData(backupProducers);
        if (success) {
          setRestoreMessage({ type: 'success', text: 'Dados restaurados com sucesso na nuvem!' });
          setRestoreFile(null);
        } else {
           throw new Error('Falha na operação de restauração.');
        }

      } catch (error: any) {
        setRestoreMessage({ type: 'error', text: `Erro: ${error.message}` });
      }
    };
    reader.onerror = () => {
      setRestoreMessage({ type: 'error', text: 'Erro ao ler o arquivo.' });
    };
    reader.readAsText(restoreFile);
  };

  const TabButton: React.FC<{tab: 'info' | 'register' | 'contracts' | 'analytics', label: string}> = ({ tab, label }) => (
      <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-blue-100' }`}>{label}</button>
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
        <div className="mb-8 flex justify-center border-b"><div className="flex space-x-2 p-1 bg-gray-100/50 rounded-xl">
                <TabButton tab="info" label="Backup e Segurança"/>
                <TabButton tab="register" label="Cadastro"/>
                <TabButton tab="contracts" label="Gestão por Item"/>
                <TabButton tab="analytics" label="Análise"/>
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
                    <h2 className="text-2xl font-black mb-6 text-gray-700 uppercase tracking-tight">Novo Produtor</h2>
                    <form className="space-y-6" onSubmit={handleRegisterSubmit}>
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Dados de Acesso</label>
                            <input value={regName} onChange={(e) => setRegName(e.target.value.toUpperCase())} required placeholder="NOME DO PRODUTOR" className="input-field font-bold"/>
                            <input value={regCpf} onChange={(e) => setRegCpf(e.target.value.replace(/[^\d]/g, ''))} maxLength={11} required placeholder="CPF (SENHA)" className="input-field font-mono"/>
                        </div>
                        <div className="space-y-4 pt-2">
                            <h3 className="text-sm font-black text-gray-600 border-b pb-2 uppercase tracking-widest">Semanas Disponíveis</h3>
                            <WeekSelector selectedWeeks={selectedWeeks} onWeekToggle={(week) => setSelectedWeeks(p => p.includes(week) ? p.filter(w=>w!==week) : [...p,week])} />
                        </div>
                        {regError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg font-bold">{regError}</p>}
                        {regSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg font-bold">{regSuccess}</p>}
                        <button type="submit" className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 uppercase">Finalizar Cadastro</button>
                    </form>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-blue-600 overflow-hidden">
              <h2 className="text-2xl font-black mb-6 text-gray-700 uppercase tracking-tight">Produtores Cadastrados ({producers.length})</h2>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {producers.length > 0 ? producers.map(p => (
                  <div key={p.id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center text-sm border border-gray-100 hover:bg-white transition-colors group">
                    <div>
                        <p className="font-black text-gray-800 group-hover:text-blue-600 transition-colors">{p.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">ID: {p.id.split('-')[1]}</p>
                    </div>
                    <span className="font-bold text-[10px] text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">{p.contractItems.length} itens</span>
                  </div>
                )) : <div className="text-center py-20"><p className="text-gray-300 italic">Nenhum registro.</p></div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-5xl mx-auto border-t-8 border-blue-600 animate-fade-in">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tighter">Gestão de Contratos por Item</h2>
                  <p className="text-gray-400 font-medium">Os itens abaixo permanecem na ordem exata de adição.</p>
                </div>
                
                <form className="space-y-10" onSubmit={handleSaveContracts}>
                    <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar p-2">
                        {itemCentricContracts.map((item, index) => {
                            const activeProducers = item.producers.filter(p => p.producerId !== '');
                            const assignedCount = activeProducers.length;
                            const isExpanded = expandedItemIndex === index;
                            
                            const totalKg = parseFloat(item.totalKg) || 0;
                            const valKg = parseFloat(item.valuePerKg) || 0;
                            const totalItemValue = totalKg * valKg;
                            
                            const kgPerProd = assignedCount > 0 ? totalKg / assignedCount : 0;
                            const valPerProd = assignedCount > 0 ? totalItemValue / assignedCount : 0;
                            
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
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Produto</label>
                                        <input value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value.toUpperCase())} placeholder="EX: ARROZ AGULHINHA" className="input-field font-black text-blue-900 uppercase"/>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Peso Total Contratado (Kg)</label>
                                        <input type="number" step="0.01" value={item.totalKg} onChange={(e) => handleItemChange(index, 'totalKg', e.target.value)} placeholder="0,00" className="input-field font-mono text-lg"/>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço por Quilograma (R$)</label>
                                        <input type="number" step="0.01" value={item.valuePerKg} onChange={(e) => handleItemChange(index, 'valuePerKg', e.target.value)} placeholder="0,00" className="input-field font-mono text-lg text-green-700"/>
                                    </div>
                                </div>

                                {/* PAINEL DE RESUMO EXCLUSIVO */}
                                <div className="mt-8 bg-blue-50/50 border-2 border-blue-100 rounded-2xl overflow-hidden shadow-inner">
                                    <div className="bg-blue-100/50 px-4 py-2 border-b-2 border-blue-100 flex justify-between items-center">
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Resumo de Cálculos do Contrato</span>
                                        <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full shadow-sm">{assignedCount} PRODUTORES</span>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="text-center md:border-r-2 border-blue-100/50">
                                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter mb-1">Valor Total</p>
                                            <p className="text-lg font-black text-gray-900">{formatCurrency(totalItemValue)}</p>
                                        </div>
                                        <div className="text-center md:border-r-2 border-blue-100/50">
                                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-tighter mb-1">Peso Total</p>
                                            <p className="text-lg font-black text-gray-900">{totalKg.toLocaleString('pt-BR')} <span className="text-xs">Kg</span></p>
                                        </div>
                                        <div className="text-center md:border-r-2 border-blue-100/50">
                                            <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mb-1">Cota Valor / Prod</p>
                                            <p className="text-lg font-black text-blue-700">{formatCurrency(valPerProd)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mb-1">Cota Peso / Prod</p>
                                            <p className="text-lg font-black text-blue-700">{kgPerProd.toLocaleString('pt-BR')} <span className="text-xs">Kg</span></p>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="button" onClick={() => setExpandedItemIndex(isExpanded ? null : index)} className={`w-full text-xs font-black p-4 mt-6 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${isExpanded ? 'bg-blue-600 text-white shadow-xl translate-y-[-2px]' : 'bg-white text-blue-600 border-2 border-blue-200 hover:bg-blue-50'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                    {isExpanded ? 'Fechar Lista de Vinculados' : `Configurar Produtores (${assignedCount})`}
                                </button>

                                {isExpanded && (
                                    <div className="mt-4 pt-6 border-t-2 border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-down">
                                        {item.producers.map((slot, slotIndex) => (
                                            <div key={slotIndex} className="flex space-x-2 items-center group">
                                                <span className="text-[10px] font-black text-gray-300 w-5 group-hover:text-blue-500 transition-colors">{slotIndex + 1}</span>
                                                <select 
                                                    value={slot.producerId} 
                                                    onChange={e => handleProducerSelectionChange(index, slotIndex, e.target.value)} 
                                                    className="input-field py-2 text-xs font-bold border-gray-100 bg-gray-50/50 hover:border-blue-300 transition-all cursor-pointer"
                                                >
                                                    <option value="">-- SELECIONAR --</option>
                                                    {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>
                    
                    {itemCentricContracts.length < 50 && (
                        <button type="button" onClick={handleAddItem} className="w-full text-lg font-black text-blue-600 hover:bg-blue-50 py-5 rounded-2xl border-4 border-dashed border-blue-200 flex items-center justify-center space-x-3 transition-all hover:border-blue-400 group shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            <span className="uppercase tracking-widest">Adicionar Próximo Item</span>
                        </button>
                    )}
                    
                    <div className="space-y-4">
                        {contractError && (
                            <div className="bg-red-50 border-l-8 border-red-500 p-4 rounded-xl text-red-700 flex items-center gap-4 animate-shake">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                <span className="font-black uppercase text-sm">{contractError}</span>
                            </div>
                        )}
                        {contractSuccess && (
                            <div className="bg-green-50 border-l-8 border-green-500 p-4 rounded-xl text-green-700 flex items-center gap-4 animate-fade-in">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                 <span className="font-black uppercase text-sm">{contractSuccess}</span>
                            </div>
                        )}

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

        {activeTab === 'analytics' && <AdminAnalytics producers={producers} />}
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