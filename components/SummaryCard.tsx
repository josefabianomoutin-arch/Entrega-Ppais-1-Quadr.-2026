import React, { useMemo } from 'react';
import type { Supplier } from '../types';
import { MONTHS_2026 } from '../constants';

interface SummaryCardProps {
    supplier: Supplier;
}

// Helper para calcular o peso total real de um item de contrato
const getContractItemWeight = (item: Supplier['contractItems'][0]): number => {
    if (!item) return 0;
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    
    const quantity = item.totalKg || 0;

    // Para 'unidade', totalKg já é o peso total.
    if (unitType === 'un') {
        return quantity;
    }
    
    // Para 'dúzia', não temos um peso definido, então retornamos 0 para o total de Kg.
    if (unitType === 'dz') {
        return 0;
    }

    // Para outros (kg, balde, saco), totalKg armazena a quantidade. Multiplicamos pelo peso da unidade.
    const unitWeight = parseFloat(unitWeightStr) || 1; // Padrão de 1 para 'kg-1'
    return quantity * unitWeight;
};


const SummaryCard: React.FC<SummaryCardProps> = ({ supplier }) => {
    // Value calculations
    const totalDeliveredValue = supplier.deliveries.reduce((sum, delivery) => sum + (delivery.value || 0), 0);
    const remainingValue = supplier.initialValue - totalDeliveredValue;
    const valueProgress = supplier.initialValue > 0 ? (totalDeliveredValue / supplier.initialValue) * 100 : 0;

    // Weight (Kg) calculations
    const totalContractedKg = useMemo(() => {
        return supplier.contractItems.reduce((sum, item) => sum + getContractItemWeight(item), 0);
    }, [supplier.contractItems]);

    const totalDeliveredKg = supplier.deliveries.reduce((sum, delivery) => sum + (delivery.kg || 0), 0);
    const remainingKg = totalContractedKg - totalDeliveredKg;
    const kgProgress = totalContractedKg > 0 ? (totalDeliveredKg / totalContractedKg) * 100 : 0;

    const monthlyDataByItem = useMemo(() => {
        const data = new Map<string, any[]>();
        
        supplier.contractItems.forEach(item => {
            const itemMonthlyData = [];
            const itemTotalValue = (item.totalKg || 0) * (item.valuePerKg || 0);
            const itemTotalKg = getContractItemWeight(item);

            const monthlyValueQuota = itemTotalValue / 4;
            const monthlyKgQuota = itemTotalKg / 4;

            for (const month of MONTHS_2026) {
                const deliveredInMonth = supplier.deliveries
                    .filter(d => d.item === item.name && new Date(d.date + 'T00:00:00').getMonth() === month.number);
                
                const deliveredValue = deliveredInMonth.reduce((sum, d) => sum + (d.value || 0), 0);
                const deliveredKg = deliveredInMonth.reduce((sum, d) => sum + (d.kg || 0), 0);

                itemMonthlyData.push({
                    monthName: month.name,
                    contractedValue: monthlyValueQuota,
                    contractedKg: monthlyKgQuota,
                    deliveredValue,
                    deliveredKg,
                    remainingValue: monthlyValueQuota - deliveredValue,
                    remainingKg: monthlyKgQuota - deliveredKg,
                });
            }
            data.set(item.name, itemMonthlyData);
        });

        return data;
    }, [supplier.contractItems, supplier.deliveries]);


    // Formatting helpers
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatKg = (value: number) => {
        return `${value.toFixed(2).replace('.', ',')} Kg`;
    };

    return (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Resumo do Contrato</h2>
            
            {/* General Summary */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pb-4 border-b text-sm">
                <span className="text-gray-500">Valor Total do Contrato:</span>
                <span className="font-bold text-gray-800 text-right">{formatCurrency(supplier.initialValue)}</span>
                
                <span className="text-gray-500">Peso Total do Contrato:</span>
                <span className="font-bold text-gray-800 text-right">{formatKg(totalContractedKg)}</span>

                <span className="text-gray-500">Valor Total Entregue:</span>
                <span className="font-bold text-green-600 text-right">{formatCurrency(totalDeliveredValue)}</span>

                <span className="text-gray-500">Peso Total Entregue:</span>
                <span className="font-bold text-green-600 text-right">{formatKg(totalDeliveredKg)}</span>
            </div>

            {/* Item Breakdown */}
            <div className="py-4 space-y-4">
                <h3 className="font-semibold text-gray-600">Detalhes por Produto</h3>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {supplier.contractItems.map(item => {
                        const itemMonthlyData = monthlyDataByItem.get(item.name) || [];
                        return (
                            <div key={item.name} className="p-3 bg-gray-50 rounded-lg text-sm">
                                <p className="font-bold text-gray-800 mb-2">{item.name}</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="p-2 text-left font-semibold text-gray-600">Mês</th>
                                                <th className="p-2 text-right font-semibold text-gray-600">Contratado</th>
                                                <th className="p-2 text-right font-semibold text-green-600">Entregue</th>
                                                <th className="p-2 text-right font-semibold text-blue-600">Restante</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemMonthlyData.map(data => (
                                                <tr key={data.monthName} className="border-t">
                                                    <td className="p-2 font-semibold">{data.monthName}</td>
                                                    <td className="p-2 text-right">
                                                        <div>{formatCurrency(data.contractedValue)}</div>
                                                        <div className="text-gray-500">{formatKg(data.contractedKg)}</div>
                                                    </td>
                                                    <td className="p-2 text-right text-green-600">
                                                        <div>{formatCurrency(data.deliveredValue)}</div>
                                                        <div className="text-gray-500">{formatKg(data.deliveredKg)}</div>
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-blue-600">
                                                         <div>{formatCurrency(data.remainingValue)}</div>
                                                        <div className="text-gray-500">{formatKg(data.remainingKg)}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
             {/* NEW CHART SECTION */}
            <div className="py-4 space-y-4 border-t">
                <h3 className="font-semibold text-gray-600">Progresso Geral</h3>
                <div className="space-y-4">
                    {/* Value Chart */}
                    <div>
                        <div className="flex justify-between items-baseline text-sm mb-1">
                            <span className="font-bold text-gray-700">Progresso Financeiro (R$)</span>
                            <span className="text-xs font-mono text-gray-500">{valueProgress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-5 relative overflow-hidden shadow-inner">
                           <div 
                                className="bg-green-500 h-5 rounded-full transition-all duration-500" 
                                style={{ width: `${valueProgress}%` }}
                            />
                             <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">{formatCurrency(totalDeliveredValue)}</span>
                        </div>
                    </div>

                    {/* KG Chart */}
                    <div>
                        <div className="flex justify-between items-baseline text-sm mb-1">
                            <span className="font-bold text-gray-700">Progresso de Entrega (Kg)</span>
                            <span className="text-xs font-mono text-gray-500">{kgProgress.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-5 relative overflow-hidden shadow-inner">
                            <div 
                                className="bg-blue-500 h-5 rounded-full transition-all duration-500" 
                                style={{ width: `${kgProgress}%` }}
                            />
                             <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">{formatKg(totalDeliveredKg)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Remaining */}
            <hr className="my-2"/>
            <div className="grid grid-cols-2 gap-x-4 pt-2">
                <span className="text-gray-500 font-semibold">Valor Total Restante:</span>
                <span className="font-bold text-xl text-blue-600 text-right">{formatCurrency(remainingValue)}</span>
                <span className="text-gray-500 font-semibold">Peso Total Restante:</span>
                <span className="font-bold text-xl text-blue-600 text-right">{formatKg(remainingKg)}</span>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default SummaryCard;