
import React, { useMemo, useState } from 'react';
import type { Supplier, Delivery, WarehouseMovement } from '../types';

interface AdminAnalyticsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
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

const getMonthNameFromDate = (dateStr?: string, timestamp?: string): string => {
    const raw = (dateStr || (timestamp ? timestamp.split('T')[0] : "")).trim();
    if (!raw) return "Mês Indefinido";

    const lowerRaw = raw.toLowerCase();
    for (let i = 0; i < months.length; i++) {
        if (lowerRaw.includes(months[i].toLowerCase())) return months[i];
    }

    const sep = raw.includes('/') ? '/' : '-';
    const parts = raw.split(sep);

    if (parts.length === 3) {
        let mIdx = -1;
        if (parts[0].length === 4) mIdx = parseInt(parts[1], 10) - 1;
        else if (parts[2].length === 4 || parts[2].length === 2) mIdx = parseInt(parts[1], 10) - 1;

        if (mIdx >= 0 && mIdx < 12) return months[mIdx];
    }

    return "Mês Indefinido";
};

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ suppliers = [], warehouseLog = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('all');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

    const supplierOptions = useMemo(() => {
        const uniqueNames = [...new Set(suppliers.map(s => s.name))];
        return uniqueNames
            .sort((a: string, b: string) => (a || '').localeCompare(b || ''))
            .map(name => ({ value: name, displayName: name }));
    }, [suppliers]);

    const auditData = useMemo(() => {
        if (!suppliers) return [];

        const consolidated = new Map<string, { 
            supplierReal: string, 
            itemReal: string, 
            month: string, 
            contractedKgMonthly: number,
            billedKg: number, 
            receivedKg: number,
            price: number,
            normSupplier: string,
            normItem: string
        }>();

        // 1. Inicializar Metas
        suppliers.forEach(s => {
            const sNorm = superNormalize(s.name);
            s.contractItems.forEach(ci => {
                const iNorm = superNormalize(ci.name);
                ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach(mName => {
                    const key = `${sNorm}|${iNorm}|${mName}`;
                    consolidated.set(key, {
                        supplierReal: s.name,
                        itemReal: ci.name,
                        month: mName,
                        contractedKgMonthly: (ci.totalKg || 0) / 4,
                        billedKg: 0,
                        receivedKg: 0,
                        price: ci.valuePerKg || 0,
                        normSupplier: sNorm,
                        normItem: iNorm
                    });
                });
            });
        });

        // 2. Acumular Estoque
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                const mName = getMonthNameFromDate(log.date, log.timestamp);
                
                const key = `${sNorm}|${iNorm}|${mName}`;
                const entry = consolidated.get(key);
                if (entry) {
                    entry.receivedKg += (Number(log.quantity) || 0);
                } else {
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

        return Array.from(consolidated.values()).map((data, idx) => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
                id: `audit-${idx}`,
                shortfallKg,
                financialLoss: shortfallKg * data.price
            };
        }).filter(i => i.contractedKgMonthly > 0)
          .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

    }, [suppliers, warehouseLog]);

    const filteredData = useMemo(() => {
        return auditData.filter(item => {
            const supplierMatch = selectedSupplierName === 'all' || item.supplierReal === selectedSupplierName;
            const monthMatch = selectedMonthFilter === 'all' || item.month === selectedMonthFilter;
            const searchMatch = item.supplierReal.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.itemReal.toLowerCase().includes(searchTerm.toLowerCase());
            return supplierMatch && monthMatch && searchMatch;
        });
    }, [auditData, selectedSupplierName, selectedMonthFilter, searchTerm]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, item) => {
            acc.contracted += item.contractedKgMonthly;
            acc.received += item.receivedKg;
            acc.loss += item.financialLoss;
            acc.shortfall += item.shortfallKg;
            return acc;
        }, { contracted: 0, received: 0, loss: 0, shortfall: 0 });
    }, [filteredData]);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-500">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Auditoria Analítica: Meta Mensal vs. Estoque</h2>
                <p className="text-sm text-gray-500 font-medium">Cruzamento profundo de dados para identificar déficits de entrega em qualquer período (Jan-Abr).</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-blue-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Meta do Período</p>
                    <p className="text-xl font-black">{totals.contracted.toLocaleString('pt-BR')} kg</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-green-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Entrada Realizada</p>
                    <p className="text-xl font-black text-green-600">{totals.received.toLocaleString('pt-BR')} kg</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-red-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Prejuízo por Déficit</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(totals.loss)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-indigo-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Falta Total (Kg)</p>
                    <p className="text-xl font-black text-indigo-800">{totals.shortfall.toLocaleString('pt-BR')} kg</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
                    <input 
                        type="text" 
                        placeholder="Pesquisar..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full lg:w-64 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                        <select value={selectedSupplierName} onChange={(e) => setSelectedSupplierName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white font-bold text-gray-700">
                            <option value="all">Todos os Fornecedores</option>
                            {supplierOptions.map(option => <option key={option.value} value={option.value}>{option.displayName}</option>)}
                        </select>
                        <select value={selectedMonthFilter} onChange={(e) => setSelectedMonthFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white font-bold text-gray-700">
                            <option value="all">Todos os Meses</option>
                            {months.slice(0, 4).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black tracking-widest border-b">
                            <tr>
                                <th className="p-4 text-left">Fornecedor</th>
                                <th className="p-4 text-left">Produto</th>
                                <th className="p-4 text-center">Mês</th>
                                <th className="p-4 text-right bg-blue-50/30 text-blue-700">Meta Contratual</th>
                                <th className="p-4 text-right bg-green-50/30 text-green-700">Estoque Almox.</th>
                                <th className="p-4 text-right bg-red-50 text-red-600">Diferença (Falta)</th>
                                <th className="p-4 text-right font-black">Prejuízo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map((item) => (
                                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.shortfallKg > 0.001 ? 'bg-red-50/10' : ''}`}>
                                    <td className="p-4 font-bold text-gray-800 uppercase text-xs">{item.supplierReal}</td>
                                    <td className="p-4 text-gray-600 uppercase text-[10px] font-medium">{item.itemReal}</td>
                                    <td className="p-4 text-center">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-[10px] font-bold uppercase">{item.month}</span>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-blue-700">{item.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className="p-4 text-right font-mono font-bold text-green-700">{item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                                    <td className={`p-4 text-right font-mono font-black ${item.shortfallKg > 0.001 ? 'text-red-600' : 'text-gray-300'}`}>
                                        {item.shortfallKg > 0.001 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00"}
                                    </td>
                                    <td className={`p-4 text-right font-black ${item.financialLoss > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                                        {item.financialLoss > 0 ? formatCurrency(item.financialLoss) : "R$ 0,00"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminAnalytics;
