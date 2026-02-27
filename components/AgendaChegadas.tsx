
import React, { useState, useMemo } from 'react';
import type { Supplier, ThirdPartyEntryLog } from '../types';
import { Calendar, Clock, Truck, UserCheck, AlertCircle, Search } from 'lucide-react';

interface AgendaChegadasProps {
    suppliers: Supplier[];
    thirdPartyEntries: ThirdPartyEntryLog[];
    embedded?: boolean;
}

const AgendaChegadas: React.FC<AgendaChegadasProps> = ({ suppliers, thirdPartyEntries, embedded }) => {
    const [selectedAgendaDate, setSelectedAgendaDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');

    const dailyDeliveries = useMemo(() => {
        const list: { supplierName: string; supplierCpf: string; time: string; arrivalTime?: string; status: 'AGENDADO' | 'CONCLUÍDO' | 'TERCEIRO' | 'CANCELADO'; id: string; type: 'FORNECEDOR' | 'TERCEIRO' }[] = [];
        
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.date === selectedAgendaDate) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    const status = isFaturado ? 'CONCLUÍDO' : 'AGENDADO';
                    const existing = list.find(l => l.supplierName === s.name && l.time === d.time && l.status === status);
                    if (!existing) {
                        list.push({
                            id: d.id,
                            supplierName: s.name,
                            supplierCpf: s.cpf,
                            time: d.time,
                            arrivalTime: d.arrivalTime,
                            status: status,
                            type: 'FORNECEDOR'
                        });
                    }
                }
            });
        });

        (thirdPartyEntries || []).forEach(log => {
            if (log.date === selectedAgendaDate) {
                let status: 'AGENDADO' | 'CONCLUÍDO' | 'TERCEIRO' | 'CANCELADO' = 'TERCEIRO';
                if (log.status === 'concluido') status = 'CONCLUÍDO';
                else if (log.status === 'cancelado') status = 'CANCELADO';
                else if (log.status === 'agendado') status = 'AGENDADO';

                list.push({
                    id: log.id,
                    supplierName: log.companyName,
                    supplierCpf: log.companyCnpj,
                    time: log.time || '00:00',
                    arrivalTime: log.arrivalTime,
                    status: status,
                    type: 'TERCEIRO'
                });
            }
        });

        return list
            .filter(item => 
                item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.supplierCpf.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [suppliers, thirdPartyEntries, selectedAgendaDate, searchTerm]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <div className={`space-y-6 animate-fade-in ${embedded ? '' : 'p-4 md:p-8 max-w-6xl mx-auto'}`}>
            {/* Header / Selector */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-black text-indigo-950 uppercase tracking-tighter italic">Agenda de Chegadas</h2>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Visualização de Entregas Programadas</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Pesquisar fornecedor..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-bold text-sm transition-all"
                            />
                        </div>
                        <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                            <span className="text-xs font-black text-indigo-600 uppercase">{dailyDeliveries.length} Veículos</span>
                        </div>
                        <input 
                            type="date" 
                            value={selectedAgendaDate} 
                            onChange={e => setSelectedAgendaDate(e.target.value)}
                            className="p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-black text-indigo-900 transition-all text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Daily Summary Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-md border border-indigo-50 flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600">
                        <Truck className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Ativo</p>
                        <p className="text-xl font-black text-indigo-900">{dailyDeliveries.filter(d => d.status !== 'CANCELADO').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-md border border-green-50 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-2xl text-green-600">
                        <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Já Chegaram</p>
                        <p className="text-xl font-black text-green-700">{dailyDeliveries.filter(d => d.arrivalTime && d.status !== 'CANCELADO').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-md border border-red-50 flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-2xl text-red-600">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pendentes</p>
                        <p className="text-xl font-black text-red-700">{dailyDeliveries.filter(d => !d.arrivalTime && d.status !== 'CANCELADO').length}</p>
                    </div>
                </div>
            </div>

            {/* List of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyDeliveries.length > 0 ? dailyDeliveries.map(item => (
                    <div 
                        key={item.id} 
                        className={`relative overflow-hidden bg-white rounded-[2rem] shadow-md border-2 transition-all ${
                            item.status === 'CONCLUÍDO' 
                                ? 'border-indigo-100 opacity-80' 
                                : item.status === 'CANCELADO'
                                    ? 'border-red-100 opacity-50 grayscale'
                                    : item.arrivalTime 
                                        ? 'border-green-200 bg-green-50/30' 
                                        : 'border-red-500 bg-red-50'
                        }`}
                    >
                        <div className={`absolute top-0 left-0 w-2 h-full ${
                            item.status === 'CONCLUÍDO' ? 'bg-indigo-900' : 
                            item.status === 'CANCELADO' ? 'bg-gray-400' :
                            item.arrivalTime ? 'bg-green-500' : 'bg-red-600'
                        }`} />

                        <div className="p-5 pl-7">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-4 py-2 rounded-xl text-lg font-black font-mono shadow-sm ${
                                    item.status === 'CONCLUÍDO' 
                                        ? 'bg-indigo-900 text-white' 
                                        : item.status === 'CANCELADO'
                                            ? 'bg-gray-400 text-white'
                                            : item.arrivalTime 
                                                ? 'bg-green-600 text-white' 
                                                : 'bg-red-600 text-white shadow-red-100'
                                }`}>
                                    {item.time}
                                </div>
                                
                                <div className="text-right">
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                        item.status === 'CONCLUÍDO' ? 'bg-indigo-100 text-indigo-700' : 
                                        item.status === 'CANCELADO' ? 'bg-red-100 text-red-700' :
                                        item.status === 'TERCEIRO' ? 'bg-amber-100 text-amber-700' : 
                                        item.status === 'AGENDADO' && item.arrivalTime ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {item.status}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-tight line-clamp-1">
                                    {item.supplierName}
                                </h3>
                                <p className="text-[10px] font-mono text-slate-400 mt-1">{item.supplierCpf}</p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-dashed border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-slate-300" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Chegada:</span>
                                    <span className={`text-[11px] font-black ${item.arrivalTime ? 'text-green-600' : 'text-red-600 italic'}`}>
                                        {item.arrivalTime || 'Aguardando...'}
                                    </span>
                                </div>
                                {item.arrivalTime && (
                                    <div className="bg-green-100 text-green-700 p-1.5 rounded-lg">
                                        <UserCheck className="h-4 w-4" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-20 bg-white rounded-[3rem] shadow-xl border-4 border-dashed border-gray-100 flex flex-col items-center justify-center gap-4">
                        <Calendar className="h-16 w-16 text-gray-200" />
                        <p className="text-xl font-black text-gray-300 uppercase tracking-[0.3em] italic">Nenhuma entrega agendada para este dia</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgendaChegadas;
