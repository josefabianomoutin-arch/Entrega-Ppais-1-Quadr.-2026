import React from 'react';
import type { Delivery } from '../types';

interface ViewDeliveryModalProps {
  date: Date;
  deliveries: Delivery[];
  onClose: () => void;
  onAddNew: () => void;
  onCancel: (deliveryIds: string[]) => void;
  simulatedToday: Date;
}

const ViewDeliveryModal: React.FC<ViewDeliveryModalProps> = ({ date, deliveries, onClose, onAddNew, onCancel, simulatedToday }) => {
  
  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const canCancel = new Date(date) >= simulatedToday;
  const invoiceNumber = deliveries[0]?.invoiceNumber;


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalValue = deliveries.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Entregas Agendadas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        <p className="text-gray-600">Data: <span className="font-semibold text-green-700">{formattedDate}</span></p>
        {invoiceNumber && <p className="mb-6 text-gray-600">Nota Fiscal: <span className="font-semibold font-mono text-blue-700">{invoiceNumber}</span></p>}
        
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4 border-t border-b py-2">
            {deliveries.length > 0 ? (
                deliveries.map(delivery => (
                    <div key={delivery.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-start text-sm">
                        <div>
                            <p className="font-bold text-gray-800">{delivery.item}</p>
                            <p className="text-xs text-gray-500">{delivery.kg} Kg</p>
                            {delivery.invoiceNumber && (
                                <p className="text-xs text-gray-500 mt-1">NF: <span className="font-mono bg-gray-200 px-1 rounded">{delivery.invoiceNumber}</span></p>
                            )}
                        </div>
                        <span className="font-semibold text-green-600 whitespace-nowrap pl-4">{formatCurrency(delivery.value)}</span>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-500">Nenhuma entrega para esta data.</p>
            )}
        </div>

        <div className="flex justify-between items-center pt-2 font-bold text-lg">
            <span className="text-gray-600">Valor Total do Dia:</span>
            <span className="text-blue-600">{formatCurrency(totalValue)}</span>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          {canCancel && (
            <button type="button" onClick={() => onCancel(deliveries.map(d => d.id))} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Cancelar Agendamentos</button>
          )}
          <button type="button" onClick={onAddNew} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Agendar Outra Entrega</button>
          <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">Fechar</button>
        </div>
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

export default ViewDeliveryModal;