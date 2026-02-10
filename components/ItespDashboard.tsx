
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';

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
 * EXTRATOR DE MÊS - ULTRA SEGURO
 */
const getMonthNameFromDate = (dateStr?: string): string => {
    if (!dateStr) return "Mês Indefinido";
    const s = String(dateStr).trim();
    
    // Testa formato ISO (YYYY-MM-DD) ou BR (DD-MM-YYYY)
    const parts = s.split('-');
    if (parts.length === 3) {
        // Se a primeira parte tiver 4 dígitos, é ISO: o mês é a parte 1 (índice 1)
        // Se a primeira parte tiver 2 dígitos, é BR: o mês é a parte 2 (índice 1)
        const m = parseInt(parts[1], 10);
        if (m >= 1 && m <= 12) return months[m - 1];
    }
    
    // Fallback: Procura por padrões numéricos diretos de Janeiro
    if (s.includes("-01-") || s.includes("/01/") || s.match(/^01\//) || s.match(/-01$/)) return "Janeiro";
    
    return "Mês Indefinido";
};

const ALLOWED_SUPPLIERS_RAW = [
    'BENEDITO OSMAR RAVAZZI', 'ADAO MAXIMO DA FONSECA', 'ANTONIO JOAQUIM DE OLIVEIRA',
    'CLAUDEMIR LUIZ TURRA', 'CONSUELO ALCANTARA FERREIRA GUIMARAES', 'DANILO ANTONIO MAXIMO',
    'DOMINGO APARECIDO ANTONINO', 'LEONARDO FELIPE VELHO MARSOLA', 'LIDIA BERNARDES MONTEIRO BARBOSA',
    'LUCIMARA MARQUES PEREIRA', 'MARCELO GIBERTONI', 'MARCOS DONADON AGOSTINHO',
    'MICHEL JOSE RAVAZZI', 'MOISES PINHEIRO DE SA', 'PAULO HENRIQUE PUGLIERI',
    'PEDRO TEODORO RODRIGUES', 'ROSA MARIA GARBIN VELLONE', 'SAULO ANTONINO',
    'SONIA REGINA COLOMBO CELESTINO', 'TANIA MARA BALDAO DE BARROS'
];

const ItespDashboard: React.FC<ItespDashboardProps> = ({ suppliers = [], warehouseLog = [], onLogout }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('all');

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
        const nameToNormMap = new Map<string, string>();

        // 1. Inicializa Metas
        itespSuppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            nameToNormMap.set(sNorm, sNorm);
            
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
                        sNorm, iNorm
                    });
                });
            });
        });

        // 2. Acumula Estoque Real
        warehouseLog.forEach(log => {
            if (log.type !== 'entrada') return;
            
            const logSNorm = superNormalize(log.supplierName);
            const logINorm = superNormalize(log.itemName);
            const logMonth = getMonthNameFromDate(log.date);

            if (!['Janeiro', 'Fevereiro', 'Março', 'Abril'].includes(logMonth)) return;

            let resolvedSNorm = "";
            for (const [norm] of nameToNormMap) {
                if (norm.includes(logSNorm) || logSNorm.includes(norm)) {
                    resolvedSNorm = norm;
                    break;
                }
            }

            if (!resolvedSNorm) return;

            const potentialKeyPrefix = `${resolvedSNorm}|`;
            for (const [key, entry] of consolidatedMap.entries()) {
                if (key.startsWith(potentialKeyPrefix) && entry.month === logMonth) {
                    if (entry.iNorm.includes(logINorm) || logINorm.includes(entry.iNorm)) {
                        entry.receivedKg += (Number(log.quantity) || 0);
                    }
                }
            }
        });

        return Array.from(consolidatedMap.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `itp-${idx}`,
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
            <header className="bg-white shadow-lg p-4 flex justify-between items-center border-b-4 border-green-700 sticky top-0 z-30">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-green-800 uppercase tracking-tighter italic">Audit ITESP - Gestão 2026</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Painel de Auditoria Mensal (Janeiro a Abril)</p>
                </div>
                <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg transition-all active:scale-95">Sair</button>
            </header>

            <main className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-blue-500">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Meta Quadrimestre</p>
                        <p className="text-2xl font-black text-blue-700">{totals.contracted.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-green-600">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Estoque Recebido</p>
                        <p className="text-2xl font-black text-green-700">{totals.received.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-red-500">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Déficit (Falta)</p>
                        <p className="text-2xl font-black text-red-600">{totals.shortfall.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-orange-500">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Impacto Financeiro</p>
                        <p className="text-2xl font-black text-orange-600">{formatCurrency(totals.loss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
                        <div className="flex-1">
                             <input type="text" placeholder="Filtrar por produtor ou produto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border-2 border-gray-100 rounded-xl px-5 py-3 outline-none focus:border-green-400 font-medium transition-all" />
                        </div>
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="md:w-64 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold bg-gray-50 text-gray-700 cursor-pointer outline-none">
                            <option value="all">Ver Todo o Período</option>
                            {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-inner">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-900 text-gray-100 text-[10px] font-black uppercase tracking-widest">
                                <tr>
                                    <th className="p-4 text-left">PRODUTOR ITESP</th>
                                    <th className="p-4 text-left">PRODUTO</th>
                                    <th className="p-4 text-center">MÊS</th>
                                    <th className="p-4 text-right bg-blue-800/20">META MENSAL</th>
                                    <th className="p-4 text-right bg-green-800/20">ENTRADA ESTOQUE</th>
                                    <th className="p-4 text-right bg-red-800/20">STATUS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 font-black text-gray-900 text-xs uppercase">{item.supplierName}</td>
                                        <td className="p-4 text-gray-500 font-bold uppercase text-[11px]">{item.productName}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.month === 'Janeiro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{item.month}</span>
                                        </td>
                                        <td className="p-4 text-right font-black text-blue-700 font-mono">{(item.contractedKgMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                        <td className={`p-4 text-right font-black font-mono ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>{(item.receivedKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                        <td className={`p-4 text-right font-black font-mono ${item.shortfallKg > 0.01 ? 'text-red-600' : 'text-gray-200'}`}>
                                            {item.shortfallKg > 0.01 ? `-${item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✓ OK'}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-gray-400 italic font-black uppercase tracking-widest text-sm">Nenhum dado localizado para 2026.</p>
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ItespDashboard;
