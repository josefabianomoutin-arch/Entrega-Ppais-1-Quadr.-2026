
import React from 'react';
import type { Delivery } from '../types';

interface ViewDeliveryModalProps {
  date: Date;
  deliveries: Delivery[];
  onClose: () => void;
  onAddNew: () => void;
  onCancel: (deliveryIds: string[]) => void;
  onFulfill: (invoiceInfo: { date: string; deliveries: Delivery[] }) => void;
  simulatedToday: Date;
}

const ViewDeliveryModal: React.FC<ViewDeliveryModalProps> = ({ date, deliveries, onClose, onAddNew, onCancel, onFulfill, simulatedToday }) => {
  
  const dateString = date.toISOString().split('T')[0];
  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const invoiceNumber = deliveries.find(d => d.invoiceNumber)?.invoiceNumber;
  
  const placeholderDeliveries = deliveries.filter(d => d.item === 'AGENDAMENTO PENDENTE');
  const isPast = date < simulatedToday;
  const canCancel = !invoiceNumber && placeholderDeliveries.length > 0;
  const needsInvoice = isPast && placeholderDeliveries.length > 0;


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const totalValue = deliveries.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Detalhes do Dia</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        <p className="text-gray-600">Data: <span className="font-semibold text-green-700">{formattedDate}</span></p>
        
        <div className="flex justify-between items-baseline mb-6">
            {invoiceNumber && <p className="text-gray-600">Nota Fiscal: <span className="font-semibold font-mono text-blue-700">{invoiceNumber}</span></p>}
        </div>
        
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4 border-t border-b py-2">
            {deliveries.length > 0 ? (
                deliveries.map(delivery => {
                    if (delivery.item === 'AGENDAMENTO PENDENTE') {
                        return (
                            <div key={delivery.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-blue-800">Agendamento das {delivery.time}</p>
                                        <p className="text-xs text-blue-600">{isPast ? 'Entrega concluída, aguardando NF.' : 'Aguardando data da entrega.'}</p>
                                    </div>
                                    {isPast && (
                                        <button 
                                            onClick={() => onFulfill({ date: dateString, deliveries: [delivery] })}
                                            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm"
                                        >
                                            Faturar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={delivery.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-start text-sm border border-gray-100">
                            <div>
                                <p className="font-bold text-gray-800">{delivery.item}</p>
                                <p className="text-xs text-gray-500">{(delivery.kg || 0).toFixed(2).replace('.', ',')} Kg</p>
                            </div>
                            <span className="font-semibold text-green-600 whitespace-nowrap pl-4">{formatCurrency(delivery.value || 0)}</span>
                        </div>
                    );
                })
            ) : (
                <p className="text-center text-gray-500">Nenhuma entrega para esta data.</p>
            )}
        </div>

        {totalValue > 0 && (
            <div className="flex justify-between items-center pt-2 font-bold text-lg">
                <span className="text-gray-600">Total Faturado:</span>
                <span className="text-blue-600">{formatCurrency(totalValue)}</span>
            </div>
        )}

        {needsInvoice && (
            <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
                <p className="text-red-700 text-xs font-bold text-center uppercase tracking-tighter">⚠️ Esta entrega precisa ser faturada!</p>
            </div>
        )}

        <div className="pt-6 flex flex-col gap-2">
          {needsInvoice && (
             <button 
                type="button" 
                onClick={() => onFulfill({ date: dateString, deliveries: placeholderDeliveries })}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-all shadow-lg uppercase tracking-widest text-sm"
            >
                Faturar Todo o Dia
            </button>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            {!isPast && (
                <button type="button" onClick={onAddNew} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider">Agendar Novo</button>
            )}
            {canCancel && (
                <button type="button" onClick={() => onCancel(placeholderDeliveries.map(d => d.id))} className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 rounded-lg text-xs uppercase tracking-wider">Excluir Tudo</button>
            )}
             <button type="button" onClick={onClose} className={`bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded-lg text-xs uppercase tracking-wider ${!canCancel && isPast ? 'col-span-2' : ''}`}>Fechar</button>
          </div>
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
