
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

// Normalização absoluta para nomes de itens e fornecedores
const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

// Normalização específica para Notas Fiscais (remove zeros à esquerda e símbolos)
const normalizeInvoice = (text: string) => {
    const cleaned = (text || "").toString().replace(/\D/g, ''); // Mantém apenas números
    return cleaned.replace(/^0+/, ''); // Remove zeros à esquerda
};

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ suppliers = [], warehouseLog = [] }) => {
    const [sortKey, setSortKey] = useState<'name' | 'progress' | 'delivered' | 'contracted'>('progress');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
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
        
        const shortfalls: any[] = [];
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        // 1. Mapear Preços e nomes reais
        const priceMap = new Map<string, number>();
        const realNamesMap = new Map<string, { supplier: string, item: string }>();

        suppliers.forEach(s => {
            (s.contractItems || []).forEach(ci => {
                const sKey = superNormalize(s.name);
                const iKey = superNormalize(ci.name);
                priceMap.set(`${sKey}|${iKey}`, ci.valuePerKg || 0);
                realNamesMap.set(`${sKey}|${iKey}`, { supplier: s.name, item: ci.name });
            });
        });

        // 2. Agrupar FATURAMENTO (Notas Fiscais do Fornecedor)
        // Chave: normalizeSupplier | normalizeItem | monthName | normalizeNF
        const billedData = new Map<string, number>(); 
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.invoiceNumber && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const mName = months[dateObj.getMonth()];
                    const nf = normalizeInvoice(d.invoiceNumber);
                    const key = `${superNormalize(s.name)}|${superNormalize(d.item)}|${mName}|${nf}`;
                    
                    billedData.set(key, (billedData.get(key) || 0) + (d.kg || 0));
                }
            });
        });

        // 3. Agrupar ENTRADAS (Registros do Almoxarifado)
        const receivedData = new Map<string, number>();
        warehouseLog.forEach(log => {
            if (log.type === 'entrada' && log.inboundInvoice) {
                const dateObj = new Date(log.timestamp);
                const mName = months[dateObj.getMonth()];
                const nf = normalizeInvoice(log.inboundInvoice);
                const key = `${superNormalize(log.supplierName)}|${superNormalize(log.itemName)}|${mName}|${nf}`;
                
                receivedData.set(key, (receivedData.get(key) || 0) + (log.quantity || 0));
            }
        });

        // 4. Cruzar dados usando as chaves de Billed (se faturou, deveria ter entrado)
        // Também pegamos chaves de Received que não estão em Billed (erro inverso)
        const allKeys = new Set([...billedData.keys(), ...receivedData.keys()]);

        allKeys.forEach(key => {
            const [sNorm, iNorm, mName, nfNorm] = key.split('|');
            const billed = billedData.get(key) || 0;
            const received = receivedData.get(key) || 0;
            
            const diff = billed - received;
            const shortfall = Math.max(0, diff);

            // Só incluímos no relatório se houver alguma quantidade em um dos lados
            if (billed > 0 || received > 0) {
                const names = realNamesMap.get(`${sNorm}|${iNorm}`);
                const price = priceMap.get(`${sNorm}|${iNorm}`) || 0;

                shortfalls.push({
                    id: key,
                    supplierName: names?.supplier || sNorm.toUpperCase(),
                    productName: names?.item || iNorm.toUpperCase(),
                    invoices: nfNorm,
                    month: mName,
                    billedKg: billed,
                    receivedKg: received,
                    shortfallKg: shortfall,
                    financialLoss: shortfall * price
                });
            }
        });

        return shortfalls.sort((a, b) => 
            months.indexOf(a.month) - months.indexOf(b.month) || 
            a.supplierName.localeCompare(b.supplierName)
        );
    }, [suppliers, warehouseLog]);

    const filteredShortfallData = useMemo(() => {
        return shortfallData.filter(item => {
            const supplierMatch = selectedSupplierName === 'all' || item.supplierName === selectedSupplierName;
            const monthMatch = selectedMonthFilter === 'all' || item.month === selectedMonthFilter;
            return supplierMatch && monthMatch;
        });
    }, [shortfallData, selectedSupplierName, selectedMonthFilter]);

    const finalDataForTable = useMemo(() => {
        // Por padrão mostramos apenas onde houve discrepância (billed > received)
        // Mas se o usuário filtrou algo específico, mostramos tudo daquele filtro
        const hasFilters = selectedSupplierName !== 'all' || selectedMonthFilter !== 'all';
        if (hasFilters) return filteredShortfallData;
        
        return filteredShortfallData.filter(item => item.shortfallKg > 0.001);
    }, [filteredShortfallData, selectedSupplierName, selectedMonthFilter]);

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
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Relatório de Falhas: Nota Fiscal vs. Estoque</h3>
                        <p className="text-xs text-gray-500">Compara o peso faturado na nota com o peso que realmente entrou no almoxarifado.</p>
                    </div>
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
                            <option value="Maio">Maio</option>
                            <option value="Junho">Junho</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-red-50 text-xs uppercase text-red-800">
                            <tr>
                                <th className="p-3 text-left">FORNECEDOR</th>
                                <th className="p-3 text-left">PRODUTO</th>
                                <th className="p-3 text-left">Nº NOTA</th>
                                <th className="p-3 text-left">MÊS</th>
                                <th className="p-3 text-right">PESO EM NOTA (KG)</th>
                                <th className="p-3 text-right">PESO ESTOQUE (KG)</th>
                                <th className="p-3 text-right">DIFERENÇA (KG)</th>
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
                                    <td className={`p-3 text-right font-mono font-bold ${item.shortfallKg > 0.01 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {item.shortfallKg.toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="p-3 text-right font-mono text-red-700 font-extrabold">
                                        {formatCurrency(item.financialLoss)}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic font-bold">Nenhuma falha de conferência detectada com os filtros atuais.</td></tr>
                            )}
                        </tbody>
                        {finalDataForTable.length > 0 && (
                            <tfoot className="font-bold">
                                <tr className="bg-gray-100">
                                    <td colSpan={7} className="p-3 text-right text-gray-700 uppercase">Prejuízo Total Estimado:</td>
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
              @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
              .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminAnalytics;
