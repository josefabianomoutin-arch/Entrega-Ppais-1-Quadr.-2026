
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';
import WeeklyScheduleControl from './WeeklyScheduleControl';

interface ItespDashboardProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  onLogout: () => void;
}

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

/**
 * EXTRATOR DE MÊS - VERSÃO AUDITORIA 2026 (FINAL)
 * Busca agressivamente pelo padrão 01/Janeiro na string da data.
 */
const getMonthNameFromDateString = (dateStr?: string): string => {
    if (!dateStr) return "Mês Indefinido";
    const s = String(dateStr).trim().toLowerCase();
    
    // Teste 1: Contém o nome do mês
    for (let i = 0; i < months.length; i++) {
        if (s.includes(months[i].toLowerCase().slice(0, 3))) return months[i];
    }

    // Teste 2: Regex para formatos DD-MM-YYYY ou YYYY-MM-DD
    const parts = s.replace(/[\/]/g, '-').split('-');
    if (parts.length >= 2) {
        // Se YYYY-MM-DD, mês é o segundo (index 1)
        if (parts[0].length === 4) {
            const m = parseInt(parts[1], 10);
            if (m >= 1 && m <= 12) return months[m - 1];
        } else {
            // Se DD-MM-YYYY ou DD-MM, mês é o segundo (index 1)
            const m = parseInt(parts[1], 10);
            if (m >= 1 && m <= 12) return months[m - 1];
        }
    }
    
    // Fallback: Se contiver '-01-' ou '/01/' ou começar com '01/'
    if (s.includes("-01-") || s.includes("/01/") || s.match(/^01[-\/]/)) return "Janeiro";
    
    return "Mês Indefinido";
};

const ALLOWED_SUPPLIERS_RAW = [
    'BENEDITO OSMAR RAVAZZI', 'ADAO MAXIMO DA FONSECA', 'ANTONIO JOAQUIM DE OLIVEIRA',
    'CLAUDEMIR LUIZ TURRA', 'CONSUELO ALCANTARA FERREIRA GUIMARARE', 'DANILO ANTONIO MAXIMO',
    'DOMINGOS APARECIDO ANTONINO', 'LEONARDO FELIPE VELHO MARSOLA', 'LIDIA BERNARDES MONTEIRO BARBOSA',
    'LUCIMARA MARQUES PEREIRA', 'MARCELO GIBERTONI', 'MARCOS DONADON AGOSTINHO',
    'MICHEL JOSE RAVAZZI', 'MOISES PINHEIRO DE SA', 'PAULO HENRIQUE PUGLIERI',
    'PEDRO TEODORO RODRIGUES', 'ROSA MARIA GARBIN VELLONE', 'SAULO ANTONINO',
    'SONIA REGINA COLOMBO CELESTINO', 'TANIA MARA BALDAO DE BARROS'
];

const ItespDashboard: React.FC<ItespDashboardProps> = ({ suppliers = [], warehouseLog = [], onLogout }) => {
    const [activeTab, setActiveTab] = useState<'audit' | 'schedule'>('audit');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('all');

    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

    const itespSuppliers = useMemo(() => {
        const allowedSet = new Set(ALLOWED_SUPPLIERS_RAW.map(superNormalize));
        return suppliers.filter(s => {
            const sn = superNormalize(s.name);
            return Array.from(allowedSet).some(allowed => sn.includes(allowed) || allowed.includes(sn));
        });
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!itespSuppliers.length) return [];
        
        const consolidatedMap = new Map<string, any>();

        // 1. Inicializa Metas Quadrimestrais (Jan a Abr)
        itespSuppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            s.contractItems.forEach(ci => {
                const iNorm = superNormalize(ci.name);
                ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach(mName => {
                    const key = `${sNorm}|${iNorm}|${mName}`;
                    consolidatedMap.set(key, {
                        supplierName: s.name,
                        productName: ci.name,
                        month: mName,
                        contractedKgMonthly: (Number(ci.totalKg) || 0) / 4,
                        receivedKg: 0,
                        unitPrice: Number(ci.valuePerKg) || 0,
                        sNorm, iNorm,
                        logEntries: [] // NOVO: Guarda os logs originais
                    });
                });
            });
        });

        // 2. Acumula Estoque Real (Match Flexível)
        warehouseLog.forEach(log => {
            if (log.type !== 'entrada') return;
            
            const logSNorm = superNormalize(log.supplierName);
            const logINorm = superNormalize(log.itemName);
            const logMonth = getMonthNameFromDateString(log.date);

            if (!['Janeiro', 'Fevereiro', 'Março', 'Abril'].includes(logMonth)) return;

            // Busca no mapa com lógica de inclusão para nomes compostos
            for (const [key, entry] of consolidatedMap.entries()) {
                if (entry.month === logMonth) {
                    const sMatch = entry.sNorm === logSNorm || entry.sNorm.includes(logSNorm) || logSNorm.includes(entry.sNorm);
                    if (sMatch) {
                        const iMatch = entry.iNorm === logINorm || entry.iNorm.includes(logINorm) || logINorm.includes(entry.iNorm);
                        if (iMatch) {
                            entry.receivedKg += (Number(log.quantity) || 0);
                            entry.logEntries.push(log); // NOVO: Adiciona o log original
                        }
                    }
                }
            }
        });

        return Array.from(consolidatedMap.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `itp-${idx}-${Date.now()}`,
                shortfallKg,
                financialLoss: shortfallKg * data.unitPrice
            };
        }).filter(item => item.contractedKgMonthly > 0)
          .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

    }, [itespSuppliers, warehouseLog]);

    const filteredData = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return comparisonData.filter(item => {
            const searchMatch = item.supplierName.toLowerCase().includes(lowerSearch) || 
                                item.productName.toLowerCase().includes(lowerSearch);
            const monthMatch = selectedMonth === 'all' || item.month === selectedMonth;
            return searchMatch && monthMatch;
        });
    }, [comparisonData, searchTerm, selectedMonth]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, item) => {
            acc.contracted += item.contractedKgMonthly;
            acc.received += item.receivedKg;
            acc.shortfall += item.shortfallKg;
            acc.loss += item.financialLoss;
            return acc;
        }, { contracted: 0, received: 0, shortfall: 0, loss: 0 });
    }, [filteredData]);

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-800 pb-20 font-sans">
            <header className="bg-white shadow-lg p-4 flex justify-between items-center border-b-4 border-green-700 sticky top-0 z-[100]">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-green-800 uppercase tracking-tighter italic leading-none">Monitor ITESP 2026</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Janeiro a Abril • Auditoria em Tempo Real</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button 
                            onClick={() => setActiveTab('audit')} 
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-green-700 text-white shadow-md' : 'text-gray-400 hover:text-green-700'}`}
                        >
                            Auditoria Quadrimestral
                        </button>
                        <button 
                            onClick={() => setActiveTab('schedule')} 
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'schedule' ? 'bg-green-700 text-white shadow-md' : 'text-gray-400 hover:text-green-700'}`}
                        >
                            Agenda Semanal
                        </button>
                    </div>
                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg active:scale-95 transition-all">Sair</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
                {/* Mobile Tab Switcher */}
                <div className="md:hidden flex bg-white p-1 rounded-2xl shadow-md border border-green-100">
                    <button 
                        onClick={() => setActiveTab('audit')} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-green-700 text-white shadow-lg' : 'text-green-400'}`}
                    >
                        Auditoria
                    </button>
                    <button 
                        onClick={() => setActiveTab('schedule')} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'schedule' ? 'bg-green-700 text-white shadow-lg' : 'text-green-400'}`}
                    >
                        Agenda
                    </button>
                </div>

                {activeTab === 'audit' ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-8 border-blue-500">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Meta de Recebimento</p>
                                <p className="text-2xl font-black text-blue-700">{totals.contracted.toLocaleString('pt-BR')} kg</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-8 border-green-600">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Realizado (Histórico de Estoque)</p>
                                <p className="text-2xl font-black text-green-700">{totals.received.toLocaleString('pt-BR')} kg</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-8 border-red-500">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Déficit (Faltante)</p>
                                <p className="text-2xl font-black text-red-600">{totals.shortfall.toLocaleString('pt-BR')} kg</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-b-8 border-orange-500">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Impacto Financeiro</p>
                                <p className="text-2xl font-black text-orange-600">{formatCurrency(totals.loss)}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100">
                            <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
                                <div className="flex-1 relative">
                                    <input type="text" placeholder="Filtrar por produtor ou produto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-green-400 font-bold bg-gray-50 transition-all" />
                                </div>
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="md:w-72 border-2 border-gray-50 rounded-2xl px-6 py-4 font-black bg-white text-green-800 outline-none cursor-pointer">
                                    <option value="all">Ver Período Completo</option>
                                    {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div className="overflow-x-auto rounded-3xl border-2 border-gray-50">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-900 text-gray-100 text-[10px] font-black uppercase tracking-widest">
                                        <tr>
                                            <th className="p-5 text-left">PRODUTOR ITESP</th>
                                            <th className="p-5 text-left">GÊNERO ALIMENTÍCIO</th>
                                            <th className="p-5 text-center">MÊS</th>
                                            <th className="p-5 text-right bg-blue-900/50">META</th>
                                            <th className="p-5 text-right bg-green-900/50">ESTOQUE</th>
                                            <th className="p-5 text-right bg-red-900/50">SALDO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredData.length > 0 ? filteredData.map(item => (
                                            <tr 
                                                key={item.id} 
                                                onClick={() => setSelectedDetail(item)}
                                                className="hover:bg-green-50/50 transition-colors group cursor-pointer"
                                            >
                                                <td className="p-5 font-black text-gray-900 text-xs uppercase">{item.supplierName}</td>
                                                <td className="p-5 text-gray-500 font-bold uppercase text-[11px]">{item.productName}</td>
                                                <td className="p-5 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${item.month === 'Janeiro' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>{item.month}</span>
                                                </td>
                                                <td className="p-5 text-right font-black text-blue-700 font-mono">{(item.contractedKgMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                                <td className={`p-5 text-right font-black font-mono ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>{(item.receivedKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                                <td className={`p-5 text-right font-black font-mono ${item.shortfallKg > 0.01 ? 'text-red-600' : 'text-gray-200'}`}>
                                                    {item.shortfallKg > 0.01 ? `-${item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✓ OK'}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={6} className="p-32 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-30">
                                                    <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <p className="text-gray-600 italic font-black uppercase tracking-widest text-lg text-center">Nenhum dado capturado para o período.<br/><span className="text-xs font-normal">Verifique o Histórico de Estoque do Almoxarifado.</span></p>
                                                </div>
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <WeeklyScheduleControl 
                        suppliers={suppliers} 
                        itespOnly={true} 
                        title="Agenda Semanal ITESP" 
                        subtitle="Controle de entregas exclusivo para produtores ITESP."
                    />
                )}

                {selectedDetail && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4 animate-fade-in">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-up">
                            <div className="bg-green-800 p-8 text-white flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tighter">{selectedDetail.productName}</h3>
                                    <p className="text-green-200 font-bold uppercase text-xs tracking-widest mt-1">{selectedDetail.supplierName} • {selectedDetail.month}</p>
                                </div>
                                <button onClick={() => setSelectedDetail(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Meta Mensal</p>
                                        <p className="text-lg font-black text-blue-700">{selectedDetail.contractedKgMonthly.toLocaleString('pt-BR')} kg</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Recebido</p>
                                        <p className="text-lg font-black text-green-700">{selectedDetail.receivedKg.toLocaleString('pt-BR')} kg</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Déficit</p>
                                        <p className="text-lg font-black text-red-600">{selectedDetail.shortfallKg.toLocaleString('pt-BR')} kg</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        Registros no Histórico de Estoque
                                    </h4>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border rounded-2xl">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr className="text-gray-500 font-black uppercase text-[9px] border-b">
                                                    <th className="p-4 text-left">Data Doc.</th>
                                                    <th className="p-4 text-left">Lote</th>
                                                    <th className="p-4 text-left">NF</th>
                                                    <th className="p-4 text-right">Qtd (kg)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {selectedDetail.logEntries.length > 0 ? selectedDetail.logEntries.map((log: any) => (
                                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-4 font-mono font-bold text-indigo-700">{(log.date || '').split('-').reverse().join('/')}</td>
                                                        <td className="p-4 font-mono">{log.lotNumber}</td>
                                                        <td className="p-4 font-mono">{log.inboundInvoice || '-'}</td>
                                                        <td className="p-4 text-right font-black">{log.quantity.toLocaleString('pt-BR')} kg</td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Nenhuma entrada registrada no estoque para este período.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 p-6 border-t flex justify-end">
                                <button onClick={() => setSelectedDetail(null)} className="bg-gray-900 text-white font-black py-3 px-10 rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-all">Fechar Detalhes</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                @keyframes scale-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-scale-up { animation: scale-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};


export default ItespDashboard;
