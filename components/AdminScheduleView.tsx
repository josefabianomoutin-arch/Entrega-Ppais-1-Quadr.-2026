
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';

interface AdminScheduleViewProps {
  suppliers: Supplier[];
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Ensure correct timezone handling
    return date.toLocaleDateString('pt-BR');
};

const AdminScheduleView: React.FC<AdminScheduleViewProps> = ({ suppliers, onCancelDeliveries }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [suppliers, searchTerm]);
    
    // Sort suppliers alphabetically for consistent order
    const sortedSuppliers = useMemo(() => {
        return [...filteredSuppliers].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredSuppliers]);

    const handleCancel = (supplierCpf: string, deliveryId: string, date: string) => {
        if (window.confirm(`Deseja realmente remover o agendamento do dia ${formatDate(date)}?`)) {
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
                    className="w-full sm:w-auto border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                />
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                {sortedSuppliers.length > 0 ? sortedSuppliers.map(supplier => {
                    const sortedDeliveries = [...(supplier.deliveries || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    return (
                        <div key={supplier.cpf} className="p-5 border rounded-xl bg-gray-50/50 hover:bg-white transition-shadow hover:shadow-md">
                            <h3 className="font-bold text-lg text-gray-800 mb-4">{supplier.name}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-4 rounded-lg border">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Semanas Disponibilizadas</h4>
                                    {supplier.allowedWeeks && supplier.allowedWeeks.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {supplier.allowedWeeks.sort((a, b) => a - b).map(week => (
                                                <span key={week} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                                                    Semana {week}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Nenhuma restrição de semana.</p>
                                    )}
                                </div>
                                <div className="bg-white p-4 rounded-lg border">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Agendamentos Confirmados</h4>
                                    {sortedDeliveries.length > 0 ? (
                                        <div className="flex flex-wrap gap-3">
                                            {sortedDeliveries.map(delivery => (
                                                <div key={delivery.id} className="flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold pl-2.5 pr-1 py-1 rounded-full font-mono border border-green-200">
                                                    <span>{formatDate(delivery.date)}</span>
                                                    <button 
                                                        onClick={() => handleCancel(supplier.cpf, delivery.id, delivery.date)}
                                                        className="hover:bg-green-200 rounded-full p-0.5 text-green-600 transition-colors"
                                                        title="Remover agendamento"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Nenhum agendamento realizado.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-20">
                        <p className="text-gray-400 italic">Nenhum fornecedor encontrado.</p>
                    </div>
                )}
            </div>
             <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 8px; } 
                .custom-scrollbar::-webkit-scrollbar-track { background: #F9FAFB; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; border: 2px solid #F9FAFB; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a78bfa; }
             `}</style>
        </div>
    );
};

export default AdminScheduleView;
