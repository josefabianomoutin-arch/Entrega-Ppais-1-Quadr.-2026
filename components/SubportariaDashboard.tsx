
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';

interface SubportariaDashboardProps {
  suppliers: Supplier[];
  onLogout: () => void;
  onMarkArrival: (supplierCpf: string, deliveryId: string) => Promise<void>;
}

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
};

const SubportariaDashboard: React.FC<SubportariaDashboardProps> = ({ suppliers, onLogout, onMarkArrival }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const dailyDeliveries = useMemo(() => {
        const list: { supplierName: string; supplierCpf: string; time: string; arrivalTime?: string; status: 'AGENDADO' | 'FATURADO'; id: string }[] = [];
        
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.date === selectedDate) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    
                    // Agrupamento para evitar duplicidade visual de caminhões com muitos itens
                    const existing = list.find(l => l.supplierName === s.name && l.time === d.time && l.status === (isFaturado ? 'FATURADO' : 'AGENDADO'));
                    
                    if (!existing) {
                        list.push({
                            id: d.id,
                            supplierName: s.name,
                            supplierCpf: s.cpf,
                            time: d.time,
                            arrivalTime: d.arrivalTime,
                            status: isFaturado ? 'FATURADO' : 'AGENDADO'
                        });
                    }
                }
            });
        });

        return list.sort((a, b) => a.time.localeCompare(b.time));
    }, [suppliers, selectedDate]);

    const handleArrival = async (cpf: string, id: string) => {
        setIsUpdating(id);
        await onMarkArrival(cpf, id);
        setIsUpdating(null);
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-10">
            {/* Header Compacto para Mobile */}
            <header className="bg-indigo-950 text-white p-4 shadow-xl flex justify-between items-center sticky top-0 z-50 border-b border-indigo-800">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">Subportaria</h1>
                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Painel de Acesso 2026</p>
                    </div>
                </div>
                <button onClick={onLogout} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase transition-all border border-red-900/50">Sair</button>
            </header>

            <main className="p-4 space-y-6 max-w-2xl mx-auto">
                
                {/* Seletor de Data Estilizado */}
                <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-200">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-xl font-black text-indigo-950 uppercase tracking-tighter italic">Agenda do Dia</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{formatDate(selectedDate)}</p>
                            </div>
                            <div className="bg-indigo-50 px-3 py-1 rounded-full">
                                <span className="text-[10px] font-black text-indigo-600 uppercase">{dailyDeliveries.length} Veículos</span>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-black text-indigo-900 transition-all appearance-none text-center"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista de Cards */}
                <div className="space-y-4">
                    {dailyDeliveries.length > 0 ? dailyDeliveries.map(item => (
                        <div 
                            key={item.id} 
                            className={`relative overflow-hidden bg-white rounded-[2rem] shadow-md border-2 transition-all active:scale-[0.98] ${
                                item.status === 'FATURADO' 
                                    ? 'border-indigo-100 opacity-80' 
                                    : item.arrivalTime 
                                        ? 'border-green-200 bg-green-50/30' 
                                        : 'border-white'
                            }`}
                        >
                            {/* Faixa lateral de status */}
                            <div className={`absolute top-0 left-0 w-2 h-full ${
                                item.status === 'FATURADO' ? 'bg-indigo-900' : item.arrivalTime ? 'bg-green-500' : 'bg-slate-200'
                            }`} />

                            <div className="p-5 pl-7">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-4 py-2 rounded-xl text-lg font-black font-mono shadow-sm ${
                                        item.status === 'FATURADO' 
                                            ? 'bg-indigo-900 text-white' 
                                            : item.arrivalTime 
                                                ? 'bg-green-600 text-white' 
                                                : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {item.time}
                                    </div>
                                    
                                    <div className="text-right">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                            item.status === 'FATURADO' 
                                                ? 'bg-indigo-100 text-indigo-700' 
                                                : item.arrivalTime 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-slate-100 text-slate-400'
                                        }`}>
                                            {item.status === 'FATURADO' ? '✓ Descarregado' : item.arrivalTime ? '● No Pátio' : '○ Aguardando'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fornecedor</p>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight break-words">{item.supplierName}</h3>
                                </div>

                                {item.arrivalTime && (
                                    <div className="flex items-center gap-2 bg-white/60 p-3 rounded-2xl border border-green-100 mb-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <p className="text-xs font-bold text-green-700 uppercase">
                                            Entrada registrada às <span className="text-sm font-black">{item.arrivalTime}</span>
                                        </p>
                                    </div>
                                )}

                                {!item.arrivalTime && item.status !== 'FATURADO' && (
                                    <button 
                                        disabled={isUpdating === item.id}
                                        onClick={() => handleArrival(item.supplierCpf, item.id)}
                                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-6 rounded-2xl text-sm uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300"
                                    >
                                        {isUpdating === item.id ? (
                                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Registrar Chegada
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-20 bg-white/50 rounded-[3rem] border-4 border-dashed border-slate-200">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Nenhum agendamento</p>
                            <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase">Para esta data</p>
                        </div>
                    )}
                </div>

                {/* Resumo Rápido no Rodapé */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-green-600 p-5 rounded-[2rem] text-white shadow-lg flex flex-col items-center text-center">
                        <p className="text-[10px] font-black uppercase opacity-60 mb-1">Confirmados</p>
                        <p className="text-3xl font-black">{dailyDeliveries.filter(d => d.arrivalTime || d.status === 'FATURADO').length}</p>
                    </div>
                    <div className="bg-indigo-900 p-5 rounded-[2rem] text-white shadow-lg flex flex-col items-center text-center">
                        <p className="text-[10px] font-black uppercase opacity-60 mb-1">Pendentes</p>
                        <p className="text-3xl font-black">{dailyDeliveries.filter(d => !d.arrivalTime && d.status === 'AGENDADO').length}</p>
                    </div>
                </div>

            </main>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                /* Remover ícone padrão do input date para mobile cleaner look */
                input[type="date"]::-webkit-inner-spin-button,
                input[type="date"]::-webkit-calendar-picker-indicator {
                    opacity: 0;
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    left: 0;
                    top: 0;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
};

export default SubportariaDashboard;
