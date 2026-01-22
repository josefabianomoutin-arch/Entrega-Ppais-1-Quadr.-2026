import React, { useState, useMemo, useRef } from 'react';
import type { Supplier, Delivery } from '../types';

// Interfaces para os dados processados e usados no componente
interface ProcessedInvoice {
    id: string; // supplierCpf-invoiceNumber
    supplierName: string;
    supplierCpf: string;
    invoiceNumber: string;
    date: string;
    items: Delivery[];
    totalValue: number;
    remainingValue: number;
}

// Props do componente
interface AdminPepsProps {
    suppliers: Supplier[];
    onUpdateSuppliers: (updatedSuppliers: Supplier[]) => void;
}

// Funções de formatação
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (dateString: string) => new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
const formatKg = (value: number) => `${(value || 0).toFixed(2).replace('.', ',')} Kg`;


const AdminPeps: React.FC<AdminPepsProps> = ({ suppliers, onUpdateSuppliers }) => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const [activeLotInputs, setActiveLotInputs] = useState<Record<string, { lotNumber: string, initialQuantity: string, barcode: string }>>({}); // delivery.id -> lot inputs
    const [activeWithdrawalInputs, setActiveWithdrawalInputs] = useState<Record<string, string>>({}); // lot.id -> withdrawal quantity string

    // Processa os dados brutos dos fornecedores para uma lista de notas fiscais
    const processedInvoices = useMemo((): ProcessedInvoice[] => {
        const invoicesMap = new Map<string, ProcessedInvoice>();
        suppliers.forEach(supplier => {
            const deliveriesByInvoice = new Map<string, Delivery[]>();
            (supplier.deliveries || []).forEach(delivery => {
                if (delivery.invoiceNumber && delivery.item !== 'AGENDAMENTO PENDENTE') {
                    const existing = deliveriesByInvoice.get(delivery.invoiceNumber) || [];
                    deliveriesByInvoice.set(delivery.invoiceNumber, [...existing, delivery]);
                }
            });

            deliveriesByInvoice.forEach((deliveriesInInvoice, invoiceNumber) => {
                const invoiceId = `${supplier.cpf}-${invoiceNumber}`;
                const earliestDate = deliveriesInInvoice.reduce((earliest, d) => d.date < earliest ? d.date : earliest, deliveriesInInvoice[0].date);
                const totalValue = deliveriesInInvoice.reduce((sum, d) => sum + (d.value || 0), 0);
                
                const totalRemainingValue = deliveriesInInvoice.reduce((sum, d) => {
                    const initialValue = d.value || 0;
                    const initialKg = d.kg || 0;
                    const remainingKg = d.remainingQuantity ?? initialKg;
                    if (initialKg > 0) {
                        return sum + (initialValue * (remainingKg / initialKg));
                    }
                    return sum;
                }, 0);

                invoicesMap.set(invoiceId, {
                    id: invoiceId,
                    supplierName: supplier.name,
                    supplierCpf: supplier.cpf,
                    invoiceNumber,
                    date: earliestDate,
                    items: deliveriesInInvoice.sort((a,b) => (a.item || '').localeCompare(b.item || '')),
                    totalValue,
                    remainingValue: totalRemainingValue
                });
            });
        });
        return Array.from(invoicesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [suppliers]);

    const filteredInvoices = useMemo(() => {
        if (!searchTerm) return processedInvoices;
        return processedInvoices.filter(inv =>
            inv.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [processedInvoices, searchTerm]);

    // Manipula a adição de um novo lote a um item de entrega
    const handleAddLot = (deliveryId: string, supplierCpf: string) => {
        const inputs = activeLotInputs[deliveryId];
        if (!inputs || !inputs.lotNumber || !inputs.initialQuantity) {
            alert("Por favor, preencha o número do lote e a quantidade.");
            return;
        }

        const initialQuantity = parseFloat(inputs.initialQuantity.replace(',', '.'));
        if (isNaN(initialQuantity) || initialQuantity <= 0) {
            alert("A quantidade do lote deve ser um número positivo.");
            return;
        }

        const newSuppliers = suppliers.map(s => {
            if (s.cpf !== supplierCpf) return s;
            const newDeliveries = s.deliveries.map(d => {
                if (d.id !== deliveryId) return d;
                
                const currentLotTotal = (d.lots || []).reduce((sum, lot) => sum + lot.initialQuantity, 0);
                if (currentLotTotal + initialQuantity > (d.kg || 0) + 0.001) { // Tolerância para ponto flutuante
                    alert(`A soma dos lotes (${(currentLotTotal + initialQuantity).toFixed(2)}kg) não pode exceder a quantidade total do item (${(d.kg || 0).toFixed(2)}kg).`);
                    return d; // Retorna sem modificar se a validação falhar
                }
                
                const newLot = {
                    id: `lot-${Date.now()}`,
                    lotNumber: inputs.lotNumber,
                    initialQuantity,
                    remainingQuantity: initialQuantity,
                    barcode: inputs.barcode || '',
                };
                return { ...d, lots: [...(d.lots || []), newLot] };
            });
            return { ...s, deliveries: newDeliveries };
        });
        
        // Verifica se a atualização foi bem-sucedida antes de limpar os campos
        const updatedSupplier = newSuppliers.find(s => s.cpf === supplierCpf);
        const updatedDelivery = updatedSupplier?.deliveries.find(d => d.id === deliveryId);
        if (updatedDelivery && updatedDelivery.lots && updatedDelivery.lots.length > (suppliers.find(s=>s.cpf===supplierCpf)?.deliveries.find(d=>d.id===deliveryId)?.lots?.length || 0)) {
            onUpdateSuppliers(newSuppliers);
            setActiveLotInputs(prev => ({ ...prev, [deliveryId]: { lotNumber: '', initialQuantity: '', barcode: '' } }));
        }
    };
    
    // Manipula o registro de uma retirada de estoque de um lote
    const handleRegisterWithdrawal = (lotId: string, deliveryId: string, supplierCpf: string) => {
        const withdrawalAmount = parseFloat((activeWithdrawalInputs[lotId] || '0').replace(',', '.'));
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            alert("Por favor, insira uma quantidade de saída válida.");
            return;
        }

        const newSuppliers = JSON.parse(JSON.stringify(suppliers)); // Deep copy para segurança
        const supplier = newSuppliers.find((s: Supplier) => s.cpf === supplierCpf);
        if (!supplier) return;
        
        const delivery = supplier.deliveries.find((d: Delivery) => d.id === deliveryId);
        if (!delivery || !delivery.lots) return;

        const lot = delivery.lots.find((l: any) => l.id === lotId);
        if (!lot || withdrawalAmount > lot.remainingQuantity) {
            alert(`A quantidade de saída (${withdrawalAmount}kg) não pode ser maior que a quantidade restante no lote (${lot.remainingQuantity}kg).`);
            return;
        }

        lot.remainingQuantity -= withdrawalAmount;
        
        const totalInitialKg = delivery.kg || 0;
        const totalLotsInitial = (delivery.lots || []).reduce((sum: number, l: any) => sum + l.initialQuantity, 0);
        const totalLotsRemaining = (delivery.lots || []).reduce((sum: number, l: any) => sum + l.remainingQuantity, 0);
        
        // A quantidade restante do item é a quantidade inicial menos o total que saiu dos lotes
        delivery.remainingQuantity = totalInitialKg - (totalLotsInitial - totalLotsRemaining);

        onUpdateSuppliers(newSuppliers);
        setActiveWithdrawalInputs(prev => ({ ...prev, [lotId]: '' }));
    };

    // Foca no lote correspondente ao código de barras lido
    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const barcode = e.currentTarget.value;
            if (!barcode) return;
            
            for (const inv of filteredInvoices) {
                for (const item of inv.items) {
                    const foundLot = (item.lots || []).find(l => l.barcode === barcode);
                    if (foundLot) {
                        setExpandedInvoiceId(inv.id);
                        // Focar no campo de input de retirada deste lote (requer ref)
                        setTimeout(() => {
                           const input = document.getElementById(`withdraw-${foundLot.id}`);
                           input?.focus();
                        }, 100);
                        return;
                    }
                }
            }
            alert(`Nenhum lote encontrado para o código de barras: ${barcode}`);
        }
    };


    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-cyan-500 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-cyan-900 uppercase tracking-tighter">Gestão PEPS</h2>
                    <p className="text-gray-400 font-medium">Controle de lotes e saídas de estoque por nota fiscal.</p>
                </div>
                <input
                    type="text"
                    ref={barcodeInputRef}
                    placeholder="Leitura de Código de Barras..."
                    onKeyDown={handleBarcodeScan}
                    className="w-full sm:w-auto border-2 border-dashed rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400 focus:border-solid transition-all font-mono"
                />
            </div>
            
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                {filteredInvoices.map(inv => {
                    const isExpanded = expandedInvoiceId === inv.id;
                    const progress = inv.totalValue > 0 ? (inv.remainingValue / inv.totalValue) * 100 : 0;
                    return (
                        <div key={inv.id} className={`border rounded-xl transition-all ${isExpanded ? 'ring-2 ring-cyan-400 bg-white' : 'bg-gray-50/50 hover:bg-white'}`}>
                            {/* Cabeçalho da Nota Fiscal */}
                            <div className="p-4 cursor-pointer grid grid-cols-3 md:grid-cols-5 gap-4 items-center" onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}>
                                <div className="col-span-3 md:col-span-2">
                                    <p className="font-bold text-gray-800">{inv.supplierName}</p>
                                    <p className="text-xs text-gray-500 font-mono">NF: {inv.invoiceNumber} &bull; {formatDate(inv.date)}</p>
                                </div>
                                <div className="hidden md:block">
                                    <p className="text-xs text-gray-500">Valor Total</p>
                                    <p className="font-semibold text-gray-700">{formatCurrency(inv.totalValue)}</p>
                                </div>
                                <div className="text-right md:text-left col-span-2 md:col-span-1">
                                     <p className="text-xs text-gray-500">Valor Restante</p>
                                    <p className="font-bold text-cyan-600">{formatCurrency(inv.remainingValue)}</p>
                                </div>
                                <div className="flex justify-end items-center">
                                    <div className="w-16 bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ml-2 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            
                            {/* Conteúdo Detalhado da Nota */}
                            {isExpanded && (
                            <div className="p-4 border-t bg-cyan-50/20 space-y-4">
                                {inv.items.map(item => (
                                <div key={item.id} className="p-4 bg-white rounded-lg border shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-gray-800">{item.item}</h4>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Total / Restante</p>
                                            <p className="text-sm font-semibold">{formatKg(item.kg || 0)} / <span className="text-green-600 font-bold">{formatKg(item.remainingQuantity || 0)}</span></p>
                                        </div>
                                    </div>
                                    
                                    {/* Lista de Lotes */}
                                    <div className="space-y-2 mb-3">
                                        {(item.lots || []).map(lot => (
                                        <div key={lot.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center p-2 bg-gray-50 rounded">
                                            <div className="text-xs">
                                                <p className="font-semibold">Lote: <span className="font-mono bg-gray-200 px-1 rounded">{lot.lotNumber}</span></p>
                                                <p className="text-gray-500">Restante: <span className="font-bold text-black">{formatKg(lot.remainingQuantity)}</span></p>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate" title={lot.barcode}>
                                                Código: <span className="font-mono">{lot.barcode || 'N/A'}</span>
                                            </div>
                                            <input
                                                id={`withdraw-${lot.id}`}
                                                type="text"
                                                value={activeWithdrawalInputs[lot.id] || ''}
                                                onChange={e => setActiveWithdrawalInputs(p => ({ ...p, [lot.id]: e.target.value.replace(/[^0-9,.]/g, '') }))}
                                                placeholder="Peso de Saída (Kg)"
                                                className="col-span-2 md:col-span-1 border rounded px-2 py-1 text-xs font-mono"
                                            />
                                            <button onClick={() => handleRegisterWithdrawal(lot.id, item.id, inv.supplierCpf)} className="bg-green-500 text-white rounded px-3 py-1 text-xs font-bold hover:bg-green-600">Registrar Saída</button>
                                        </div>
                                        ))}
                                    </div>

                                    {/* Adicionar Lote */}
                                    {(item.lots || []).length < 4 && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center pt-3 border-t border-dashed">
                                        <input type="text" value={activeLotInputs[item.id]?.lotNumber || ''} onChange={e => setActiveLotInputs(p => ({ ...p, [item.id]: { ...p[item.id], lotNumber: e.target.value } }))} placeholder="Nº do Lote" className="col-span-2 md:col-span-1 border rounded px-2 py-1 text-xs" />
                                        <input type="text" value={activeLotInputs[item.id]?.initialQuantity || ''} onChange={e => setActiveLotInputs(p => ({ ...p, [item.id]: { ...p[item.id], initialQuantity: e.target.value.replace(/[^0-9,.]/g, '') } }))} placeholder="Qtd. (Kg)" className="border rounded px-2 py-1 text-xs font-mono" />
                                        <input type="text" value={activeLotInputs[item.id]?.barcode || ''} onChange={e => setActiveLotInputs(p => ({ ...p, [item.id]: { ...p[item.id], barcode: e.target.value } }))} placeholder="Código de Barras" className="col-span-2 md:col-span-1 border rounded px-2 py-1 text-xs font-mono" />
                                        <button onClick={() => handleAddLot(item.id, inv.supplierCpf)} className="bg-blue-500 text-white rounded px-3 py-1 text-xs font-bold hover:bg-blue-600">Adicionar Lote</button>
                                    </div>
                                    )}
                                </div>
                                ))}
                            </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default AdminPeps;