
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';

interface AdminScheduleViewProps {
  suppliers: Supplier[];
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};

const AdminScheduleView: React.FC<AdminScheduleViewProps> = ({ suppliers, onCancelDeliveries }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [suppliers, searchTerm]);
    
    const sortedSuppliers = useMemo(() => {
        return [...filteredSuppliers].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredSuppliers]);

    const handleCancel = (supplierCpf: string, deliveryId: string, date: string) => {
        if (window.confirm(`Deseja realmente REMOVER o agendamento do dia ${formatDate(date)}?`)) {
            onCancelDeliveries(supplierCpf, [deliveryId]);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-purple-600 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Agenda de Entregas</h2>
                    <p className="text-gray-400 font-medium">Visualize as semanas e gerencie os agendamentos de cada fornecedor.</p>
                </div>
                <input
                    type="text"
                    placeholder="Pesquisar fornecedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                />
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                {sortedSuppliers.length > 0 ? sortedSuppliers.map(supplier => {
                    const sortedDeliveries = [...(supplier.deliveries || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const pendingDeliveries = sortedDeliveries.filter(d => d.item === 'AGENDAMENTO PENDENTE');
                    const realDeliveries = sortedDeliveries.filter(d => d.item !== 'AGENDAMENTO PENDENTE');

                    return (
                        <div key={supplier.cpf} className="p-5 border rounded-2xl bg-gray-50/50 hover:bg-white transition-all border-l-8 border-l-purple-400">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-black text-lg text-purple-900 uppercase">{supplier.name}</h3>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block">Total Agendados</span>
                                    <span className="font-mono font-bold text-gray-600">{sortedDeliveries.length} dia(s)</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-4 rounded-xl border shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase text-orange-500 mb-3 tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                                        Agendamentos Pendentes de Dados
                                    </h4>
                                    {pendingDeliveries.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {pendingDeliveries.map(delivery => (
                                                <div key={delivery.id} className="flex items-center gap-2 bg-orange-100 text-orange-800 text-xs font-black px-3 py-1.5 rounded-xl border border-orange-200">
                                                    <span className="font-mono">{formatDate(delivery.date)}</span>
                                                    <button 
                                                        onClick={() => handleCancel(supplier.cpf, delivery.id, delivery.date)}
                                                        className="hover:bg-orange-600 hover:text-white bg-white/50 rounded-lg p-1 text-orange-600 transition-all border border-orange-200"
                                                        title="Limpar agendamento"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Nenhum agendamento pendente.</p>
                                    )}
                                </div>
                                <div className="bg-white p-4 rounded-xl border shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase text-green-500 mb-3 tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        Faturamentos Concluídos
                                    </h4>
                                    {realDeliveries.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {realDeliveries.map(delivery => (
                                                <div key={delivery.id} className="flex items-center gap-2 bg-green-50 text-green-700 text-xs font-black px-3 py-1.5 rounded-xl border border-green-200">
                                                    <span className="font-mono">{formatDate(delivery.date)}</span>
                                                    <span className="text-[10px] opacity-60">NF {delivery.invoiceNumber}</span>
                                                    <button 
                                                        onClick={() => handleCancel(supplier.cpf, delivery.id, delivery.date)}
                                                        className="hover:bg-red-600 hover:text-white bg-white/50 rounded-lg p-1 text-red-400 transition-all border border-red-100"
                                                        title="Excluir faturamento"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Nenhum faturamento registrado.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-20"><p className="text-gray-400 italic">Nenhum fornecedor encontrado.</p></div>
                )}
            </div>
             <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }`}</style>
        </div>
    );
};

export default AdminScheduleView;
