
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Supplier, WarehouseMovement, ContractItem } from '../types';

interface WarehouseMovementFormProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

const WarehouseMovementForm: React.FC<WarehouseMovementFormProps> = ({ suppliers, warehouseLog, onRegisterEntry, onRegisterWithdrawal }) => {
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Estados para o formulário manual/individual
    const [manualType, setManualType] = useState<'entrada' | 'saída'>('entrada');
    const [selectedSupplierCpf, setSelectedSupplierCpf] = useState('');
    const [manualNf, setManualNf] = useState('');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

    // Estados para o item sendo adicionado
    const [selectedItemName, setSelectedItemName] = useState('');
    const [manualBarcode, setManualBarcode] = useState('');
    const [manualQuantity, setManualQuantity] = useState('');
    const [manualInboundNf, setManualInboundNf] = useState('');
    const [manualLot, setManualLot] = useState('');
    const [manualExp, setManualExp] = useState('');
    
    // Lista de itens a serem processados
    const [items, setItems] = useState<{ id: string; itemName: string; quantity: number; lot: string; exp: string; barcode: string; inboundInvoice?: string }[]>([]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        barcodeInputRef.current?.focus();
    }, [manualType]);

    const selectedSupplier = useMemo(() => 
        suppliers.find(s => s.cpf === selectedSupplierCpf), 
    [suppliers, selectedSupplierCpf]);

    const manualSupplierInvoices = useMemo(() => {
        if (!selectedSupplier) return [];
        const invoices = new Set<string>();
        (selectedSupplier.deliveries || []).forEach(d => {
            if (d.invoiceNumber) invoices.add(d.invoiceNumber);
        });
        return Array.from(invoices).sort();
    }, [selectedSupplier]);

    const availableItems = useMemo(() => {
        if (selectedSupplier) {
            return (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name));
        }
        if (manualType === 'saída') {
            const all: { name: string; supplierName: string; supplierCpf: string }[] = [];
            suppliers.forEach(s => {
                (s.contractItems || []).forEach(ci => {
                    all.push({ name: ci.name, supplierName: s.name, supplierCpf: s.cpf });
                });
            });
            return all.sort((a, b) => a.name.localeCompare(b.name));
        }
        return [];
    }, [selectedSupplier, manualType, suppliers]);

    useEffect(() => {
        const barcode = manualBarcode.trim();
        if (barcode.length >= 8) {
            let foundMatch = false;
            for (const s of suppliers) {
                const deliveries = (s.deliveries || []).filter(d => d.barcode === barcode);
                if (deliveries.length > 0) {
                    // Se o fornecedor ainda não foi selecionado, seleciona
                    if (!selectedSupplierCpf) {
                        setSelectedSupplierCpf(s.cpf);
                    }
                    // Se for saída e a NF de entrada não foi selecionada, tenta selecionar
                    if (manualType === 'saída' && !manualInboundNf) {
                        setManualInboundNf(deliveries[0].invoiceNumber || '');
                    }
                    
                    if (deliveries.length === 1) {
                        setSelectedItemName(deliveries[0].item || '');
                        
                        const entryLog = warehouseLog.find(l => l.barcode === barcode && l.type === 'entrada');
                        if (entryLog) {
                            setManualLot(entryLog.lotNumber || '');
                            setManualExp(entryLog.expirationDate || '');
                        }
                    } else {
                        // Se houver múltiplos itens com mesmo código, não preenche item automaticamente
                        // setSelectedItemName('');
                    }
                    foundMatch = true;
                    break;
                }
            }
            
            if (!foundMatch) {
                const entryLog = warehouseLog.find(l => l.barcode === barcode && l.type === 'entrada');
                if (entryLog) {
                    const supplier = suppliers.find(s => s.name === entryLog.supplierName);
                    if (supplier && !selectedSupplierCpf) setSelectedSupplierCpf(supplier.cpf);
                    setSelectedItemName(entryLog.itemName);
                    if (manualType === 'saída' && !manualInboundNf) setManualInboundNf(entryLog.inboundInvoice || '');
                    setManualLot(entryLog.lotNumber || '');
                    setManualExp(entryLog.expirationDate || '');
                }
            }
        }
    }, [manualBarcode, suppliers, warehouseLog, manualType, selectedSupplierCpf, manualInboundNf]);

    const handleAddItem = () => {
        const qtyVal = parseFloat(manualQuantity.replace(',', '.'));
        if (!selectedItemName || isNaN(qtyVal) || qtyVal <= 0) {
            alert('Preencha Item e Quantidade válida.');
            return;
        }

        if (manualType === 'saída' && !manualInboundNf) {
             alert('Selecione a Nota Fiscal de Origem (Entrada) para este item.');
             return;
        }

        setItems(prev => [...prev, {
            id: `item-${Date.now()}`,
            itemName: selectedItemName,
            quantity: qtyVal,
            lot: manualLot,
            exp: manualExp,
            barcode: manualBarcode,
            inboundInvoice: manualInboundNf
        }]);

        // Limpa campos do item para próxima inserção
        setSelectedItemName('');
        setManualQuantity('');
        setManualLot('');
        setManualExp('');
        setManualBarcode('');
        // Não limpamos manualInboundNf automaticamente pois pode ser a mesma para o próximo item? 
        // Melhor limpar para forçar atenção ou manter? Manter é mais prático.
        // Mas se o usuário mudar de item, talvez a NF mude.
        // Vamos manter por conveniência, mas o usuário pode mudar.
        barcodeInputRef.current?.focus();
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const handleRegisterAll = async () => {
        if (!selectedSupplierCpf) {
            alert('Selecione o Fornecedor.');
            return;
        }
        if (items.length === 0) {
            alert('Adicione pelo menos um item à lista.');
            return;
        }

        setIsSubmitting(true);
        try {
            let successCount = 0;
            let failCount = 0;

            for (const item of items) {
                const res = manualType === 'entrada' 
                    ? await onRegisterEntry({
                        supplierCpf: selectedSupplierCpf,
                        itemName: item.itemName,
                        invoiceNumber: manualNf,
                        invoiceDate: manualDate,
                        lotNumber: item.lot || 'UNICO',
                        quantity: item.quantity,
                        expirationDate: item.exp,
                        barcode: item.barcode
                    })
                    : await onRegisterWithdrawal({
                        supplierCpf: selectedSupplierCpf,
                        itemName: item.itemName,
                        outboundInvoice: manualNf,
                        inboundInvoice: item.inboundInvoice,
                        lotNumber: item.lot || 'UNICO',
                        quantity: item.quantity,
                        expirationDate: item.exp,
                        date: manualDate,
                        barcode: item.barcode
                    });
                
                if (res.success) successCount++;
                else failCount++;
            }

            if (failCount === 0) {
                alert('Todos os itens foram registrados com sucesso!');
                setItems([]);
                setManualNf('');
                setManualInboundNf('');
                setManualBarcode('');
                setManualQuantity('');
                setManualLot('');
                setManualExp('');
                setSelectedItemName('');
            } else {
                alert(`${successCount} itens registrados. ${failCount} falharam. Verifique os logs.`);
                setItems([]); 
            }
        } catch (err) {
            alert('Erro de conexão ao processar lançamentos.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in">
            <div className="p-6 md:p-8 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${manualType === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} transition-colors duration-500`}>
                        {manualType === 'entrada' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                        )}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">
                            {manualType === 'entrada' ? 'Entrada de Materiais' : 'Saída de Materiais'}
                        </h2>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1 italic">
                            {manualType === 'entrada' ? 'Registro de Compra e Recebimento' : 'Registro de Consumo e Requisição'}
                        </p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner w-full md:w-auto">
                    <button 
                        type="button" 
                        onClick={() => { setManualType('entrada'); setItems([]); setManualInboundNf(''); }} 
                        className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 flex items-center justify-center gap-2 ${manualType === 'entrada' ? 'bg-white text-green-600 shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${manualType === 'entrada' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        Entrada
                    </button>
                    <button 
                        type="button" 
                        onClick={() => { setManualType('saída'); setItems([]); setManualInboundNf(''); }} 
                        className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 flex items-center justify-center gap-2 ${manualType === 'saída' ? 'bg-white text-red-600 shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${manualType === 'saída' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        Saída
                    </button>
                </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
                {/* CABEÇALHO DO DOCUMENTO */}
                <div className="relative">
                    <div className="absolute -top-3 left-6 px-3 bg-white text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] z-10">
                        Informações do Documento (Cabeçalho)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100 pt-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                {manualType === 'entrada' ? 'Fornecedor / Origem' : 'Origem (Fornecedor)'}
                            </label>
                            <select 
                                value={selectedSupplierCpf} 
                                onChange={e => { setSelectedSupplierCpf(e.target.value); setSelectedItemName(''); setItems([]); }} 
                                className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer">
                                <option value="">-- SELECIONE --</option>
                                {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Data do Documento
                            </label>
                            <input 
                                type="date" 
                                value={manualDate} 
                                onChange={e => setManualDate(e.target.value)} 
                                className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                {manualType === 'entrada' ? 'Número da Nota Fiscal' : 'Nº Requisição SAN ESTOQUE'}
                            </label>
                            <input 
                                type="text" 
                                value={manualNf} 
                                onChange={e => setManualNf(e.target.value)} 
                                placeholder={manualType === 'entrada' ? "000.000.000" : "REQ-2026-X"} 
                                className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-mono font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm placeholder:text-gray-300" />
                        </div>
                    </div>
                </div>

                {/* ÁREA DE ADIÇÃO DE ITENS */}
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-[2rem] p-6 space-y-6">
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        Adicionar Itens à Lista
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">Item do Contrato</label>
                                <select 
                                    value={selectedItemName} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (manualType === 'saída' && !selectedSupplierCpf) {
                                            const [itemName, supplierCpf] = val.split('|');
                                            setSelectedSupplierCpf(supplierCpf);
                                            setSelectedItemName(itemName);
                                        } else {
                                            setSelectedItemName(val);
                                        }
                                    }} 
                                    className="w-full h-14 px-4 border-2 border-indigo-50 rounded-2xl bg-white font-black outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm disabled:opacity-50 appearance-none cursor-pointer shadow-sm" 
                                    disabled={manualType === 'entrada' && !selectedSupplierCpf}>
                                    <option value="">-- SELECIONAR PRODUTO --</option>
                                    {manualType === 'saída' && !selectedSupplierCpf ? (
                                        (availableItems as any[]).map((it, idx) => (
                                            <option key={`${it.name}-${idx}`} value={`${it.name}|${it.supplierCpf}`}>
                                                {it.name} ({it.supplierName})
                                            </option>
                                        ))
                                    ) : (
                                        (availableItems as any[]).map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)
                                    )}
                                </select>
                            </div>
                            
                            {manualType === 'saída' && (
                                <div className="space-y-2 animate-fade-in">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                        Nota Fiscal de Origem (Entrada)
                                    </label>
                                    <select 
                                        value={manualInboundNf} 
                                        onChange={e => setManualInboundNf(e.target.value)} 
                                        className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer disabled:opacity-50"
                                        disabled={!selectedSupplierCpf}>
                                        <option value="">-- SELECIONE A NF DE ENTRADA --</option>
                                        {manualSupplierInvoices.map(nf => <option key={nf} value={nf}>NF {nf}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-5 space-y-2">
                            <label className="text-[10px] font-black text-blue-600 uppercase ml-1">Código de Barras</label>
                            <input 
                                ref={barcodeInputRef} 
                                type="text" 
                                value={manualBarcode} 
                                onChange={e => setManualBarcode(e.target.value)} 
                                placeholder="Bipar..." 
                                className="w-full h-14 px-4 border-2 border-blue-100 rounded-2xl bg-white font-mono font-bold focus:ring-4 focus:ring-blue-50 outline-none text-sm placeholder:text-blue-200 transition-all shadow-sm" />
                        </div>

                        <div className="md:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Quantidade</label>
                            <input 
                                type="text" 
                                value={manualQuantity} 
                                onChange={e => setManualQuantity(e.target.value.replace(/[^0-9,.]/g, ''))} 
                                placeholder="0,00" 
                                className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl bg-gray-900 text-white font-black text-center text-xl outline-none focus:ring-4 focus:ring-gray-100 transition-all shadow-lg font-mono" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lote</label>
                            <input 
                                type="text" 
                                value={manualLot} 
                                onChange={e => setManualLot(e.target.value.toUpperCase())} 
                                placeholder="OPCIONAL" 
                                className="w-full h-12 px-4 border-2 border-gray-100 rounded-xl bg-white font-mono font-bold outline-none focus:ring-2 focus:ring-gray-50 transition-all text-xs" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Validade</label>
                            <input 
                                type="date" 
                                value={manualExp} 
                                onChange={e => setManualExp(e.target.value)} 
                                className="w-full h-12 px-4 border-2 border-gray-100 rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-gray-50 transition-all text-xs" />
                        </div>

                        <div className="flex items-end">
                            <button 
                                type="button" 
                                onClick={handleAddItem}
                                disabled={!selectedItemName || !manualQuantity}
                                className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Adicionar Item
                            </button>
                        </div>
                    </div>
                </div>

                {/* LISTA DE ITENS */}
                {items.length > 0 && (
                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-200">
                        <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest mb-4">Itens a Registrar ({items.length})</h3>
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 border border-gray-100">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase">Produto</p>
                                        <p className="font-bold text-gray-800 text-sm">{item.itemName}</p>
                                    </div>
                                    <div className="flex gap-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Qtd</p>
                                            <p className="font-mono font-bold text-gray-800">{item.quantity} kg/un</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Lote</p>
                                            <p className="font-mono text-gray-600 text-xs">{item.lot || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Validade</p>
                                            <p className="font-mono text-gray-600 text-xs">{item.exp ? new Date(item.exp).toLocaleDateString('pt-BR') : '-'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* BOTÃO FINAL */}
                <button 
                    type="button" 
                    onClick={handleRegisterAll}
                    disabled={isSubmitting || items.length === 0} 
                    className={`w-full h-16 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 text-white flex items-center justify-center gap-3 ${manualType === 'entrada' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Processando {items.length} itens...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Confirmar Movimentação
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default WarehouseMovementForm;
