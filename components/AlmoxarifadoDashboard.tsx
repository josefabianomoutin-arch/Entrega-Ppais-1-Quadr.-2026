import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier, Delivery } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    onLogout: () => void;
    onRegisterEntry: (payload: {
        supplierCpf: string;
        itemName: string;
        invoiceNumber: string;
        invoiceDate: string;
        lotNumber: string;
        quantity: number;
        expirationDate: string;
    }) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: {
        supplierCpf: string;
        itemName: string;
        lotNumber: string;
        quantity: number;
        outboundInvoice: string;
        expirationDate: string;
    }) => Promise<{ success: boolean; message: string }>;
}

const getContractItemWeight = (item: { totalKg?: number, unit?: string }): number => {
    if (!item || !item.totalKg) return 0;
    const [unitType, unitWeightStr] = (item.unit || 'kg-1').split('-');
    if (unitType === 'un') return item.totalKg;
    if (unitType === 'dz') return 0;
    return item.totalKg * (parseFloat(unitWeightStr) || 1);
};


const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, onLogout, onRegisterEntry, onRegisterWithdrawal }) => {
    const [activeTab, setActiveTab] = useState<'entrada' | 'saída'>('entrada');
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // --- ENTRADA STATE ---
    const [selectedEntryItem, setSelectedEntryItem] = useState('');
    const [entrySupplierCpf, setEntrySupplierCpf] = useState('');
    const [entryInvoice, setEntryInvoice] = useState('');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [entryLot, setEntryLot] = useState('');
    const [entryQty, setEntryQty] = useState('');
    const [entryExpiration, setEntryExpiration] = useState('');

    // --- SAÍDA STATE ---
    const [selectedExitItem, setSelectedExitItem] = useState('');
    const [exitSupplierCpf, setExitSupplierCpf] = useState('');
    const [exitOutboundInvoice, setExitOutboundInvoice] = useState('');
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [exitLot, setExitLot] = useState('');
    const [exitQty, setExitQty] = useState('');
    const [exitExpiration, setExitExpiration] = useState('');


    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const allContractItems = useMemo(() => {
        const items = new Map<string, { name: string }>();
        suppliers.forEach(s => s.contractItems.forEach(ci => items.set(ci.name, { name: ci.name })));
        return Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);
    
    // --- ENTRADA DERIVED STATE ---
    const entrySuppliersForItem = useMemo(() => {
        if (!selectedEntryItem) return [];
        return suppliers
            .filter(s => s.contractItems.some(ci => ci.name === selectedEntryItem))
            .sort((a,b) => a.name.localeCompare(b.name));
    }, [selectedEntryItem, suppliers]);

    const entryItemData = useMemo(() => {
        if (!selectedEntryItem) return null;
        let totalContratado = 0;
        let totalRecebido = 0;

        suppliers.forEach(s => {
            s.contractItems.forEach(ci => {
                if (ci.name === selectedEntryItem) {
                    totalContratado += getContractItemWeight(ci);
                }
            });
            s.deliveries.forEach(d => {
                if (d.item === selectedEntryItem) {
                    totalRecebido += (d.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                }
            });
        });
        
        return { totalContratado, totalRecebido, saldo: totalContratado - totalRecebido };
    }, [selectedEntryItem, suppliers]);

    // --- SAÍDA DERIVED STATE ---
     const exitSuppliersForItem = useMemo(() => {
        if (!selectedExitItem) return [];
        return suppliers
            .filter(s => s.contractItems.some(ci => ci.name === selectedExitItem))
            .sort((a,b) => a.name.localeCompare(b.name));
    }, [selectedExitItem, suppliers]);

    const exitItemData = useMemo(() => {
        if (!selectedExitItem) return null;
        let totalContratado = 0;
        let totalRecebido = 0;

        suppliers.forEach(s => {
            s.contractItems.forEach(ci => {
                if (ci.name === selectedExitItem) {
                    totalContratado += getContractItemWeight(ci);
                }
            });
            s.deliveries.forEach(d => {
                if (d.item === selectedExitItem) {
                    totalRecebido += (d.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                }
            });
        });
        
        return { totalContratado, totalRecebido, saldo: totalRecebido }; // Para saída, saldo é o que está em estoque
    }, [selectedExitItem, suppliers]);


    const handleConfirmEntry = async () => {
        setIsProcessing(true);
        setFeedback(null);
        const quantity = parseFloat(entryQty.replace(',', '.'));

        if (!selectedEntryItem || !entrySupplierCpf || !entryInvoice || !entryLot || isNaN(quantity) || quantity <= 0 || !entryExpiration) {
            setFeedback({ type: 'error', message: "Todos os campos de entrada são obrigatórios, incluindo o vencimento." });
            setIsProcessing(false);
            return;
        }
        if (entryItemData && quantity > entryItemData.saldo) {
            setFeedback({ type: 'error', message: `Quantidade excede o saldo a receber de ${entryItemData.saldo.toFixed(2)} Kg.` });
            setIsProcessing(false);
            return;
        }

        const result = await onRegisterEntry({ 
            itemName: selectedEntryItem,
            supplierCpf: entrySupplierCpf,
            invoiceNumber: entryInvoice.trim(),
            invoiceDate: entryDate,
            lotNumber: entryLot.trim(),
            quantity,
            expirationDate: entryExpiration
        });

        setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
        if (result.success) {
            // Reset form
            setSelectedEntryItem('');
            setEntrySupplierCpf('');
            setEntryInvoice('');
            setEntryLot('');
            setEntryQty('');
            setEntryExpiration('');
        }
        setIsProcessing(false);
    };
    
    const handleConfirmExit = async () => {
        setIsProcessing(true);
        setFeedback(null);
        const quantity = parseFloat(exitQty.replace(',', '.'));

        if (!selectedExitItem || !exitSupplierCpf || !exitOutboundInvoice || !exitLot || isNaN(quantity) || quantity <= 0 || !exitExpiration) {
            setFeedback({ type: 'error', message: "Todos os campos de saída são obrigatórios, incluindo o vencimento." });
            setIsProcessing(false);
            return;
        }

        const result = await onRegisterWithdrawal({
            itemName: selectedExitItem,
            supplierCpf: exitSupplierCpf,
            outboundInvoice: exitOutboundInvoice.trim(),
            lotNumber: exitLot.trim(),
            quantity,
            expirationDate: exitExpiration
        });

        setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
        if (result.success) {
            setSelectedExitItem('');
            setExitSupplierCpf('');
            setExitOutboundInvoice('');
            setExitLot('');
            setExitQty('');
            setExitExpiration('');
        }
        setIsProcessing(false);
    };


    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <header className="bg-white shadow-md p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-700" translate="no">Controle de Estoque</h1>
                    <p className="text-sm text-gray-500">Registre as entradas e saídas de produtos no estoque.</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Sair</button>
            </header>

            <main className="p-4 md:p-8">
                <div className="max-w-5xl mx-auto mb-8">
                    <div className="flex border-b"><button onClick={() => setActiveTab('entrada')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'entrada' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Entrada de Produtos</button><button onClick={() => setActiveTab('saída')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'saída' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-red-500'}`}>Saída de Produtos</button></div>
                </div>

                {feedback && <div className={`max-w-5xl mx-auto mb-6 p-4 rounded-lg text-center font-semibold animate-fade-in ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{feedback.message}</div>}

                {activeTab === 'entrada' && (
                    <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500 animate-fade-in">
                        <div className="space-y-6">
                            <div><label className="block text-sm font-medium text-gray-600 mb-1">1. Selecione o Item</label><select value={selectedEntryItem} onChange={e => setSelectedEntryItem(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Itens do Contrato --</option>{allContractItems.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}</select></div>
                            
                            {entryItemData && (
                                <div className="grid grid-cols-3 gap-4 text-center animate-fade-in">
                                    <div className="bg-gray-100 p-2 rounded"><p className="text-xs text-gray-500">Total Contratado</p><p className="font-bold text-lg">{entryItemData.totalContratado.toFixed(2)} Kg</p></div>
                                    <div className="bg-green-100 p-2 rounded"><p className="text-xs text-green-700">Total Recebido</p><p className="font-bold text-lg text-green-800">{entryItemData.totalRecebido.toFixed(2)} Kg</p></div>
                                    <div className="bg-blue-100 p-2 rounded"><p className="text-xs text-blue-700">Saldo a Receber</p><p className="font-bold text-lg text-blue-800">{entryItemData.saldo.toFixed(2)} Kg</p></div>
                                </div>
                            )}

                            {selectedEntryItem && (
                                <div className="space-y-4 pt-4 border-t animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-medium text-gray-600" translate="no">Fornecedor</label><select value={entrySupplierCpf} onChange={e => setEntrySupplierCpf(e.target.value)} className="w-full p-2 border rounded-md"><option value="">-- Selecione --</option>{entrySuppliersForItem.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Data da NF</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº da Nota Fiscal</label><input type="text" value={entryInvoice} onChange={e => setEntryInvoice(e.target.value)} placeholder="Número da NF de Entrada" className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº do Lote / Cód. Barras</label><input type="text" value={entryLot} onChange={e => setEntryLot(e.target.value)} placeholder="Identificador do Lote" className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Quantidade da Entrada (Kg)</label><input type="text" value={entryQty} onChange={e => setEntryQty(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 150,5" className="w-full p-2 border rounded-md font-mono"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Vencimento do Produto</label><input type="date" value={entryExpiration} onChange={e => setEntryExpiration(e.target.value)} className="w-full p-2 border rounded-md"/></div>
                                    </div>
                                    <button onClick={handleConfirmEntry} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400">{isProcessing ? 'Processando...' : 'Registrar Entrada'}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'saída' && (
                     <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-500 animate-fade-in">
                        <div className="space-y-6">
                            <div><label className="block text-sm font-medium text-gray-600 mb-1">1. Selecione o Item</label><select value={selectedExitItem} onChange={e => setSelectedExitItem(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"><option value="">-- Itens em Estoque --</option>{allContractItems.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}</select></div>
                           
                            {exitItemData && (
                                <div className="grid grid-cols-3 gap-4 text-center animate-fade-in">
                                    <div className="bg-gray-100 p-2 rounded"><p className="text-xs text-gray-500">Total Contratado</p><p className="font-bold text-lg">{exitItemData.totalContratado.toFixed(2)} Kg</p></div>
                                    <div className="bg-green-100 p-2 rounded"><p className="text-xs text-green-700">Total em Estoque</p><p className="font-bold text-lg text-green-800">{exitItemData.saldo.toFixed(2)} Kg</p></div>
                                    <div className="bg-red-100 p-2 rounded"><p className="text-xs text-red-700">Balanço (Contratado - Estoque)</p><p className="font-bold text-lg text-red-800">{(exitItemData.totalContratado - exitItemData.saldo).toFixed(2)} Kg</p></div>
                                </div>
                            )}

                            {selectedExitItem && (
                                <div className="space-y-4 pt-4 border-t animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-medium text-gray-600" translate="no">Fornecedor</label><select value={exitSupplierCpf} onChange={e => setExitSupplierCpf(e.target.value)} className="w-full p-2 border rounded-md"><option value="">-- Selecione --</option>{exitSuppliersForItem.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Data da Saída</label><input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº da NF de Saída</label><input type="text" value={exitOutboundInvoice} onChange={e => setExitOutboundInvoice(e.target.value)} placeholder="Número da NF de Saída" className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº do Lote / Cód. Barras</label><input type="text" value={exitLot} onChange={e => setExitLot(e.target.value)} placeholder="Identificador do Lote" className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Quantidade da Saída (Kg)</label><input type="text" value={exitQty} onChange={e => setExitQty(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 25,0" className="w-full p-2 border rounded-md font-mono"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Vencimento do Produto</label><input type="date" value={exitExpiration} onChange={e => setExitExpiration(e.target.value)} className="w-full p-2 border rounded-md"/></div>
                                    </div>
                                    <button onClick={handleConfirmExit} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400">{isProcessing ? 'Processando...' : 'Registrar Saída'}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }`}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;