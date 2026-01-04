import React, { useState, useMemo } from 'react';
import type { ContractItem, Delivery } from '../types';

interface DeliveryModalProps {
  date: Date;
  onClose: () => void;
  onSave: (deliveryData: { time: string; item: string; kg: number; value: number }[], invoiceNumber: string) => void;
  contractItems: ContractItem[];
  deliveries: Delivery[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const DeliveryModal: React.FC<DeliveryModalProps> = ({ date, onClose, onSave, contractItems, deliveries }) => {
  const [time, setTime] = useState('08:00');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  const selectedMonth = date.getMonth();

  const itemDeliveryInfo = useMemo(() => {
    return contractItems.map(item => {
      const monthlyQuotaKg = item.totalKg / 4;
      
      const hasDeliveredInMonth = deliveries.some(d => 
        d.item === item.name && new Date(d.date + 'T00:00:00').getMonth() === selectedMonth
      );

      const deliveryAmountKg = monthlyQuotaKg;
      const deliveryAmountValue = monthlyQuotaKg * item.valuePerKg;

      return {
        name: item.name,
        isQuotaMet: hasDeliveredInMonth,
        deliveryAmountKg,
        deliveryAmountValue,
        valuePerKg: item.valuePerKg
      };
    });
  }, [contractItems, deliveries, selectedMonth]);

  const handleToggleItem = (itemName: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (time < '08:00' || time > '16:00') {
      alert('O horário da entrega deve ser entre 08:00 e 16:00.');
      return;
    }

    if (!invoiceNumber.trim()) {
      alert('Por favor, insira o número da nota fiscal.');
      return;
    }

    const deliveriesToSave: { time: string; item: string; kg: number; value: number }[] = [];
    
    itemDeliveryInfo.forEach(itemInfo => {
      if (selectedItems[itemInfo.name] && !itemInfo.isQuotaMet) {
        deliveriesToSave.push({
          time,
          item: itemInfo.name,
          kg: itemInfo.deliveryAmountKg,
          value: itemInfo.deliveryAmountValue,
        });
      }
    });

    if (deliveriesToSave.length === 0) {
      alert('Por favor, selecione pelo menos um item para entregar.');
      return;
    }
    
    onSave(deliveriesToSave, invoiceNumber);
  };
  
  const formattedDate = date.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Agendar Entrega</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        <p className="mb-6 text-gray-600">Data selecionada: <span className="font-semibold text-green-700">{formattedDate}</span></p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
           <div>
            <label htmlFor="invoice-number" className="block text-sm font-medium text-gray-700">Número da Nota Fiscal (para todos os itens)</label>
            <input type="text" id="invoice-number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required placeholder="Ex: 001234" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
          </div>

          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700">Horário da Entrega (08:00 às 16:00)</label>
            <input 
              type="time" 
              id="time" 
              value={time} 
              onChange={e => setTime(e.target.value)} 
              required 
              min="08:00"
              max="16:00"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
          
          <div className="space-y-4 pt-2">
            <label className="block text-sm font-medium text-gray-700">Selecione os itens para entregar (cota mensal)</label>
            <div className="space-y-4 max-h-64 overflow-y-auto p-2 border rounded-md bg-gray-50">
                {contractItems.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Nenhum item de contrato encontrado.</p>
                ) : (
                    itemDeliveryInfo.map((itemInfo, index) => (
                      <div key={itemInfo.name} className={`p-3 border rounded-lg bg-white shadow-sm transition-all ${itemInfo.isQuotaMet ? 'bg-gray-200 opacity-70' : ''}`}>
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                  <input
                                      type="checkbox"
                                      id={`checkbox-${index}`}
                                      checked={!!selectedItems[itemInfo.name]}
                                      onChange={() => handleToggleItem(itemInfo.name)}
                                      disabled={itemInfo.isQuotaMet}
                                      className="h-5 w-5 rounded text-green-600 focus:ring-green-500 border-gray-300 disabled:cursor-not-allowed"
                                  />
                                  <label htmlFor={`checkbox-${index}`} className={`font-semibold text-gray-800 ${itemInfo.isQuotaMet ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    {itemInfo.name}
                                  </label>
                              </div>
                              <p className="text-xs text-gray-500 whitespace-nowrap pl-2">Valor/Kg: {formatCurrency(itemInfo.valuePerKg)}</p>
                          </div>

                          {itemInfo.isQuotaMet ? (
                            <p className="text-center text-sm font-semibold text-green-700 py-2">Cota do mês completa!</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 mt-2 pl-8">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Quilograma (Kg)</label>
                                    <input type="text" readOnly value={itemInfo.deliveryAmountKg.toFixed(2).replace('.', ',')} className="mt-1 block w-full px-3 py-2 border-gray-200 rounded-md shadow-sm bg-gray-100 cursor-default sm:text-sm font-mono"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
                                    <input type="text" readOnly value={formatCurrency(itemInfo.deliveryAmountValue)} className="mt-1 block w-full px-3 py-2 border-gray-200 rounded-md shadow-sm bg-gray-100 cursor-default sm:text-sm font-mono"/>
                                </div>
                            </div>
                          )}
                      </div>
                    ))
                )}
            </div>
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Salvar Agendamento</button>
          </div>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DeliveryModal;