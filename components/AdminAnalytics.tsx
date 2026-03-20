
import React, { useMemo, useState } from 'react';
import type { Supplier, Delivery, WarehouseMovement, PerCapitaConfig } from '../types';

interface AdminAnalyticsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  perCapitaConfig?: PerCapitaConfig;
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
 * EXTRATOR DE MÊS - VERSÃO UNIFICADA (ALTA RESILIÊNCIA)
 * Mesma lógica usada no painel ITESP para garantir consistência em Janeiro.
 */
const getMonthNameFromDateString = (dateStr?: string): string => {
    if (!dateStr) return "Mês Indefinido";
    const s = String(dateStr).trim().toLowerCase();
    
    // Tenta detectar nome do mês por extenso ou abreviado
    for (let i = 0; i < months.length; i++) {
        if (s.includes(months[i].toLowerCase().slice(0, 3))) return months[i];
    }

    // Limpeza de separadores para tratar 01-01 ou 01/01
    const cleanS = s.replace(/[\/]/g, '-');
    const parts = cleanS.split('-');
    
    if (parts.length >= 2) {
        // Se YYYY-MM-DD (ISO)
        if (parts[0].length === 4) {
            const m = parseInt(parts[1], 10);
            if (m >= 1 && m <= 12) return months[m - 1];
        } else {
            // Se DD-MM-YYYY ou DD-MM
            const m = parseInt(parts[1], 10);
            if (m >= 1 && m <= 12) return months[m - 1];
        }
    }
    
    // Fallback agressivo para Janeiro
    if (cleanS.includes("-01-") || cleanS.startsWith("01-") || cleanS.endsWith("-01")) return "Janeiro";
    
    return "Mês Indefinido";
};

const ITESP_SUPPLIERS_NAMES = [
    'BENEDITO OSMAR RAVAZZI', 'ADAO MAXIMO DA FONSECA', 'ANTONIO JOAQUIM DE OLIVEIRA',
    'CLAUDEMIR LUIZ TURRA', 'CONSUELO ALCANTARA FERREIRA GUIMARARE', 'DANILO ANTONIO MAXIMO',
    'DOMINGOS APARECIDO ANTONINO', 'LEONARDO FELIPE VELHO MARSOLA', 'LIDIA BERNARDES MONTEIRO BARBOSA',
    'LUCIMARA MARQUES PEREIRA', 'MARCELO GIBERTONI', 'MARCOS DONADON AGOSTINHO',
    'MICHEL JOSE RAVAZZI', 'MOISES PINHEIRO DE SA', 'PAULO HENRIQUE PUGLIERI',
    'PEDRO TEODORO RODRIGUES', 'ROSA MARIA GARBIN VELLONE', 'SAULO ANTONINO',
    'SONIA REGINA COLOMBO CELESTINO', 'TANIA MARA BALDAO DE BARROS'
];

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ suppliers = [], warehouseLog = [], perCapitaConfig }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('all');
    const [selectedProductName, setSelectedProductName] = useState<string>('all');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

    const itespSet = useMemo(() => new Set<string>(ITESP_SUPPLIERS_NAMES.map(superNormalize)), []);

    const supplierOptions = useMemo(() => {
        const uniqueNames = [...new Set(suppliers.map(s => s.name))];
        return uniqueNames
            .sort((a: string, b: string) => (a || '').localeCompare(b || ''))
            .map(name => ({ value: name, displayName: name }));
    }, [suppliers]);

    const auditData = useMemo(() => {
        if (!suppliers) return [];

        const consolidated = new Map<string, any>();

        // 1. Inicializar Metas Baseado nos Contratos
        suppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            
            // Tenta encontrar o cronograma mensal se for um produtor PPAIS/ITESP ou Perecíveis
            const ppaisProducer = perCapitaConfig?.ppaisProducers?.find(p => superNormalize(p.name) === sNorm || p.cpfCnpj === s.cpf);
            const pereciveisSupplier = perCapitaConfig?.pereciveisSuppliers?.find(p => superNormalize(p.name) === sNorm || p.cpfCnpj === s.cpf);
            const producerData = ppaisProducer || pereciveisSupplier;
            
            const isItesp = [...itespSet].some(allowed => sNorm.includes(allowed) || allowed.includes(sNorm));

            // Se houver cronograma, usamos apenas os meses com semanas agendadas
            // Se for ITESP e não tiver cronograma, padrão de 4 meses (Jan-Abr)
            // Caso contrário, assumimos o ano todo (12 meses)
            let activeMonths = months;
            if (producerData?.monthlySchedule) {
                activeMonths = months.filter(m => (producerData.monthlySchedule[m] || []).length > 0);
            } else if (isItesp) {
                activeMonths = months.slice(0, 4);
            }
            
            const monthsCount = activeMonths.length || 12;

            Object.values(s.contractItems || {}).forEach((ci: any) => {
                const iNorm = superNormalize(ci.name);
                // Auditoria focada no ano completo
                months.forEach(mName => {
                    const hasContractInMonth = activeMonths.includes(mName);
                    const key = `${sNorm}|${iNorm}|${mName}`;
                    consolidated.set(key, {
                        supplierReal: s.name,
                        supplierCpf: s.cpf,
                        itemReal: ci.name,
                        month: mName,
                        contractedKgMonthly: hasContractInMonth ? (Number(ci.totalKg) || 0) / monthsCount : 0,
                        receivedKg: 0,
                        price: Number(ci.valuePerKg) || 0,
                        normSupplier: sNorm,
                        normItem: iNorm
                    });
                });
            });
        });

        // 2. Acumular Entradas de Notas Fiscais (Deliveries)
        suppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            (Object.values(s.deliveries || {}) as Delivery[]).forEach(del => {
                if (del.item === 'AGENDAMENTO PENDENTE') return;
                
                const delINorm = superNormalize(del.item || '');
                const delMonth = getMonthNameFromDateString(del.date);

                if (!months.includes(delMonth)) return;

                // Busca no mapa consolidado
                for (const [key, entry] of consolidated.entries()) {
                    if (entry.month === delMonth) {
                        const sMatch = entry.normSupplier === sNorm || entry.normSupplier.includes(sNorm) || sNorm.includes(entry.normSupplier);
                        if (sMatch) {
                            const iMatch = entry.normItem === delINorm || entry.normItem.includes(delINorm) || delINorm.includes(entry.normItem);
                            if (iMatch) {
                                entry.receivedKg += (Number(del.kg) || 0);
                            }
                        }
                    }
                }
            });
        });

        return Array.from(consolidated.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `audit-v2-${idx}`,
                shortfallKg,
                financialLoss: shortfallKg * data.price
            };
        }).filter(i => i.contractedKgMonthly > 0 || i.receivedKg > 0)
          .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

    }, [suppliers, warehouseLog, perCapitaConfig]);

    const productOptions = useMemo(() => {
        const products = new Set<string>();
        auditData.forEach(item => products.add(item.itemReal));
        return Array.from(products).sort().map(name => ({ value: name, displayName: name }));
    }, [auditData]);

    const filteredData = useMemo(() => {
        return auditData.filter(item => {
            const supplierMatch = selectedSupplierName === 'all' || item.supplierReal === selectedSupplierName;
            const productMatch = selectedProductName === 'all' || item.itemReal === selectedProductName;
            const monthMatch = selectedMonthFilter === 'all' || item.month === selectedMonthFilter;
            const searchMatch = item.supplierReal.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.itemReal.toLowerCase().includes(searchTerm.toLowerCase());
            return supplierMatch && productMatch && monthMatch && searchMatch;
        });
    }, [auditData, selectedSupplierName, selectedProductName, selectedMonthFilter, searchTerm]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, item) => {
            acc.contracted += item.contractedKgMonthly;
            // Cap received by contracted so over-deliveries don't mask shortfalls in totals
            acc.received += Math.min(item.receivedKg, item.contractedKgMonthly);
            acc.loss += item.financialLoss;
            acc.shortfall += item.shortfallKg;
            return acc;
        }, { contracted: 0, received: 0, loss: 0, shortfall: 0 });
    }, [filteredData]);

    return (
        <div className="space-y-8 animate-fade-in pb-12 max-w-[1600px] mx-auto">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Auditoria Analítica</h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">Cruzamento profundo de dados: Meta Mensal vs. Notas Fiscais (Jan-Dez).</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase leading-none mb-1">Status do Sistema</p>
                        <p className="text-xs font-black text-indigo-700 uppercase tracking-widest">Sincronizado</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Meta do Período</p>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">{totals.contracted.toLocaleString('pt-BR')} <span className="text-sm font-bold text-gray-400">kg</span></p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group">
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Entrada Realizada</p>
                    <p className="text-3xl font-black text-green-600 tracking-tighter">{totals.received.toLocaleString('pt-BR')} <span className="text-sm font-bold text-green-400">kg</span></p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Prejuízo por Déficit</p>
                    <p className="text-3xl font-black text-red-600 tracking-tighter">{formatCurrency(totals.loss)}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Falta Total (Kg)</p>
                    <p className="text-3xl font-black text-indigo-800 tracking-tighter">{totals.shortfall.toLocaleString('pt-BR')} <span className="text-sm font-bold text-indigo-400">kg</span></p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-50">
                <div className="flex flex-col xl:flex-row justify-between items-stretch mb-8 gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Pesquisar por fornecedor ou produto..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all shadow-inner"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <select value={selectedSupplierName} onChange={(e) => setSelectedSupplierName(e.target.value)} className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-2 text-xs font-black uppercase text-gray-700 outline-none focus:border-indigo-500 cursor-pointer transition-all">
                            <option value="all">Todos Fornecedores</option>
                            {supplierOptions.map(option => <option key={option.value} value={option.value}>{option.displayName}</option>)}
                        </select>
                        <select value={selectedProductName} onChange={(e) => setSelectedProductName(e.target.value)} className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-2 text-xs font-black uppercase text-gray-700 outline-none focus:border-indigo-500 cursor-pointer transition-all">
                            <option value="all">Todos Produtos</option>
                            {productOptions.map(option => <option key={option.value} value={option.value}>{option.displayName}</option>)}
                        </select>
                        <select value={selectedMonthFilter} onChange={(e) => setSelectedMonthFilter(e.target.value)} className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-2 text-xs font-black uppercase text-gray-700 outline-none focus:border-indigo-500 cursor-pointer transition-all">
                            <option value="all">Todos Meses</option>
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <button 
                            onClick={() => {
                                const printContent = `
                                    <html>
                                        <head>
                                            <title>Auditoria Analítica</title>
                                            <style>
                                                @page { size: A4 landscape; margin: 10mm; }
                                                body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
                                                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                                th { background-color: #1e293b; color: white; text-transform: uppercase; font-size: 8px; letter-spacing: 0.05em; }
                                                .text-center { text-align: center; }
                                                .text-right { text-align: right; }
                                                h2 { text-align: center; text-transform: uppercase; margin-bottom: 5px; font-size: 18px; color: #1e293b; }
                                                .header-info { text-align: center; color: #666; margin-bottom: 20px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
                                                .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; font-size: 8px; text-align: right; color: #999; }
                                            </style>
                                        </head>
                                        <body>
                                            <h2>AUDITORIA ANALÍTICA: META MENSAL VS. NOTAS FISCAIS</h2>
                                            <div class="header-info">Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th class="text-center">#</th>
                                                        <th>Fornecedor</th>
                                                        <th>Produto</th>
                                                        <th class="text-center">Mês</th>
                                                        <th class="text-right">Meta Contratual</th>
                                                        <th class="text-right">Notas Fiscais</th>
                                                        <th class="text-right">Diferença (Falta)</th>
                                                        <th class="text-right">Prejuízo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${filteredData.map((item, index) => `
                                                        <tr>
                                                            <td class="text-center">${index + 1}</td>
                                                            <td><strong>${item.supplierReal}</strong><br><small>${item.supplierCpf}</small></td>
                                                            <td>${item.itemReal}</td>
                                                            <td class="text-center">${item.month}</td>
                                                            <td class="text-right">${item.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                                            <td class="text-right">${item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                                            <td class="text-right" style="color: ${item.shortfallKg > 0.001 ? '#dc2626' : '#333'}">${item.shortfallKg > 0.001 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00"}</td>
                                                            <td class="text-right" style="font-weight: bold; color: ${item.financialLoss > 0 ? '#dc2626' : '#333'}">${item.financialLoss > 0 ? formatCurrency(item.financialLoss) : "R$ 0,00"}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                            <div class="footer">Sistema de Gestão de Fornecedores • Auditoria Analítica 2026</div>
                                            <script>
                                                window.onload = () => { window.print(); };
                                            </script>
                                        </body>
                                    </html>
                                `;
                                const win = window.open('', '_blank');
                                if (win) {
                                    win.document.write(printContent);
                                    win.document.close();
                                }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-6 rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Imprimir
                        </button>
                    </div>
                </div>

                <div className="border-2 border-gray-50 rounded-[2rem] overflow-hidden shadow-inner bg-gray-50/30">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-900 text-white text-[10px] uppercase font-black tracking-widest sticky top-0 z-10">
                                <tr>
                                    <th className="p-6 text-center w-16">#</th>
                                    <th className="p-6 text-left">Fornecedor</th>
                                    <th className="p-6 text-left">Produto</th>
                                    <th className="p-6 text-center">Mês</th>
                                    <th className="p-6 text-right bg-blue-900/40">Meta</th>
                                    <th className="p-6 text-right bg-green-900/40">Entregue</th>
                                    <th className="p-6 text-right bg-red-900/40">Falta</th>
                                    <th className="p-6 text-right">Prejuízo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredData.length > 0 ? filteredData.map((item, idx) => (
                                    <tr key={item.id} className={`hover:bg-indigo-50/30 transition-colors group ${item.shortfallKg > 0.001 ? 'bg-red-50/5' : ''}`}>
                                        <td className="p-6 text-center font-black text-gray-300 group-hover:text-indigo-400 transition-colors">{idx + 1}</td>
                                        <td className="p-6">
                                            <p className="font-black text-gray-900 uppercase text-xs leading-none mb-1">{item.supplierReal}</p>
                                            <p className="text-[9px] font-mono text-gray-400 tracking-tighter">{item.supplierCpf}</p>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-gray-600 uppercase text-[10px] font-black tracking-tight bg-gray-100 px-2 py-1 rounded-lg">{item.itemReal}</span>
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm ${item.month === 'Janeiro' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>{item.month}</span>
                                        </td>
                                        <td className="p-6 text-right font-mono font-black text-blue-700 text-xs">{(item.contractedKgMonthly || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[9px] opacity-50">kg</span></td>
                                        <td className={`p-6 text-right font-mono font-black text-xs ${item.receivedKg > 0 ? 'text-green-700' : 'text-gray-300'}`}>{(item.receivedKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[9px] opacity-50">kg</span></td>
                                        <td className={`p-6 text-right font-mono font-black text-xs ${item.shortfallKg > 0.001 ? 'text-red-600' : 'text-gray-200'}`}>
                                            {item.shortfallKg > 0.001 ? `-${item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '✓ OK'}
                                        </td>
                                        <td className={`p-6 text-right font-black text-xs ${item.financialLoss > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                                            {item.financialLoss > 0 ? formatCurrency(item.financialLoss) : "R$ 0,00"}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="p-32 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-20">
                                                <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                <p className="text-gray-600 font-black uppercase tracking-widest text-xl">Nenhum dado encontrado.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
};

export default AdminAnalytics;
