
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';

interface ItespDashboardProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  onLogout: () => void;
}

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

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const itespSuppliers = useMemo(() => {
        const normalizedAllowed = ALLOWED_SUPPLIERS.map(superNormalize);
        return suppliers.filter(s => normalizedAllowed.includes(superNormalize(s.name)));
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!itespSuppliers) return [];

        const consolidated = new Map<string, {
            supplierName: string,
            productName: string,
            month: string,
            contractedKgMonthly: number,
            billedKg: number,
            receivedKg: number,
            invoices: Set<string>,
            unitPrice: number
        }>();

        // 1. Base: Metas Contratuais (Anchor principal)
        itespSuppliers.forEach(s => {
            s.contractItems.forEach(ci => {
                const itemNorm = superNormalize(ci.name);
                // Auditoria do 1º Quadrimestre
                ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach(mName => {
                    const key = `${superNormalize(s.name)}|${itemNorm}|${mName}`;
                    consolidated.set(key, {
                        supplierName: s.name,
                        productName: ci.name,
                        month: mName,
                        contractedKgMonthly: (ci.totalKg || 0) / 4,
                        billedKg: 0,
                        receivedKg: 0,
                        invoices: new Set(),
                        unitPrice: ci.valuePerKg || 0
                    });
                });
            });
        });

        // 2. Agregação de Faturamento (Apenas informativo)
        itespSuppliers.forEach(s => {
            const supplierNorm = superNormalize(s.name);
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.invoiceNumber && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const mName = months[dateObj.getMonth()];
                    const key = `${supplierNorm}|${superNormalize(d.item)}|${mName}`;
                    
                    const entry = consolidated.get(key);
                    if (entry) {
                        entry.billedKg += (d.kg || 0);
                        entry.invoices.add(d.invoiceNumber);
                    }
                }
            });
        });

        // 3. Agregação de Estoque Real (O que realmente chegou)
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                
                // CRÍTICO: Usa log.date (data real informada) em vez de log.timestamp (data de sistema)
                const documentDate = log.date || log.timestamp.split('T')[0];
                const dateObj = new Date(documentDate + 'T00:00:00');
                const mName = months[dateObj.getMonth()];
                const key = `${sNorm}|${iNorm}|${mName}`;

                const entry = consolidated.get(key);
                if (entry) {
                    entry.receivedKg += (log.quantity || 0);
                }
            }
        });

        // 4. Cálculo final: Meta vs. Estoque
        return Array.from(consolidated.values()).map(data => {
            // A falta é estritamente o que foi prometido no contrato menos o que está no estoque
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
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
                               item.invoiceList.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            acc.billedKg += item.billedKg || 0;
            acc.receivedKg += item.receivedKg || 0;
            acc.shortfallKg += item.shortfallKg || 0;
            acc.financialLoss += item.financialLoss || 0;
            return acc;
        }, {
            contractedKgMonthly: 0,
            billedKg: 0,
            receivedKg: 0,
            shortfallKg: 0,
            financialLoss: 0,
        });
    }, [filteredData]);

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-800 pb-20">
            <header className="bg-white/80 backdrop-blur-sm shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-green-800">Módulo ITESP - Auditoria Estratégica</h1>
                    <p className="text-sm text-gray-500 font-medium">Comparativo de Meta Contratual vs. Entrega Real</p>
                </div>
                <button
                    onClick={onLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm text-sm"
                >
                    Sair
                </button>
            </header>

            <main className="p-4 md:p-8 max-w-[1600px] mx-auto">
                {/* Resumo Consolidado */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border-b-4 border-blue-500">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Meta de Contrato (Mês)</p>
                        <p className="text-2xl font-black text-blue-700">{totals.contractedKgMonthly.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border-b-4 border-green-600">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Estoque Realizado</p>
                        <p className="text-2xl font-black text-green-700">{totals.receivedKg.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border-b-4 border-red-500">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Falta p/ o Contrato</p>
                        <p className="text-2xl font-black text-red-600">{totals.shortfallKg.toLocaleString('pt-BR')} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-lg border-b-4 border-orange-500">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Prejuízo Calculado</p>
                        <p className="text-2xl font-black text-orange-600">{formatCurrency(totals.financialLoss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl animate-fade-in border border-gray-100">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div className="w-full md:w-80">
                            <input 
                                type="text" 
                                placeholder="Filtrar por nome ou produto..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm border-gray-200"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <select 
                                value={selectedSupplierName} 
                                onChange={(e) => setSelectedSupplierName(e.target.value)}
                                className="w-full md:w-64 border-2 border-indigo-500 rounded-lg px-4 py-2.5 text-sm font-bold outline-none text-gray-700 bg-white cursor-pointer"
                            >
                                <option value="all">Todos os produtores ITESP</option>
                                {supplierOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.displayName}</option>
                                ))}
                            </select>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full md:w-48 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium outline-none text-gray-700 bg-white cursor-pointer"
                            >
                                <option value="all">Todos os Meses</option>
                                {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b">
                                <tr>
                                    <th className="p-4 text-left border-b min-w-[250px]">PRODUTOR</th>
                                    <th className="p-4 text-left border-b">PRODUTO</th>
                                    <th className="p-4 text-left border-b">MÊS</th>
                                    <th className="p-4 text-right border-b bg-blue-50/30 text-blue-600">PESO CONTRATO (MÊS)</th>
                                    <th className="p-4 text-right border-b italic opacity-60">Peso na Nota (Informativo)</th>
                                    <th className="p-4 text-right border-b bg-green-50/30 text-green-700">PESO NO ESTOQUE</th>
                                    <th className="p-4 text-right border-b bg-red-50 text-red-600">FALTA REAL (META - ESTOQUE)</th>
                                    <th className="p-4 text-right border-b font-black">PREJUÍZO ACUMULADO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors group">
                                        <td className="p-4 font-black text-gray-900 uppercase text-xs">
                                            {item.supplierName}
                                        </td>
                                        <td className="p-4 text-[#6B7280] uppercase text-[11px] font-medium">
                                            {item.productName}
                                        </td>
                                        <td className="p-4 font-bold text-gray-500">
                                            {item.month}
                                        </td>
                                        <td className="p-4 text-right font-black text-blue-700 font-mono bg-blue-50/10">
                                            {item.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className="p-4 text-right font-medium text-gray-400 font-mono">
                                            {item.billedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className="p-4 text-right font-black text-green-700 font-mono bg-green-50/10">
                                            {item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className={`p-4 text-right font-black font-mono bg-red-50 ${item.shortfallKg > 0.01 ? 'text-red-600' : 'text-gray-300'}`}>
                                            {item.shortfallKg > 0.01 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                        </td>
                                        <td className={`p-4 text-right font-black ${item.financialLoss > 0.01 ? 'text-red-700' : 'text-gray-300'}`}>
                                            {item.financialLoss > 0.01 ? formatCurrency(item.financialLoss) : 'R$ 0,00'}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="p-20 text-center text-gray-400 italic font-medium uppercase tracking-widest bg-gray-50/50">
                                            Nenhum registro encontrado para os filtros selecionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 font-black text-xs border-t-2">
                                <tr>
                                    <td colSpan={3} className="p-4 text-left text-gray-600 uppercase">Totais da Auditoria</td>
                                    <td className="p-4 text-right text-blue-800 font-mono">{totals.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-4 text-right text-gray-400 font-mono">{totals.billedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-4 text-right text-green-800 font-mono">{totals.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-4 text-right text-red-700 font-mono">{totals.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-4 text-right text-red-800 text-lg">{formatCurrency(totals.financialLoss)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </main>

            <style>{`
              @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
              .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ItespDashboard;
