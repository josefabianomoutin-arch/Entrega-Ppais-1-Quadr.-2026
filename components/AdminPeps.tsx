import React, { useState, useMemo, useRef } from 'react';
import type { Supplier, Delivery } from '../types';

// Helper to identify meat products
const MEAT_KEYWORDS = [
    'CARNE', 'BISTECA', 'LOMBO', 'PERNIL', 'COSTELA', 'CUPIM', 'ACÉM', 'PALETA', 'MÚSCULO', 'PATINHO',
    'PEITO', 'PESCOÇO', 'COXÃO', 'COXAO', 'ALMÔNDEGA', 'ALMONDEGA', 'HAMBÚRGUER', 'HAMBURGUER',
    'FRANGO', 'COXA', 'SOBRECOXA', 'SALSICHA', 'LINGUIÇA', 'TOUCINHO', 'DOBRADINHA', 'FÍGADO', 'FIGADO', 'CHARQUE'
];
const isMeatProduct = (itemName: string = ''): boolean => {
    const upperItemName = itemName.toUpperCase();
    return MEAT_KEYWORDS.some(keyword => upperItemName.includes(keyword));
};


// Interfaces for the new item-centric data structure
interface ProcessedMeatItem {
    name: string;
    totalInitialKg: number;
    totalRemainingKg: number;
    deliveries: {
        id: string; // delivery.id
        supplierName: string;
        supplierCpf: string;
        invoiceNumber: string;
        date: string;
        deliveryDetails: Delivery;
    }[];
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
    const [expandedItemName, setExpandedItemName] = useState<string | null>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const [activeLotInputs, setActiveLotInputs] = useState<Record<string, { lotIdentifier: string; initialQuantity: string; }>>({});
    const [activeWithdrawalInputs, setActiveWithdrawalInputs] = useState<Record<string, string>>({}); // lot.id -> withdrawal quantity string

    // Processa os dados para a nova estrutura focada em itens de carne
    const processedMeatItems = useMemo((): ProcessedMeatItem[] => {
        const meatItemsMap = new Map<string, ProcessedMeatItem>();

        suppliers.forEach(supplier => {
            (supplier.deliveries || []).forEach(delivery => {
                if (isMeatProduct(delivery.item) && delivery.invoiceNumber) {
                    const itemName = delivery.item!;
                    
                    if (!meatItemsMap.has(itemName)) {
                        meatItemsMap.set(itemName, {
                            name: itemName,
                            totalInitialKg: 0,
                            totalRemainingKg: 0,
                            deliveries: [],
                        });
                    }

                    const meatItem = meatItemsMap.get(itemName)!;
                    meatItem.totalInitialKg += delivery.kg || 0;
                    meatItem.totalRemainingKg += delivery.remainingQuantity ?? (delivery.kg || 0);
                    meatItem.deliveries.push({
                        id: delivery.id,
                        supplierName: supplier.name,
                        supplierCpf: supplier.cpf,
                        invoiceNumber: delivery.invoiceNumber,
                        date: delivery.date,
                        deliveryDetails: delivery,
                    });
                }
            });
        });

        // Sort deliveries within each item by date
        meatItemsMap.forEach(item => {
            item.deliveries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });

        return Array.from(meatItemsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const filteredItems = useMemo(() => {
        if (!searchTerm) return processedMeatItems;
        return processedMeatItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [processedMeatItems, searchTerm]);

    const handleAddLots = (deliveryId: string, supplierCpf: string, slotsToRender: number) => {
        const newLotsData = [];
        const newActiveLotInputs = { ...activeLotInputs };

        for (let i = 0; i < slotsToRender; i++) {
            const inputKey = `${deliveryId}-${i}`;
            const inputs = activeLotInputs[inputKey];
            if (inputs && inputs.lotIdentifier && inputs.initialQuantity) {
                const initialQuantity = parseFloat(inputs.initialQuantity.replace(',', '.'));
                if (!isNaN(initialQuantity) && initialQuantity > 0) {
                    newLotsData.push({
                        lotNumber: inputs.lotIdentifier,
                        barcode: inputs.lotIdentifier,
                        initialQuantity: initialQuantity,
                        remainingQuantity: initialQuantity,
                        id: `lot-${Date.now()}-${i}`
                    });
                }
            }
             delete newActiveLotInputs[inputKey];
        }

        if (newLotsData.length === 0) {
            alert("Nenhum lote válido para adicionar. Preencha o Lote/Código e a Quantidade.");
            return;
        }
        
        const newSuppliers = JSON.parse(JSON.stringify(suppliers));
        const supplier = newSuppliers.find((s: Supplier) => s.cpf === supplierCpf);
        if (!supplier) return;
        
        const delivery = supplier.deliveries.find((d: Delivery) => d.id === deliveryId);
        if (!delivery) return;

        const currentLotTotal = (delivery.lots || []).reduce((sum: number, lot: any) => sum + lot.initialQuantity, 0);
        const newLotsTotal = newLotsData.reduce((sum, lot) => sum + lot.initialQuantity, 0);

        if (currentLotTotal + newLotsTotal > (delivery.kg || 0) + 0.001) {
            alert(`A soma dos lotes (${(currentLotTotal + newLotsTotal).toFixed(2)}kg) não pode exceder a quantidade total do item (${(delivery.kg || 0).toFixed(2)}kg).`);
            return;
        }

        delivery.lots = [...(delivery.lots || []), ...newLotsData];
        delivery.remainingQuantity = (delivery.lots || []).reduce((sum: number, lot: any) => sum + lot.remainingQuantity, 0);

        onUpdateSuppliers(newSuppliers);
        setActiveLotInputs(newActiveLotInputs);
    };
    
    // Manipula o registro de uma retirada de estoque de um lote
    const handleRegisterWithdrawal = (lotId: string, deliveryId: string, supplierCpf: string) => {
        const withdrawalAmount = parseFloat((activeWithdrawalInputs[lotId] || '0').replace(',', '.'));
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            alert("Por favor, insira uma quantidade de saída válida.");
            return;
        }

        const newSuppliers = JSON.parse(JSON.stringify(suppliers)); // Deep copy
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
        delivery.remainingQuantity = (delivery.lots || []).reduce((sum: number, l: any) => sum + l.remainingQuantity, 0);

        onUpdateSuppliers(newSuppliers);
        setActiveWithdrawalInputs(prev => ({ ...prev, [lotId]: '' }));
    };

    // Foca no lote correspondente ao código de barras lido
    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const barcode = e.currentTarget.value;
            if (!barcode) return;
            
            for (const item of filteredItems) {
                for (const del of item.deliveries) {
                    const foundLot = (del.deliveryDetails.lots || []).find(l => l.barcode === barcode);
                    if (foundLot) {
                        setExpandedItemName(item.name);
                        setTimeout(() => {
                           const input = document.getElementById(`withdraw-${foundLot.id}`);
                           input?.focus();
                        }, 100);
                        e.currentTarget.value = ''; // Limpa o campo após a leitura
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
                    <h2 className="text-3xl font-black text-cyan-900 uppercase tracking-tighter">Gestão PEPS - Carnes</h2>
                    <p className="text-gray-400 font-medium">Controle de lotes e saídas de estoque por item.</p>
                </div>
                <div className="flex items-center gap-4">
                     <input
                        type="text"
                        placeholder="Pesquisar item..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-auto border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
                    />
                    <input
                        type="text"
                        ref={barcodeInputRef}
                        placeholder="Leitura de Código de Barras..."
                        onKeyDown={handleBarcodeScan}
                        className="w-full sm:w-auto border-2 border-dashed rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400 focus:border-solid transition-all font-mono"
                    />
                </div>
            </div>
            
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                {filteredItems.map(item => {
                    const isExpanded = expandedItemName === item.name;
                    const progress = item.totalInitialKg > 0 ? (item.totalRemainingKg / item.totalInitialKg) * 100 : 0;
                    return (
                        <div key={item.name} className={`border rounded-xl transition-all ${isExpanded ? 'ring-2 ring-cyan-400 bg-white' : 'bg-gray-50/50 hover:bg-white'}`}>
                            {/* Cabeçalho do Item */}
                            <div className="p-4 cursor-pointer grid grid-cols-2 md:grid-cols-3 gap-4 items-center" onClick={() => setExpandedItemName(isExpanded ? null : item.name)}>
                                <div className="col-span-2 md:col-span-1">
                                    <p className="font-bold text-gray-800 text-lg">{item.name}</p>
                                </div>
                                <div className="text-right md:text-left">
                                     <p className="text-xs text-gray-500">Total / Restante</p>
                                    <p className="font-bold text-cyan-600">{formatKg(item.totalInitialKg)} / {formatKg(item.totalRemainingKg)}</p>
                                </div>
                                <div className="flex justify-end items-center col-span-2 md:col-span-1">
                                    <div className="w-24 bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ml-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            
                            {/* Conteúdo Detalhado do Item */}
                            {isExpanded && (
                            <div className="p-4 border-t bg-cyan-50/20 space-y-4">
                                {item.deliveries.map(del => {
                                    const deliveryItem = del.deliveryDetails;
                                    const valuePerKg = (deliveryItem.value || 0) / (deliveryItem.kg || 1);
                                    const deliveryRemainingValue = (deliveryItem.remainingQuantity || 0) * valuePerKg;
                                    const existingLotsCount = deliveryItem.lots?.length || 0;
                                    const slotsToRender = 4 - existingLotsCount;
                                    
                                    return (
                                        <div key={del.id} className="p-4 bg-white rounded-lg border shadow-sm">
                                            {/* CABEÇALHO DA NOTA FISCAL */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border-b pb-4">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase">Fornecedor</p>
                                                    <p className="font-semibold text-gray-800 truncate">{del.supplierName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase">Nota Fiscal / Data</p>
                                                    <p className="font-semibold font-mono text-gray-800">{del.invoiceNumber} <span className="text-gray-500 font-sans">({formatDate(del.date)})</span></p>
                                                </div>
                                                <div className="text-left md:text-right">
                                                    <p className="text-xs font-bold text-gray-500 uppercase">Sobra / Total da Nota (Kg)</p>
                                                    <p className="font-semibold text-gray-800">
                                                        <span className="text-green-700" title="Sobra">{formatKg(deliveryItem.remainingQuantity || 0)}</span> / <span title="Total">{formatKg(deliveryItem.kg || 0)}</span>
                                                    </p>
                                                    <p className="font-semibold text-green-700" title="Valor da Sobra">{formatCurrency(deliveryRemainingValue)}</p>
                                                </div>
                                            </div>

                                            {/* ÁREA DE LOTES E AÇÕES */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* COLUNA ESQUERDA: LOTES ATUAIS */}
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Lotes Atuais</h4>
                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar-small">
                                                        {(deliveryItem.lots && deliveryItem.lots.length > 0) ? (deliveryItem.lots || []).map(lot => {
                                                            const lotRemainingValue = lot.remainingQuantity * valuePerKg;
                                                            return (
                                                                <div key={lot.id} className="p-2 bg-gray-50 rounded-md border">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div>
                                                                            <p className="text-xs font-semibold">Lote: <span className="font-mono bg-gray-200 px-1 rounded">{lot.lotNumber}</span></p>
                                                                            <p className="text-xs text-gray-500 truncate" title={lot.barcode}>Código: <span className="font-mono">{lot.barcode || 'N/A'}</span></p>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0 ml-2">
                                                                            <p className="text-xs font-bold">{formatKg(lot.remainingQuantity)}</p>
                                                                            <p className="text-xs font-bold text-blue-700">{formatCurrency(lotRemainingValue)}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <input id={`withdraw-${lot.id}`} type="text" value={activeWithdrawalInputs[lot.id] || ''} onChange={e => setActiveWithdrawalInputs(p => ({ ...p, [lot.id]: e.target.value.replace(/[^0-9,.]/g, '') }))} placeholder="Saída (Kg)" className="flex-grow border rounded px-2 py-1 text-xs font-mono"/>
                                                                        <button onClick={() => handleRegisterWithdrawal(lot.id, del.id, del.supplierCpf)} className="bg-green-500 text-white rounded px-3 py-1 text-xs font-bold hover:bg-green-600 whitespace-nowrap">Dar Saída</button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }) : (
                                                            <div className="text-center p-4 bg-gray-50 rounded-md">
                                                                <p className="text-xs text-gray-400 italic">Nenhum lote cadastrado para esta nota.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* COLUNA DIREITA: ADICIONAR NOVOS LOTES */}
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-700 mb-2">Adicionar Novos Lotes</h4>
                                                    {slotsToRender > 0 ? (
                                                        <div className="p-2 bg-gray-50 rounded-md border">
                                                            <div className="space-y-2">
                                                                {Array.from({ length: slotsToRender }).map((_, index) => {
                                                                    const inputKey = `${del.id}-${index}`;
                                                                    return(
                                                                        <div key={inputKey} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                                                                            <input id={`lot-identifier-${inputKey}`} type="text" value={activeLotInputs[inputKey]?.lotIdentifier || ''} onChange={e => setActiveLotInputs(p => ({ ...p, [inputKey]: { ...(p[inputKey] || {}), lotIdentifier: e.target.value } }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`lot-quantity-${inputKey}`)?.focus(); } }} placeholder={`Lote / Cód. Barras #${existingLotsCount + index + 1}`} className="border rounded px-2 py-1 text-xs"/>
                                                                            <input id={`lot-quantity-${inputKey}`} type="text" value={activeLotInputs[inputKey]?.initialQuantity || ''} onChange={e => setActiveLotInputs(p => ({ ...p, [inputKey]: { ...(p[inputKey] || {}), initialQuantity: e.target.value.replace(/[^0-9,.]/g, '') } }))} placeholder="Qtd. (Kg)" className="border rounded px-2 py-1 text-xs font-mono"/>
                                                                        </div>
                                                                    )
                                                                })}
                                                                <button onClick={() => handleAddLots(del.id, del.supplierCpf, slotsToRender)} className="w-full mt-2 bg-blue-500 text-white rounded px-3 py-1.5 text-xs font-bold hover:bg-blue-600">Adicionar Lotes Preenchidos</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                         <div className="text-center p-4 bg-gray-50 rounded-md">
                                                            <p className="text-xs text-gray-400 italic">Limite de 4 lotes por nota atingido.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            )}
                        </div>
                    )
                })}
            </div>
             <style>{`
                .custom-scrollbar-small::-webkit-scrollbar { width: 4px; } 
                .custom-scrollbar-small::-webkit-scrollbar-track { background: #f8fafc; }
                .custom-scrollbar-small::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
                .custom-scrollbar-small::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
             `}</style>
        </div>
    );
};

export default AdminPeps;