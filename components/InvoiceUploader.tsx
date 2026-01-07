import React from 'react';
import type { Delivery } from '../types';

interface InvoiceUploaderProps {
  pendingDeliveries: Delivery[];
  onFulfill: (delivery: Delivery) => void;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ pendingDeliveries, onFulfill }) => {
  
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-orange-600">Entregas a Faturar</h2>
      <p className="text-xs text-gray-500 mb-4">
        As entregas agendadas que já passaram da data aparecerão aqui para você preencher os dados e enviar a nota fiscal.
      </p>
      
      <div className="space-y-3 max-h-60 overflow-y-auto border-t border-b py-2 pr-2">
        {pendingDeliveries.length > 0 ? (
          pendingDeliveries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(delivery => (
            <div key={delivery.id} className="p-3 bg-gray-50 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                  <div>
                      <p className="font-bold text-gray-800 text-sm">
                        {formatDate(delivery.date)}
                      </p>
                      <p className="text-xs text-gray-500">Horário agendado: {delivery.time}</p>
                  </div>
                  <button
                      onClick={() => onFulfill(delivery)}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs"
                  >
                      Preencher e Faturar
                  </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-gray-400 italic py-4">Nenhuma entrega pendente.</p>
        )}
      </div>
    </div>
  );
};

export default InvoiceUploader;
