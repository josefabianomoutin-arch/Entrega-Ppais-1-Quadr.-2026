import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, WarehouseMovement } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    onLogout: () => void;
    onRegisterLots: (payload: {
        supplierCpf: string;
        itemsWithLots: { deliveryId: string; newLots: { lotNumber: string; quantity: number }[] }[];
    }) => Promise<boolean>;
    onRegisterWithdrawal: (payload: {
        barcode: string;
        quantity: number;
        outboundInvoice: string;
    }) => Promise<{ success: boolean; message: string }>;
}

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, onLogout, onRegisterLots, onRegisterWithdrawal }) => {
    const [activeTab, setActiveTab] = useState<'entrada' | 'saída'>('entrada');
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // --- ENTRADA STATE ---
    const [selectedSupplierCpf, setSelectedSupplierCpf] = useState<string>('');
    const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
    const [newLotEntries, setNewLotEntries] = useState<Record<string, { id: string, lotNumber: string, quantity: string }[]>>({});

    // --- SAÍDA STATE ---
    const [exitBarcode, setExitBarcode] = useState('');
    const [exitQuantity, setExitQuantity] = useState('');
    const [exitInvoice, setExitInvoice] = useState('');

    const clearFeedback = () => {
        if (feedback) {
            setTimeout(() => setFeedback(null), 5000);
        }
    };

    const pendingInvoices = useMemo(() => {
        if (!selectedSupplierCpf) return [];
        const supplier = suppliers.find(s => s.cpf === selectedSupplierCpf);
        if (!supplier) return [];

        const invoices = new Map<string, { date: string; deliveries: Delivery[] }>();
        (supplier.deliveries || []).forEach(delivery => {
            if (delivery.invoiceNumber && delivery.item !== 'AGENDAMENTO PENDENTE') {
                const existing = invoices.get(delivery.invoiceNumber) || { date: delivery.date, deliveries: [] };
                existing.deliveries.push(delivery);
                invoices.set(delivery.invoiceNumber, existing);
            }
        });

        return Array.from(invoices.values()).filter(invoice => 
            invoice.deliveries.some(d => {
                const totalInLots = (d.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                return (d.kg || 0) > totalInLots;
            })
        ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [suppliers, selectedSupplierCpf]);

    const handleAddLotField = (deliveryId: string) => {
        setNewLotEntries(prev => ({
            ...prev,
            [deliveryId]: [...(prev[deliveryId] || []), { id: `lot-temp-${Date.now()}`, lotNumber: '', quantity: '' }]
        }));
    };
    
    // FIX: Refactored to be more explicit for the TypeScript type checker, resolving an error where prev[deliveryId] was being inferred as unknown.
    const handleLotInputChange = (deliveryId: string, tempId: string, field: 'lotNumber' | 'quantity', value: string) => {
        const cleanValue = field === 'quantity' ? value.replace(/[^0-9,.]/g, '') : value;
        setNewLotEntries(prev => {
            const currentLots = prev[deliveryId] || [];
            return {
                ...prev,
                [deliveryId]: currentLots.map(lot =>
                    lot.id === tempId ? { ...lot, [field]: cleanValue } : lot
                )
            };
        });
    };

    const handleConfirmEntry = async () => {
        if (!selectedSupplierCpf || !expandedInvoice) return;

        setIsProcessing(true);
        setFeedback(null);

        const itemsWithLots = Object.entries(newLotEntries)
            .map(([deliveryId, lots]) => {
                const newLots = lots
                    .map(lot => ({
                        lotNumber: lot.lotNumber.trim(),
                        quantity: parseFloat(lot.quantity.replace(',', '.'))
                    }))
                    .filter(lot => lot.lotNumber && !isNaN(lot.quantity) && lot.quantity > 0);
                return { deliveryId, newLots };
            })
            .filter(item => item.newLots.length > 0);

        if (itemsWithLots.length === 0) {
            setFeedback({ type: 'error', message: 'Nenhum lote válido preenchido.' });
            setIsProcessing(false);
            clearFeedback();
            return;
        }

        const success = await onRegisterLots({ supplierCpf: selectedSupplierCpf, itemsWithLots });
        if (success) {
            setFeedback({ type: 'success', message: 'Lotes registrados com sucesso!' });
            setNewLotEntries({});
            setExpandedInvoice(null);
        } else {
            setFeedback({ type: 'error', message: 'Falha ao registrar os lotes.' });
        }
        setIsProcessing(false);
        clearFeedback();
    };
    
    const handleConfirmExit = async () => {
        setIsProcessing(true);
        setFeedback(null);

        const quantity = parseFloat(exitQuantity.replace(',', '.'));
        if (!exitBarcode.trim() || !exitInvoice.trim() || isNaN(quantity) || quantity <= 0) {
            setFeedback({ type: 'error', message: 'Todos os campos de saída são obrigatórios e a quantidade deve ser válida.' });
            setIsProcessing(false);
            clearFeedback();
            return;
        }

        const result = await onRegisterWithdrawal({ barcode: exitBarcode.trim(), quantity, outboundInvoice: exitInvoice.trim() });
        setFeedback({ type: result.success ? 'success' : 'error', message: result.message });

        if (result.success) {
            setExitBarcode('');
            setExitQuantity('');
            setExitInvoice('');
        }
        setIsProcessing(false);
        clearFeedback();
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <header className="bg-white shadow-md p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-700">Painel do Almoxarifado</h1>
                    <p className="text-sm text-gray-500">Registro de Entradas e Saídas de Lotes</p>
                </div>
                <button
                    onClick={onLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                    Sair
                </button>
            </header>

            <main className="p-8">
                 <div className="max-w-4xl mx-auto mb-8">
                    <div className="flex border-b">
                        <button onClick={() => setActiveTab('entrada')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'entrada' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Registrar Entrada</button>
                        <button onClick={() => setActiveTab('saída')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'saída' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-red-500'}`}>Registrar Saída</button>
                    </div>
                </div>

                {activeTab === 'entrada' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500 animate-fade-in">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">1. Selecione o Fornecedor</label>
                                <select value={selectedSupplierCpf} onChange={e => { setSelectedSupplierCpf(e.target.value); setExpandedInvoice(null); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">-- Fornecedores --</option>
                                    {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                                </select>
                            </div>
                            {selectedSupplierCpf && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">2. Selecione a Nota Fiscal para dar Entrada</label>
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                        {pendingInvoices.length > 0 ? pendingInvoices.map(invoice => {
                                            const isExpanded = expandedInvoice === invoice.deliveries[0].invoiceNumber;
                                            return (
                                                <div key={invoice.deliveries[0].invoiceNumber} className="border rounded-lg">
                                                    <div onClick={() => setExpandedInvoice(isExpanded ? null : invoice.deliveries[0].invoiceNumber!)} className="p-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center">
                                                        <p className="font-semibold">NF: <span className="font-mono">{invoice.deliveries[0].invoiceNumber}</span> <span className="text-gray-500 text-sm">({new Date(invoice.date + 'T00:00:00').toLocaleDateString('pt-BR')})</span></p>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="p-4 border-t bg-gray-50 space-y-4">
                                                            {invoice.deliveries.map(delivery => {
                                                                const totalInLots = (delivery.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                                                                const pendingQty = (delivery.kg || 0) - totalInLots;
                                                                const currentNewLotsTotal = (newLotEntries[delivery.id] || []).reduce((sum, lot) => sum + (parseFloat(lot.quantity.replace(',', '.')) || 0), 0);
                                                                const remainingForEntry = pendingQty - currentNewLotsTotal;

                                                                if (pendingQty <= 0) return null;

                                                                return (
                                                                    <div key={delivery.id} className="p-3 bg-white rounded-md border">
                                                                        <p className="font-bold">{delivery.item}</p>
                                                                        <p className="text-xs text-gray-500">Pendente na NF: <span className="font-mono font-semibold">{pendingQty.toFixed(2).replace('.', ',')} Kg</span></p>
                                                                        
                                                                        {(newLotEntries[delivery.id] || []).map(lot => (
                                                                            <div key={lot.id} className="grid grid-cols-2 gap-2 mt-2">
                                                                                <input type="text" value={lot.lotNumber} onChange={e => handleLotInputChange(delivery.id, lot.id, 'lotNumber', e.target.value)} placeholder="Nº do Lote" className="px-2 py-1 border rounded text-xs"/>
                                                                                <input type="text" value={lot.quantity} onChange={e => handleLotInputChange(delivery.id, lot.id, 'quantity', e.target.value)} placeholder="Qtd. (Kg)" className="px-2 py-1 border rounded text-xs font-mono"/>
                                                                            </div>
                                                                        ))}
                                                                        
                                                                        <p className={`text-xs mt-2 font-semibold ${remainingForEntry < 0 ? 'text-red-500' : 'text-gray-600'}`}>Restante para entrada: {remainingForEntry.toFixed(2).replace('.', ',')} Kg</p>

                                                                        <button onClick={() => handleAddLotField(delivery.id)} className="text-xs text-blue-600 hover:underline mt-2">Adicionar Lote</button>
                                                                    </div>
                                                                );
                                                            })}
                                                            <button onClick={handleConfirmEntry} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg mt-4 disabled:bg-gray-400">
                                                                {isProcessing ? 'Processando...' : 'Confirmar Entrada dos Lotes'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        }) : <p className="text-sm text-gray-500 italic p-3">Nenhuma nota fiscal pendente para este fornecedor.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'saída' && (
                     <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-500 animate-fade-in">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">Registrar Saída</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="exit-barcode" className="block text-sm font-medium text-gray-600 mb-1">Lote / Código de Barras</label>
                                <input id="exit-barcode" type="text" value={exitBarcode} onChange={(e) => setExitBarcode(e.target.value)} placeholder="Leia ou digite o código" className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono" />
                            </div>
                             <div>
                                <label htmlFor="exit-quantity" className="block text-sm font-medium text-gray-600 mb-1">Quantidade da Saída (Kg)</label>
                                <input id="exit-quantity" type="text" value={exitQuantity} onChange={(e) => setExitQuantity(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 15,5" className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono" />
                            </div>
                            <div>
                                <label htmlFor="exit-invoice" className="block text-sm font-medium text-gray-600 mb-1">Nº da Nota Fiscal de Saída</label>
                                <input id="exit-invoice" type="text" value={exitInvoice} onChange={(e) => setExitInvoice(e.target.value)} placeholder="Digite o número da NF" className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono" />
                            </div>
                            <button onClick={handleConfirmExit} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400">
                                {isProcessing ? 'Processando...' : 'Registrar Saída'}
                            </button>
                        </div>
                    </div>
                )}

                {feedback && (
                    <div className={`mt-8 max-w-4xl mx-auto p-4 rounded-lg text-center font-semibold animate-fade-in ${
                        feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                        {feedback.message}
                    </div>
                )}
            </main>
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
            `}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;