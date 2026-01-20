import React, { useState, useMemo } from 'react';
import type { Supplier } from '../types';

interface InvoiceInfo {
    id: string;
    supplierName: string;
    supplierCpf: string;
    invoiceNumber: string;
    date: string; // The earliest date associated with this invoice
    totalValue: number;
    items: { name: string; kg: number; value: number }[];
}

interface AdminInvoicesProps {
    suppliers: Supplier[];
    onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => void;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};

const AdminInvoices: React.FC<AdminInvoicesProps> = ({ suppliers, onReopenInvoice }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<'supplierName' | 'date' | 'totalValue'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

    const allInvoices = useMemo((): InvoiceInfo[] => {
        const invoicesMap = new Map<string, InvoiceInfo>();

        suppliers.forEach(supplier => {
            const deliveriesByInvoice = new Map<string, any[]>();
            
            // Group deliveries by invoice number for this supplier
            (supplier.deliveries || []).forEach(delivery => {
                if (delivery.invoiceNumber) {
                    const existing = deliveriesByInvoice.get(delivery.invoiceNumber) || [];
                    deliveriesByInvoice.set(delivery.invoiceNumber, [...existing, delivery]);
                }
            });

            deliveriesByInvoice.forEach((deliveries, invoiceNumber) => {
                const invoiceId = `${supplier.cpf}-${invoiceNumber}`;
                const totalValue = deliveries.reduce((sum, d) => sum + (d.value || 0), 0);
                const items = deliveries.map(d => ({ name: d.item || 'N/A', kg: d.kg || 0, value: d.value || 0 })).filter(d => d.name !== 'AGENDAMENTO PENDENTE');
                
                if(items.length === 0) return;

                const earliestDate = deliveries.reduce((earliest, d) => d.date < earliest ? d.date : earliest, deliveries[0].date);

                invoicesMap.set(invoiceId, {
                    id: invoiceId,
                    supplierName: supplier.name,
                    supplierCpf: supplier.cpf,
                    invoiceNumber,
                    date: earliestDate,
                    totalValue,
                    items,
                });
            });
        });

        return Array.from(invoicesMap.values());
    }, [suppliers]);
    
    const filteredAndSortedInvoices = useMemo(() => {
        const filtered = allInvoices.filter(invoice => 
            invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.invoiceNumber.includes(searchTerm)
        );

        return filtered.sort((a, b) => {
            let comp = 0;
            if (sortKey === 'supplierName') {
                comp = a.supplierName.localeCompare(b.supplierName);
            } else if (sortKey === 'date') {
                comp = new Date(b.date).getTime() - new Date(a.date).getTime();
            } else if (sortKey === 'totalValue') {
                comp = b.totalValue - a.totalValue;
            }
            return sortDirection === 'asc' ? -comp : comp;
        });
    }, [allInvoices, searchTerm, sortKey, sortDirection]);

    const handleSort = (key: 'supplierName' | 'date' | 'totalValue') => {
        if (key === sortKey) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };
    
    const toggleExpand = (invoiceId: string) => {
        setExpandedInvoiceId(prev => prev === invoiceId ? null : invoiceId);
    };

    const handleReopenClick = (supplierCpf: string, invoiceNumber: string) => {
        const confirmationMessage = `Tem certeza que deseja reabrir esta nota fiscal (NF: ${invoiceNumber})?\n\nTodas as entregas associadas serão revertidas para UM ÚNICO 'AGENDAMENTO PENDENTE' e o fornecedor precisará faturá-las novamente.\n\nEsta ação não pode ser desfeita.`;
        if (window.confirm(confirmationMessage)) {
            onReopenInvoice(supplierCpf, invoiceNumber);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-teal-500 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                 <div>
                    <h2 className="text-3xl font-black text-teal-900 uppercase tracking-tighter">Consulta de Notas Fiscais</h2>
                    <p className="text-gray-400 font-medium">Visualize todas as notas fiscais enviadas pelos fornecedores.</p>
                </div>
                <input
                    type="text"
                    placeholder="Pesquisar por fornecedor ou NF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400 transition-all"
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('supplierName')}>Fornecedor</th>
                            <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('date')}>Data</th>
                            <th className="p-3 text-left">Nº Nota Fiscal</th>
                            <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('totalValue')}>Valor Total</th>
                            <th className="p-3 text-center">Detalhes</th>
                            <th className="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedInvoices.length > 0 ? filteredAndSortedInvoices.map(invoice => {
                            const isExpanded = expandedInvoiceId === invoice.id;
                            return (
                                <React.Fragment key={invoice.id}>
                                    <tr className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-bold text-gray-800">{invoice.supplierName}</td>
                                        <td className="p-3 font-mono">{formatDate(invoice.date)}</td>
                                        <td className="p-3 font-mono">{invoice.invoiceNumber}</td>
                                        <td className="p-3 text-right font-mono font-bold text-green-700">{formatCurrency(invoice.totalValue)}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => toggleExpand(invoice.id)} className="p-2 rounded-full hover:bg-gray-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                             <button 
                                                onClick={() => handleReopenClick(invoice.supplierCpf, invoice.invoiceNumber)}
                                                className="bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-bold px-3 py-1 rounded-full transition-colors"
                                                title="Reverter para agendamento pendente"
                                             >
                                                Reabrir
                                             </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-100">
                                            <td colSpan={6} className="p-4">
                                                <div className="animate-slide-down">
                                                    <h4 className="text-xs font-bold uppercase text-gray-600 mb-2">Itens na Nota Fiscal {invoice.invoiceNumber}</h4>
                                                    <ul className="space-y-1 text-xs">
                                                        {invoice.items.map((item, index) => (
                                                            <li key={index} className="flex justify-between items-center p-2 bg-white rounded">
                                                                <span>{item.name} <span className="text-gray-500">({(item.kg || 0).toFixed(2).replace('.',',')} Kg)</span></span>
                                                                <span className="font-mono">{formatCurrency(item.value)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        }) : (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Nenhuma nota fiscal encontrada.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <style>{`
                @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
             `}</style>
        </div>
    )
};

export default AdminInvoices;