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
    }) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: {
        barcode: string;
        quantity: number;
        outboundInvoice: string;
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

    // --- SAÍDA STATE ---
    const [selectedExitItem, setSelectedExitItem] = useState('');
    const [exitBarcode, setExitBarcode] = useState('');
    const [exitQty, setExitQty] = useState('');
    const [exitInvoice, setExitInvoice] = useState('');

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
    
    const suppliersForItem = useMemo(() => {
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

    const availableLotsForExit = useMemo(() => {
        if (!selectedExitItem) return [];
        const lots: any[] = [];
        suppliers.forEach(s => {
            s.deliveries.forEach(d => {
                if (d.item === selectedExitItem) {
                    (d.lots || []).forEach(l => {
                        if (l.remainingQuantity > 0) {
                            lots.push({ ...l, entryDate: d.date, supplierName: s.name });
                        }
                    });
                }
            });
        });
        return lots.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    }, [selectedExitItem, suppliers]);
    
    const handleConfirmEntry = async () => {
        setIsProcessing(true);
        setFeedback(null);
        const quantity = parseFloat(entryQty.replace(',', '.'));

        if (!selectedEntryItem || !entrySupplierCpf || !entryInvoice || !entryLot || isNaN(quantity) || quantity <= 0) {
            setFeedback({ type: 'error', message: "Todos os campos de entrada são obrigatórios." });
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
            quantity
        });

        setFeedback(result);
        if (result.success) {
            // Reset form
            setSelectedEntryItem('');
            setEntrySupplierCpf('');
            setEntryInvoice('');
            setEntryLot('');
            setEntryQty('');
        }
        setIsProcessing(false);
    };
    
    const handleConfirmExit = async (barcode: string) => {
        setIsProcessing(true);
        setFeedback(null);
        const quantity = parseFloat(exitQty.replace(',', '.'));

        if (!barcode || isNaN(quantity) || quantity <= 0 || !exitInvoice) {
            setFeedback({ type: 'error', message: 'Quantidade e NF de saída são obrigatórios.' });
            setIsProcessing(false);
            return;
        }

        const result = await onRegisterWithdrawal({ barcode, quantity, outboundInvoice: exitInvoice.trim() });
        setFeedback(result);
        if (result.success) {
            setExitQty('');
            setExitInvoice('');
            setExitBarcode('');
        }
        setIsProcessing(false);
    };

    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = exitBarcode.trim();
            if(!barcode) return;

            const oldestLot = availableLotsForExit.length > 0 ? availableLotsForExit[0] : null;

            if (oldestLot && oldestLot.barcode === barcode) {
                document.getElementById('exit-quantity-input')?.focus();
            } else {
                setFeedback({ type: 'error', message: 'Este não é o lote mais antigo. Por favor, dê saída no lote destacado.' });
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <header className="bg-white shadow-md p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-700">Painel do Almoxarifado</h1>
                    <p className="text-sm text-gray-500">Controle de Estoque por Contrato e Lógica PEPS</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Sair</button>
            </header>

            <main className="p-4 md:p-8">
                <div className="max-w-5xl mx-auto mb-8">
                    <div className="flex border-b"><button onClick={() => setActiveTab('entrada')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'entrada' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Registrar Entrada</button><button onClick={() => setActiveTab('saída')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'saída' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-red-500'}`}>Registrar Saída</button></div>
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
                                        <div><label className="block text-xs font-medium text-gray-600">Fornecedor</label><select value={entrySupplierCpf} onChange={e => setEntrySupplierCpf(e.target.value)} className="w-full p-2 border rounded-md"><option value="">-- Selecione --</option>{suppliersForItem.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Data da NF</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº da Nota Fiscal</label><input type="text" value={entryInvoice} onChange={e => setEntryInvoice(e.target.value)} placeholder="Número da NF" className="w-full p-2 border rounded-md"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº do Lote / Cód. Barras</label><input type="text" value={entryLot} onChange={e => setEntryLot(e.target.value)} placeholder="Identificador do Lote" className="w-full p-2 border rounded-md"/></div>
                                        <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-600">Quantidade da Entrada (Kg)</label><input type="text" value={entryQty} onChange={e => setEntryQty(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 150,5" className="w-full p-2 border rounded-md font-mono"/></div>
                                    </div>
                                    <button onClick={handleConfirmEntry} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400">{isProcessing ? 'Processando...' : 'Adicionar Entrada'}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'saída' && (
                     <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-500 animate-fade-in">
                        <div className="space-y-6">
                            <div><label className="block text-sm font-medium text-gray-600 mb-1">1. Selecione o Item para Saída</label><select value={selectedExitItem} onChange={e => setSelectedExitItem(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"><option value="">-- Itens em Estoque --</option>{allContractItems.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}</select></div>

                            {selectedExitItem && (
                                <div className="space-y-4 pt-4 border-t animate-fade-in">
                                     <div><label className="block text-sm font-medium text-gray-600 mb-1">2. Leitor de Código de Barras (Opcional)</label><input type="text" value={exitBarcode} onChange={e => setExitBarcode(e.target.value)} onKeyDown={handleBarcodeScan} placeholder="Leia o código do lote mais antigo e pressione Enter" className="w-full px-4 py-2 border-2 border-dashed rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"/></div>
                                     <h3 className="text-lg font-bold text-gray-700">3. Lotes Disponíveis (Ordem de Saída)</h3>
                                     <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                         {availableLotsForExit.length > 0 ? availableLotsForExit.map((lot, index) => {
                                             const isOldest = index === 0;
                                             return (
                                                 <div key={lot.id} className={`p-4 rounded-lg border-2 ${isOldest ? 'bg-green-50 border-green-400' : 'bg-gray-100 border-gray-200 opacity-60'}`}>
                                                     {isOldest && <p className="text-xs font-bold text-green-700 mb-2">PRÓXIMO PARA SAÍDA (PEPS)</p>}
                                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                                                         <div><p className="text-xs text-gray-500">Lote</p><p className="font-bold font-mono">{lot.lotNumber}</p></div>
                                                         <div><p className="text-xs text-gray-500">Fornecedor</p><p className="font-semibold truncate">{lot.supplierName}</p></div>
                                                         <div><p className="text-xs text-gray-500">Data Entrada</p><p className="font-mono">{new Date(lot.entryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p></div>
                                                         <div><p className="text-xs text-gray-500">Qtd. Restante</p><p className="font-bold text-lg">{lot.remainingQuantity.toFixed(2)} Kg</p></div>
                                                     </div>
                                                     {isOldest && (
                                                         <div className="mt-4 pt-4 border-t border-green-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                                              <div className="md:col-span-1"><label htmlFor="exit-quantity-input" className="block text-xs font-medium text-gray-600">Qtd. da Saída (Kg)</label><input id="exit-quantity-input" type="text" value={exitQty} onChange={e => setExitQty(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 15,5" className="w-full p-2 border rounded-md font-mono"/></div>
                                                              <div className="md:col-span-1"><label className="block text-xs font-medium text-gray-600">Nº da NF de Saída</label><input type="text" value={exitInvoice} onChange={e => setExitInvoice(e.target.value)} placeholder="NF de Saída" className="w-full p-2 border rounded-md"/></div>
                                                             <button onClick={() => handleConfirmExit(lot.barcode)} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400">{isProcessing ? '...' : 'Confirmar Saída'}</button>
                                                         </div>
                                                     )}
                                                 </div>
                                             );
                                         }) : <p className="text-sm text-center text-gray-500 italic p-4">Nenhum lote com estoque para este item.</p>}
                                     </div>
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