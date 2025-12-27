import React, { useMemo } from 'react';
import type { Producer } from '../types';

interface SummaryCardProps {
    producer: Producer;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ producer }) => {
    const totalDeliveredValue = producer.deliveries.reduce((sum, delivery) => sum + delivery.value, 0);
    const remainingValue = producer.initialValue - totalDeliveredValue;

    const deliveredValueByItem = useMemo(() => {
        const valueMap = new Map<string, number>();
        producer.deliveries.forEach(delivery => {
            const currentVal = valueMap.get(delivery.item) || 0;
            valueMap.set(delivery.item, currentVal + delivery.value);
        });
        return valueMap;
    }, [producer.deliveries]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Resumo Financeiro</h2>
            
            {/* General Summary */}
            <div className="space-y-3 pb-4 border-b">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Valor Total do Contrato:</span>
                    <span className="font-bold text-gray-800">{formatCurrency(producer.initialValue)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Valor Total Entregue:</span>
                    <span className="font-bold text-green-600">{formatCurrency(totalDeliveredValue)}</span>
                </div>
            </div>

            {/* Item Breakdown */}
            <div className="py-4 space-y-4">
                <h3 className="font-semibold text-gray-600">Detalhes por Produto</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {producer.contractItems.map(item => {
                        const itemTotalValue = item.totalKg * item.valuePerKg;
                        const delivered = deliveredValueByItem.get(item.name) || 0;
                        const remaining = itemTotalValue - delivered;
                        return (
                            <div key={item.name} className="p-3 bg-gray-50 rounded-lg text-sm">
                                <p className="font-bold text-gray-800">{item.name}</p>
                                <div className="flex justify-between mt-1">
                                    <span className="text-gray-500">Contratado:</span>
                                    <span>{formatCurrency(itemTotalValue)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Entregue:</span>
                                    <span className="text-green-600">{formatCurrency(delivered)}</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <span className="text-gray-500">Restante:</span>
                                    <span className="text-blue-600">{formatCurrency(remaining)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Total Remaining */}
            <hr className="my-2"/>
            <div className="flex justify-between items-center pt-2">
                <span className="text-gray-500 font-semibold">Valor Total Restante:</span>
                <span className="font-bold text-2xl text-blue-600">{formatCurrency(remainingValue)}</span>
            </div>
        </div>
    );
};

export default SummaryCard;