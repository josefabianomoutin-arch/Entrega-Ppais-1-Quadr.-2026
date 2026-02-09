
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
    const [sortKey, setSortKey] = useState<'name' | 'progress' | 'delivered' | 'contracted'>('progress');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [expandedSupplierCpf, setExpandedSupplierCpf] = useState<string | null>(null);
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('all');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

    const analyticsData = useMemo(() => {
        const totalContracted = suppliers.reduce((sum, p) => sum + (p.initialValue || 0), 0);
        const totalDelivered = suppliers.reduce((sum, p) => sum + (p.deliveries || []).filter(d => d.invoiceUploaded).reduce((dSum, d) => dSum + (d.value || 0), 0), 0);
        
        return {
            totalContracted,
            totalDelivered,
            progress: totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 0,
            supplierCount: suppliers.length,
        };
    }, [suppliers]);

    const supplierOptions = useMemo(() => {
        const uniqueNames = [...new Set(suppliers.map(s => s.name))];
        return uniqueNames
            .sort((a: string, b: string) => (a || '').localeCompare(b || ''))
            .map(name => ({
                value: name,
                displayName: name
            }));
    }, [suppliers]);
    
    const filteredSuppliers = useMemo(() => {
      return suppliers.filter(p => (p.name || '').toLowerCase().includes(supplierSearchTerm.toLowerCase()));
    }, [suppliers, supplierSearchTerm]);

    const sortedSuppliers = useMemo(() => {
      return [...filteredSuppliers].sort((a, b) => {
            const aDelivered = (a.deliveries || []).filter(d => d.invoiceUploaded).reduce((sum, d) => sum + (d.value || 0), 0);
            const bDelivered = (b.deliveries || []).filter(d => d.invoiceUploaded).reduce((sum, d) => sum + (d.value || 0), 0);
            const aProgress = (a.initialValue || 0) > 0 ? aDelivered / a.initialValue : 0;
            const bProgress = (b.initialValue || 0) > 0 ? bDelivered / b.initialValue : 0;
            let comp = 0;
            if (sortKey === 'name') comp = (a.name || '').localeCompare(b.name || '');
            else if (sortKey === 'progress') comp = bProgress - aProgress;
            else if (sortKey === 'delivered') comp = bDelivered - aDelivered;
            else comp = (b.initialValue || 0) - (a.initialValue || 0);
            return sortDirection === 'asc' ? comp : -comp;
        });
    }, [filteredSuppliers, sortKey, sortDirection]);

    const shortfallData = useMemo(() => {
        if (!suppliers || !warehouseLog) return [];
        
        const shortfalls: {
            id: string;
            supplierName: string;
            productName: string;
            invoices: string;
            month: string;
            billedKg: number;
            receivedKg: number;
            shortfallKg: number;
            financialLoss: number;
        }[] = [];
        
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril'];

        // Passo 1: Mapear Preços do Contrato para cálculo de prejuízo
        const priceMap = new Map<string, number>();
        suppliers.forEach(s => {
            (s.contractItems || []).forEach(ci => {
                priceMap.set(`${superNormalize(s.name)}-${superNormalize(ci.name)}`, ci.valuePerKg || 0);
            });
        });

        // Passo 2: Agrupar o que foi FATURADO (Deliveries com Nota)
        const billedData = new Map<string, number>(); 
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.invoiceNumber && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const mIdx = dateObj.getMonth();
                    if (mIdx < 4) {
                        const key = `${superNormalize(s.name)}|${superNormalize(d.item)}|${months[mIdx]}|${d.invoiceNumber}`;
                        billedData.set(key, (billedData.get(key) || 0) + (d.kg || 0));
                    }
                }
            });
        });

        // Passo 3: Agrupar o que entrou no ESTOQUE (WarehouseLog tipo 'entrada')
        const receivedData = new Map<string, number>();
        warehouseLog.forEach(log => {
            if (log.type === 'entrada' && log.inboundInvoice) {
                const dateObj = new Date(log.timestamp);
                const mIdx = dateObj.getMonth();
                if (mIdx < 4) {
                    const key = `${superNormalize(log.supplierName)}|${superNormalize(log.itemName)}|${months[mIdx]}|${log.inboundInvoice}`;
                    receivedData.set(key, (receivedData.get(key) || 0) + (log.quantity || 0));
                }
            }
        });

        // Passo 4: Cruzar os dados
        const allKeys = new Set([...billedData.keys(), ...receivedData.keys()]);

        allKeys.forEach(key => {
            const [sNorm, iNorm, month, invoice] = key.split('|');
            const billed = billedData.get(key) || 0;
            const received = receivedData.get(key) || 0;
            const diff = billed - received;
            const shortfall = Math.max(0, diff);

            if (billed > 0 || received > 0) {
                const supplierObj = suppliers.find(s => superNormalize(s.name) === sNorm);
                const itemObj = supplierObj?.contractItems?.find(ci => superNormalize(ci.name) === iNorm);
                const price = priceMap.get(`${sNorm}-${iNorm}`) || 0;

                shortfalls.push({
                    id: key,
                    supplierName: supplierObj?.name || sNorm.toUpperCase(),
                    productName: itemObj?.name || iNorm.toUpperCase(),
                    invoices: invoice,
                    month: month,
                    billedKg: billed,
                    receivedKg: received,
                    shortfallKg: shortfall,
                    financialLoss: shortfall * price
                });
            }
        });

        return shortfalls.sort((a, b) => 
            new Date(`2026-${a.month}-01`).getMonth() - new Date(`2026-${b.month}-01`).getMonth() || 
            a.supplierName.localeCompare(b.supplierName)
        );
    }, [suppliers, warehouseLog]);

    const filteredShortfallData = useMemo(() => {
        if (selectedSupplierName === 'all' && selectedMonthFilter === 'all') {
            return shortfallData;
        }
        return shortfallData.filter(item => {
            const supplierMatch = selectedSupplierName === 'all' || item.supplierName === selectedSupplierName;
            const monthMatch = selectedMonthFilter === 'all' || item.month === selectedMonthFilter;
            return supplierMatch && monthMatch;
        });
    }, [shortfallData, selectedSupplierName, selectedMonthFilter]);

    const hasActualFailures = useMemo(() => 
        filteredShortfallData.some(item => item.shortfallKg > 0.001), 
        [filteredShortfallData]
    );

    const finalDataForTable = useMemo(() => {
        if (hasActualFailures) {
            return filteredShortfallData.filter(item => item.shortfallKg > 0.001);
        }
        return filteredShortfallData;
    }, [filteredShortfallData, hasActualFailures]);

    const totalFinancialLoss = useMemo(() => {
        return finalDataForTable.reduce((sum, item) => sum + item.financialLoss, 0);
    }, [finalDataForTable]);

    const handleSort = (key: 'name' | 'progress' | 'delivered' | 'contracted') => {
      if (key === sortKey) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setSortKey(key); setSortDirection('desc'); }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Relatório Analítico de Contratos</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-blue-500">
                    <p className="text-xs text-gray-400 font-bold uppercase">Contratado</p>
                    <p className="text-xl font-black">{formatCurrency(analyticsData.totalContracted)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-green-500">
                    <p className="text-xs text-gray-400 font-bold uppercase">Entregue</p>
                    <p className="text-xl font-black text-green-600">{formatCurrency(analyticsData.totalDelivered)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-yellow-500">
                    <p className="text-xs text-gray-400 font-bold uppercase">Progresso</p>
                    <p className="text-xl font-black text-yellow-600">{analyticsData.progress.toFixed(1)}%</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-indigo-500">
                    <p className="text-xs text-gray-400 font-bold uppercase">Fornecedores</p>
                    <p className="text-xl font-black text-indigo-800">{analyticsData.supplierCount}</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-gray-800">Relatório de Falhas: Nota Fiscal vs. Estoque</h3>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <select
                            value={selectedSupplierName}
                            onChange={(e) => setSelectedSupplierName(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 transition-all w-full sm:w-auto bg-white"
                        >
                            <option value="all">Todos os Fornecedores</option>
                            {supplierOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.displayName}</option>
                            ))}
                        </select>
                        <select
                            value={selectedMonthFilter}
                            onChange={(e) => setSelectedMonthFilter(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 transition-all w-full sm:w-auto bg-white"
                        >
                            <option value="all">Todos os Meses</option>
                            <option value="Janeiro">Janeiro</option>
                            <option value="Fevereiro">Fevereiro</option>
                            <option value="Março">Março</option>
                            <option value="Abril">Abril</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-red-50 text-xs uppercase text-red-800">
                            <tr>
                                <th className="p-3 text-left">FORNECEDOR</th>
                                <th className="p-3 text-left">PRODUTO</th>
                                <th className="p-3 text-left">Nº DA NOTA</th>
                                <th className="p-3 text-left">MÊS</th>
                                <th className="p-3 text-right">TOTAL EM NOTA (KG)</th>
                                <th className="p-3 text-right">ENTRADA ESTOQUE (KG)</th>
                                <th className="p-3 text-right">FALHA NA ENTREGA (KG)</th>
                                <th className="p-3 text-right">PREJUÍZO (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalDataForTable.length > 0 ? finalDataForTable.map(item => (
                                <tr key={item.id} className="border-b hover:bg-red-50/50 transition-colors">
                                    <td className="p-3 font-bold text-gray-800 uppercase">{item.supplierName}</td>
                                    <td className="p-3 text-gray-700 uppercase">{item.productName}</td>
                                    <td className="p-3 font-mono text-xs text-blue-600 font-bold">{item.invoices}</td>
                                    <td className="p-3 text-gray-600 font-semibold">{item.month}</td>
                                    <td className="p-3 text-right font-mono text-gray-500">
                                        {item.billedKg.toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="p-3 text-right font-mono text-green-600 font-bold">
                                        {item.receivedKg.toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className={`p-3 text-right font-mono font-bold ${item.shortfallKg > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {item.shortfallKg.toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="p-3 text-right font-mono text-red-700 font-extrabold">
                                        {formatCurrency(item.financialLoss)}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic font-bold">Nenhuma falha física detectada entre Notas e Estoque.</td></tr>
                            )}
                        </tbody>
                        {finalDataForTable.length > 0 && (
                            <tfoot className="font-bold">
                                <tr className="bg-gray-100">
                                    <td colSpan={7} className="p-3 text-right text-gray-700 uppercase">Prejuízo Total em Discrepâncias:</td>
                                    <td className="p-3 text-right text-red-800 text-base font-extrabold">{formatCurrency(totalFinancialLoss)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
              .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
              @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
              .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminAnalytics;
