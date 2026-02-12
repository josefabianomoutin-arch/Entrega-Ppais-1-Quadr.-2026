
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';

interface SubportariaDashboardProps {
  suppliers: Supplier[];
  onLogout: () => void;
}

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const SubportariaDashboard: React.FC<SubportariaDashboardProps> = ({ suppliers, onLogout }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const dailyDeliveries = useMemo(() => {
        const list: { supplierName: string; time: string; status: 'AGENDADO' | 'FATURADO'; id: string }[] = [];
        
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.date === selectedDate) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    
                    // Se for faturado, agrupamos por NF para não repetir o mesmo caminhão várias vezes se tiver 20 itens
                    const existing = list.find(l => l.supplierName === s.name && l.time === d.time && l.status === (isFaturado ? 'FATURADO' : 'AGENDADO'));
                    
                    if (!existing) {
                        list.push({
                            id: d.id,
                            supplierName: s.name,
                            time: d.time,
                            status: isFaturado ? 'FATURADO' : 'AGENDADO'
                        });
                    }
                }
            });
        });

        return list.sort((a, b) => a.time.localeCompare(b.time));
    }, [suppliers, selectedDate]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <header className="bg-indigo-950 text-white p-6 shadow-2xl flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Subportaria 2026</h1>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Painel de Acesso • Taiúva/SP</p>
                    </div>
                </div>
                <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-8 rounded-xl text-xs uppercase shadow-lg active:scale-95 transition-all">Sair</button>
            </header>

            <main className="p-4 md:p-10 max-w-5xl mx-auto space-y-8">
                
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                        <div>
                            <h2 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter italic">Entregas Previstas</h2>
                            <p className="text-slate-400 font-medium text-sm mt-1">{formatDate(selectedDate)}</p>
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Alterar Data de Consulta</label>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full md:w-64 p-4 border-2 border-indigo-50 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-bold text-indigo-900 bg-indigo-50/30 transition-all cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {dailyDeliveries.length > 0 ? dailyDeliveries.map(item => (
                            <div key={item.id} className={`flex flex-col sm:flex-row items-center justify-between p-6 rounded-3xl border-2 transition-all hover:scale-[1.02] ${item.status === 'FATURADO' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                                <div className="flex items-center gap-6 mb-4 sm:mb-0">
                                    <div className={`p-4 rounded-2xl text-xl font-black font-mono shadow-sm ${item.status === 'FATURADO' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
                                        {item.time}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtor / Empresa</p>
                                        <p className="text-xl font-black text-slate-800 uppercase tracking-tight">{item.supplierName}</p>
                                    </div>
                                </div>
                                <div className="text-center sm:text-right">
                                    <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${item.status === 'FATURADO' ? 'bg-white text-green-700' : 'bg-white text-blue-700'}`}>
                                        {item.status === 'FATURADO' ? '✓ Descarregando / OK' : '○ Previsto p/ Hoje'}
                                    </span>
                                    {item.status === 'AGENDADO' && (
                                        <p className="text-[9px] text-blue-400 font-bold mt-2 uppercase">Aguardando Chegada</p>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 opacity-50">
                                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Nenhuma entrega agendada</p>
                                <p className="text-xs font-bold text-slate-300 mt-1 uppercase">Para o dia selecionado</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-xl">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Total do Dia</p>
                        <p className="text-4xl font-black">{dailyDeliveries.length} <span className="text-lg font-bold opacity-50">Caminhões</span></p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border-2 border-green-100 shadow-xl">
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Já Chegaram</p>
                        <p className="text-4xl font-black text-green-700">{dailyDeliveries.filter(d => d.status === 'FATURADO').length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-xl">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Aguardando</p>
                        <p className="text-4xl font-black text-blue-700">{dailyDeliveries.filter(d => d.status === 'AGENDADO').length}</p>
                    </div>
                </div>

            </main>

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default SubportariaDashboard;
