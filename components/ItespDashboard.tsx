
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
 * Remove acentos, símbolos e espaços para comparação cruzada total.
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
 * Extrator de mês inteligente:
 * Entende datas ISO (2026-01-01), BR (01/01/2026), 
 * ou nomes do mês por extenso vindos de planilhas Excel.
 */
const getMonthNameFromDate = (dateStr?: string, timestamp?: string): string => {
    const raw = (dateStr || (timestamp ? timestamp.split('T')[0] : "")).trim();
    if (!raw) return "Mês Indefinido";

    // 1. Tenta identificar se o nome do mês está escrito na string (ex: "Janeiro de 2026")
    const lowerRaw = raw.toLowerCase();
    for (let i = 0; i < months.length; i++) {
        if (lowerRaw.includes(months[i].toLowerCase())) return months[i];
    }

    // 2. Tenta tratar como data numérica (DD/MM/YYYY ou YYYY-MM-DD)
    const sep = raw.includes('/') ? '/' : '-';
    const parts = raw.split(sep);

    if (parts.length === 3) {
        let mIdx = -1;
        // Se a primeira parte tem 4 dígitos, é ISO: YYYY-MM-DD -> Mês é parts[1]
        if (parts[0].length === 4) {
            mIdx = parseInt(parts[1], 10) - 1;
        } else if (parts[2].length === 4 || parts[2].length === 2) {
            // Caso contrário, assume BR: DD/MM/YYYY -> Mês é parts[1]
            mIdx = parseInt(parts[1], 10) - 1;
        }

        if (mIdx >= 0 && mIdx < 12) return months[mIdx];
    }

    return "Mês Indefinido";
};

const ALLOWED_SUPPLIERS = [
    'BENEDITO OSMAR RAVAZZI',
    'ADÃO MÁXIMO DA FONSECA',
    'ANTÔNIO JOAQUIM DE OLIVEIRA',
    'CLAUDEMIR LUIZ TURRA',
    'CONSUELO ALCANTARA FERREIRA GUIMARÃES',
    'DANILO ANTONIO MÁXIMO',
    'DOMINGO APARECIDO ANTONINO',
    'LEONARDO FELIPE VELHO MARSOLA',
    'LÍDIA BERNARDES MONTEIRO BARBOSA',
    'LUCIMARA MARQUES PEREIRA',
    'MARCELO GIBERTONI',
    'MARCOS DONADON AGOSTINHO',
    'MICHEL JOSÉ RAVAZZI',
    'MOISÉS PINHEIRO DE SA',
    'PAULO HENRIQUE PUGLIERI',
    'PEDRO TEODORO RODRIGUES',
    'ROSA MARIA GARBIN VELLONE',
    'SAULO ANTONINO',
    'SÔNIA REGINA COLOMBO CELESTINO',
    'TÂNIA MARA BALDÃO DE BARROS'
];

const ItespDashboard: React.FC<ItespDashboardProps> = ({ suppliers = [], warehouseLog = [], onLogout }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierName, setSelectedSupplierName] = useState('all'); 
    const [selectedMonth, setSelectedMonth] = useState('all');

    const itespSuppliers = useMemo(() => {
        const normalizedAllowed = ALLOWED_SUPPLIERS.map(superNormalize);
        return suppliers.filter(s => normalizedAllowed.includes(superNormalize(s.name)));
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!itespSuppliers || itespSuppliers.length === 0) return [];

        const consolidated = new Map<string, {
            supplierName: string,
            productName: string,
            month: string,
            contractedKgMonthly: number,
            billedKg: number,
            receivedKg: number,
            invoices: Set<string>,
            unitPrice: number,
            normSupplier: string,
            normItem: string
        }>();

        // 1. Base: Metas Contratuais (Jan a Abr)
        itespSuppliers.forEach(s => {
            const supplierNorm = superNormalize(s.name);
            s.contractItems.forEach(ci => {
                const itemNorm = superNormalize(ci.name);
                ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach(mName => {
                    const key = `${supplierNorm}|${itemNorm}|${mName}`;
                    consolidated.set(key, {
                        supplierName: s.name,
                        productName: ci.name,
                        month: mName,
                        contractedKgMonthly: (ci.totalKg || 0) / 4,
                        billedKg: 0,
                        receivedKg: 0,
                        invoices: new Set(),
                        unitPrice: ci.valuePerKg || 0,
                        normSupplier: supplierNorm,
                        normItem: itemNorm
                    });
                });
            });
        });

        // 2. Acumulação de Notas Fiscais (Informativo)
        itespSuppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const mName = getMonthNameFromDate(d.date);
                    const dItemNorm = superNormalize(d.item);
                    
                    const key = `${sNorm}|${dItemNorm}|${mName}`;
                    const entry = consolidated.get(key);
                    if (entry) {
                        entry.billedKg += (d.kg || 0);
                        if (d.invoiceNumber) entry.invoices.add(d.invoiceNumber);
                    }
                }
            });
        });

        // 3. Auditoria Real do Estoque (Físico no Almoxarifado)
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                const mName = getMonthNameFromDate(log.date, log.timestamp);
                
                // Busca exata pelo mês extraído
                const key = `${sNorm}|${iNorm}|${mName}`;
                const entry = consolidated.get(key);
                
                if (entry) {
                    entry.receivedKg += (Number(log.quantity) || 0);
                    if (log.inboundInvoice) entry.invoices.add(log.inboundInvoice);
                } else {
                    // Busca por semelhança de nome caso o almoxarifado escreva o item de forma abreviada
                    for (let ent of consolidated.values()) {
                        if (ent.normSupplier === sNorm && ent.month === mName) {
                            if (ent.normItem.includes(iNorm) || iNorm.includes(ent.normItem)) {
                                ent.receivedKg += (Number(log.quantity) || 0);
                            }
                        }
                    }
                }
            }
        });

        // 4. Transformação Final do Mapa para Lista
        return Array.from(consolidated.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `itesp-row-${idx}`,
                invoiceList: Array.from(data.invoices).join(', ') || 'Nenhuma NF',
                shortfallKg: shortfallKg,
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

    const supplierOptions = useMemo(() => {
        const uniqueNames = [...new Set(itespSuppliers.map(s => s.name))];
        return uniqueNames.sort().map(name => ({ value: name, displayName: name }));
    }, [itespSuppliers]);
    
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

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-800 pb-20">
            <header className="bg-white/95 backdrop-blur-md shadow-lg p-4 flex justify-between items-center sticky top-0 z-30 border-b border-green-100">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-green-800 uppercase tracking-tighter">Auditoria ITESP - Monitoramento 1º Quadr.</h1>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Comparativo de Saldo Contratual vs. Estoque Real Físico</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 text-xs uppercase tracking-widest">Sair</button>
            </header>

            <main className="p-4 md:p-8 max-w-[1700px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-blue-500 transform hover:scale-[1.02] transition-transform">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Meta de Contrato (Filtro)</p>
                        <p className="text-3xl font-black text-blue-700">{totals.contractedKgMonthly.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-green-600 transform hover:scale-[1.02] transition-transform">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Entrada Real no Estoque</p>
                        <p className="text-3xl font-black text-green-700">{totals.receivedKg.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-red-500 transform hover:scale-[1.02] transition-transform">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Déficit de Abastecimento</p>
                        <p className="text-3xl font-black text-red-600">{totals.shortfallKg.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-b-8 border-orange-500 transform hover:scale-[1.02] transition-transform">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Prejuízo Calculado</p>
                        <p className="text-3xl font-black text-orange-600">{formatCurrency(totals.financialLoss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-2xl animate-fade-in border border-gray-100">
                    <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
                        <div className="w-full lg:w-96">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Pesquisar registros</label>
                            <input 
                                type="text" 
                                placeholder="Produtor ou Produto..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 bg-gray-50 transition-all"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                             <div className="flex-1 lg:w-80">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Filtro por Produtor</label>
                                <select 
                                    value={selectedSupplierName} 
                                    onChange={(e) => setSelectedSupplierName(e.target.value)}
                                    className="w-full border-2 border-indigo-100 rounded-2xl px-4 py-3 text-sm font-black outline-none text-indigo-900 bg-indigo-50 cursor-pointer shadow-sm hover:bg-indigo-100 transition-colors"
                                >
                                    <option value="all">Todos os produtores ITESP</option>
                                    {supplierOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.displayName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full sm:w-56">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-1 block">Filtro por Mês</label>
                                <select 
                                    value={selectedMonth} 
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none text-gray-600 bg-gray-50 cursor-pointer"
                                >
                                    <option value="all">Todos (Jan-Abr)</option>
                                    {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-900 text-gray-200 text-[10px] uppercase font-black tracking-widest">
                                <tr>
                                    <th className="p-5 text-left border-b border-gray-800">PRODUTOR</th>
                                    <th className="p-5 text-left border-b border-gray-800">PRODUTO</th>
                                    <th className="p-5 text-center border-b border-gray-800">MÊS</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-blue-900/50">META CONTRATO</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-green-900/50">FISICO ESTOQUE</th>
                                    <th className="p-5 text-right border-b border-gray-800 bg-red-900/50">FALTA REAL</th>
                                    <th className="p-5 text-right border-b border-gray-800">PREJUÍZO (EST.)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-green-50/50 transition-colors group">
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
                                                <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nenhuma movimentação de Janeiro localizada.</p>
                                                <p className="text-xs text-gray-400 mt-2">Dica: Verifique se as importações de planilha do almoxarifado foram processadas corretamente.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-900 font-black text-xs border-t-4 border-green-800 text-white">
                                <tr>
                                    <td colSpan={3} className="p-5 text-left uppercase tracking-tighter">Consolidação Geral Auditoria</td>
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
