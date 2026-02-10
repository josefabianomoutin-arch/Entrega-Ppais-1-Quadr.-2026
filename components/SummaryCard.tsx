
import React, { useMemo } from 'react';
import type { Supplier } from '../types';
import { MONTHS_2026 } from '../constants';

interface SummaryCardProps {
    supplier: Supplier;
}

const getContractItemDisplayInfo = (item: Supplier['contractItems'][0]): { quantity: number; unit: string } => {
    if (!item) return { quantity: 0, unit: 'N/A' };
    
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    const contractQuantity = item.totalKg || 0;
    const unitWeight = parseFloat(unitWeightStr) || 1;

    let displayQuantity = contractQuantity;
    let displayUnit = 'Un';

    switch (unitType) {
        case 'kg':
        case 'un':
            displayQuantity = contractQuantity;
            displayUnit = 'Kg';
            break;
        case 'saco':
        case 'balde':
        case 'pacote':
        case 'pote':
            displayQuantity = contractQuantity * unitWeight;
            displayUnit = 'Kg';
            break;
        case 'litro':
        case 'l':
        case 'caixa':
        case 'embalagem':
            displayQuantity = contractQuantity * unitWeight;
            displayUnit = 'L';
            break;
        case 'dz':
            displayQuantity = contractQuantity;
            displayUnit = 'Dz';
            break;
        default:
            displayQuantity = contractQuantity;
            displayUnit = 'Un';
    }
    return { quantity: displayQuantity, unit: displayUnit };
};

const formatQuantity = (quantity: number, unit: string): string => {
    const options: Intl.NumberFormatOptions = {
        minimumFractionDigits: (unit === 'Dz' || unit === 'Un') ? 0 : 2,
        maximumFractionDigits: (unit === 'Dz' || unit === 'Un') ? 0 : 2,
    };
    return `${quantity.toLocaleString('pt-BR', options)} ${unit}`;
};

const SummaryCard: React.FC<SummaryCardProps> = ({ supplier }) => {
    const totalDeliveredValue = supplier.deliveries.reduce((sum, delivery) => sum + (delivery.value || 0), 0);
    const valueProgress = supplier.initialValue > 0 ? (totalDeliveredValue / supplier.initialValue) * 100 : 0;

    const aggregatedTotals = useMemo(() => {
        const contracted = new Map<string, number>();
        const delivered = new Map<string, number>();

        supplier.contractItems.forEach(item => {
            const { quantity, unit } = getContractItemDisplayInfo(item);
            contracted.set(unit, (contracted.get(unit) || 0) + quantity);
        });

        supplier.deliveries.forEach(delivery => {
            if (!delivery.item || (delivery.kg || 0) === 0) return;
            const contractItem = supplier.contractItems.find(ci => ci.name === delivery.item);
            if (contractItem) {
                const { unit } = getContractItemDisplayInfo(contractItem);
                delivered.set(unit, (delivered.get(unit) || 0) + (delivery.kg || 0));
            }
        });
        return { contracted, delivered };
    }, [supplier]);

    const totalContractedKgForProgress = aggregatedTotals.contracted.get('Kg') || 0;
    const totalDeliveredKgForProgress = aggregatedTotals.delivered.get('Kg') || 0;
    const kgProgress = totalContractedKgForProgress > 0 ? (totalDeliveredKgForProgress / totalContractedKgForProgress) * 100 : 0;

    const monthlyDataByItem = useMemo(() => {
        const data = new Map<string, any[]>();
        
        supplier.contractItems.forEach(item => {
            const itemMonthlyData = [];
            const { quantity: itemTotalQuantity, unit: itemUnit } = getContractItemDisplayInfo(item);
            const itemTotalValue = (item.totalKg || 0) * (item.valuePerKg || 0);
            
            const monthlyValueQuota = itemTotalValue / 4;
            const monthlyQuantityQuota = itemTotalQuantity / 4;

            for (const month of MONTHS_2026) {
                const deliveredInMonth = supplier.deliveries.filter(d => {
                    if (d.item !== item.name) return false;
                    
                    // EXTRAÇÃO SEGURA DE MÊS DA STRING ISO (YYYY-MM-DD)
                    const parts = d.date.split('-');
                    if (parts.length < 2) return false;
                    
                    const monthNumber = parseInt(parts[1], 10); // Janeiro = 1
                    
                    // Janeiro é 01, mas no constants.ts Janeiro é 0 (index).
                    return (monthNumber - 1) === month.number;
                });
                
                const deliveredValue = deliveredInMonth.reduce((sum, d) => sum + (d.value || 0), 0);
                const deliveredQuantity = deliveredInMonth.reduce((sum, d) => sum + (d.kg || 0), 0);

                itemMonthlyData.push({
                    monthName: month.name,
                    contractedValue: monthlyValueQuota,
                    contractedQuantity: monthlyQuantityQuota,
                    deliveredValue,
                    deliveredQuantity,
                    remainingValue: monthlyValueQuota - deliveredValue,
                    remainingQuantity: monthlyQuantityQuota - deliveredQuantity,
                    unit: itemUnit,
                });
            }
            data.set(item.name, itemMonthlyData);
        });

        return data;
    }, [supplier.contractItems, supplier.deliveries]);


    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Resumo do Contrato</h2>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pb-4 border-b text-sm">
                <span className="text-gray-500">Valor Total do Contrato:</span>
                <span className="font-bold text-gray-800 text-right">{formatCurrency(supplier.initialValue)}</span>

                {Array.from(aggregatedTotals.contracted.entries()).sort().map(([unit, quantity]) => (
                    <React.Fragment key={`contracted-${unit}`}>
                        <span className="text-gray-500">Total Contratado ({unit}):</span>
                        <span className="font-bold text-gray-800 text-right">{formatQuantity(quantity, unit)}</span>
                    </React.Fragment>
                ))}
                
                <span className="text-gray-500 col-span-2 my-1"></span>

                <span className="text-gray-500">Valor Total Entregue:</span>
                <span className="font-bold text-green-600 text-right">{formatCurrency(totalDeliveredValue)}</span>
                
                {Array.from(aggregatedTotals.delivered.entries()).sort().map(([unit, quantity]) => (
                    <React.Fragment key={`delivered-${unit}`}>
                        <span className="text-gray-500">Total Entregue ({unit}):</span>
                        <span className="font-bold text-green-600 text-right">{formatQuantity(quantity, unit)}</span>
                    </React.Fragment>
                ))}
            </div>

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
                                                        <div className="text-gray-500">{formatQuantity(data.contractedQuantity, data.unit)}</div>
                                                    </td>
                                                    <td className="p-2 text-right text-green-600">
                                                        <div>{formatCurrency(data.deliveredValue)}</div>
                                                        <div className="text-gray-500">{formatQuantity(data.deliveredQuantity, data.unit)}</div>
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-blue-600">
                                                         <div>{formatCurrency(data.remainingValue)}</div>
                                                        <div className="text-gray-500">{formatQuantity(data.remainingQuantity, data.unit)}</div>
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
            
            <div className="py-4 space-y-4 border-t">
                <h3 className="font-semibold text-gray-600">Progresso Geral</h3>
                <div className="space-y-4">
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
                             <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">{formatQuantity(totalDeliveredKgForProgress, 'Kg')}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <hr className="my-2"/>
            <div className="grid grid-cols-2 gap-x-4 pt-2">
                <span className="text-gray-500 font-semibold">Valor Total Restante:</span>
                <span className="font-bold text-xl text-blue-600 text-right">{formatCurrency(supplier.initialValue - totalDeliveredValue)}</span>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default SummaryCard;
