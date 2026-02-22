
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';
import WeeklyScheduleControl from './WeeklyScheduleControl';

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
    const [activeSubTab, setActiveSubTab] = useState<'daily' | 'weekly'>('daily');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(p => {
            const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const dateMatch = !dateFilter || (p.deliveries || []).some(d => d.date === dateFilter);
            return nameMatch && dateMatch;
        });
    }, [suppliers, searchTerm, dateFilter]);
    
    const sortedSuppliers = useMemo(() => {
        return [...filteredSuppliers].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredSuppliers]);

    const handleCancel = (supplierCpf: string, deliveryIds: string[], date: string, isInvoice: boolean) => {
        const type = isInvoice ? 'FATURAMENTO' : 'AGENDAMENTO';
        if (window.confirm(`ATENÇÃO: Deseja realmente EXCLUIR o ${type} do dia ${formatDate(date)}?\n\nEsta ação removerá o registro permanentemente.`)) {
            onCancelDeliveries(supplierCpf, deliveryIds);
        }
    };

    const handleClearDayForSupplier = (supplierCpf: string, supplierName: string, date: string) => {
        const p = suppliers.find(s => s.cpf === supplierCpf);
        if (!p) return;
        const deliveriesOnDate = (p.deliveries || []).filter(d => d.date === date);
        if (deliveriesOnDate.length === 0) return;

        if (window.confirm(`ATENÇÃO: Deseja excluir TODOS os registros (${deliveriesOnDate.length}) do fornecedor ${supplierName} no dia ${formatDate(date)}?`)) {
            onCancelDeliveries(supplierCpf, deliveriesOnDate.map(d => d.id));
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex bg-white p-1 rounded-2xl shadow-md border border-purple-100 max-w-md mx-auto">
                <button 
                    onClick={() => setActiveSubTab('daily')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'daily' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-purple-50'}`}
                >
                    Agenda Diária
                </button>
                <button 
                    onClick={() => setActiveSubTab('weekly')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'weekly' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-purple-50'}`}
                >
                    Controle Semanal
                </button>
            </div>

            {activeSubTab === 'daily' ? (
                <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-purple-600">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b pb-6">
                        <div>
                            <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Agenda de Entregas</h2>
                            <p className="text-gray-400 font-medium">Gerencie os agendamentos. Use os filtros abaixo para localizar datas específicas.</p>
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
                                <button 
                                    onClick={() => setDateFilter('')}
                                    className="mt-5 text-xs text-purple-600 font-bold hover:underline"
                                >
                                    Limpar Data
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                        {sortedSuppliers.length > 0 ? sortedSuppliers.map(supplier => {
                            const displayDeliveries = dateFilter 
                                ? (supplier.deliveries || []).filter(d => d.date === dateFilter)
                                : (supplier.deliveries || []);

                            const sortedDeliveries = [...displayDeliveries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            const pendingDeliveries = sortedDeliveries.filter(d => d.item === 'AGENDAMENTO PENDENTE');
                            const realDeliveries = sortedDeliveries.filter(d => d.item !== 'AGENDAMENTO PENDENTE');

                            return (
                                <div key={supplier.cpf} className="p-5 border rounded-2xl bg-gray-50/50 hover:bg-white transition-all border-l-8 border-l-purple-400 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-lg text-purple-900 uppercase">{supplier.name}</h3>
                                            <p className="text-[10px] font-mono text-gray-400">{supplier.cpf}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            {dateFilter && displayDeliveries.length > 0 && (
                                                <button 
                                                    onClick={() => handleClearDayForSupplier(supplier.cpf, supplier.name, dateFilter)}
                                                    className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    Limpar este dia
                                                </button>
                                            )}
                                            <span className="text-[10px] font-black text-gray-400 uppercase block">Resultados no Filtro</span>
                                            <span className="font-mono font-bold text-purple-600">{sortedDeliveries.length} registro(s)</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-4 rounded-xl border shadow-inner">
                                            <h4 className="text-[10px] font-black uppercase text-red-600 mb-3 tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                Agendamentos em Aberto (Aguardando)
                                            </h4>
                                            {pendingDeliveries.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                            {pendingDeliveries.map(delivery => (
                                                                <div key={delivery.id} className="flex flex-col gap-2 p-3 bg-red-50/50 rounded-xl border border-red-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-red-800 font-mono">{formatDate(delivery.date)}</span>
                                                                        <span className="text-[10px] font-bold text-red-600">Agendado p/ {delivery.time}</span>
                                                                        <button 
                                                                            onClick={() => handleCancel(supplier.cpf, [delivery.id], delivery.date, false)}
                                                                            className="hover:bg-red-600 hover:text-white bg-white rounded-lg p-1 text-red-500 transition-all border border-red-100 shadow-sm ml-auto"
                                                                            title="Excluir Agendamento"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    </div>
                                                            
                                                            {/* INFORMAÇÃO DA SUBPORTARIA ABERTA AQUI */}
                                                            {delivery.arrivalTime && (
                                                                <div className="bg-green-600 text-white px-3 py-1.5 rounded-lg flex items-center justify-between shadow-sm animate-pulse">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                                        <span className="text-[10px] font-black uppercase tracking-tight">Veículo em Pátio</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold">Entrou às {delivery.arrivalTime}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-300 italic">Nenhum agendamento nesta visualização.</p>
                                            )}
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border shadow-inner">
                                            <h4 className="text-[10px] font-black uppercase text-green-500 mb-3 tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                                Faturamentos Concluídos
                                            </h4>
                                            {realDeliveries.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {(() => {
                                                        const invoices = new Map<string, { date: string, invoiceNumber: string, ids: string[] }>();
                                                        realDeliveries.forEach(d => {
                                                            const nf = (d.invoiceNumber || '').toString().trim();
                                                            const key = nf || `no-nf-${d.id}`;
                                                            if (!invoices.has(key)) {
                                                                invoices.set(key, { date: d.date, invoiceNumber: nf || 'S/N', ids: [] });
                                                            }
                                                            invoices.get(key)!.ids.push(d.id);
                                                        });
                                                        return Array.from(invoices.values()).map((inv, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 bg-green-50 text-green-700 text-xs font-black px-3 py-1.5 rounded-xl border border-green-100">
                                                                <span className="font-mono">{formatDate(inv.date)}</span>
                                                                <span className="text-[9px] px-1 bg-green-100 rounded">NF {inv.invoiceNumber}</span>
                                                                <button 
                                                                    onClick={() => handleCancel(supplier.cpf, inv.ids, inv.date, true)}
                                                                    className="hover:bg-red-600 hover:text-white bg-white rounded-lg p-1 text-red-500 transition-all border border-red-100 shadow-sm"
                                                                    title="Excluir Faturamento"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-300 italic">Nenhum faturamento nesta visualização.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed">
                                <p className="text-gray-400 font-bold uppercase tracking-widest">Nenhum registro encontrado para estes filtros.</p>
                                {dateFilter && <p className="text-xs text-gray-400 mt-2">Dica: Verifique se o dia {formatDate(dateFilter)} realmente possui entregas agendadas.</p>}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <WeeklyScheduleControl suppliers={suppliers} />
            )}
             <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }`}</style>
        </div>
    );
};

export default AdminScheduleView;
