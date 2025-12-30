import React, { useMemo, useState } from 'react';
import type { Producer } from '../types';

interface AdminAnalyticsProps {
  producers: Producer[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};


const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ producers }) => {
    const [sortKey, setSortKey] = useState<'name' | 'progress' | 'delivered' | 'contracted'>('progress');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [producerSearchTerm, setProducerSearchTerm] = useState('');
    const [expandedProducerId, setExpandedProducerId] = useState<string | null>(null);

    const analyticsData = useMemo(() => {
        const totalContracted = producers.reduce((sum, p) => sum + p.initialValue, 0);
        const totalDelivered = producers.reduce((sum, p) => sum + p.deliveries.reduce((dSum, d) => dSum + d.value, 0), 0);
        
        return {
            totalContracted,
            totalDelivered,
            progress: totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 0,
            producerCount: producers.length,
        };
    }, [producers]);
    
    const filteredProducers = useMemo(() => {
      return producers.filter(p => p.name.toLowerCase().includes(producerSearchTerm.toLowerCase()));
    }, [producers, producerSearchTerm]);

    const sortedProducers = useMemo(() => {
      return [...filteredProducers].sort((a, b) => {
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
    }, [filteredProducers, sortKey, sortDirection]);

    const handleSort = (key: 'name' | 'progress' | 'delivered' | 'contracted') => {
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
                    <h3 className="text-lg font-bold text-gray-800">Detalhes do Contrato por Produtor</h3>
                     <input 
                        type="text" 
                        placeholder="Pesquisar produtor..." 
                        value={producerSearchTerm} 
                        onChange={(e) => setProducerSearchTerm(e.target.value)}
                        className="border rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                   {filteredProducers.length > 0 ? filteredProducers.map(producer => {
                       const isExpanded = expandedProducerId === producer.id;
                       return (
                           <div key={producer.id} className={`border rounded-xl transition-all ${isExpanded ? 'ring-2 ring-blue-500 bg-white' : 'bg-gray-50/50 hover:bg-white'}`}>
                               <div className="p-4 cursor-pointer flex justify-between items-center" onClick={() => setExpandedProducerId(isExpanded ? null : producer.id)}>
                                   <span className="font-bold text-gray-700">{producer.name}</span>
                                   <div className="flex items-center gap-4">
                                       <span className="text-sm font-bold text-blue-600">{formatCurrency(producer.initialValue)}</span>
                                       <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                   </div>
                               </div>
                               {isExpanded && (
                                   <div className="p-4 bg-gray-50 border-t animate-slide-down space-y-6">
                                       <div>
                                            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Itens Contratados</h4>
                                            <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-200">
                                                            <tr>
                                                                <th className="p-2 text-left font-semibold">Item</th>
                                                                <th className="p-2 text-right font-semibold">Peso (Kg)</th>
                                                                <th className="p-2 text-right font-semibold">Valor (R$)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {producer.contractItems.length > 0 ? producer.contractItems.map(item => (
                                                                <tr key={item.name} className="border-b last:border-b-0 bg-white">
                                                                    <td className="p-2">{item.name}</td>
                                                                    <td className="p-2 text-right font-mono">{item.totalKg.toFixed(2).replace('.',',')}</td>
                                                                    <td className="p-2 text-right font-mono">{formatCurrency(item.totalKg * item.valuePerKg)}</td>
                                                                </tr>
                                                            )) : (
                                                                <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Nenhum item neste contrato.</td></tr>
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
                                                                <th className="p-2 text-center font-semibold">Fatura</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {producer.deliveries.length > 0 ? producer.deliveries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(delivery => (
                                                                <tr key={delivery.id} className="border-b last:border-b-0 bg-white">
                                                                    <td className="p-2 font-mono">{formatDate(delivery.date)}</td>
                                                                    <td className="p-2">{delivery.item}</td>
                                                                    <td className="p-2 font-mono">{delivery.invoiceNumber || '-'}</td>
                                                                    <td className="p-2 text-right font-mono">{formatCurrency(delivery.value)}</td>
                                                                    <td className="p-2 text-center">
                                                                        {delivery.invoiceDownloadURL ? (
                                                                            <a href={delivery.invoiceDownloadURL} target="_blank" rel="noopener noreferrer" className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200 transition-colors">Baixar NF</a>
                                                                        ) : (
                                                                            <span className="text-red-500 font-semibold">Pendente</span>
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
                        <div className="text-center py-10"><p className="text-gray-400 italic">Nenhum produtor encontrado.</p></div>
                   )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-bold mb-4">Desempenho Geral dos Produtores</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('name')}>Produtor</th>
                                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('progress')}>Progresso da Entrega</th>
                                <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('delivered')}>Entregue / Contratado (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducers.length > 0 ? sortedProducers.map(p => {
                                const deliveredValue = p.deliveries.reduce((s, d) => s + d.value, 0);
                                const contractedValue = p.initialValue;
                                const progress = contractedValue > 0 ? (deliveredValue / contractedValue) * 100 : 0;
                                return (
                                    <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
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
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">Nenhum dado de produtor para exibir.</td></tr>
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