
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement, PerCapitaConfig } from '../types';
import WeeklyScheduleControl from './WeeklyScheduleControl';

interface ItespDashboardProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  perCapitaConfig?: PerCapitaConfig;
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

const ItespDashboard: React.FC<ItespDashboardProps> = ({ suppliers = [], warehouseLog = [], perCapitaConfig, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'audit' | 'schedule'>('audit');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState('all');

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

        // 1. Inicializa Metas Anuais (Jan a Dez)
        itespSuppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            
            // Tenta encontrar o cronograma mensal se for um produtor PPAIS/ITESP
            const ppaisProducer = perCapitaConfig?.ppaisProducers?.find(p => superNormalize(p.name) === sNorm || p.cpfCnpj === s.cpf);
            
            // Se houver cronograma, usamos apenas os meses com semanas agendadas
            // Caso contrário, usamos o fallback de 4 meses (Jan-Abr) que era o padrão anterior para ITESP
            const activeMonths = ppaisProducer?.monthlySchedule 
                ? months.filter(m => (ppaisProducer.monthlySchedule[m] || []).length > 0)
                : months.slice(0, 4); 
            
            const monthsCount = activeMonths.length || 4;

            s.contractItems.forEach(ci => {
                const iNorm = superNormalize(ci.name);
                months.forEach(mName => {
                    const hasContractInMonth = activeMonths.includes(mName);
                    const key = `${sNorm}|${iNorm}|${mName}`;
                    consolidatedMap.set(key, {
                        supplierName: s.name,
                        productName: ci.name,
                        month: mName,
                        contractedKgMonthly: hasContractInMonth ? (Number(ci.totalKg) || 0) / monthsCount : 0,
                        receivedKg: 0,
                        unitPrice: Number(ci.valuePerKg) || 0,
                        sNorm, iNorm,
                        logEntries: [] // NOVO: Guarda os logs originais
                    });
                });
            });
        });

        // 2. Acumula Entradas Reais (via Consulta de Notas Fiscais / Deliveries)
        itespSuppliers.forEach(supplier => {
            const sNorm = superNormalize(supplier.name);
            (supplier.deliveries || []).forEach(delivery => {
                // Consideramos apenas entregas com item definido e que não seja o placeholder de agendamento
                if (!delivery.item || delivery.item === 'AGENDAMENTO PENDENTE') return;

                const dINorm = superNormalize(delivery.item);
                const dMonth = getMonthNameFromDateString(delivery.date);

                if (!months.includes(dMonth)) return;

                // Busca no mapa
                for (const [key, entry] of consolidatedMap.entries()) {
                    if (entry.month === dMonth && entry.sNorm === sNorm) {
                        // Match de item
                        const iMatch = entry.iNorm === dINorm || entry.iNorm.includes(dINorm) || dINorm.includes(entry.iNorm);
                        if (iMatch) {
                            entry.receivedKg += (Number(delivery.kg) || 0);
                            entry.logEntries.push({
                                id: delivery.id,
                                date: delivery.date,
                                lotNumber: (delivery.lots && delivery.lots[0]?.lotNumber) || 'N/A',
                                inboundInvoice: delivery.invoiceNumber || 'N/A',
                                quantity: delivery.kg || 0
                            });
                        }
                    }
                }
            });
        });

        return Array.from(consolidatedMap.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `itp-${idx}-${Date.now()}`,
                shortfallKg,
                financialLoss: shortfallKg * data.unitPrice
            };
        }).filter(item => item.contractedKgMonthly > 0 || item.receivedKg > 0)
          .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

    }, [itespSuppliers, perCapitaConfig]);

    const filteredData = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return comparisonData.filter(item => {
            const searchMatch = item.supplierName.toLowerCase().includes(lowerSearch) || 
                                item.productName.toLowerCase().includes(lowerSearch);
            const monthMatch = selectedMonth === 'all' || item.month === selectedMonth;
            const productMatch = selectedProduct === 'all' || item.productName === selectedProduct;
            return searchMatch && monthMatch && productMatch;
        });
    }, [comparisonData, searchTerm, selectedMonth, selectedProduct]);

    const productOptions = useMemo(() => {
        const products = new Set<string>();
        comparisonData.forEach(item => products.add(item.productName));
        return Array.from(products).sort();
    }, [comparisonData]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, item) => {
            acc.contracted += item.contractedKgMonthly;
            // Cap received by contracted so over-deliveries don't mask shortfalls in totals
            acc.received += Math.min(item.receivedKg, item.contractedKgMonthly);
            acc.shortfall += item.shortfallKg;
            acc.loss += item.financialLoss;
            return acc;
        }, { contracted: 0, received: 0, shortfall: 0, loss: 0 });
    }, [filteredData]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-gray-800 pb-20 font-sans">
            <header className="bg-white/80 backdrop-blur-md shadow-sm p-6 flex justify-between items-center border-b border-gray-100 sticky top-0 z-[100]">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Módulo ITESP • 2026</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic leading-none">Auditoria de Produtores</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
                        <button 
                            onClick={() => setActiveTab('audit')} 
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${activeTab === 'audit' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-green-700'}`}
                        >
                            Auditoria Anual
                        </button>
                        <button 
                            onClick={() => setActiveTab('schedule')} 
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${activeTab === 'schedule' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-green-700'}`}
                        >
                            Agenda Semanal
                        </button>
                    </div>
                    <button onClick={onLogout} className="bg-white hover:bg-red-50 text-red-600 border border-red-100 font-black py-2.5 px-6 rounded-2xl text-[10px] uppercase shadow-sm active:scale-95 transition-all">Sair do Sistema</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-10">
                {/* Mobile Tab Switcher */}
                <div className="md:hidden flex bg-white p-1.5 rounded-[2rem] shadow-lg border border-gray-100">
                    <button 
                        onClick={() => setActiveTab('audit')} 
                        className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all ${activeTab === 'audit' ? 'bg-green-700 text-white shadow-lg' : 'text-gray-400'}`}
                    >
                        Auditoria
                    </button>
                    <button 
                        onClick={() => setActiveTab('schedule')} 
                        className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all ${activeTab === 'schedule' ? 'bg-green-700 text-white shadow-lg' : 'text-gray-400'}`}
                    >
                        Agenda
                    </button>
                </div>

                {activeTab === 'audit' ? (
                    <div className="space-y-10 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 hover:shadow-2xl transition-shadow group">
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta de Recebimento</p>
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">{totals.contracted.toLocaleString('pt-BR')} <span className="text-sm font-bold text-gray-300">kg</span></p>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 hover:shadow-2xl transition-shadow group">
                                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Realizado (NF)</p>
                                <p className="text-3xl font-black text-green-600 tracking-tighter">{totals.received.toLocaleString('pt-BR')} <span className="text-sm font-bold text-green-300">kg</span></p>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 hover:shadow-2xl transition-shadow group">
                                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Déficit Faltante</p>
                                <p className="text-3xl font-black text-red-600 tracking-tighter">{totals.shortfall.toLocaleString('pt-BR')} <span className="text-sm font-bold text-red-300">kg</span></p>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 hover:shadow-2xl transition-shadow group">
                                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Impacto Financeiro</p>
                                <p className="text-3xl font-black text-orange-600 tracking-tighter">{formatCurrency(totals.loss)}</p>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-gray-50">
                            <div className="flex flex-col xl:flex-row justify-between gap-6 mb-10">
                                <div className="flex-1 relative group">
                                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                                        <svg className="h-6 w-6 text-gray-300 group-focus-within:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar por produtor ou produto..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full pl-16 pr-8 py-5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-[2rem] outline-none font-black text-gray-700 transition-all shadow-inner placeholder:text-gray-300" 
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="relative">
                                        <select 
                                            value={selectedProduct} 
                                            onChange={(e) => setSelectedProduct(e.target.value)} 
                                            className="w-full sm:w-72 appearance-none border-2 border-gray-100 rounded-[1.5rem] pl-6 pr-12 py-5 font-black bg-white text-green-800 outline-none cursor-pointer focus:border-green-500 transition-all shadow-sm"
                                        >
                                            <option value="all">Todos os Produtos</option>
                                            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                            <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <select 
                                            value={selectedMonth} 
                                            onChange={(e) => setSelectedMonth(e.target.value)} 
                                            className="w-full sm:w-72 appearance-none border-2 border-gray-100 rounded-[1.5rem] pl-6 pr-12 py-5 font-black bg-white text-green-800 outline-none cursor-pointer focus:border-green-500 transition-all shadow-sm"
                                        >
                                            <option value="all">Período Completo</option>
                                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                            <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-2 border-gray-50 rounded-[2.5rem] overflow-hidden shadow-inner bg-gray-50/30">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
                                            <tr>
                                                <th className="p-8 text-left">PRODUTOR ITESP</th>
                                                <th className="p-8 text-left">GÊNERO ALIMENTÍCIO</th>
                                                <th className="p-8 text-center">MÊS</th>
                                                <th className="p-8 text-right bg-blue-900/50">META</th>
                                                <th className="p-8 text-right bg-green-900/50">ESTOQUE</th>
                                                <th className="p-8 text-right bg-red-900/50">SALDO</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {filteredData.length > 0 ? filteredData.map(item => (
                                                <tr 
                                                    key={item.id} 
                                                    onClick={() => setSelectedDetail(item)}
                                                    className="hover:bg-green-50/50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="p-8">
                                                        <p className="font-black text-gray-900 uppercase text-xs leading-none mb-1 group-hover:text-green-700 transition-colors">{item.supplierName}</p>
                                                        <p className="text-[10px] font-mono text-gray-400 tracking-tighter italic">Produtor Assentado</p>
                                                    </td>
                                                    <td className="p-8">
                                                        <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight group-hover:bg-green-100 group-hover:text-green-700 transition-colors">
                                                            {item.productName}
                                                        </span>
                                                    </td>
                                                    <td className="p-8 text-center">
                                                        <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-sm ${item.month === 'Janeiro' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-100'}`}>{item.month}</span>
                                                    </td>
                                                    <td className="p-8 text-right font-black text-blue-700 font-mono text-xs">{(item.contractedKgMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[9px] opacity-50">kg</span></td>
                                                    <td className={`p-8 text-right font-black font-mono text-xs ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>{(item.receivedKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[9px] opacity-50">kg</span></td>
                                                    <td className={`p-8 text-right font-black font-mono text-xs ${item.shortfallKg > 0.01 ? 'text-red-600' : 'text-gray-200'}`}>
                                                        {item.shortfallKg > 0.01 ? `-${item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✓ OK'}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={6} className="p-32 text-center">
                                                    <div className="flex flex-col items-center gap-6 opacity-20">
                                                        <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <p className="text-gray-600 font-black uppercase tracking-widest text-xl text-center">Nenhum dado capturado para o período.<br/><span className="text-xs font-normal normal-case">Verifique a Consulta de Notas Fiscais no Almoxarifado.</span></p>
                                                    </div>
                                                </td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-4 mb-8 pl-4">
                            <div className="w-2 h-10 bg-green-500 rounded-full"></div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Agenda Semanal ITESP</h3>
                                <p className="text-sm text-gray-400 font-medium">Controle de entregas exclusivo para produtores ITESP.</p>
                            </div>
                        </div>
                        <WeeklyScheduleControl 
                            suppliers={suppliers} 
                            itespOnly={true} 
                            title="Agenda Semanal ITESP" 
                            subtitle="Controle de entregas exclusivo para produtores ITESP."
                        />
                    </div>
                )}

                {selectedDetail && (
                    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-[200] flex justify-center items-center p-4 animate-fade-in">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-up border border-white/20">
                            <div className="bg-gradient-to-br from-green-800 to-green-900 p-10 text-white flex justify-between items-start relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Detalhes da Auditoria</span>
                                    </div>
                                    <h3 className="text-4xl font-black uppercase tracking-tighter italic">{selectedDetail.productName}</h3>
                                    <p className="text-green-200 font-bold uppercase text-xs tracking-widest mt-2 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                        {selectedDetail.supplierName} • {selectedDetail.month}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedDetail(null)} className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all group relative z-10">
                                    <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="p-10 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Meta Mensal</p>
                                        <p className="text-2xl font-black text-blue-700 tracking-tighter">{selectedDetail.contractedKgMonthly.toLocaleString('pt-BR')} <span className="text-xs">kg</span></p>
                                    </div>
                                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Recebido</p>
                                        <p className="text-2xl font-black text-green-700 tracking-tighter">{selectedDetail.receivedKg.toLocaleString('pt-BR')} <span className="text-xs">kg</span></p>
                                    </div>
                                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Déficit Atual</p>
                                        <p className="text-2xl font-black text-red-600 tracking-tighter">{selectedDetail.shortfallKg.toLocaleString('pt-BR')} <span className="text-xs">kg</span></p>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            Registros de Notas Fiscais (Entradas)
                                        </h4>
                                        <span className="text-[10px] font-black text-gray-300 uppercase">{selectedDetail.logEntries.length} registros</span>
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar border-2 border-gray-50 rounded-[2rem] shadow-inner bg-gray-50/30">
                                        <table className="w-full text-xs">
                                            <thead className="bg-white sticky top-0 z-10">
                                                <tr className="text-gray-400 font-black uppercase text-[9px] border-b border-gray-100">
                                                    <th className="p-5 text-left">Data Doc.</th>
                                                    <th className="p-5 text-left">Lote</th>
                                                    <th className="p-5 text-left">NF</th>
                                                    <th className="p-5 text-right">Qtd (kg)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 bg-white">
                                                {selectedDetail.logEntries.length > 0 ? selectedDetail.logEntries.map((log: any) => (
                                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-5 font-mono font-black text-indigo-600">{(log.date || '').split('-').reverse().join('/')}</td>
                                                        <td className="p-5 font-mono text-gray-500">{log.lotNumber}</td>
                                                        <td className="p-5 font-mono font-bold text-gray-900">{log.inboundInvoice || '-'}</td>
                                                        <td className="p-5 text-right font-black text-gray-900">{log.quantity.toLocaleString('pt-BR')} kg</td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic font-medium">Nenhuma entrada registrada no estoque para este período.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 p-8 border-t border-gray-100 flex justify-end">
                                <button onClick={() => setSelectedDetail(null)} className="bg-gray-900 hover:bg-black text-white font-black py-4 px-12 rounded-[1.5rem] uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Fechar Detalhes</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scale-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .animate-scale-up { animation: scale-up 0.3s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
};

export default ItespDashboard;
