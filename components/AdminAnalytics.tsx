import React, { useMemo, useState } from 'react';
import type { Producer, Delivery } from '../types';

interface AdminAnalyticsProps {
  producers: Producer[];
}

type SortKey = 'name' | 'progress' | 'delivered' | 'contracted';
type SortDirection = 'asc' | 'desc';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const DonutChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    if (!data || data.length === 0) return <p className="text-center text-gray-500">Dados insuficientes.</p>;

    const colors = ['#34D399', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA'];
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;

    const paths = data.map((item, index) => {
        const percentage = item.value / total;
        const startAngle = (cumulative / total) * 360;
        const endAngle = ((cumulative + item.value) / total) * 360;
        cumulative += item.value;
        const largeArcFlag = percentage > 0.5 ? 1 : 0;
        const x1 = 50 + 40 * Math.cos(Math.PI * (startAngle - 90) / 180);
        const y1 = 50 + 40 * Math.sin(Math.PI * (startAngle - 90) / 180);
        const x2 = 50 + 40 * Math.cos(Math.PI * (endAngle - 90) / 180);
        const y2 = 50 + 40 * Math.sin(Math.PI * (endAngle - 90) / 180);
        return (
            <path key={index} d={`M ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2}`} fill="none" stroke={colors[index % colors.length]} strokeWidth="15" />
        );
    });

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">{paths}</svg>
            <div className="mt-4 text-xs space-y-1">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors[index % colors.length] }}></div>
                        <span className="truncate max-w-[150px]">{item.label}: <b>{formatCurrency(item.value)}</b></span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ producers }) => {
    const [sortKey, setSortKey] = useState<SortKey>('progress');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedProducerId, setExpandedProducerId] = useState<string | null>(null);
    const [expandedItemName, setExpandedItemName] = useState<string | null>(null);
    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const [producerSearchTerm, setProducerSearchTerm] = useState('');
    
    const SIMULATED_TODAY = new Date('2026-04-30T00:00:00');

    const analyticsData = useMemo(() => {
        const totalContracted = producers.reduce((sum, p) => sum + p.initialValue, 0);
        const totalDelivered = producers.reduce((sum, p) => sum + p.deliveries.reduce((dSum, d) => dSum + d.value, 0), 0);
        
        const productsDelivered = new Map<string, number>();
        const allDeliveries = producers.flatMap(p => p.deliveries);
        allDeliveries.forEach(d => {
            productsDelivered.set(d.item, (productsDelivered.get(d.item) || 0) + d.value);
        });

        const topProducts = Array.from(productsDelivered.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, value]) => ({ label, value }));

        let uniquePendingInvoices = 0;
        let uniqueSentInvoices = 0;
        const invoiceGroups = new Map<string, Delivery[]>();
        allDeliveries.forEach(d => {
            if (!d.invoiceNumber) return;
            const group = invoiceGroups.get(d.invoiceNumber) || [];
            group.push(d);
            invoiceGroups.set(d.invoiceNumber, group);
        });

        invoiceGroups.forEach((deliveries) => {
            if (deliveries.every(d => d.invoiceUploaded)) uniqueSentInvoices++;
            else if (deliveries.some(d => new Date(d.date + 'T00:00:00') < SIMULATED_TODAY)) uniquePendingInvoices++;
        });

        return {
            totalContracted, totalDelivered,
            progress: totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 0,
            producerCount: producers.length,
            topProducts, uniquePendingInvoices, uniqueSentInvoices
        };
    }, [producers, SIMULATED_TODAY]);

    const itemProgressData = useMemo(() => {
        const itemsMap = new Map<string, { contracted: number; delivered: number; contributors: {producerName: string, contracted: number, delivered: number}[] }>();
        
        producers.forEach(p => {
            p.contractItems.forEach(item => {
                const entry = itemsMap.get(item.name) || { contracted: 0, delivered: 0, contributors: [] };
                const itemContractValue = item.totalKg * item.valuePerKg;
                const itemDeliveredValue = p.deliveries.filter(d => d.item === item.name).reduce((sum, d) => sum + d.value, 0);
                entry.contracted += itemContractValue;
                entry.delivered += itemDeliveredValue;
                entry.contributors.push({ producerName: p.name, contracted: itemContractValue, delivered: itemDeliveredValue });
                itemsMap.set(item.name, entry);
            });
        });

        return Array.from(itemsMap.entries())
            .map(([name, data]) => ({ name, ...data, progress: data.contracted > 0 ? (data.delivered / data.contracted) * 100 : 0 }))
            .filter(item => item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [producers, itemSearchTerm]);
    
    const sortedProducers = useMemo(() => {
      return [...producers]
        .filter(p => p.name.toLowerCase().includes(producerSearchTerm.toLowerCase()))
        .sort((a, b) => {
            const aDelivered = a.deliveries.reduce((sum, d) => sum + d.value, 0);
            const bDelivered = b.deliveries.reduce((sum, d) => sum + d.value, 0);
            const aProgress = a.initialValue > 0 ? aDelivered / a.initialValue : 0;
            const bProgress = b.initialValue > 0 ? bDelivered / b.initialValue : 0;
            let comp = 0;
            if (sortKey === 'name') comp = a.name.localeCompare(b.name);
            else if (sortKey === 'progress') comp = bProgress - aProgress;
            else if (sortKey === 'delivered') comp = bDelivered - aDelivered;
            else comp = b.initialValue - a.initialValue;
            return sortDirection === 'asc' ? comp : -comp;
        });
    }, [producers, sortKey, sortDirection, producerSearchTerm]);

    const handleSort = (key: SortKey) => {
      if (key === sortKey) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setSortKey(key); setSortDirection('desc'); }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
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
                    <p className="text-xs text-gray-400 font-bold uppercase">Produtores</p>
                    <p className="text-xl font-black text-indigo-800">{analyticsData.producerCount}</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Progresso por Produto</h3>
                    <input type="text" placeholder="Pesquisar..." value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)} className="border rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400"/>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {itemProgressData.map(item => {
                        const isExpanded = expandedItemName === item.name;
                        return (
                            <div key={item.name} className={`border rounded-xl ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}>
                                <div className="p-4 cursor-pointer" onClick={() => setExpandedItemName(isExpanded ? null : item.name)}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-gray-700">{item.name}</span>
                                        <span className="text-xs text-gray-400">{formatCurrency(item.delivered)} / {formatCurrency(item.contracted)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div className="bg-blue-600 h-3" style={{ width: `${Math.min(100, item.progress)}%` }}></div>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="p-4 bg-gray-50 border-t rounded-b-xl space-y-2">
                                        {item.contributors.map((c, i) => (
                                            <div key={i} className="flex justify-between text-xs bg-white p-2 rounded border">
                                                <span>{c.producerName}</span>
                                                <span className="font-bold text-blue-600">{((c.delivered/c.contracted)*100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-lg"><DonutChart data={analyticsData.topProducts} /></div>
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Ranking de Produtores</h3>
                        <input 
                            type="text" 
                            placeholder="Filtrar por produtor..." 
                            value={producerSearchTerm} 
                            onChange={(e) => setProducerSearchTerm(e.target.value)}
                            className="border rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-2 text-left cursor-pointer" onClick={() => handleSort('name')}>Nome</th>
                                    <th className="p-2 text-left cursor-pointer" onClick={() => handleSort('progress')}>%</th>
                                    <th className="p-2 text-right">Entregue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedProducers.map(p => (
                                    <tr key={p.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 font-bold">{p.name}</td>
                                        <td className="p-2">{( (p.deliveries.reduce((s,d)=>s+d.value,0) / p.initialValue || 0) * 100 ).toFixed(0)}%</td>
                                        <td className="p-2 text-right text-green-600 font-bold">{formatCurrency(p.deliveries.reduce((s,d)=>s+d.value,0))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }`}</style>
        </div>
    );
};

export default AdminAnalytics;