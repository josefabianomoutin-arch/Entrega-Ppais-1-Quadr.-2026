

import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier, PerCapitaConfig, WarehouseMovement } from '../types';
import { resolutionData } from './resolutionData';
import AdminContractItems from './AdminContractItems';

interface AdminPerCapitaProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  perCapitaConfig: PerCapitaConfig;
  onUpdatePerCapitaConfig: (config: PerCapitaConfig) => void;
  onUpdateContractForItem: (itemName: string, assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string }[]) => Promise<{ success: boolean, message: string }>;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const normalizeItemName = (name: string): string => {
    return (name || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[;,\.\-\/]/g, " ")    // Troca separadores por espaço
        .replace(/\s+/g, " ")           // Remove espaços duplos
        .trim()
        .toUpperCase();
};

const formatContractedTotal = (quantity: number, unitString?: string): string => {
    const [unitType, unitWeightStr] = (unitString || 'kg-1').split('-');
    
    if (['litro', 'embalagem', 'caixa'].some(u => unitType.includes(u))) {
        // For volume, quantity is total Liters
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
    }
    
    if (unitType === 'dz') {
        // For dozen, quantity is number of dozens
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Dz`;
    }

    if (unitType === 'un') {
        // For 'un', the quantity stored is already the total weight in kg.
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
    }

    // For everything else (saco, balde, kg, etc.), convert quantity of units to total weight.
    const unitWeight = parseFloat(unitWeightStr) || 1;
    const totalWeight = quantity * unitWeight;
    return `${totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
};

const getContractItemWeight = (item: { totalKg?: number, unit?: string }): number => {
    if (!item) return 0;
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    
    const quantity = item.totalKg || 0;

    if (unitType === 'un') {
        return quantity;
    }
    if (unitType === 'dz') {
        return 0;
    }

    const unitWeight = parseFloat(unitWeightStr) || 1;
    return quantity * unitWeight;
};

const hortifrutiKeywords = [
    'abacate', 'abacaxi', 'abóbora', 'abobrinha', 'acelga', 'agrião', 'alface', 
    'banana', 'batata', 'berinjela', 'beterraba', 'brócolis', 'caqui', 'cará', 
    'cebola', 'cebolinha', 'cenoura', 'chuchu', 'couve', 'escarola', 'espinafre', 
    'goiaba', 'inhame', 'jiló', 'laranja', 'limão', 'maçã', 'mamão', 'mandioca', 
    'manga', 'maracujá', 'melancia', 'melão', 'milho', 'moranga', 'mostarda', 
    'pepino', 'pêra', 'pimentão', 'quiabo', 'rabanete', 'repolho', 'rúcula', 
    'salsa', 'tomate', 'uva', 'vagem'
];

const perishablesKeywords = [
    'carne', 'frango', 'suína', 'peixe', 'bovina', 'almôndega', 'embutido', 
    'linguiça', 'salsicha', 'fígado', 'dobradinha', 'charque', 'costela', 'pé', 
    'toucinho', 'bisteca', 'lombo', 'pernil', 'hambúrguer', 'ovo', 'atum', 'sardinha'
];

const isHortifrutiOrPerishable = (itemName: string): boolean => {
    const lowerItemName = itemName.toLowerCase();
    const allKeywords = [...hortifrutiKeywords, ...perishablesKeywords];
    return allKeywords.some(keyword => lowerItemName.includes(keyword));
};

const AdminPerCapita: React.FC<AdminPerCapitaProps> = ({ suppliers, warehouseLog, perCapitaConfig, onUpdatePerCapitaConfig, onUpdateContractForItem }) => {
    const [activeSubTab, setActiveSubTab] = useState<'CALCULO' | 'KIT PPL' | 'PPAIS' | 'ESTOCÁVEIS' | 'PERECÍVEIS' | 'AUTOMAÇÃO'>('CALCULO');
    const [staffCount, setStaffCount] = useState<number>(0);
    const [inmateCount, setInmateCount] = useState<number>(0);
    const [customPerCapita, setCustomPerCapita] = useState<Record<string, string>>({});
    const [showComparison, setShowComparison] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        setStaffCount(perCapitaConfig.staffCount || 0);
        setInmateCount(perCapitaConfig.inmateCount || 0);
        setCustomPerCapita(perCapitaConfig.customValues || {});
        setIsDirty(false);
    }, [perCapitaConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        const newConfig: PerCapitaConfig = {
            staffCount,
            inmateCount,
            customValues: customPerCapita,
        };
        try {
            await onUpdatePerCapitaConfig(newConfig);
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save per capita config:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStaffCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStaffCount(parseInt(e.target.value, 10) || 0);
        setIsDirty(true);
    };

    const handleInmateCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInmateCount(parseInt(e.target.value, 10) || 0);
        setIsDirty(true);
    };

    const handleCustomPerCapitaChange = (itemName: string, value: string) => {
        setCustomPerCapita(prev => ({
            ...prev,
            [itemName]: value.replace(/[^0-9,]/g, '')
        }));
        setIsDirty(true);
    };

    const itemData = useMemo(() => {
      const data = new Map<string, { totalQuantity: number; totalValue: number; unit: string }>();
      suppliers?.forEach(p => {
        (p.contractItems || []).forEach(item => {
          const current = data.get(item.name) || { totalQuantity: 0, totalValue: 0, unit: item.unit || 'kg-1' };
          
          current.totalQuantity += item.totalKg;

          const itemTotalValue = (item.totalKg || 0) * (item.valuePerKg || 0);
          current.totalValue += itemTotalValue;

          data.set(item.name, current);
        });
      });
      return Array.from(data.entries())
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const filteredItemData = useMemo(() => {
        return itemData.filter(item => isHortifrutiOrPerishable(item.name));
    }, [itemData]);

    const perCapitaDenominator = useMemo(() => {
        return inmateCount + (staffCount / 3);
    }, [inmateCount, staffCount]);

    const totalPerCapitaKg = useMemo(() => {
        if (perCapitaDenominator === 0) return 0;
        const totalKgOfAllItems = itemData.reduce((sum, item) => {
            const [unitType] = (item.unit || 'kg-1').split('-');
             if (['litro', 'embalagem', 'caixa', 'dz'].some(u => unitType.includes(u))) {
                return sum;
            }
            const weight = getContractItemWeight({ totalKg: item.totalQuantity, unit: item.unit });
            return sum + weight;
        }, 0);
        return (totalKgOfAllItems / perCapitaDenominator) / 4;
    }, [itemData, perCapitaDenominator]);
    
    const totalPerCapitaValue = useMemo(() => {
        if (perCapitaDenominator === 0) return 0;
        const totalValueOfAllItems = itemData.reduce((sum, item) => sum + item.totalValue, 0);
        return (totalValueOfAllItems / perCapitaDenominator) / 4;
    }, [itemData, perCapitaDenominator]);

    const totalContractValue = useMemo(() => {
        return itemData.reduce((sum, item) => sum + item.totalValue, 0);
    }, [itemData]);

    const shelfLifeData = useMemo(() => {
        const shelfLives = new Map<string, number[]>();
        suppliers?.forEach(s => {
            s.deliveries?.forEach(d => {
                const startDate = d.invoiceDate || d.date;
                if (!startDate) return;
                const start = new Date(startDate + 'T12:00:00').getTime();
                
                const itemName = normalizeItemName(d.item || '');
                if (!itemName) return;

                d.lots?.forEach(l => {
                    if (!l.expirationDate) return;
                    const end = new Date(l.expirationDate + 'T12:00:00').getTime();
                    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays > 0) {
                        const existing = shelfLives.get(itemName) || [];
                        existing.push(diffDays);
                        shelfLives.set(itemName, existing);
                    }
                });
            });
        });
        
        const averages = new Map<string, number>();
        shelfLives.forEach((lives, name) => {
            const avg = lives.reduce((a, b) => a + b, 0) / lives.length;
            averages.set(name, avg);
        });
        return averages;
    }, [suppliers]);

    const getPurchaseRecommendation = (avgDays: number) => {
        if (avgDays === 0) return 'DADOS INSUFICIENTES';
        if (avgDays < 45) return 'MENSAL';
        if (avgDays < 135) return 'QUADRIMESTRAL';
        if (avgDays < 200) return 'SEMESTRAL';
        return 'ANUAL';
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-green-500 animate-fade-in relative">
            
            <div className="flex flex-wrap gap-2 mb-8 border-b pb-4">
                <button 
                    onClick={() => setActiveSubTab('CALCULO')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'CALCULO' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    Cálculo Geral
                </button>
                <button 
                    onClick={() => setActiveSubTab('KIT PPL')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'KIT PPL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    KIT PPL - HIGIÊNE E VESTUÁRIO
                </button>
                <button 
                    onClick={() => setActiveSubTab('PPAIS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'PPAIS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    PPAIS
                </button>
                <button 
                    onClick={() => setActiveSubTab('ESTOCÁVEIS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'ESTOCÁVEIS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    ESTOCÁVEIS
                </button>
                <button 
                    onClick={() => setActiveSubTab('PERECÍVEIS')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'PERECÍVEIS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    PERECÍVEIS
                </button>
                <button 
                    onClick={() => setActiveSubTab('AUTOMAÇÃO')}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${activeSubTab === 'AUTOMAÇÃO' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                    AUTOMAÇÃO
                </button>
            </div>

            {activeSubTab === 'CALCULO' ? (
                <>
                    {(isDirty || saveSuccess) && (
                <div className="sticky top-0 z-10 mb-6 -mx-6 -mt-6">
                    {saveSuccess && (
                        <div className="p-4 bg-green-100 border-b border-green-300 text-center font-semibold text-green-800 shadow-sm animate-fade-in">
                            Dados salvos com sucesso na nuvem!
                        </div>
                    )}
                    {isDirty && (
                        <div className="p-4 bg-yellow-100 border-b border-yellow-300 rounded-t-2xl flex justify-between items-center shadow-sm animate-fade-in">
                            <p className="font-semibold text-yellow-800">Você tem alterações não salvas.</p>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400"
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    )}
                </div>
            )}


            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-green-900 uppercase tracking-tighter">Cálculo de Consumo Per Capita</h2>
                <p className="text-gray-400 font-medium">Estime o consumo mensal por pessoa com base nos totais contratados.</p>
                <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200 inline-block">
                    <p className="text-sm font-mono text-gray-600">
                        Fórmula: (Total / (Pop. Carcerária + (Servidores / 3))) / 4
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">População Carcerária</label>
                    <input 
                        type="number"
                        value={inmateCount || ''}
                        onChange={handleInmateCountChange}
                        placeholder="0" 
                        className="input-field font-mono text-lg"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total de Servidores</label>
                     <input 
                        type="number"
                        value={staffCount || ''}
                        onChange={handleStaffCountChange}
                        placeholder="0" 
                        className="input-field font-mono text-lg"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                 <div className="bg-gray-50/50 p-4 rounded-xl text-center flex flex-col justify-center border">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter mb-1">Valor Total Contratado</p>
                    <p className="text-2xl font-black text-gray-700">{formatCurrency(totalContractValue)}</p>
                </div>
                 <div className="bg-blue-50/50 p-4 rounded-xl text-center flex flex-col justify-center border">
                    <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mb-1">Total de Consumidores (Base)</p>
                    <p className="text-2xl font-black text-blue-700">{perCapitaDenominator.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</p>
                </div>
                <div className="bg-green-50/50 p-4 rounded-xl text-center flex flex-col justify-center border border-green-200">
                    <p className="text-[10px] text-green-600 uppercase font-black tracking-tighter mb-1">Total Per Capita (Kg)</p>
                    <p className="text-2xl font-black text-green-700">
                        {totalPerCapitaKg.toFixed(4).replace('.', ',')}
                        <span className="text-base font-medium ml-1">Kg</span>
                    </p>
                </div>
                 <div className="bg-blue-50/50 p-4 rounded-xl text-center flex flex-col justify-center border border-blue-200">
                    <p className="text-[10px] text-blue-600 uppercase font-black tracking-tighter mb-1">Total Per Capita (R$)</p>
                    <p className="text-2xl font-black text-blue-700">
                        {formatCurrency(totalPerCapitaValue)}
                    </p>
                </div>
            </div>

             <div className="text-center my-10 border-t pt-10">
                <button 
                    onClick={() => setShowComparison(!showComparison)}
                    className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105"
                >
                    {showComparison ? 'Ocultar Comparativo' : 'Exibir Comparativo de Contrato'}
                </button>
            </div>

            {showComparison && (
                <div className="mt-8 animate-fade-in">
                    <h3 className="text-2xl font-black text-gray-800 mb-6 text-center uppercase tracking-tighter">
                        Análise de Frequência de Compra por Prazo de Validade (Média das NFs)
                    </h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                                <tr>
                                    <th className="p-3 text-center">#</th>
                                    <th className="p-3 text-left">Item (Tabela de Pesos)</th>
                                    <th className="p-3 text-center">Frequência Consumo</th>
                                    <th className="p-3 text-center">Média Validade (Dias)</th>
                                    <th className="p-3 text-center">Recomendação de Compra</th>
                                    <th className="p-3 text-right">Ação Sugerida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {resolutionData && Object.entries(resolutionData).sort((a, b) => a[0].localeCompare(b[0])).map(([name, data], index) => {
                                    const normalizedName = normalizeItemName(name);
                                    const avgDays = shelfLifeData.get(normalizedName) || 0;
                                    const recommendation = getPurchaseRecommendation(avgDays);
                                    
                                    return (
                                        <tr key={name} className="hover:bg-gray-50">
                                            <td className="p-3 text-center font-mono text-gray-500">{index + 1}</td>
                                            <td className="p-3 font-semibold text-gray-800">{name}</td>
                                            <td className="p-3 text-center font-mono text-gray-500">{data.frequency}</td>
                                            <td className="p-3 text-center font-mono font-bold">
                                                {avgDays > 0 ? `${Math.round(avgDays)} dias` : <span className="text-gray-300 italic">Sem dados NF</span>}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                                    recommendation === 'MENSAL' ? 'bg-red-100 text-red-700' :
                                                    recommendation === 'QUADRIMESTRAL' ? 'bg-orange-100 text-orange-700' :
                                                    recommendation === 'SEMESTRAL' ? 'bg-blue-100 text-blue-700' :
                                                    recommendation === 'ANUAL' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {recommendation}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right text-[10px] font-medium text-gray-500 italic">
                                                {avgDays > 0 ? (
                                                    avgDays < 45 ? "Comprar conforme necessidade imediata" :
                                                    avgDays < 135 ? "Estoque para até 4 meses" :
                                                    avgDays < 200 ? "Estoque para até 6 meses" :
                                                    "Possível estoque anual"
                                                ) : "Aguardando lançamentos de NF"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

                </>
            ) : (
                <div className="animate-fade-in">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tighter">
                            {activeSubTab === 'KIT PPL' ? 'KIT PPL - HIGIÊNE E VESTUÁRIO' : activeSubTab}
                        </h2>
                        <p className="text-gray-400 font-medium">Levantamento de informações iniciais para gestão de itens.</p>
                    </div>
                    <AdminContractItems 
                        key={activeSubTab}
                        suppliers={suppliers} 
                        warehouseLog={warehouseLog} 
                        onUpdateContractForItem={onUpdateContractForItem}
                        categoryFilter={activeSubTab as any}
                        hideHeader={false}
                    />
                </div>
            )}


            <style>{`
                .input-field { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 1rem; border: 2px solid #F3F4F6; border-radius: 1rem; background-color: #fff; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); } 
                .input-field:focus { border-color: #10B981; background-color: #fff; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.15); }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminPerCapita;