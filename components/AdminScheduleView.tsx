import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';

interface AdminScheduleViewProps {
  suppliers: Supplier[];
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};

const AdminScheduleView: React.FC<AdminScheduleViewProps> = ({ suppliers, onCancelDeliveries }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(p => {
            const nameMatch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const dateMatch = !dateFilter || (p.deliveries || []).some(d => d.date === dateFilter);
            return nameMatch && dateMatch;
        });
    }, [suppliers, searchTerm, dateFilter]);
    
    const sortedSuppliers = useMemo(() => {
        return [...filteredSuppliers].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredSuppliers]);

    const handleCancelGroup = (supplierCpf: string, ids: string[], date: string, nf: string) => {
        if (window.confirm(`ATENÇÃO: Deseja realmente EXCLUIR o registro da NF ${nf} do dia ${formatDate(date)}?\n\nEsta ação removerá todos os itens vinculados a esta nota.`)) {
            onCancelDeliveries(supplierCpf, ids);
        }
    };

    const handleCancelSingle = (supplierCpf: string, deliveryId: string, date: string) => {
        if (window.confirm(`Deseja excluir o agendamento do dia ${formatDate(date)}?`)) {
            onCancelDeliveries(supplierCpf, [deliveryId]);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-purple-600 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Agenda de Entregas</h2>
                    <p className="text-gray-400 font-medium">Gerencie agendamentos e faturamentos agrupados por Nota Fiscal.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Pesquisar Fornecedor</label>
                        <input
                            type="text"
                            placeholder="Ex: Dominato..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filtrar por Data</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all bg-white"
                        />
                    </div>
                    {dateFilter && (
                        <button onClick={() => setDateFilter('')} className="mt-5 text-xs text-purple-600 font-bold hover:underline">Limpar Data</button>
                    )}
                </div>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                {sortedSuppliers.length > 0 ? sortedSuppliers.map(supplier => {
                    const displayDeliveries = (supplier.deliveries || []).filter(d => !dateFilter || d.date === dateFilter);
                    
                    // Separa os agendamentos pendentes (itens sem descrição real ainda)
                    const pendingDeliveries = displayDeliveries.filter(d => d.item === 'AGENDAMENTO PENDENTE');
                    
                    // Lógica de agrupamento manual por Nota Fiscal (Sem usar hooks dentro do map)
                    const realDeliveries = displayDeliveries.filter(d => d.item !== 'AGENDAMENTO PENDENTE');
                    const invoiceGroups: Record<string, { date: string; nf: string; ids: string[] }> = {};
                    
                    realDeliveries.forEach(d => {
                        const nf = (d.invoiceNumber || 'S/N').trim().toUpperCase();
                        const key = `${d.date}-${nf}`;
                        if (!invoiceGroups[key]) {
                            invoiceGroups[key] = { date: d.date, nf: nf, ids: [] };
                        }
                        invoiceGroups[key].ids.push(d.id);
                    });
                    
                    const groupedInvoices = Object.values(invoiceGroups).sort((a, b) => 
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                    return (
                        <div key={supplier.cpf} className="p-5 border rounded-2xl bg-gray-50/50 hover:bg-white transition-all border-l-8 border-l-purple-400 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-black text-lg text-purple-900 uppercase">{supplier.name}</h3>
                                    <p className="text-[10px] font-mono text-gray-400">{supplier.cpf}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block">Registros Únicos</span>
                                    <span className="font-mono font-bold text-purple-600">{pendingDeliveries.length + groupedInvoices.length}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Coluna de Agendamentos */}
                                <div className="bg-white p-4 rounded-xl border shadow-inner">
                                    <h4 className="text-[10px] font-black uppercase text-orange-500 mb-3 tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                                        Agendamentos Pendentes
                                    </h4>
                                    {pendingDeliveries.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {pendingDeliveries.map(delivery => (
                                                <div key={delivery.id} className="flex flex-col gap-2 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-orange-800 font-mono">{formatDate(delivery.date)}</span>
                                                        <span className="text-[10px] font-bold text-orange-600">{delivery.time}</span>
                                                        <button 
                                                            onClick={() => handleCancelSingle(supplier.cpf, delivery.id, delivery.date)}
                                                            className="hover:bg-red-600 hover:text-white bg-white rounded-lg p-1 text-red-500 transition-all border border-red-100 shadow-sm ml-auto"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-[10px] text-gray-300 italic">Nenhum pendente.</p>}
                                </div>

                                {/* Coluna de Faturamentos Agrupados (Sua Solicitação) */}
                                <div className="bg-white p-4 rounded-xl border shadow-inner">
                                    <h4 className="text-[10px] font-black uppercase text-green-600 mb-3 tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        Faturamentos Concluídos
                                    </h4>
                                    <div className="flex flex-wrap gap-3">
                                        {groupedInvoices.length > 0 ? groupedInvoices.map((group, idx) => (
                                            <div key={`${group.date}-${group.nf}-${idx}`} className="flex items-center gap-3 bg-[#f0fff4] text-[#2f855a] px-4 py-2.5 rounded-2xl border border-[#c6f6d5] shadow-sm animate-fade-in group">
                                                <span className="text-xs font-black font-mono tracking-tighter">{formatDate(group.date)}</span>
                                                <div className="bg-[#c6f6d5] px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                                                    NF {group.nf}
                                                </div>
                                                <button 
                                                    onClick={() => handleCancelGroup(supplier.cpf, group.ids, group.date, group.nf)}
                                                    className="bg-white hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all border border-red-100 shadow-sm active:scale-90"
                                                    title={`Excluir Nota Completa (${group.ids.length} itens)`}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        )) : <p className="text-[10px] text-gray-300 italic">Nenhum faturamento.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed">
                        <p className="text-gray-400 font-bold uppercase tracking-widest">Nenhum registro encontrado.</p>
                    </div>
                )}
            </div>
             <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }`}</style>
        </div>
    );
};

export default AdminScheduleView;