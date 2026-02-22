
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
        case 'kg': case 'un': displayQuantity = contractQuantity; displayUnit = 'Kg'; break;
        case 'saco': case 'balde': case 'pacote': case 'pote': displayQuantity = contractQuantity * unitWeight; displayUnit = 'Kg'; break;
        case 'litro': case 'l': case 'caixa': case 'embalagem': displayQuantity = contractQuantity * unitWeight; displayUnit = 'L'; break;
        case 'dz': displayQuantity = contractQuantity; displayUnit = 'Dz'; break;
        default: displayQuantity = contractQuantity; displayUnit = 'Un';
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
            for (const month of MONTHS_2026) {
                const isWithinContract = month.number <= 3; // Jan to Apr
                const monthlyValueQuota = isWithinContract ? itemTotalValue / 4 : 0;
                const monthlyQuantityQuota = isWithinContract ? itemTotalQuantity / 4 : 0;

                const deliveredInMonth = supplier.deliveries.filter(d => {
                    if (d.item !== item.name) return false;
                    const parts = d.date.split('-');
                    if (parts.length < 2) return false;
                    const monthNumber = parseInt(parts[1], 10);
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

    return (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Contrato 1º Quadr. 2026</h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {supplier.contractItems.map(item => {
                    const itemMonthlyData = monthlyDataByItem.get(item.name) || [];
                    return (
                        <div key={item.name} className="p-3 bg-gray-50 rounded-lg text-sm border">
                            <p className="font-bold text-gray-800 mb-2 uppercase">{item.name}</p>
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-500 font-black uppercase">
                                        <th className="p-1 text-left">Mês</th>
                                        <th className="p-1 text-right">Meta</th>
                                        <th className="p-1 text-right text-green-600">Real</th>
                                        <th className="p-1 text-right text-blue-600">Resto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemMonthlyData.map(data => (
                                        <tr key={data.monthName} className="border-t">
                                            <td className="p-1 font-bold">{data.monthName}</td>
                                            <td className="p-1 text-right">{formatQuantity(data.contractedQuantity, data.unit)}</td>
                                            <td className="p-1 text-right text-green-600 font-bold">{formatQuantity(data.deliveredQuantity, data.unit)}</td>
                                            <td className="p-1 text-right text-blue-600 font-bold">{formatQuantity(data.remainingQuantity, data.unit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 pt-4 border-t space-y-2">
                 <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">VALOR TOTAL:</span>
                    <span className="font-black text-green-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(supplier.initialValue)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${valueProgress}%` }} />
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }`}</style>
        </div>
    );
};

export default SummaryCard;
