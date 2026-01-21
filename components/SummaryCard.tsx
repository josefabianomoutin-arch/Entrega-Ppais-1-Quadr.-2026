import React, { useMemo } from 'react';
import type { Supplier } from '../types';

interface SummaryCardProps {
    supplier: Supplier;
}

// Helper para calcular o peso total real de um item de contrato
const getContractItemWeight = (item: Supplier['contractItems'][0]): number => {
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    
    // Para 'unidade', totalKg já é o peso total.
    if (unitType === 'un') {
        return item.totalKg;
    }
    
    // Para 'dúzia', não temos um peso definido, então retornamos 0 para o total de Kg.
    if (unitType === 'dz') {
        return 0;
    }

    // Para outros (kg, balde, saco), totalKg armazena a quantidade. Multiplicamos pelo peso da unidade.
    const quantity = item.totalKg;
    const unitWeight = parseFloat(unitWeightStr) || 1; // Padrão de 1 para 'kg-1'
    return quantity * unitWeight;
};


const SummaryCard: React.FC<SummaryCardProps> = ({ supplier }) => {
    // Value calculations
    const totalDeliveredValue = supplier.deliveries.reduce((sum, delivery) => sum + (delivery.value || 0), 0);
    const remainingValue = supplier.initialValue - totalDeliveredValue;
    const valueProgress = supplier.initialValue > 0 ? (totalDeliveredValue / supplier.initialValue) * 100 : 0;


    const deliveredValueByItem = useMemo(() => {
        const valueMap = new Map<string, number>();
        supplier.deliveries.forEach(delivery => {
            if (delivery.item && delivery.value) {
                const currentVal = valueMap.get(delivery.item) || 0;
                valueMap.set(delivery.item, currentVal + delivery.value);
            }
        });
        return valueMap;
    }, [supplier.deliveries]);

    // Weight (Kg) calculations
    const totalContractedKg = useMemo(() => {
        return supplier.contractItems.reduce((sum, item) => sum + getContractItemWeight(item), 0);
    }, [supplier.contractItems]);

    const totalDeliveredKg = supplier.deliveries.reduce((sum, delivery) => sum + (delivery.kg || 0), 0);
    const remainingKg = totalContractedKg - totalDeliveredKg;
    const kgProgress = totalContractedKg > 0 ? (totalDeliveredKg / totalContractedKg) * 100 : 0;

    const deliveredKgByItem = useMemo(() => {
        const kgMap = new Map<string, number>();
        supplier.deliveries.forEach(delivery => {
             if (delivery.item && delivery.kg) {
                const currentKg = kgMap.get(delivery.item) || 0;
                kgMap.set(delivery.item, currentKg + delivery.kg);
            }
        });
        return kgMap;
    }, [supplier.deliveries]);

    // Formatting helpers
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatKg = (value: number) => {
        return `${value.toFixed(2).replace('.', ',')} Kg`;
    };

    return (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Resumo Financeiro</h2>
            
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
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {supplier.contractItems.map(item => {
                        const [unitType] = (item.unit || 'kg-1').split('-');
                        const isUnitBased = unitType !== 'un';

                        const itemTotalValue = isUnitBased 
                            ? item.totalKg * item.valuePerKg  // quantity * value_per_unit
                            : item.totalKg * item.valuePerKg; // total_weight * value_per_kg (same formula, different meanings)

                        const deliveredValue = deliveredValueByItem.get(item.name) || 0;
                        const remainingItemValue = itemTotalValue - deliveredValue;

                        const itemTotalKg = getContractItemWeight(item);
                        const deliveredItemKg = deliveredKgByItem.get(item.name) || 0;
                        const remainingItemKg = itemTotalKg - deliveredItemKg;

                        return (
                            <div key={item.name} className="p-3 bg-gray-50 rounded-lg text-sm">
                                <p className="font-bold text-gray-800 mb-2">{item.name}</p>
                                <div className="grid grid-cols-3 gap-x-2 text-xs">
                                    {/* Headers */}
                                    <span className="font-semibold text-gray-500"></span>
                                    <span className="font-semibold text-gray-600 text-right">Valor</span>
                                    <span className="font-semibold text-gray-600 text-right">Peso</span>
                                    
                                    {/* Contracted */}
                                    <span className="text-gray-500">Contratado</span>
                                    <span className="text-right">{formatCurrency(itemTotalValue)}</span>
                                    <span className="text-right">{formatKg(itemTotalKg)}</span>

                                    {/* Delivered */}
                                    <span className="text-gray-500">Entregue</span>
                                    <span className="text-green-600 text-right">{formatCurrency(deliveredValue)}</span>
                                    <span className="text-green-600 text-right">{formatKg(deliveredItemKg)}</span>

                                    {/* Remaining */}
                                    <span className="text-gray-500 font-semibold">Restante</span>
                                    <span className="text-blue-600 font-semibold text-right">{formatCurrency(remainingItemValue)}</span>
                                    <span className="text-blue-600 font-semibold text-right">{formatKg(remainingItemKg)}</span>
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