
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
 * EXTRATOR DE MÊS ULTRA-RESILIENTE
 * Identifica o mês 01 (Janeiro) mesmo em strings mal formatadas ou com fuso horário deslocado.
 */
const getMonthNameFromDate = (dateStr?: string): string => {
    if (!dateStr) return "Mês Indefinido";
    const s = String(dateStr).trim();
    
    // Teste 1: Regex para procurar o padrão de Janeiro (01) entre separadores
    if (s.match(/[-/.]01[-/.]/) || s.match(/^01[-/.]/) || s.match(/[-/.]01$/)) {
        return "Janeiro";
    }

    // Teste 2: Se for ISO (YYYY-MM-DD)
    const parts = s.split('-');
    if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        if (m >= 1 && m <= 12) return months[m - 1];
    }

    // Teste 3: Nomes diretos
    const upper = s.toUpperCase();
    if (upper.includes("JANEIRO") || upper.includes("JAN")) return "Janeiro";
    if (upper.includes("FEVEREIRO") || upper.includes("FEV")) return "Fevereiro";
    if (upper.includes("MARCO") || upper.includes("MAR")) return "Março";
    if (upper.includes("ABRIL") || upper.includes("ABR")) return "Abril";

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
        const allowedNorm = ALLOWED_SUPPLIERS_RAW.map(superNormalize);
        return suppliers.filter(s => {
            const sNorm = superNormalize(s.name);
            return allowedNorm.some(allowed => sNorm.includes(allowed) || allowed.includes(sNorm));
        });
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!itespSuppliers.length) return [];
        const consolidated = new Map<string, any>();

        // 1. Criar estrutura de metas
        itespSuppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            s.contractItems.forEach(ci => {
                const iNorm = superNormalize(ci.name);
                ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach(mName => {
                    const key = `${sNorm}|${iNorm}|${mName}`;
                    consolidated.set(key, {
                        supplierName: s.name,
                        productName: ci.name,
                        month: mName,
                        contractedKgMonthly: (Number(ci.totalKg) || 0) / 4,
                        receivedKg: 0,
                        unitPrice: Number(ci.valuePerKg) || 0,
                        normSupplier: sNorm,
                        normItem: iNorm
                    });
                });
            });
        });

        // 2. Processar logs de estoque
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const mName = getMonthNameFromDate(log.date);
                const logSupplierNorm = superNormalize(log.supplierName);
                const logItemNorm = superNormalize(log.itemName);

                for (let val of consolidated.values()) {
                    if (val.month === mName) {
                        const sMatch = val.normSupplier.includes(logSupplierNorm) || logSupplierNorm.includes(val.normSupplier);
                        if (sMatch) {
                            const iMatch = val.normItem.includes(logItemNorm) || logItemNorm.includes(val.normItem);
                            if (iMatch) {
                                val.receivedKg += (Number(log.quantity) || 0);
                            }
                        }
                    }
                }
            }
        });

        return Array.from(consolidated.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `itesp-${idx}`,
                shortfallKg,
                financialLoss: shortfallKg * data.unitPrice
            };
        }).filter(item => item.contractedKgMonthly > 0)
          .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

    }, [itespSuppliers, warehouseLog]);

    const filteredData = useMemo(() => {
        return comparisonData.filter(item => {
            const searchMatch = item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.productName.toLowerCase().includes(searchTerm.toLowerCase());
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
        <div className="min-h-screen bg-[#F3F4F6] text-gray-800 pb-20">
            <header className="bg-white shadow-lg p-4 flex justify-between items-center border-b-4 border-green-700 sticky top-0 z-30">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-green-800 uppercase tracking-tighter italic">Audit ITESP - Gestão 2026</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Painel de Auditoria Mensal (Janeiro a Abril)</p>
                </div>
                <button onClick={onLogout} className="bg-red-600 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg">Sair</button>
            </header>

            <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-blue-500">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Meta Janeiro-Abril</p>
                        <p className="text-2xl font-black text-blue-700">{totals.contracted.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-green-600">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Estoque Realizado</p>
                        <p className="text-2xl font-black text-green-700">{totals.received.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-red-500">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Déficit de Entrega</p>
                        <p className="text-2xl font-black text-red-600">{totals.shortfall.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-xl border-b-8 border-orange-500">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Perda Financeira</p>
                        <p className="text-2xl font-black text-orange-600">{formatCurrency(totals.loss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
                        <input type="text" placeholder="Filtrar produtor ou item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 border-2 border-gray-100 rounded-xl px-5 py-3 outline-none focus:border-green-400 font-medium" />
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="md:w-64 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold bg-gray-50">
                            <option value="all">Todo o Quadrimestre</option>
                            {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-900 text-gray-100 text-[10px] font-black uppercase tracking-widest">
                                <tr>
                                    <th className="p-4 text-left">PRODUTOR</th>
                                    <th className="p-4 text-left">PRODUTO</th>
                                    <th className="p-4 text-center">MÊS</th>
                                    <th className="p-4 text-right bg-blue-800/40">META MENSAL</th>
                                    <th className="p-4 text-right bg-green-800/40">ENTRADA ESTOQUE</th>
                                    <th className="p-4 text-right bg-red-800/40">FALTA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-black text-gray-900 text-xs uppercase">{item.supplierName}</td>
                                        <td className="p-4 text-gray-500 font-bold uppercase text-[11px]">{item.productName}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.month === 'Janeiro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{item.month}</span>
                                        </td>
                                        <td className="p-4 text-right font-black text-blue-700 font-mono">{(item.contractedKgMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                        <td className={`p-4 text-right font-black font-mono ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>{(item.receivedKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                        <td className={`p-4 text-right font-black font-mono ${item.shortfallKg > 0.01 ? 'text-red-600' : 'text-gray-200'}`}>{(item.shortfallKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="p-20 text-center text-gray-400 italic font-black uppercase tracking-widest">Nenhum dado localizado para o filtro selecionado.</td></tr>
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
