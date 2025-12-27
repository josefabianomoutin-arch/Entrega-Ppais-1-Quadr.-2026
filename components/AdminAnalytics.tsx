import React, { useMemo, useState } from 'react';
import type { Producer, Delivery } from '../types';

interface AdminAnalyticsProps {
  producers: Producer[];
}

type SortKey = 'name' | 'progress' | 'delivered' | 'contracted';
type SortDirection = 'asc' | 'desc';

// Helper function to format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// SVG Donut Chart Component
const DonutChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    if (!data || data.length === 0) return <p className="text-center text-gray-500">Dados insuficientes para o gráfico.</p>;

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
            <path
                key={index}
                d={`M ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2}`}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="15"
            />
        );
    });

    return (
        <div className="flex flex-col md:flex-row items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">{paths}</svg>
            <div className="ml-0 md:ml-6 mt-4 md:mt-0 text-sm">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center mb-2">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: colors[index % colors.length] }}></div>
                        <span>{item.label}: <span className="font-semibold">{formatCurrency(item.value)}</span></span>
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

        const deliveriesByInvoice = new Map<string, Delivery[]>();
        allDeliveries.forEach(d => {
            const key = d.invoiceNumber || 'N/A';
            const group = deliveriesByInvoice.get(key) || [];
            group.push(d);
            deliveriesByInvoice.set(key, group);
        });

        let uniquePendingInvoices = 0;
        let uniqueSentInvoices = 0;

        for (const [invoiceNumber, deliveries] of deliveriesByInvoice.entries()) {
            if (invoiceNumber === 'N/A') continue;

            const isFullyUploaded = deliveries.every(d => d.invoiceUploaded);
            
            if (isFullyUploaded) {
                uniqueSentInvoices++;
            } else {
                const hasPastDatePending = deliveries.some(d => 
                    !d.invoiceUploaded && new Date(d.date + 'T00:00:00') < SIMULATED_TODAY
                );
                if (hasPastDatePending) {
                    uniquePendingInvoices++;
                }
            }
        }

        return {
            totalContracted,
            totalDelivered,
            progress: totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 0,
            producerCount: producers.length,
            topProducts,
            uniquePendingInvoices,
            uniqueSentInvoices
        };
    }, [producers, SIMULATED_TODAY]);
    
    const sortedProducers = useMemo(() => {
      return [...producers].sort((a, b) => {
        const aDelivered = a.deliveries.reduce((sum, d) => sum + d.value, 0);
        const bDelivered = b.deliveries.reduce((sum, d) => sum + d.value, 0);
        const aProgress = a.initialValue > 0 ? (aDelivered / a.initialValue) : 0;
        const bProgress = b.initialValue > 0 ? (bDelivered / b.initialValue) : 0;

        let comparison = 0;
        if (sortKey === 'name') comparison = a.name.localeCompare(b.name);
        if (sortKey === 'progress') comparison = bProgress - aProgress;
        if (sortKey === 'delivered') comparison = bDelivered - aDelivered;
        if (sortKey === 'contracted') comparison = b.initialValue - a.initialValue;

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }, [producers, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
      if (key === sortKey) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(key);
        setSortDirection('desc');
      }
    };

    const toggleProducerDetails = (producerId: string) => {
      setExpandedProducerId(currentId => currentId === producerId ? null : producerId);
    };

    const SortableHeader: React.FC<{ headerKey: SortKey, label: string }> = ({ headerKey, label }) => (
        <th className="p-3 text-left cursor-pointer" onClick={() => handleSort(headerKey)}>
            {label} {sortKey === headerKey && (sortDirection === 'desc' ? '▼' : '▲')}
        </th>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4">
                    <div className="bg-blue-100 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8h6m-5 4h4m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                    <div>
                        <p className="text-sm text-gray-500">Total Contratado</p>
                        <p className="text-2xl font-bold">{formatCurrency(analyticsData.totalContracted)}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4">
                     <div className="bg-green-100 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div>
                        <p className="text-sm text-gray-500">Total Entregue</p>
                        <p className="text-2xl font-bold">{formatCurrency(analyticsData.totalDelivered)}</p>
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4">
                    <div className="bg-yellow-100 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                    <div>
                        <p className="text-sm text-gray-500">Progresso Geral</p>
                        <p className="text-2xl font-bold">{analyticsData.progress.toFixed(1)}%</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4">
                     <div className="bg-indigo-100 p-3 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
                    <div>
                        <p className="text-sm text-gray-500">Produtores Ativos</p>
                        <p className="text-2xl font-bold">{analyticsData.producerCount}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
                    <div className="flex items-center space-x-4">
                        <div className="bg-orange-100 p-3 rounded-full">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </div>
                        <p className="text-lg font-semibold text-gray-700">Status das Notas Fiscais</p>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-baseline">
                            <p className="text-sm text-gray-500">Pendentes</p>
                            <p className="text-2xl font-bold text-red-600">{analyticsData.uniquePendingInvoices}</p>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <p className="text-sm text-gray-500">Enviadas</p>
                            <p className="text-2xl font-bold text-green-600">{analyticsData.uniqueSentInvoices}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                 <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-semibold mb-4 text-center">Contrato vs. Entregas</h3>
                    {analyticsData.totalContracted > 0 ? (
                      <div className="w-full h-64 flex items-end space-x-8 px-4">
                          <div className="flex-1 flex flex-col items-center">
                              <div className="font-bold text-blue-600">{formatCurrency(analyticsData.totalContracted)}</div>
                              <div className="w-full bg-blue-500 rounded-t-lg" style={{ height: `100%` }}></div>
                              <div className="text-sm mt-1">Contratado</div>
                          </div>
                          <div className="flex-1 flex flex-col items-center">
                              <div className="font-bold text-green-600">{formatCurrency(analyticsData.totalDelivered)}</div>
                              <div className="w-full bg-green-500 rounded-t-lg" style={{ height: `${analyticsData.progress}%` }}></div>
                              <div className="text-sm mt-1">Entregue</div>
                          </div>
                      </div>
                    ) : <p className="text-center text-gray-500 pt-16">Nenhum contrato cadastrado.</p>}
                </div>
                 <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-semibold mb-4 text-center">Top 5 Produtos (Valor Entregue)</h3>
                     <DonutChart data={analyticsData.topProducts} />
                </div>
            </div>

            {/* Producer Performance Table */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Desempenho dos Produtores</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableHeader headerKey="name" label="Produtor" />
                                <SortableHeader headerKey="contracted" label="Contratado" />
                                <SortableHeader headerKey="delivered" label="Entregue" />
                                <SortableHeader headerKey="progress" label="Progresso" />
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducers.map(p => {
                                const delivered = p.deliveries.reduce((sum, d) => sum + d.value, 0);
                                const progress = p.initialValue > 0 ? (delivered / p.initialValue) * 100 : 0;
                                const isExpanded = expandedProducerId === p.id;

                                const deliveredValueByItem = new Map<string, number>();
                                p.deliveries.forEach(delivery => {
                                    const currentVal = deliveredValueByItem.get(delivery.item) || 0;
                                    deliveredValueByItem.set(delivery.item, currentVal + delivery.value);
                                });

                                return (
                                    <React.Fragment key={p.id}>
                                        <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleProducerDetails(p.id)}>
                                            <td className="p-3 font-medium">
                                                <span className="mr-2">{isExpanded ? '▼' : '►'}</span>{p.name}
                                            </td>
                                            <td className="p-3">{formatCurrency(p.initialValue)}</td>
                                            <td className="p-3 text-green-600 font-semibold">{formatCurrency(delivered)}</td>
                                            <td className="p-3">
                                                <div className="w-full bg-gray-200 rounded-full h-4">
                                                    <div className="bg-green-500 h-4 rounded-full text-white text-xs flex items-center justify-center" style={{ width: `${progress}%` }}>
                                                        {progress > 20 && `${progress.toFixed(0)}%`}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-blue-50">
                                                <td colSpan={4} className="p-4">
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-gray-700">Detalhes do Contrato de {p.name}</h4>
                                                        {p.contractItems.map(item => {
                                                            const itemDelivered = deliveredValueByItem.get(item.name) || 0;
                                                            const itemProgress = item.value > 0 ? (itemDelivered / item.value) * 100 : 0;
                                                            return (
                                                                <div key={item.name} className="p-2 bg-white rounded-lg border">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className="font-medium">{item.name}</span>
                                                                        <span className="text-xs text-gray-500">
                                                                            {formatCurrency(itemDelivered)} / {formatCurrency(item.value)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                                        <div className="bg-blue-500 h-3 rounded-full text-white text-[10px] flex items-center justify-center" style={{ width: `${itemProgress}%` }}>
                                                                            {itemProgress > 25 && `${itemProgress.toFixed(0)}%`}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                  animation: fade-in 0.5s ease-out forwards;
                }
              `}</style>
        </div>
    );
};

export default AdminAnalytics;