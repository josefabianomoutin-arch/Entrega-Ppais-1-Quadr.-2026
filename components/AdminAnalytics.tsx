
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

// Normalização para nomes e textos
const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

// Normalização para Notas Fiscais (mais flexível: preserva letras mas limpa ruído)
const normalizeInvoice = (text: string) => {
    return (text || "")
        .toString()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") // Remove traços, pontos e espaços
        .replace(/^NF|^NFE/g, "")   // Remove prefixos comuns
        .replace(/^0+/, "")         // Remove zeros à esquerda
        .trim();
};

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ suppliers = [], warehouseLog = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('all');
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
            .map(name => ({ value: name, displayName: name }));
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!suppliers) return [];

        const billedGroups = new Map<string, { 
            supplierReal: string, 
            itemReal: string, 
            month: string, 
            nfDisplay: string, 
            kg: number,
            price: number 
        }>();

        const receivedGroups = new Map<string, number>();

        // 1. Mapear tudo que foi FATURADO (Baseado nas Deliveries)
        suppliers.forEach(s => {
            const supplierNorm = superNormalize(s.name);
            
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.invoiceNumber && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const itemNorm = superNormalize(d.item);
                    const nfNorm = normalizeInvoice(d.invoiceNumber);
                    const key = `${supplierNorm}|${itemNorm}|${nfNorm}`;
                    
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const mName = months[dateObj.getMonth()];
                    
                    const existing = billedGroups.get(key);
                    const price = s.contractItems.find(ci => superNormalize(ci.name) === itemNorm)?.valuePerKg || 0;

                    billedGroups.set(key, {
                        supplierReal: s.name,
                        itemReal: d.item,
                        month: mName,
                        nfDisplay: d.invoiceNumber,
                        kg: (existing?.kg || 0) + (d.kg || 0),
                        price: price
                    });
                }
            });
        });

        // 2. Mapear tudo que entrou no ESTOQUE (Baseado no WarehouseLog)
        warehouseLog.forEach(log => {
            if (log.type === 'entrada' && log.inboundInvoice) {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                const nfNorm = normalizeInvoice(log.inboundInvoice);
                const key = `${sNorm}|${iNorm}|${nfNorm}`;
                
                const current = receivedGroups.get(key) || 0;
                receivedGroups.set(key, current + (log.quantity || 0));
            }
        });

        // 3. Gerar o Relatório Final
        const result: any[] = [];
        
        // Usamos as chaves de faturamento como prioridade
        billedGroups.forEach((data, key) => {
            const receivedKg = receivedGroups.get(key) || 0;
            const shortfall = Math.max(0, data.kg - receivedKg);

            result.push({
                id: key,
                supplierName: data.supplierReal,
                productName: data.itemReal,
                invoice: data.nfDisplay,
                month: data.month,
                billedKg: data.kg,
                receivedKg: receivedKg,
                shortfallKg: shortfall,
                financialLoss: shortfall * data.price
            });
        });

        // Adicionar casos onde há estoque mas não há nota registrada no faturamento (erro de lançamento)
        receivedGroups.forEach((qty, key) => {
            if (!billedGroups.has(key)) {
                const [sNorm, iNorm, nfNorm] = key.split('|');
                result.push({
                    id: key,
                    supplierName: sNorm.toUpperCase() + " (S/ NOTA)",
                    productName: iNorm.toUpperCase(),
                    invoice: nfNorm,
                    month: "Desconhecido",
                    billedKg: 0,
                    receivedKg: qty,
                    shortfallKg: 0,
                    financialLoss: 0
                });
            }
        });

        return result.sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
    }, [suppliers, warehouseLog]);

    const filteredData = useMemo(() => {
        return comparisonData.filter(item => {
            const supplierMatch = selectedSupplierName === 'all' || item.supplierName === selectedSupplierName;
            const monthMatch = selectedMonthFilter === 'all' || item.month === selectedMonthFilter;
            const searchMatch = item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.invoice.toLowerCase().includes(searchTerm.toLowerCase());
            return supplierMatch && monthMatch && searchMatch;
        });
    }, [comparisonData, selectedSupplierName, selectedMonthFilter, searchTerm]);

    const totalLoss = useMemo(() => filteredData.reduce((sum, item) => sum + item.financialLoss, 0), [filteredData]);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Relatório de Conferência: Notas vs. Estoque</h2>
                <p className="text-sm text-gray-500 font-medium">Cruzamento automático baseado no número da Nota Fiscal e Fornecedor.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-blue-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Contratado Total</p>
                    <p className="text-xl font-black">{formatCurrency(analyticsData.totalContracted)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-green-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Faturado em Notas</p>
                    <p className="text-xl font-black text-green-600">{formatCurrency(analyticsData.totalDelivered)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-red-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Divergência Financeira</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(totalLoss)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-lg border-b-4 border-indigo-500 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Notas Processadas</p>
                    <p className="text-xl font-black text-indigo-800">{filteredData.length}</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
                    <input 
                        type="text" 
                        placeholder="Pesquisar fornecedor ou nota..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full lg:w-64 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                         <select
                            value={selectedSupplierName}
                            onChange={(e) => setSelectedSupplierName(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                            <option value="all">Todos os Fornecedores</option>
                            {supplierOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.displayName}</option>
                            ))}
                        </select>
                        <select
                            value={selectedMonthFilter}
                            onChange={(e) => setSelectedMonthFilter(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                            <option value="all">Todos os Meses</option>
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="p-4 text-left border-b">Fornecedor</th>
                                <th className="p-4 text-left border-b">Produto</th>
                                <th className="p-4 text-left border-b">Nº Nota</th>
                                <th className="p-4 text-left border-b">Mês (Nota)</th>
                                <th className="p-4 text-right border-b">Peso na Nota</th>
                                <th className="p-4 text-right border-b">Peso no Estoque</th>
                                <th className="p-4 text-right border-b">Falta (Kg)</th>
                                <th className="p-4 text-right border-b">Prejuízo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.length > 0 ? filteredData.map(item => (
                                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.shortfallKg > 0.001 ? 'bg-red-50/30' : ''}`}>
                                    <td className="p-4 font-bold text-gray-800 uppercase">{item.supplierName}</td>
                                    <td className="p-4 text-gray-600 uppercase text-xs">{item.productName}</td>
                                    <td className="p-4 font-mono text-xs font-bold text-blue-600">{item.invoice}</td>
                                    <td className="p-4 font-medium text-gray-500">{item.month}</td>
                                    <td className="p-4 text-right font-mono text-gray-600">
                                        {item.billedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                    </td>
                                    <td className={`p-4 text-right font-mono font-bold ${item.receivedKg > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                        {item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                    </td>
                                    <td className={`p-4 text-right font-mono font-black ${item.shortfallKg > 0.001 ? 'text-red-600 animate-pulse' : 'text-gray-300'}`}>
                                        {item.shortfallKg > 0.001 ? item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00"}
                                    </td>
                                    <td className={`p-4 text-right font-black ${item.financialLoss > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                                        {item.financialLoss > 0 ? formatCurrency(item.financialLoss) : "R$ 0,00"}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="p-20 text-center text-gray-400 italic font-medium uppercase tracking-widest bg-gray-50">
                                        Nenhuma divergência localizada para os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredData.length > 0 && (
                            <tfoot className="bg-gray-50 font-black">
                                <tr>
                                    <td colSpan={7} className="p-4 text-right text-gray-500 uppercase text-xs">Total Estimado de Perda em Falhas:</td>
                                    <td className="p-4 text-right text-red-800 text-lg">{formatCurrency(totalLoss)}</td>
                                </tr>
                            </tfoot>
                        )}
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
