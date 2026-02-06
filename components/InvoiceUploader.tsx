
import React from 'react';
import type { Delivery } from '../types';

interface InvoiceUploaderProps {
  pendingInvoices: { date: string; deliveries: Delivery[] }[];
  onFulfill: (invoiceInfo: { date: string; deliveries: Delivery[] }) => void;
  onCancel: (deliveryIds: string[]) => void;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ pendingInvoices, onFulfill, onCancel }) => {
  
  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
  };

  const handleCancelClick = (date: string, deliveryIds: string[]) => {
    const formatted = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
    if (window.confirm(`Deseja realmente EXCLUIR o agendamento do dia ${formatted}? Esta ação não pode ser desfeita.`)) {
      onCancel(deliveryIds);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-orange-600">Entregas a Faturar</h2>
      <p className="text-xs text-gray-500 mb-4">
        As entregas agendadas que já passaram da data aparecerão aqui para você preencher os dados e enviar a nota fiscal ou excluir caso a entrega não tenha ocorrido.
      </p>
      
      <div className="space-y-3 max-h-80 overflow-y-auto border-t border-b py-2 pr-2 custom-scrollbar">
        {pendingInvoices.length > 0 ? (
          pendingInvoices.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(invoiceInfo => (
            <div key={invoiceInfo.date} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-100">
              <div className="flex flex-col gap-3">
                  <div>
                      <p className="font-bold text-gray-800 text-sm">
                        {formatDate(invoiceInfo.date)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase font-black">{invoiceInfo.deliveries.length} agendamento(s) pendente(s)</p>
                  </div>
                  <div className="flex gap-2">
                      <button
                          onClick={() => onFulfill(invoiceInfo)}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs shadow-sm active:scale-95"
                      >
                          Faturar Agora
                      </button>
                      <button
                          onClick={() => handleCancelClick(invoiceInfo.date, invoiceInfo.deliveries.map(d => d.id))}
                          className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-colors border border-red-100 active:scale-95"
                          title="Excluir agendamento não realizado"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                      </button>
                  </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-gray-400 italic py-4">Nenhuma entrega pendente.</p>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default InvoiceUploader;
