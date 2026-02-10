
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';

interface ItespDashboardProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  onLogout: () => void;
}

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
 * Extrator de mês e ano Ultra-Resiliente: 
 * Retorna o nome do mês APENAS se o ano for 2026.
 */
const getMonthNameFromDate = (dateStr?: string): string => {
    if (!dateStr) return "Mês Indefinido";
    
    // Normaliza separadores
    const cleanStr = dateStr.replace(/[\.\/]/g, '-');
    const parts = cleanStr.split('-');

    if (parts.length === 3) {
        let mIdx = -1;
        let year = "";

        // Se for ISO (2026-01-01)
        if (parts[0].length === 4) {
            year = parts[0];
            mIdx = parseInt(parts[1], 10) - 1;
        } else {
            // Se for BR (01-01-2026)
            year = parts[2];
            if (year.length === 2) year = '20' + year;
            mIdx = parseInt(parts[1], 10) - 1;
        }

        // TRAVA DE SEGURANÇA: Apenas dados de 2026
        if (year !== "2026") return "Mês Indefinido";
        if (mIdx >= 0 && mIdx < 12) return months[mIdx];
    }
    
    // Fallback: Busca por nomes de meses por extenso
    const upper = dateStr.toUpperCase();
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
    const [selectedSupplierName, setSelectedSupplierName] = useState('all'); 
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

        // 1. Inicializar Metas (Jan-Abr)
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

        // 2. Acumular Entradas do Almoxarifado
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                const mName = getMonthNameFromDate(log.date);
                
                // Filtro estrito para o 1º quadrimestre de 2026
                if (!['Janeiro', 'Fevereiro', 'Março', 'Abril'].includes(mName)) return;

                // Match inteligente: Procura por nome do fornecedor e item
                let matched = false;
                for (let val of consolidated.values()) {
                    if (val.month === mName && (val.normSupplier.includes(sNorm) || sNorm.includes(val.normSupplier))) {
                        // Verifica o item (Fuzzy Match)
                        if (val.normItem.includes(iNorm) || iNorm.includes(val.normItem)) {
                            val.receivedKg += (Number(log.quantity) || 0);
                            matched = true;
                            break;
                        }
                    }
                }
            }
        });

        return Array.from(consolidated.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `itesp-row-${idx}`,
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
            const supplierMatch = selectedSupplierName === 'all' || item.supplierName === selectedSupplierName;
            return searchMatch && monthMatch && supplierMatch;
        });
    }, [comparisonData, searchTerm, selectedMonth, selectedSupplierName]);

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
            <header className="bg-white shadow-lg p-4 flex justify-between items-center sticky top-0 z-30 border-b-4 border-green-700">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-green-800 uppercase tracking-tighter">Audit ITESP - Gestão 1º Quadr. 2026</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Consolidação de Entradas Físicas vs. Metas Contratuais</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 text-white font-black py-2 px-6 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-all shadow-md">Sair</button>
            </header>

            <main className="p-4 md:p-8 max-w-[1700px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-blue-500">
                        <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Meta Acumulada (2026)</p>
                        <p className="text-3xl font-black text-blue-700">{totals.contracted.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-green-600">
                        <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Entrada Real (Janeiro+)</p>
                        <p className="text-3xl font-black text-green-700">{totals.received.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-red-500">
                        <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Déficit de Entrega</p>
                        <p className="text-3xl font-black text-red-600">{totals.shortfall.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-orange-500">
                        <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Prejuízo Estimado</p>
                        <p className="text-3xl font-black text-orange-600">{formatCurrency(totals.loss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-2xl animate-fade-in">
                    <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
                        <input type="text" placeholder="Produtor ou Produto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full lg:w-96 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm outline-none focus:border-green-400 bg-gray-50 transition-all" />
                        <div className="flex gap-3 w-full lg:w-auto">
                            <select value={selectedSupplierName} onChange={(e) => setSelectedSupplierName(e.target.value)} className="flex-1 lg:w-80 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-black text-indigo-900 bg-indigo-50">
                                <option value="all">Todos os Produtores ITESP</option>
                                {[...new Set(itespSuppliers.map(s => s.name))].sort().map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-48 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-600 bg-gray-50">
                                <option value="all">Jan - Abr</option>
                                {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-900 text-gray-200 text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="p-5 text-left border-b border-gray-800">PRODUTOR</th>
                                    <th className="p-5 text-left border-b border-gray-800">PRODUTO</th>
                                    <th className="p-5 text-center border-b border-gray-800">MÊS</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-blue-900/50">META</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-green-900/50">REALIZADO</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-red-900/50">FALTA</th>
                                    <th className="p-5 text-right border-b border-gray-800">PREJUÍZO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-green-50 transition-colors group">
                                        <td className="p-5 font-black text-gray-900 uppercase text-xs">{item.supplierName}</td>
                                        <td className="p-5 text-gray-500 uppercase text-[11px] font-bold">{item.productName}</td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.month === 'Janeiro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{item.month}</span>
                                        </td>
                                        <td className="p-5 text-right font-black text-blue-700 font-mono bg-blue-50/20">{item.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                        <td className={`p-5 text-right font-black font-mono bg-green-50/20 ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>{item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                        <td className={`p-5 text-right font-black font-mono bg-red-50/20 ${item.shortfallKg > 0.01 ? 'text-red-600 animate-pulse' : 'text-gray-200'}`}>{item.shortfallKg > 0.01 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</td>
                                        <td className={`p-5 text-right font-black ${item.financialLoss > 0.01 ? 'text-red-700' : 'text-gray-200'}`}>{item.financialLoss > 0.01 ? formatCurrency(item.financialLoss) : 'R$ 0,00'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={7} className="p-32 text-center text-gray-400 font-black uppercase tracking-widest italic bg-gray-50">Dados de Janeiro (2026) não localizados ou erro de fuso horário.</td></tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-900 text-white font-black text-xs border-t-4 border-green-800">
                                <tr>
                                    <td colSpan={3} className="p-5 text-left uppercase">Consolidação Geral de Auditoria</td>
                                    <td className="p-5 text-right text-blue-400 font-mono text-lg">{totals.contracted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-5 text-right text-green-400 font-mono text-lg">{totals.received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-5 text-right text-red-400 font-mono text-lg">{totals.shortfall.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-5 text-right text-orange-400 text-xl">{formatCurrency(totals.loss)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ItespDashboard;
