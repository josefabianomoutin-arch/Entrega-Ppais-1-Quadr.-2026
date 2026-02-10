
import React, { useMemo, useState } from 'react';
import type { Supplier, Delivery, WarehouseMovement } from '../types';

interface AdminAnalyticsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
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

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ suppliers = [], warehouseLog = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('all');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
            price: number 
        }>();

        // 1. Inicializar com Meta de Contrato Mensal
        suppliers.forEach(s => {
            const supplierNorm = superNormalize(s.name);
            s.contractItems.forEach(ci => {
                const itemNorm = superNormalize(ci.name);
                ['Janeiro', 'Fevereiro', 'Março', 'Abril'].forEach(mName => {
                    const key = `${supplierNorm}|${itemNorm}|${mName}`;
                    consolidated.set(key, {
                        supplierReal: s.name,
                        itemReal: ci.name,
                        month: mName,
                        contractedKgMonthly: (ci.totalKg || 0) / 4,
                        billedKg: 0,
                        receivedKg: 0,
                        price: ci.valuePerKg || 0
                    });
                });
            });
        });

        // 2. Somar Faturamento (Informativo)
        suppliers.forEach(s => {
            const supplierNorm = superNormalize(s.name);
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const mName = months[dateObj.getMonth()];
                    const key = `${supplierNorm}|${superNormalize(d.item)}|${mName}`;
                    
                    const entry = consolidated.get(key);
                    if (entry) entry.billedKg += (d.kg || 0);
                }
            });
        });

        // 3. Somar Estoque Real (Crítico para Auditoria)
        warehouseLog.forEach(log => {
            if (log.type === 'entrada') {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                
                // CRÍTICO: Usa a data informada no movimento
                const documentDate = log.date || log.timestamp.split('T')[0];
                const dateObj = new Date(documentDate + 'T00:00:00');
                const mName = months[dateObj.getMonth()];
                const key = `${sNorm}|${iNorm}|${mName}`;
                
                const entry = consolidated.get(key);
                if (entry) entry.receivedKg += (log.quantity || 0);
            }
        });

        // 4. Calcular Falta Real (Meta - Estoque)
        return Array.from(consolidated.values()).map(data => {
            const shortfallKg = Math.max(0, data.contractedKgMonthly - data.receivedKg);
            return {
                ...data,
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

    const totalLoss = useMemo(() => filteredData.reduce((sum, item) => sum + item.financialLoss, 0), [filteredData]);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-indigo-500">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Auditoria Institucional: Meta vs. Estoque</h2>
                <p className="text-sm text-gray-500 font-medium">A falta é calculada comparando a meta contratual mensal do fornecedor contra o que efetivamente entrou no almoxarifado.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-blue-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Meta Contratual (Filtro)</p>
                    <p className="text-xl font-black">{filteredData.reduce((a, b) => a + b.contractedKgMonthly, 0).toLocaleString('pt-BR')} kg</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-green-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Estoque Real (Filtro)</p>
                    <p className="text-xl font-black text-green-600">{filteredData.reduce((a, b) => a + b.receivedKg, 0).toLocaleString('pt-BR')} kg</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-red-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Prejuízo p/ Falta de Entrega</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(totalLoss)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-indigo-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Déficit Total (Kg)</p>
                    <p className="text-xl font-black text-indigo-800">{filteredData.reduce((a, b) => a + b.shortfallKg, 0).toLocaleString('pt-BR')} kg</p>
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
                                <th className="p-4 text-left">Mês</th>
                                <th className="p-4 text-right bg-blue-50/30 text-blue-700">Meta (Contrato)</th>
                                <th className="p-4 text-right italic opacity-50">Peso NF (Info)</th>
                                <th className="p-4 text-right bg-green-50/30 text-green-700">Peso Estoque</th>
                                <th className="p-4 text-right bg-red-50 text-red-600">Falta Real</th>
                                <th className="p-4 text-right font-black">Prejuízo Estimado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.length > 0 ? filteredData.map((item, idx) => (
                                <tr key={idx} className={`hover:bg-gray-50 transition-colors ${item.shortfallKg > 0.001 ? 'bg-red-50/10' : ''}`}>
                                    <td className="p-4 font-bold text-gray-800 uppercase">{item.supplierReal}</td>
                                    <td className="p-4 text-gray-600 uppercase text-xs font-medium">{item.itemReal}</td>
                                    <td className="p-4 font-medium text-gray-500">{item.month}</td>
                                    <td className="p-4 text-right font-mono font-bold text-blue-700 bg-blue-50/5">
                                        {item.contractedKgMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                    </td>
                                    <td className="p-4 text-right font-mono text-gray-400">
                                        {item.billedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                    </td>
                                    <td className={`p-4 text-right font-mono font-bold bg-green-50/5 ${item.receivedKg > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                        {item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                    </td>
                                    <td className={`p-4 text-right font-mono font-black bg-red-50 ${item.shortfallKg > 0.001 ? 'text-red-600' : 'text-gray-300'}`}>
                                        {item.shortfallKg > 0.001 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00"}
                                    </td>
                                    <td className={`p-4 text-right font-black ${item.financialLoss > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                                        {item.financialLoss > 0 ? formatCurrency(item.financialLoss) : "R$ 0,00"}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={8} className="p-20 text-center text-gray-400 italic font-medium uppercase tracking-widest bg-gray-50">Nenhuma divergência de contrato localizada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
              @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
              .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminAnalytics;
