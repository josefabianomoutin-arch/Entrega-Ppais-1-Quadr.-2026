
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

/**
 * Normalização Ultra-Resiliente: 
 * Remove acentos, símbolos, espaços e pontuações.
 */
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
 * Extrator de mês universal (Versão Janeiro-Hardened):
 * Suporta Excel Serial (ex: 46022), Formatos BR, ISO, Abreviaturas e strings sujas.
 */
const getMonthNameFromDate = (dateStr?: any): string => {
    const raw = String(dateStr || "").toUpperCase().trim();
    if (!raw || raw === "UNDEFINED" || raw === "") return "Mês Indefinido";

    // 1. Caso seja Número Serial do Excel (Dias desde 30/12/1899)
    // Se o valor for um número entre 45000 e 47000, é quase certeza ser uma data de 2023-2027
    if (!isNaN(Number(raw)) && Number(raw) > 40000) {
        try {
            const excelDate = new Date((Number(raw) - 25569) * 86400 * 1000);
            if (!isNaN(excelDate.getTime())) return months[excelDate.getUTCMonth()];
        } catch (e) { /* ignore */ }
    }

    // 2. Busca exata por palavras-chave de meses (Independente do ano)
    if (raw.includes("JANEIRO") || raw.includes("JAN/") || raw.includes("01/2026") || raw.includes("/01/26") || raw.includes("-01-") || raw.startsWith("01/") || raw.startsWith("1/")) return "Janeiro";
    if (raw.includes("FEVEREIRO") || raw.includes("FEV/") || raw.includes("02/2026") || raw.includes("/02/26") || raw.includes("-02-") || raw.startsWith("02/") || raw.startsWith("2/")) return "Fevereiro";
    if (raw.includes("MARCO") || raw.includes("MAR/") || raw.includes("03/2026") || raw.includes("/03/26") || raw.includes("-03-") || raw.startsWith("03/") || raw.startsWith("3/")) return "Março";
    if (raw.includes("ABRIL") || raw.includes("ABR/") || raw.includes("04/2026") || raw.includes("/04/26") || raw.includes("-04-") || raw.startsWith("04/") || raw.startsWith("4/")) return "Abril";

    // 3. Regex para capturar o mês em formatos numéricos flexíveis (DD/MM/YYYY ou YYYY-MM-DD)
    const parts = raw.split(/[/\-.]/);
    if (parts.length >= 2) {
        let mStr = "";
        // Se a primeira parte tem 4 dígitos (2026-01-01), o mês é a segunda parte
        if (parts[0].length === 4) mStr = parts[1];
        // Se for 01/01/2026, o mês é a segunda parte
        else mStr = parts[1];

        const mIdx = parseInt(mStr, 10) - 1;
        if (mIdx >= 0 && mIdx < 12) return months[mIdx];
    }

    return "Mês Indefinido";
};

// Lista de produtores ITESP Autorizados
const ALLOWED_SUPPLIERS_RAW = [
    'BENEDITO OSMAR RAVAZZI',
    'ADAO MAXIMO DA FONSECA',
    'ANTONIO JOAQUIM DE OLIVEIRA',
    'CLAUDEMIR LUIZ TURRA',
    'CONSUELO ALCANTARA FERREIRA GUIMARAES',
    'DANILO ANTONIO MAXIMO',
    'DOMINGO APARECIDO ANTONINO',
    'LEONARDO FELIPE VELHO MARSOLA',
    'LIDIA BERNARDES MONTEIRO BARBOSA',
    'LUCIMARA MARQUES PEREIRA',
    'MARCELO GIBERTONI',
    'MARCOS DONADON AGOSTINHO',
    'MICHEL JOSE RAVAZZI',
    'MOISES PINHEIRO DE SA',
    'PAULO HENRIQUE PUGLIERI',
    'PEDRO TEODORO RODRIGUES',
    'ROSA MARIA GARBIN VELLONE',
    'SAULO ANTONINO',
    'SONIA REGINA COLOMBO CELESTINO',
    'TANIA MARA BALDAO DE BARROS'
];

const ItespDashboard: React.FC<ItespDashboardProps> = ({ suppliers = [], warehouseLog = [], onLogout }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierName, setSelectedSupplierName] = useState('all'); 
    const [selectedMonth, setSelectedMonth] = useState('all');

    // Filtra fornecedores ITESP de forma flexível
    const itespSuppliers = useMemo(() => {
        const allowedNorm = ALLOWED_SUPPLIERS_RAW.map(superNormalize);
        return suppliers.filter(s => {
            const sNorm = superNormalize(s.name);
            return allowedNorm.some(allowed => sNorm.includes(allowed) || allowed.includes(sNorm));
        });
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!itespSuppliers.length) return [];

        const consolidated = new Map<string, {
            supplierName: string,
            productName: string,
            month: string,
            contractedKgMonthly: number,
            receivedKg: number,
            unitPrice: number,
            normSupplier: string,
            normItem: string
        }>();

        // 1. Inicializar Metas Baseadas no Contrato (Jan-Abr)
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
                        contractedKgMonthly: (ci.totalKg || 0) / 4,
                        receivedKg: 0,
                        unitPrice: ci.valuePerKg || 0,
                        normSupplier: sNorm,
                        normItem: iNorm
                    });
                });
            });
        });

        // 2. Acumular Dados Reais do Almoxarifado (WarehouseLog)
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                const mName = getMonthNameFromDate(log.date);
                
                if (mName === "Mês Indefinido" || !['Janeiro', 'Fevereiro', 'Março', 'Abril'].includes(mName)) return;

                // Match Inteligente: Procura por inclusão mútua (Fuzzy)
                let matched = false;
                for (let val of consolidated.values()) {
                    if (val.month === mName && 
                        (val.normSupplier.includes(sNorm) || sNorm.includes(val.normSupplier))) {
                        
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
            acc.contractedKgMonthly += item.contractedKgMonthly || 0;
            acc.receivedKg += item.receivedKg || 0;
            acc.shortfallKg += item.shortfallKg || 0;
            acc.financialLoss += item.financialLoss || 0;
            return acc;
        }, {
            contractedKgMonthly: 0,
            receivedKg: 0,
            shortfallKg: 0,
            financialLoss: 0,
        });
    }, [filteredData]);

    const supplierOptions = useMemo(() => {
        const uniqueNames = [...new Set(itespSuppliers.map(s => s.name))];
        return uniqueNames.sort().map(name => ({ value: name, displayName: name }));
    }, [itespSuppliers]);

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-800 pb-20">
            <header className="bg-white/95 backdrop-blur-md shadow-lg p-4 flex justify-between items-center sticky top-0 z-30 border-b border-green-100">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-green-800 uppercase tracking-tighter">Auditoria ITESP - Monitoramento 1º Quadr.</h1>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Contrato Administrativo vs. Entradas Reais (Físico)</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 text-xs uppercase tracking-widest">Sair</button>
            </header>

            <main className="p-4 md:p-8 max-w-[1700px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-blue-500 transform transition-transform hover:translate-y-[-4px]">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Meta Acumulada no Filtro</p>
                        <p className="text-3xl font-black text-blue-700">{totals.contractedKgMonthly.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-green-600 transform transition-transform hover:translate-y-[-4px]">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Entrada Real (Janeiro+)</p>
                        <p className="text-3xl font-black text-green-700">{totals.receivedKg.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-red-500 transform transition-transform hover:translate-y-[-4px]">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Déficit Localizado</p>
                        <p className="text-3xl font-black text-red-600">{totals.shortfallKg.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-orange-500 transform transition-transform hover:translate-y-[-4px]">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Prejuízo Calculado</p>
                        <p className="text-3xl font-black text-orange-600">{formatCurrency(totals.financialLoss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-2xl animate-fade-in border border-gray-100">
                    <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
                        <div className="w-full lg:w-96">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Pesquisa Global</label>
                            <input 
                                type="text" 
                                placeholder="Produtor ou Produto..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 bg-gray-50 transition-all shadow-inner"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                             <div className="flex-1 lg:w-80">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Filtrar Produtor ITESP</label>
                                <select 
                                    value={selectedSupplierName} 
                                    onChange={(e) => setSelectedSupplierName(e.target.value)}
                                    className="w-full border-2 border-indigo-100 rounded-2xl px-4 py-3 text-sm font-black outline-none text-indigo-900 bg-indigo-50 cursor-pointer shadow-sm"
                                >
                                    <option value="all">Todos os produtores ITESP</option>
                                    {supplierOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.displayName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full sm:w-56">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Mês Selecionado</label>
                                <select 
                                    value={selectedMonth} 
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none text-gray-600 bg-gray-50 cursor-pointer shadow-sm"
                                >
                                    <option value="all">Todos (Jan-Abr)</option>
                                    {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-900 text-gray-200 text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="p-5 text-left border-b border-gray-800">PRODUTOR</th>
                                    <th className="p-5 text-left border-b border-gray-800">PRODUTO</th>
                                    <th className="p-5 text-center border-b border-gray-800">MÊS</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-blue-900/50">META CONTRATO</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-green-900/50">FISICO EM ESTOQUE</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-red-900/50">DIFERENÇA (KG)</th>
                                    <th className="p-5 text-right border-b border-gray-800">PREJUÍZO ESTIMADO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-green-50/30 transition-colors group">
                                        <td className="p-5 font-black text-gray-900 uppercase text-xs">
                                            {item.supplierName}
                                        </td>
                                        <td className="p-5 text-gray-500 uppercase text-[11px] font-bold">
                                            {item.productName}
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.month === 'Janeiro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                {item.month}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right font-black text-blue-700 font-mono bg-blue-50/20">
                                            {item.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className={`p-5 text-right font-black font-mono bg-green-50/20 ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                                            {item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className={`p-5 text-right font-black font-mono bg-red-50/50 ${item.shortfallKg > 0.01 ? 'text-red-600 animate-pulse' : 'text-gray-200'}`}>
                                            {item.shortfallKg > 0.01 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                        </td>
                                        <td className={`p-5 text-right font-black ${item.financialLoss > 0.01 ? 'text-red-700' : 'text-gray-200'}`}>
                                            {item.financialLoss > 0.01 ? formatCurrency(item.financialLoss) : 'R$ 0,00'}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="p-32 text-center bg-gray-50/50">
                                            <div className="max-w-md mx-auto">
                                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </div>
                                                <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Dados de Janeiro não localizados.</p>
                                                <p className="text-xs text-gray-400 mt-2 italic">Dica: Se importou via planilha, certifique-se de que a coluna de data não está formatada como 'Número' no Excel.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-900 font-black text-xs border-t-4 border-green-800 text-white">
                                <tr>
                                    <td colSpan={3} className="p-5 text-left uppercase tracking-tighter">Consolidação de Auditoria Consumada</td>
                                    <td className="p-5 text-right text-blue-400 font-mono text-lg">{totals.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-5 text-right text-green-400 font-mono text-lg">{totals.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-5 text-right text-red-400 font-mono text-lg">{totals.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-5 text-right text-orange-400 text-xl">{formatCurrency(totals.financialLoss)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </main>

            <style>{`
              @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
              .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
              ::-webkit-scrollbar { width: 8px; height: 8px; }
              ::-webkit-scrollbar-track { background: #f1f1f1; }
              ::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
              ::-webkit-scrollbar-thumb:hover { background: #555; }
            `}</style>
        </div>
    );
};

export default ItespDashboard;
