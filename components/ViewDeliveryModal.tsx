
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
      <div className="bg-white rounded-[2rem] shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up overflow-hidden">
        
        {/* Header Fixo */}
        <div className="p-6 md:p-8 border-b border-gray-50 flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Detalhes do Dia</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-800 text-3xl font-light">&times;</button>
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                Data: <span className="text-green-700">{formattedDate}</span>
            </p>
            {invoiceNumber && (
                <p className="text-[10px] font-black text-indigo-400 uppercase mt-2">
                    Nota Fiscal vinculada: <span className="text-indigo-700 font-mono">{invoiceNumber}</span>
                </p>
            )}
        </div>
        
        {/* Conteúdo com Rolagem */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
            <div className="space-y-4">
                {deliveries.length > 0 ? (
                    deliveries.map(delivery => {
                        if (delivery.item === 'AGENDAMENTO PENDENTE') {
                            return (
                                <div key={delivery.id} className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-blue-900 text-sm uppercase">Agendado p/ {delivery.time}</p>
                                            <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">{isPast ? 'Aguardando Lançamento NF' : 'Entrega Futura'}</p>
                                        </div>
                                        {isPast && (
                                            <button 
                                                onClick={() => onFulfill({ date: dateString, deliveries: [delivery] })}
                                                className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl shadow-lg active:scale-95 transition-all"
                                            >
                                                Faturar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={delivery.id} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-start text-sm border border-gray-100 shadow-sm">
                                <div>
                                    <p className="font-black text-gray-800 uppercase text-xs">{delivery.item}</p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{(delivery.kg || 0).toFixed(2).replace('.', ',')} Kg</p>
                                </div>
                                <span className="font-black text-green-700 whitespace-nowrap pl-4">{formatCurrency(delivery.value || 0)}</span>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-gray-500 py-10 italic">Nenhuma entrega para esta data.</p>
                )}
            </div>

            {totalValue > 0 && (
                <div className="flex justify-between items-center mt-6 pt-6 border-t font-black text-lg">
                    <span className="text-gray-400 uppercase text-xs">Total do Período</span>
                    <span className="text-indigo-700">{formatCurrency(totalValue)}</span>
                </div>
            )}

            {needsInvoice && (
                <div className="mt-6 bg-red-50 p-4 rounded-2xl border-2 border-dashed border-red-200 animate-pulse">
                    <p className="text-red-700 text-[10px] font-black text-center uppercase tracking-widest flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Ação Necessária: Faturar Entrega
                    </p>
                </div>
            )}
        </div>

        {/* Footer Fixo */}
        <div className="p-6 md:p-8 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex flex-col gap-3">
                {needsInvoice && (
                    <button 
                        type="button" 
                        onClick={() => onFulfill({ date: dateString, deliveries: placeholderDeliveries })}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl uppercase tracking-widest text-sm active:scale-95"
                    >
                        Faturar Todo o Dia
                    </button>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                    {!isPast && (
                        <button type="button" onClick={onAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-md">Novo Horário</button>
                    )}
                    {canCancel && (
                        <button type="button" onClick={() => onCancel(placeholderDeliveries.map(d => d.id))} className="bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest border border-red-100">Excluir Tudo</button>
                    )}
                    <button type="button" onClick={onClose} className={`bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest ${!canCancel && isPast ? 'col-span-2' : ''}`}>Fechar</button>
                </div>
            </div>
        </div>
      </div>
       <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default ViewDeliveryModal;
