
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ContractItem } from '../types';

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
    onDeleteInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onUpdateInvoiceItems: (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => Promise<{ success: boolean; message?: string }>;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
    if (!dateString || dateString === "Invalid Date") return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('pt-BR');
};

const getDisplayUnit = (item: ContractItem | undefined): string => {
    if (!item || !item.unit) return 'Kg';
    const [unitType] = item.unit.split('-');
    const unitMap: { [key: string]: string } = {
        kg: 'Kg', un: 'Kg', saco: 'Kg', balde: 'Kg', pacote: 'Kg', pote: 'Kg',
        litro: 'L', l: 'L', caixa: 'L', embalagem: 'L',
        dz: 'Dz'
    };
    return unitMap[unitType] || 'Un';
};

const AdminInvoices: React.FC<AdminInvoicesProps> = ({ suppliers, onReopenInvoice, onDeleteInvoice, onUpdateInvoiceItems }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<'supplierName' | 'date' | 'totalValue'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<InvoiceInfo | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const allInvoices = useMemo((): InvoiceInfo[] => {
        const invoicesMap = new Map<string, InvoiceInfo>();

        (suppliers || []).forEach(supplier => {
            const deliveriesByInvoice = new Map<string, Delivery[]>();
            
            (supplier.deliveries || []).forEach(delivery => {
                if (delivery.invoiceNumber && delivery.invoiceNumber.trim() !== "") {
                    const existing = deliveriesByInvoice.get(delivery.invoiceNumber) || [];
                    deliveriesByInvoice.set(delivery.invoiceNumber, [...existing, delivery]);
                }
            });

            deliveriesByInvoice.forEach((deliveries, invoiceNumber) => {
                const invoiceId = `${supplier.cpf}-${invoiceNumber}`;
                const totalValue = deliveries.reduce((sum, d) => sum + (d.value || 0), 0);
                
                const items = deliveries
                    .filter(d => d.item && d.item !== 'AGENDAMENTO PENDENTE')
                    .map(d => ({ 
                        name: d.item || 'Item não especificado', 
                        kg: d.kg || 0, 
                        value: d.value || 0 
                    }));
                
                const validDates = deliveries.map(d => d.date).filter(d => d && d !== "Invalid Date");
                const earliestDate = validDates.length > 0 ? validDates.sort()[0] : new Date().toISOString().split('T')[0];

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
            invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
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
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };
    
    const toggleExpand = (invoiceId: string) => {
        setExpandedInvoiceId(prev => (prev === invoiceId ? null : invoiceId));
    };

    const handleReopenClick = (supplierCpf: string, invoiceNumber: string) => {
        const confirmationMessage = `Tem certeza que deseja REABRIR esta nota fiscal (NF: ${invoiceNumber})?\n\nAs entregas associadas voltarão ao estado de agendamento pendente para nova digitação.`;
        if (window.confirm(confirmationMessage)) {
            onReopenInvoice(supplierCpf, invoiceNumber);
        }
    };

    const handleDeleteClick = (supplierCpf: string, invoiceNumber: string) => {
        const confirmationMessage = `ATENÇÃO: Deseja EXCLUIR permanentemente o faturamento desta NF (${invoiceNumber})?\n\nEsta ação é irreversível.`;
        if (window.confirm(confirmationMessage)) {
            onDeleteInvoice(supplierCpf, invoiceNumber);
        }
    };

    const handleEditSave = async (updatedItems: { name: string; kg: number; value: number }[]) => {
        if (!editingInvoice) return;
        setIsSavingEdit(true);
        const res = await onUpdateInvoiceItems(editingInvoice.supplierCpf, editingInvoice.invoiceNumber, updatedItems);
        setIsSavingEdit(false);
        if (res.success) {
            setEditingInvoice(null);
        } else {
            alert(res.message || 'Erro ao salvar alterações.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-7xl mx-auto border-t-8 border-teal-500">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                 <div>
                    <h2 className="text-3xl font-black text-teal-900 uppercase tracking-tighter">Consulta de Notas Fiscais</h2>
                    <p className="text-gray-400 font-medium">Visualize as faturas. Use o botão Editar para adicionar itens ou corrigir quantidades.</p>
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
                            <th className="p-3 text-center">Itens</th>
                            <th className="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedInvoices.length > 0 ? filteredAndSortedInvoices.map(invoice => {
                            const isExpanded = expandedInvoiceId === invoice.id;
                            return (
                                <React.Fragment key={invoice.id}>
                                    <tr className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-3 font-bold text-gray-800 uppercase">{invoice.supplierName}</td>
                                        <td className="p-3 font-mono">{formatDate(invoice.date)}</td>
                                        <td className="p-3 font-mono">{invoice.invoiceNumber}</td>
                                        <td className="p-3 text-right font-mono font-bold text-green-700">{formatCurrency(invoice.totalValue)}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => toggleExpand(invoice.id)} className="p-2 rounded-full hover:bg-gray-200" title="Ver itens">
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => setEditingInvoice(invoice)}
                                                    className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors"
                                                    title="Adicionar itens ou editar quantidades"
                                                >
                                                    Editar
                                                </button>
                                                <button 
                                                    onClick={() => handleReopenClick(invoice.supplierCpf, invoice.invoiceNumber)}
                                                    className="bg-orange-100 text-orange-700 hover:bg-orange-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors"
                                                    title="Reverter para agendamento pendente"
                                                >
                                                    Reabrir
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteClick(invoice.supplierCpf, invoice.invoiceNumber)}
                                                    className="bg-red-100 text-red-700 hover:bg-red-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors"
                                                    title="Excluir permanentemente"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-100">
                                            <td colSpan={6} className="p-4">
                                                <div className="bg-white p-4 rounded-lg shadow-inner">
                                                    <h4 className="text-xs font-bold uppercase text-gray-600 mb-2">Detalhamento da NF {invoice.invoiceNumber}</h4>
                                                    <ul className="space-y-1 text-xs">
                                                        {invoice.items.length > 0 ? invoice.items.map((item, index) => (
                                                            <li key={index} className="flex justify-between items-center p-2 border-b last:border-b-0">
                                                                <span className="font-semibold text-gray-700 uppercase">{item.name} <span className="text-gray-400 font-normal">({(item.kg || 0).toFixed(2).replace('.',',')} Kg)</span></span>
                                                                <span className="font-mono text-gray-600">{formatCurrency(item.value)}</span>
                                                            </li>
                                                        )) : <li className="p-2 text-gray-400 italic">Nota fiscal sem itens registrados.</li>}
                                                    </ul>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        }) : (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Nenhuma nota fiscal registrada.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {editingInvoice && (
                <EditInvoiceModal 
                    invoice={editingInvoice} 
                    supplier={suppliers.find(s => s.cpf === editingInvoice.supplierCpf)!}
                    onClose={() => setEditingInvoice(null)}
                    onSave={handleEditSave}
                    isSaving={isSavingEdit}
                />
            )}
        </div>
    )
};

interface EditInvoiceModalProps {
    invoice: InvoiceInfo;
    supplier: Supplier;
    onClose: () => void;
    onSave: (items: { name: string; kg: number; value: number }[]) => void;
    isSaving: boolean;
}

const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({ invoice, supplier, onClose, onSave, isSaving }) => {
    // Inicializa os itens da nota. Se não houver itens (nota vazia), começa com um campo em branco.
    const initialItems = invoice.items.length > 0 
        ? invoice.items.map((it, idx) => ({ id: `edit-${idx}`, name: it.name, kg: String(it.kg).replace('.', ',') }))
        : [{ id: `new-0`, name: '', kg: '' }];

    const [items, setItems] = useState(initialItems);
    
    const availableContractItems = useMemo(() => {
        return (supplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name));
    }, [supplier.contractItems]);

    const handleItemChange = (id: string, field: 'name' | 'kg', value: string) => {
        setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
    };

    const handleAddItem = () => {
        setItems(prev => [...prev, { id: `new-${Date.now()}`, name: '', kg: '' }]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(it => it.id !== id));
    };

    const totalValue = useMemo(() => {
        return items.reduce((sum, it) => {
            const contract = supplier.contractItems.find(ci => ci.name === it.name);
            const kg = parseFloat(it.kg.replace(',', '.'));
            if (contract && !isNaN(kg)) {
                return sum + (kg * contract.valuePerKg);
            }
            return sum;
        }, 0);
    }, [items, supplier.contractItems]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalItems = items.map(it => {
            const contract = supplier.contractItems.find(ci => ci.name === it.name);
            const kg = parseFloat(it.kg.replace(',', '.'));
            if (!contract || isNaN(kg)) return null;
            return { name: it.name, kg, value: kg * contract.valuePerKg };
        }).filter(Boolean) as { name: string; kg: number; value: number }[];

        if (finalItems.length === 0) {
            alert('Adicione pelo menos um item válido do contrato.');
            return;
        }
        onSave(finalItems);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Editar Itens da NF {invoice.invoiceNumber}</h2>
                        <p className="text-xs text-gray-500 uppercase font-black">{invoice.supplierName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {items.map(item => {
                            const contract = supplier.contractItems.find(ci => ci.name === item.name);
                            const unit = getDisplayUnit(contract);
                            return (
                                <div key={item.id} className="flex gap-2 items-center bg-gray-50 p-3 rounded-lg border">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Item do Contrato</label>
                                        <select 
                                            value={item.name} 
                                            onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                            className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                                            required
                                        >
                                            <option value="">-- Selecione o Item --</option>
                                            {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-28">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Qtd ({unit})</label>
                                        <input 
                                            type="text" 
                                            value={item.kg} 
                                            onChange={e => handleItemChange(item.id, 'kg', e.target.value)}
                                            placeholder="0,00"
                                            className="w-full p-2 border rounded-lg text-sm text-center font-mono outline-none focus:ring-2 focus:ring-teal-400"
                                            required
                                        />
                                    </div>
                                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-1 mt-4" title="Remover item">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <button type="button" onClick={handleAddItem} className="w-full py-2 border-2 border-dashed border-teal-200 text-teal-600 font-bold rounded-lg text-xs uppercase hover:bg-teal-50 transition-colors">
                        + Adicionar Item à Nota
                    </button>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-left">
                            <p className="text-[10px] text-gray-400 font-black uppercase">Novo Total da Nota</p>
                            <p className="text-xl font-black text-green-700">{formatCurrency(totalValue)}</p>
                        </div>
                        <div className="space-x-2">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm">Cancelar</button>
                            <button type="submit" disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:bg-gray-400">
                                {isSaving ? 'Gravando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminInvoices;
