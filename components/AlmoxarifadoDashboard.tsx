
import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier, Delivery, ContractItem, WarehouseMovement } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
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

// Helper para obter informações da unidade a partir do item do contrato
const getUnitInfo = (item: ContractItem | undefined): { name: string; factorToKg: number } => {
    if (!item || !item.unit) return { name: 'Kg', factorToKg: 1 };
    
    const [type, weightStr] = item.unit.split('-');
    
    const nameMap: { [key: string]: string } = {
        saco: 'Sacos', balde: 'Baldes', embalagem: 'Litros', kg: 'Kg',
        litro: 'Litros', caixa: 'Litros', pacote: 'Pacotes', pote: 'Potes',
        dz: 'Dúzias', un: 'Unidades'
    };
    
    const name = nameMap[type] || 'Unidades';
    let factorToKg = parseFloat(weightStr);

    if (type === 'dz') {
        factorToKg = 0;
    } else if (isNaN(factorToKg)) {
        factorToKg = 1;
    }

    return { name, factorToKg };
};

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, warehouseLog, onLogout, onRegisterEntry, onRegisterWithdrawal }) => {
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
        suppliers.forEach(s => s.contractItems.forEach(ci => {
            if (!items.has(ci.name)) {
                items.set(ci.name, { name: ci.name });
            }
        }));
        return Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);
    
    // --- ENTRADA DERIVED STATE ---
    const entrySuppliersForItem = useMemo(() => {
        if (!selectedEntryItem) return [];
        return suppliers
            .filter(s => s.contractItems.some(ci => ci.name === selectedEntryItem))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedEntryItem, suppliers]);

    const entryItemData = useMemo(() => {
        if (!selectedEntryItem) return null;
        
        const contractItems = suppliers.flatMap(s => s.contractItems.filter(ci => ci.name === selectedEntryItem));
        if (contractItems.length === 0) return null;

        const { name: displayUnit, factorToKg } = getUnitInfo(contractItems[0]);

        const totalContratado = contractItems.reduce((sum, item) => sum + (item.totalKg || 0), 0);

        let totalRecebidoHistoricoKg = 0;
        suppliers.forEach(s => {
            s.deliveries.forEach(d => {
                if (d.item === selectedEntryItem) {
                    totalRecebidoHistoricoKg += (d.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                }
            });
        });
        
        const canCompare = factorToKg > 0;
        const totalRecebidoHistorico = canCompare ? totalRecebidoHistoricoKg / factorToKg : 0;
        const saldo = canCompare ? Math.max(0, totalContratado - totalRecebidoHistorico) : totalContratado;
        
        return { 
            totalContratado, 
            totalRecebidoHistorico, 
            saldo,
            displayUnit,
            factorToKg,
            canCompare
        };
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
        
        const contractItems = suppliers.flatMap(s => s.contractItems.filter(ci => ci.name === selectedExitItem));
        if (contractItems.length === 0) return null;
        
        const { name: displayUnit, factorToKg } = getUnitInfo(contractItems[0]);

        let totalRecebidoHistoricoKg = 0;
        let estoqueAtualKg = 0;
        suppliers.forEach(s => {
            s.deliveries.forEach(d => {
                if (d.item === selectedExitItem) {
                    totalRecebidoHistoricoKg += (d.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                    estoqueAtualKg += (d.lots || []).reduce((sum, lot) => sum + lot.remainingQuantity, 0);
                }
            });
        });
        
        const canCompare = factorToKg > 0;
        const totalRecebidoHistorico = canCompare ? totalRecebidoHistoricoKg / factorToKg : 0;
        const estoqueAtual = canCompare ? estoqueAtualKg / factorToKg : 0;
        const totalSaidas = canCompare ? (totalRecebidoHistoricoKg - estoqueAtualKg) / factorToKg : 0;
        
        return { 
            displayUnit,
            estoqueAtual, 
            totalSaidas,
            totalRecebidoHistorico,
            factorToKg,
            canCompare
        };
    }, [selectedExitItem, suppliers]);

    const recentMovements = useMemo(() => {
        return warehouseLog
            .slice()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);
    }, [warehouseLog]);

    const handleConfirmEntry = async () => {
        setIsProcessing(true);
        setFeedback(null);
        const quantityInUnit = parseFloat(entryQty.replace(',', '.'));

        if (!selectedEntryItem || !entrySupplierCpf || !entryInvoice || !entryLot || isNaN(quantityInUnit) || quantityInUnit <= 0 || !entryExpiration || !entryItemData) {
            setFeedback({ type: 'error', message: "Todos os campos de entrada são obrigatórios, incluindo o vencimento." });
            setIsProcessing(false);
            return;
        }

        if (entryItemData.canCompare && quantityInUnit > entryItemData.saldo + 0.001) { 
            setFeedback({ type: 'error', message: `Quantidade excede o saldo a receber do contrato (${entryItemData.saldo.toFixed(2)} ${entryItemData.displayUnit}).` });
            setIsProcessing(false);
            return;
        }

        const quantityInKg = quantityInUnit * entryItemData.factorToKg;

        const result = await onRegisterEntry({ 
            itemName: selectedEntryItem,
            supplierCpf: entrySupplierCpf,
            invoiceNumber: entryInvoice.trim(),
            invoiceDate: entryDate,
            lotNumber: entryLot.trim(),
            quantity: quantityInKg,
            expirationDate: entryExpiration
        });

        setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
        if (result.success) {
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
        const quantityInUnit = parseFloat(exitQty.replace(',', '.'));

        if (!selectedExitItem || !exitSupplierCpf || !exitOutboundInvoice || !exitLot || isNaN(quantityInUnit) || quantityInUnit <= 0 || !exitExpiration || !exitItemData) {
            setFeedback({ type: 'error', message: "Todos os campos de saída são obrigatórios, incluindo o vencimento." });
            setIsProcessing(false);
            return;
        }

        const quantityInKg = quantityInUnit * exitItemData.factorToKg;

        const result = await onRegisterWithdrawal({
            itemName: selectedExitItem,
            supplierCpf: exitSupplierCpf,
            outboundInvoice: exitOutboundInvoice.trim(),
            lotNumber: exitLot.trim(),
            quantity: quantityInKg,
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
        <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
                <div>
                    <h1 className="text-2xl font-bold text-gray-700" translate="no">Controle de Estoque</h1>
                    <p className="text-sm text-gray-500">Registre as entradas e saídas de produtos no estoque.</p>
                </div>
                <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">Sair</button>
            </header>

            <main className="p-4 md:p-8 space-y-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex border-b border-gray-200">
                        <button onClick={() => setActiveTab('entrada')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'entrada' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Entrada de Produtos</button>
                        <button onClick={() => setActiveTab('saída')} className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'saída' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-red-500'}`}>Saída de Produtos</button>
                    </div>
                </div>

                {feedback && <div className={`max-w-5xl mx-auto p-4 rounded-lg text-center font-bold animate-fade-in shadow-sm ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{feedback.message}</div>}

                {activeTab === 'entrada' && (
                    <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500 animate-fade-in">
                        <div className="space-y-6">
                            <div><label className="block text-sm font-medium text-gray-600 mb-1">1. Selecione o Item</label><select value={selectedEntryItem} onChange={e => setSelectedEntryItem(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Itens do Contrato --</option>{allContractItems.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}</select></div>
                            
                            {entryItemData && (
                                <div className="grid grid-cols-3 gap-4 text-center animate-fade-in">
                                    <div className="bg-gray-100 p-2 rounded">
                                        <p className="text-xs text-gray-500">Total Contratado</p>
                                        <p className="font-bold text-lg">{entryItemData.totalContratado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {entryItemData.displayUnit}</p>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded border border-green-100">
                                        <p className="text-xs text-green-700">Histórico Recebido</p>
                                        <p className="font-bold text-lg text-green-800">{entryItemData.totalRecebidoHistorico.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {entryItemData.displayUnit}</p>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                        <p className="text-xs text-blue-700">Saldo a Receber</p>
                                        {entryItemData.canCompare ? (
                                            <p className="font-bold text-lg text-blue-800">{entryItemData.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {entryItemData.displayUnit}</p>
                                        ) : (
                                            <p className="font-bold text-lg text-blue-800" title="Cálculo indisponível (unidades de medida diferentes)">N/A</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedEntryItem && entryItemData && (
                                <div className="space-y-4 pt-4 border-t animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-medium text-gray-600" translate="no">Fornecedor</label><select value={entrySupplierCpf} onChange={e => setEntrySupplierCpf(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"><option value="">-- Selecione --</option>{entrySuppliersForItem.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Data da NF</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº da Nota Fiscal</label><input type="text" value={entryInvoice} onChange={e => setEntryInvoice(e.target.value)} placeholder="Número da NF de Entrada" className="w-full p-2 border rounded-md shadow-sm"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº do Lote / Cód. Barras</label><input type="text" value={entryLot} onChange={e => setEntryLot(e.target.value)} placeholder="Identificador do Lote" className="w-full p-2 border rounded-md shadow-sm"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Quantidade da Entrada ({entryItemData.displayUnit})</label><input type="text" value={entryQty} onChange={e => setEntryQty(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 150,5" className="w-full p-2 border rounded-md shadow-sm font-mono" disabled={!entryItemData.canCompare}/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Vencimento do Produto</label><input type="date" value={entryExpiration} onChange={e => setEntryExpiration(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"/></div>
                                    </div>
                                    <button onClick={handleConfirmEntry} disabled={isProcessing || !entryItemData.canCompare} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-4 rounded-xl transition-all shadow-md active:scale-95 disabled:bg-gray-400">{isProcessing ? 'Sincronizando...' : 'Registrar Entrada no Estoque'}</button>
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
                                    <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                        <p className="text-xs text-blue-700">Histórico Recebido</p>
                                        <p className="font-bold text-lg text-blue-800">{exitItemData.totalRecebidoHistorico.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {exitItemData.displayUnit}</p>
                                    </div>
                                    <div className="bg-gray-100 p-2 rounded">
                                        <p className="text-xs text-gray-500">Total de Saídas</p>
                                        <p className="font-bold text-lg text-gray-800">{exitItemData.totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {exitItemData.displayUnit}</p>
                                    </div>
                                     <div className="bg-green-50 p-2 rounded border border-green-200">
                                        <p className="text-xs text-green-700">Estoque Atual</p>
                                        <p className="font-bold text-lg text-green-800">{exitItemData.estoqueAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {exitItemData.displayUnit}</p>
                                    </div>
                                </div>
                            )}

                            {selectedExitItem && exitItemData && (
                                <div className="space-y-4 pt-4 border-t animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-medium text-gray-600" translate="no">Fornecedor</label><select value={exitSupplierCpf} onChange={e => setExitSupplierCpf(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"><option value="">-- Selecione --</option>{exitSuppliersForItem.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}</select></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Data da Saída</label><input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº da NF de Saída</label><input type="text" value={exitOutboundInvoice} onChange={e => setExitOutboundInvoice(e.target.value)} placeholder="Número da NF de Saída" className="w-full p-2 border rounded-md shadow-sm"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Nº do Lote / Cód. Barras</label><input type="text" value={exitLot} onChange={e => setExitLot(e.target.value)} placeholder="Identificador do Lote" className="w-full p-2 border rounded-md shadow-sm"/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Quantidade da Saída ({exitItemData.displayUnit})</label><input type="text" value={exitQty} onChange={e => setExitQty(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Ex: 25,0" className="w-full p-2 border rounded-md shadow-sm font-mono" disabled={!exitItemData.canCompare}/></div>
                                        <div><label className="block text-xs font-medium text-gray-600">Vencimento do Produto</label><input type="date" value={exitExpiration} onChange={e => setExitExpiration(e.target.value)} className="w-full p-2 border rounded-md shadow-sm"/></div>
                                    </div>
                                    <button onClick={handleConfirmExit} disabled={isProcessing || !exitItemData.canCompare} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 px-4 rounded-xl transition-all shadow-md active:scale-95 disabled:bg-gray-400">{isProcessing ? 'Sincronizando...' : 'Registrar Saída do Estoque'}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-black text-gray-800 uppercase mb-4 tracking-tight">Movimentações Recentes</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs font-black uppercase text-gray-400 border-b">
                                <tr>
                                    <th className="p-3 text-left">Tipo</th>
                                    <th className="p-3 text-left">Data</th>
                                    <th className="p-3 text-left">Item</th>
                                    <th className="p-3 text-right">Qtd.</th>
                                    <th className="p-3 text-left">NF</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentMovements.length > 0 ? recentMovements.map(mov => (
                                    <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3">
                                            {mov.type === 'entrada' ? (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Entrada</span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Saída</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs text-gray-500 font-mono">{new Date(mov.timestamp).toLocaleString('pt-BR')}</td>
                                        <td className="p-3 font-bold text-gray-700">{mov.itemName}</td>
                                        <td className="p-3 text-right font-mono font-bold">{(mov.quantity || 0).toLocaleString('pt-BR')} kg</td>
                                        <td className="p-3 text-xs text-gray-500 font-mono">{mov.inboundInvoice || mov.outboundInvoice || '-'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-gray-400 italic">Nenhuma movimentação registrada recentemente.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }`}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;
