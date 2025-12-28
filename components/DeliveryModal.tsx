import React, { useState } from 'react';
import type { ContractItem } from '../types';

interface DeliveryModalProps {
  date: Date;
  onClose: () => void;
  onSave: (deliveryData: { time: string; item: string; kg: number; value: number }[], invoiceNumber: string) => void;
  contractItems: ContractItem[];
}

const DeliveryModal: React.FC<DeliveryModalProps> = ({ date, onClose, onSave, contractItems }) => {
  const [time, setTime] = useState('08:00');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [itemInputs, setItemInputs] = useState(
    contractItems.map(() => ({ kg: '', value: '' }))
  );

  const handleKgChange = (index: number, kgValue: string) => {
    const newInputs = [...itemInputs];
    let calculatedValue = '';

    const contractItem = contractItems[index];
    if (contractItem) {
        const kgNumber = parseFloat(kgValue);
        if (!isNaN(kgNumber) && kgNumber >= 0) {
            const totalValue = kgNumber * contractItem.valuePerKg;
            calculatedValue = totalValue.toFixed(2);
        }
    }
    
    newInputs[index] = { kg: kgValue, value: calculatedValue };
    setItemInputs(newInputs);
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
    
    itemInputs.forEach((input, index) => {
      const kgNumber = parseFloat(input.kg);
      const valueNumber = parseFloat(input.value);
      
      if (input.kg && !isNaN(kgNumber) && kgNumber > 0 && !isNaN(valueNumber)) {
        deliveriesToSave.push({
          time,
          item: contractItems[index].name,
          kg: kgNumber,
          value: valueNumber,
        });
      }
    });

    if (deliveriesToSave.length > 0) {
      onSave(deliveriesToSave, invoiceNumber);
    } else {
      alert('Por favor, preencha o campo de quilograma para pelo menos um item.');
    }
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
            <label className="block text-sm font-medium text-gray-700">Itens a serem entregues</label>
            <div className="space-y-4 max-h-64 overflow-y-auto p-2 border rounded-md bg-gray-50">
                {contractItems.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Nenhum item de contrato encontrado.</p>
                ) : (
                    contractItems.map((contractItem, index) => (
                      <div key={contractItem.name} className="p-3 border rounded-lg bg-white shadow-sm">
                          <div className="flex justify-between items-baseline mb-2">
                            <p className="font-semibold text-gray-800">{contractItem.name}</p>
                            <p className="text-xs text-gray-500">Valor/Kg: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contractItem.valuePerKg)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label htmlFor={`kg-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Quilograma (Kg)</label>
                                  <input type="number" id={`kg-${index}`} value={itemInputs[index].kg} onChange={e => handleKgChange(index, e.target.value)} min="0.01" step="0.01" placeholder="Ex: 50.5" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"/>
                              </div>
                              <div>
                                  <label htmlFor={`value-${index}`} className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
                                  <input type="number" id={`value-${index}`} value={itemInputs[index].value} readOnly placeholder="Calculado" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"/>
                              </div>
                          </div>
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