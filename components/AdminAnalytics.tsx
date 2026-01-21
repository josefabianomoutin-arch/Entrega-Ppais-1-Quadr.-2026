import React, { useMemo, useState } from 'react';
import type { Supplier } from '../types';

interface AdminAnalyticsProps {
  suppliers: Supplier[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};

const getContractItemWeight = (item: Supplier['contractItems'][0]): number => {
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    if (unitType === 'un') return item.totalKg;
    if (unitType === 'dz') return 0;
    const quantity = item.totalKg;
    const unitWeight = parseFloat(unitWeightStr) || 1;
    return quantity * unitWeight;
};


const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ suppliers }) => {
    const [sortKey, setSortKey] = useState<'name' | 'progress' | 'delivered' | 'contracted'>('progress');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
    const [expandedSupplierCpf, setExpandedSupplierCpf] = useState<string | null>(null);

    const analyticsData = useMemo(() => {
        const totalContracted = suppliers.reduce((sum, p) => sum + p.initialValue, 0);
        const totalDelivered = suppliers.reduce((sum, p) => sum + p.deliveries.reduce((dSum, d) => dSum + (d.value || 0), 0), 0);
        
        return {
            totalContracted,
            totalDelivered,
            progress: totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 0,
            supplierCount: suppliers.length,
        };
    }, [suppliers]);
    
    const filteredSuppliers = useMemo(() => {
      return suppliers.filter(p => p.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()));
    }, [suppliers, supplierSearchTerm]);

    const sortedSuppliers = useMemo(() => {
      return [...filteredSuppliers].sort((a, b) => {
            const aDelivered = a.deliveries.reduce((sum, d) => sum + (d.value || 0), 0);
            const bDelivered = b.deliveries.reduce((sum, d) => sum + (d.value || 0), 0);
            const aProgress = a.initialValue > 0 ? aDelivered / a.initialValue : 0;
            const bProgress = b.initialValue > 0 ? bDelivered / b.initialValue : 0;
            let comp = 0;
            if (sortKey === 'name') comp = a.name.localeCompare(b.name);
            else if (sortKey === 'progress') comp = bProgress - aProgress;
            else if (sortKey === 'delivered') comp = bDelivered - aDelivered;
            else comp = b.initialValue - a.initialValue;
            return sortDirection === 'asc' ? comp : -comp;
        });
    }, [filteredSuppliers, sortKey, sortDirection]);

    const handleSort = (key: 'name' | 'progress' | 'delivered' | 'contracted') => {
      if (key === sortKey) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setSortKey(key); setSortDirection('desc'); }
    };

    const handleExportCSV = () => {
        const headers = [
            "Fornecedor",
            "CPF/CNPJ",
            "Item",
            "Mês",
            "Peso Previsto (Kg)",
            "Peso Entregue (Kg)",
            "Peso Restante (Kg)",
            "Valor Previsto (R$)",
            "Observação"
        ];
    
        const csvRows = [headers.join(';')];
    
        suppliers.forEach(p => {
            csvRows.push('');
            
            p.contractItems.forEach(item => {
                const totalItemWeight = getContractItemWeight(item);
                const itemTotalValue = item.totalKg * item.valuePerKg;
                const monthlyKg = totalItemWeight / 4;
                const monthlyValue = itemTotalValue / 4;
                const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril'];
                const deliveriesForItem = p.deliveries.filter(d => d.item === item.name && d.kg);
                let surplusFromPreviousMonth = 0;
    
                months.forEach((month, index) => {
                    const deliveredInMonth = deliveriesForItem
                        .filter(d => new Date(d.date + 'T00:00:00').getMonth() === index)
                        .reduce((sum, d) => sum + (d.kg || 0), 0);
                    
                    const surplusApplied = surplusFromPreviousMonth;
                    const adjustedMonthlyKg = monthlyKg - surplusApplied;
                    const remainingInMonth = adjustedMonthlyKg - deliveredInMonth;
    
                    surplusFromPreviousMonth = remainingInMonth < 0 ? -remainingInMonth : 0;
    
                    const observation = surplusApplied > 0 
                        ? `Ajustado pelo excedente de ${surplusApplied.toFixed(2).replace('.', ',')}kg do mês anterior.` 
                        : '';
    
                    const row = [
                        `"${p.name}"`,
                        `'${p.cpf}`,
                        `"${item.name}"`,
                        month,
                        String(adjustedMonthlyKg.toFixed(2)).replace('.', ','),
                        String(deliveredInMonth.toFixed(2)).replace('.', ','),
                        String(remainingInMonth.toFixed(2)).replace('.', ','),
                        String(monthlyValue.toFixed(2)).replace('.', ','),
                        `"${observation}"`
                    ];
                    csvRows.push(row.join(';'));
                });
    
                const totalDeliveredKgForItem = deliveriesForItem.reduce((sum, d) => sum + (d.kg || 0), 0);
                const totalRemainingKgForItem = totalItemWeight - totalDeliveredKgForItem;
                const row = [
                    "",
                    "",
                    `"Total ${item.name}"`,
                    "",
                    String(totalItemWeight.toFixed(2)).replace('.', ','),
                    String(totalDeliveredKgForItem.toFixed(2)).replace('.', ','),
                    String(totalRemainingKgForItem.toFixed(2)).replace('.', ','),
                    String(itemTotalValue.toFixed(2)).replace('.', ','),
                    ""
                ];
                csvRows.push(row.join(';'));
                csvRows.push('');
            });
        });
    
        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'relatorio_analitico_fornecedores.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                    <h3 className="text-lg font-bold text-gray-800">Desempenho Detalhado por Fornecedor</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                         <input 
                            type="text" 
                            placeholder="Pesquisar fornecedor..." 
                            value={supplierSearchTerm} 
                            onChange={(e) => setSupplierSearchTerm(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                        />
                         <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Exportar CSV
                        </button>
                    </div>
                </div>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                   {filteredSuppliers.length > 0 ? filteredSuppliers.map(supplier => {
                       const isExpanded = expandedSupplierCpf === supplier.cpf;
                       return (
                           <div key={supplier.cpf} className={`border rounded-xl transition-all ${isExpanded ? 'ring-2 ring-blue-500 bg-white' : 'bg-gray-50/50 hover:bg-white'}`}>
                               <div className="p-4 cursor-pointer flex justify-between items-center" onClick={() => setExpandedSupplierCpf(isExpanded ? null : supplier.cpf)}>
                                   <span className="font-bold text-gray-700">{supplier.name}</span>
                                   <div className="flex items-center gap-4">
                                       <span className="text-sm font-bold text-blue-600">{formatCurrency(supplier.initialValue)}</span>
                                       <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                   </div>
                               </div>
                               {isExpanded && (
                                   <div className="p-4 bg-gray-50 border-t animate-slide-down space-y-6">
                                       <div>
                                            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Itens Contratados (Previsão Mensal)</h4>
                                            <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-200">
                                                            <tr>
                                                                <th className="p-2 text-left font-semibold">Item</th>
                                                                <th className="p-2 text-left font-semibold">Mês</th>
                                                                <th className="p-2 text-right font-semibold">Peso Previsto (Kg)</th>
                                                                <th className="p-2 text-right font-semibold text-green-700">Peso Entregue (Kg)</th>
                                                                <th className="p-2 text-right font-semibold text-red-700">Peso Restante (Kg)</th>
                                                                <th className="p-2 text-right font-semibold">Valor Previsto (R$)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {supplier.contractItems.length > 0 ? supplier.contractItems.map(item => {
                                                                const totalItemWeight = getContractItemWeight(item);
                                                                const monthlyKg = totalItemWeight / 4;
                                                                const itemTotalValue = item.totalKg * item.valuePerKg;
                                                                const monthlyValue = itemTotalValue / 4;
                                                                const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril'];
                                                                
                                                                const deliveriesForItem = supplier.deliveries.filter(d => d.item === item.name && d.kg);
                                                                const totalDeliveredKgForItem = deliveriesForItem.reduce((sum, d) => sum + (d.kg || 0), 0);
                                                                const totalRemainingKgForItem = totalItemWeight - totalDeliveredKgForItem;

                                                                let surplusFromPreviousMonth = 0;

                                                                return (
                                                                    <React.Fragment key={item.name}>
                                                                        {months.map((month, index) => {
                                                                            const deliveredInMonth = deliveriesForItem
                                                                                .filter(d => new Date(d.date + 'T00:00:00').getMonth() === index)
                                                                                .reduce((sum, d) => sum + (d.kg || 0), 0);
                                                                            
                                                                            const surplusApplied = surplusFromPreviousMonth;
                                                                            const adjustedMonthlyKg = monthlyKg - surplusApplied;
                                                                            const remainingInMonth = adjustedMonthlyKg - deliveredInMonth;
                                                                            
                                                                            surplusFromPreviousMonth = remainingInMonth < 0 ? -remainingInMonth : 0;
                                                                            
                                                                            return (
                                                                                <tr key={`${item.name}-${month}`} className="border-b bg-white">
                                                                                    {index === 0 ? (
                                                                                        <td rowSpan={4} className="p-2 align-top border-r font-semibold text-gray-700">{item.name}</td>
                                                                                    ) : null}
                                                                                    <td className="p-2">{month}</td>
                                                                                    <td className="p-2 text-right font-mono" title={surplusApplied > 0 ? `Valor ajustado pelo excedente de ${surplusApplied.toFixed(2).replace('.',',')}kg do mês anterior` : ''}>
                                                                                      {adjustedMonthlyKg.toFixed(2).replace('.',',')}
                                                                                      {surplusApplied > 0 && <span className="text-blue-500 font-bold">*</span>}
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-mono font-semibold text-green-600">{deliveredInMonth.toFixed(2).replace('.',',')}</td>
                                                                                    <td className={`p-2 text-right font-mono font-semibold ${remainingInMonth > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                                        {Math.max(0, remainingInMonth).toFixed(2).replace('.',',')}
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-mono">{formatCurrency(monthlyValue)}</td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        <tr className="bg-gray-100 font-bold border-b-2 border-gray-300">
                                                                            <td colSpan={2} className="p-2 text-right">Total do Item:</td>
                                                                            <td className="p-2 text-right font-mono">{totalItemWeight.toFixed(2).replace('.',',')}</td>
                                                                            <td className="p-2 text-right font-mono text-green-700">{totalDeliveredKgForItem.toFixed(2).replace('.',',')}</td>
                                                                            <td className={`p-2 text-right font-mono font-bold ${totalRemainingKgForItem > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalRemainingKgForItem.toFixed(2).replace('.',',')}</td>
                                                                            <td className="p-2 text-right font-mono">{formatCurrency(itemTotalValue)}</td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                )
                                                            }) : (
                                                                <tr><td colSpan={6} className="p-4 text-center text-gray-500 italic">Nenhum item neste contrato.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                            </div>
                                       </div>
                                       <div>
                                            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Entregas Realizadas</h4>
                                            <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-200">
                                                            <tr>
                                                                <th className="p-2 text-left font-semibold">Data</th>
                                                                <th className="p-2 text-left font-semibold">Item</th>
                                                                <th className="p-2 text-left font-semibold">NF</th>
                                                                <th className="p-2 text-right font-semibold">Valor (R$)</th>
                                                                <th className="p-2 text-center font-semibold">Status NF</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {supplier.deliveries.length > 0 ? supplier.deliveries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(delivery => (
                                                                <tr key={delivery.id} className="border-b last:border-b-0 bg-white">
                                                                    <td className="p-2 font-mono">{formatDate(delivery.date)}</td>
                                                                    <td className="p-2">{delivery.item}</td>
                                                                    <td className="p-2 font-mono">{delivery.invoiceNumber || '-'}</td>
                                                                    <td className="p-2 text-right font-mono">{formatCurrency(delivery.value || 0)}</td>
                                                                    <td className="p-2 text-center">
                                                                        {delivery.invoiceUploaded ? (
                                                                            <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">Enviada</span>
                                                                        ) : (
                                                                            <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">Pendente</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )) : (
                                                                <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">Nenhuma entrega registrada.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                            </div>
                                       </div>
                                   </div>
                               )}
                           </div>
                       );
                   }) : (
                        <div className="text-center py-10"><p className="text-gray-400 italic">Nenhum fornecedor encontrado.</p></div>
                   )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-bold mb-4">Desempenho Geral dos Fornecedores</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('name')}>Fornecedor</th>
                                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('progress')}>Progresso da Entrega</th>
                                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('delivered')}>Entregue / Contratado (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSuppliers.length > 0 ? sortedSuppliers.map(p => {
                                const deliveredValue = p.deliveries.reduce((s, d) => s + (d.value || 0), 0);
                                const contractedValue = p.initialValue;
                                const progress = contractedValue > 0 ? (deliveredValue / contractedValue) * 100 : 0;
                                return (
                                    <tr key={p.cpf} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-bold text-gray-800">{p.name}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-full bg-gray-200 rounded-full h-5 relative overflow-hidden shadow-inner">
                                                    <div
                                                        className="bg-green-500 h-5 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min(100, progress)}%` }}
                                                    />
                                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-lighten">{progress.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-xs">
                                            <span className="font-bold text-green-600">{formatCurrency(deliveredValue)}</span>
                                            <span className="text-gray-400"> / {formatCurrency(contractedValue)}</span>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">Nenhum dado de fornecedor para exibir.</td></tr>
                            )}
                        </tbody>
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