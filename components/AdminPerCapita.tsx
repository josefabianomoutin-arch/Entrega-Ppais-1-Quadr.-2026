import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier } from '../types';
import { resolutionData } from './resolutionData';

interface AdminPerCapitaProps {
  suppliers: Supplier[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatContractedTotal = (quantity: number, unitString?: string): string => {
    const [unitType] = (unitString || 'kg-1').split('-');
    
    // Check for volume units
    if (['litro', 'embalagem', 'caixa'].some(u => unitType.includes(u))) {
        // For volume, the stored quantity in `totalKg` is already in Liters
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
    }
    
    if (unitType === 'dz') {
        return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Dz`;
    }

    // Default to Kg for everything else (saco, balde, kg, un) as they are weight-based.
    return `${quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
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

const AdminPerCapita: React.FC<AdminPerCapitaProps> = ({ suppliers }) => {
    const [staffCount, setStaffCount] = useState<number>(() => {
        const saved = localStorage.getItem('perCapitaStaffCount');
        return saved ? parseInt(saved, 10) : 0;
    });
    const [inmateCount, setInmateCount] = useState<number>(() => {
        const saved = localStorage.getItem('perCapitaInmateCount');
        return saved ? parseInt(saved, 10) : 0;
    });
    const [showComparison, setShowComparison] = useState(false);
    const [customPerCapita, setCustomPerCapita] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('perCapitaCustomValues');
        return saved ? JSON.parse(saved) : {};
    });
    
    useEffect(() => {
        localStorage.setItem('perCapitaStaffCount', String(staffCount));
        localStorage.setItem('perCapitaInmateCount', String(inmateCount));
    }, [staffCount, inmateCount]);

    useEffect(() => {
        localStorage.setItem('perCapitaCustomValues', JSON.stringify(customPerCapita));
    }, [customPerCapita]);

    const itemData = useMemo(() => {
      const data = new Map<string, { totalKg: number; totalValue: number; unit?: string }>();
      suppliers.forEach(p => {
        (p.contractItems || []).forEach(item => {
          const current = data.get(item.name) || { totalKg: 0, totalValue: 0, unit: item.unit };
          
          current.totalKg += getContractItemWeight(item);

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
            return sum + item.totalKg;
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

    const handleCustomPerCapitaChange = (itemName: string, value: string) => {
        setCustomPerCapita(prev => ({
            ...prev,
            [itemName]: value.replace(/[^0-9,]/g, '')
        }));
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-green-500 animate-fade-in">
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
                        onChange={(e) => setInmateCount(parseInt(e.target.value, 10) || 0)}
                        placeholder="0" 
                        className="input-field font-mono text-lg"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total de Servidores</label>
                     <input 
                        type="number"
                        value={staffCount || ''}
                        onChange={(e) => setStaffCount(parseInt(e.target.value, 10) || 0)}
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
                        Comparativo Contratado vs. Requerido (Totais para 4 Meses)
                    </h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                                <tr>
                                    <th className="p-3 text-center">#</th>
                                    <th className="p-3 text-left">Item</th>
                                    <th className="p-3 text-left">Frequência</th>
                                    <th className="p-3 text-right">Qtd. Mensal p/ Pessoa</th>
                                    <th className="p-3 text-right">Citado por Pessoa (4 meses)</th>
                                    <th className="p-3 text-right">Requerido para 4 meses (População total)</th>
                                    <th className="p-3 text-right">Contratado para 4 meses (População total)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredItemData.length > 0 ? filteredItemData.map((item, index) => {
                                    const reference = resolutionData[item.name.toUpperCase()];
                                    const contractedTotal = item.totalKg;
                                    const contractedUnitString = item.unit;
                                    
                                    if (!reference) {
                                        return (
                                            <tr key={item.name} className="bg-blue-50 hover:bg-blue-100">
                                                <td className="p-3 text-center font-mono text-gray-500">{index + 1}</td>
                                                <td className="p-3 font-semibold text-blue-900">{item.name}</td>
                                                <td className="p-3 text-center text-blue-800 font-mono">-</td>
                                                <td className="p-3 text-right">-</td>
                                                <td className="p-3 text-right">-</td>
                                                <td className="p-3 text-right font-mono font-bold">-</td>
                                                <td className="p-3 text-right font-mono font-bold text-blue-900">{formatContractedTotal(contractedTotal, contractedUnitString)}</td>
                                            </tr>
                                        );
                                    }
                                    
                                    // Utiliza diretamente o consumo mensal por pessoa (Consumo em 4) definido nos dados de referência.
                                    // Esta abordagem é mais direta e robusta do que recalcular a partir da frequência semanal.
                                    const perCapitaRequiredMonthly = reference.monthlyConsumption;
                                    
                                    const perCapitaRequired4Months = perCapitaRequiredMonthly.value * 4;

                                    const customValueStr = customPerCapita[item.name];
                                    const hasCustomValue = customValueStr !== undefined && customValueStr.trim() !== '';

                                    const effectiveValue4Months = hasCustomValue
                                        ? parseFloat(customValueStr.replace(',', '.')) || 0
                                        : perCapitaRequired4Months;
                                    
                                    const effectiveValueMonthly = effectiveValue4Months / 4;
                                    const effectiveUnit = perCapitaRequiredMonthly.unit;

                                    let totalRequiredValue = 0;
                                    let requiredUnitType = ''; // 'kg', 'L', 'unid.'

                                    if (perCapitaDenominator > 0) {
                                        const unit = effectiveUnit.toLowerCase();
                                        const value4Months = effectiveValue4Months;

                                        if (unit === 'g') {
                                            totalRequiredValue = (value4Months / 1000) * perCapitaDenominator;
                                            requiredUnitType = 'kg';
                                        } else if (unit === 'ml') {
                                            totalRequiredValue = (value4Months / 1000) * perCapitaDenominator;
                                            requiredUnitType = 'L';
                                        } else if (unit === 'l') {
                                            totalRequiredValue = value4Months * perCapitaDenominator;
                                            requiredUnitType = 'L';
                                        } else if (unit === 'unid.') {
                                            totalRequiredValue = value4Months * perCapitaDenominator;
                                            requiredUnitType = 'unid.';
                                        }
                                    }

                                    const formatMonthlyPerCapita = (value: number, unit: string) => {
                                        const formattedValue = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        return `${formattedValue} ${unit}`;
                                    };

                                    const formatRequiredTotal = (value: number, unit: string) => {
                                        if (value === 0) return '-';
                                        const numberFormatOptions: Intl.NumberFormatOptions = {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        };
                                        if (unit === 'unid.') {
                                            numberFormatOptions.minimumFractionDigits = 0;
                                            numberFormatOptions.maximumFractionDigits = 0;
                                        }
                                        const formattedValue = value.toLocaleString('pt-BR', numberFormatOptions);
                                        return `${formattedValue} ${unit}`;
                                    };

                                    return (
                                         <tr key={item.name} className="hover:bg-gray-50">
                                            <td className="p-3 text-center font-mono text-gray-500">{index + 1}</td>
                                            <td className="p-3 font-semibold text-gray-800">{item.name}</td>
                                            <td className="p-3 text-left font-mono text-gray-500">{reference.frequency}</td>
                                            <td className="p-3 text-right font-mono text-gray-600">
                                                {formatMonthlyPerCapita(effectiveValueMonthly, effectiveUnit)}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="inline-flex items-center justify-end">
                                                    <input
                                                        type="text"
                                                        value={customPerCapita[item.name] ?? ''}
                                                        onChange={(e) => handleCustomPerCapitaChange(item.name, e.target.value)}
                                                        placeholder={(perCapitaRequired4Months || 0).toString().replace('.', ',')}
                                                        className="w-24 p-1 border rounded-md text-right font-mono text-sm bg-yellow-50 focus:bg-white focus:ring-2 focus:ring-indigo-400"
                                                    />
                                                    <span className="ml-2 text-xs text-gray-500 w-8">{perCapitaRequiredMonthly.unit}</span>
                                                </div>
                                            </td>
                                            <td className={`p-3 text-right font-mono ${hasCustomValue ? 'text-indigo-600 font-bold' : 'text-gray-600'}`}>
                                                {formatRequiredTotal(totalRequiredValue, requiredUnitType)}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-gray-800">{formatContractedTotal(contractedTotal, contractedUnitString)}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                                            Nenhum item de hortifruti ou perecível encontrado nos contratos.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
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