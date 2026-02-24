
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
    const [selectedItemName, setSelectedItemName] = useState('');
    const [manualBarcode, setManualBarcode] = useState('');
    const [manualQuantity, setManualQuantity] = useState('');
    const [manualNf, setManualNf] = useState('');
    const [manualInboundNf, setManualInboundNf] = useState('');
    const [manualLot, setManualLot] = useState('');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualExp, setManualExp] = useState('');
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
                    setSelectedSupplierCpf(s.cpf);
                    setManualInboundNf(deliveries[0].invoiceNumber || '');
                    
                    if (deliveries.length === 1) {
                        setSelectedItemName(deliveries[0].item || '');
                        
                        const entryLog = warehouseLog.find(l => l.barcode === barcode && l.type === 'entrada');
                        if (entryLog) {
                            setManualLot(entryLog.lotNumber || '');
                            setManualExp(entryLog.expirationDate || '');
                        }
                    } else {
                        setSelectedItemName('');
                    }
                    foundMatch = true;
                    break;
                }
            }
            
            if (!foundMatch) {
                const entryLog = warehouseLog.find(l => l.barcode === barcode && l.type === 'entrada');
                if (entryLog) {
                    const supplier = suppliers.find(s => s.name === entryLog.supplierName);
                    if (supplier) setSelectedSupplierCpf(supplier.cpf);
                    setSelectedItemName(entryLog.itemName);
                    setManualInboundNf(entryLog.inboundInvoice || '');
                    setManualLot(entryLog.lotNumber || '');
                    setManualExp(entryLog.expirationDate || '');
                }
            }
        }
    }, [manualBarcode, suppliers, warehouseLog]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const qtyVal = parseFloat(manualQuantity.replace(',', '.'));
        if (!selectedSupplierCpf || !selectedItemName || isNaN(qtyVal) || qtyVal <= 0) {
            alert('Preencha os campos obrigatórios (Fornecedor, Item e Quantidade).');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = manualType === 'entrada' 
                ? await onRegisterEntry({
                    supplierCpf: selectedSupplierCpf,
                    itemName: selectedItemName,
                    invoiceNumber: manualNf,
                    invoiceDate: manualDate,
                    lotNumber: manualLot || 'UNICO',
                    quantity: qtyVal,
                    expirationDate: manualExp,
                    barcode: manualBarcode
                })
                : await onRegisterWithdrawal({
                    supplierCpf: selectedSupplierCpf,
                    itemName: selectedItemName,
                    outboundInvoice: manualNf,
                    inboundInvoice: manualInboundNf,
                    lotNumber: manualLot || 'UNICO',
                    quantity: qtyVal,
                    expirationDate: manualExp,
                    date: manualDate,
                    barcode: manualBarcode
                });

            if (res.success) {
                setManualBarcode('');
                setManualQuantity('');
                setManualLot('');
                setManualExp('');
                barcodeInputRef.current?.focus();
            } else {
                alert(res.message);
            }
        } catch (err) {
            alert('Erro de conexão ao processar lançamento.');
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
                        onClick={() => setManualType('entrada')} 
                        className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 flex items-center justify-center gap-2 ${manualType === 'entrada' ? 'bg-white text-green-600 shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${manualType === 'entrada' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        Entrada
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setManualType('saída')} 
                        className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 flex items-center justify-center gap-2 ${manualType === 'saída' ? 'bg-white text-red-600 shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${manualType === 'saída' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        Saída
                    </button>
                </div>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 md:p-8 space-y-10">
                <div className="relative">
                    <div className="absolute -top-3 left-6 px-3 bg-white text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] z-10">
                        Informações do Documento
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100 pt-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                {manualType === 'entrada' ? 'Fornecedor / Origem' : 'Origem (Fornecedor)'}
                            </label>
                            <select 
                                value={selectedSupplierCpf} 
                                onChange={e => { setSelectedSupplierCpf(e.target.value); setSelectedItemName(''); }} 
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
                        {manualType === 'saída' && (
                            <div className="space-y-2 md:col-span-3 animate-fade-in">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                    Nota Fiscal de Origem (Entrada)
                                </label>
                                <select 
                                    value={manualInboundNf} 
                                    onChange={e => setManualInboundNf(e.target.value)} 
                                    className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer disabled:opacity-50"
                                    disabled={!selectedSupplierCpf}>
                                    <option value="">-- SELECIONE A NF DE ENTRADA --</option>
                                    {manualSupplierInvoices.map(nf => <option key={nf} value={nf}>NF {nf}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-5 space-y-2">
                        <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            Item do Contrato
                        </label>
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
                            className="w-full h-20 px-6 border-2 border-indigo-50 rounded-3xl bg-white font-black outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-base disabled:opacity-50 appearance-none cursor-pointer shadow-sm" 
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

                    <div className="md:col-span-4 space-y-2">
                        <label className="text-[10px] font-black text-blue-600 uppercase ml-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                            Código de Barras (Bipar)
                        </label>
                        <div className="relative group">
                            <input 
                                ref={barcodeInputRef} 
                                type="text" 
                                value={manualBarcode} 
                                onChange={e => setManualBarcode(e.target.value)} 
                                onKeyDown={e => {
                                    if (e.ctrlKey && e.key === 'j') {
                                        e.preventDefault();
                                    }
                                    if (e.key === 'Enter' && !manualQuantity) {
                                    }
                                }}
                                placeholder="Aguardando leitura..." 
                                className="w-full h-20 px-6 border-2 border-blue-100 rounded-3xl bg-white font-mono font-bold focus:ring-8 focus:ring-blue-50 outline-none text-lg placeholder:text-blue-200 transition-all shadow-sm" />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                <div className={`w-3 h-3 rounded-full ${manualBarcode ? 'bg-blue-500' : 'bg-gray-200 animate-pulse'}`}></div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 01-6.001 0M18 7l-3 9m3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                            Quantidade / Peso
                        </label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={manualQuantity} 
                                onChange={e => setManualQuantity(e.target.value.replace(/[^0-9,.]/g, ''))} 
                                placeholder="0,00" 
                                className="w-full h-20 px-6 border-2 border-gray-100 rounded-3xl bg-gray-900 text-white font-black text-center text-3xl outline-none focus:ring-8 focus:ring-gray-100 transition-all shadow-xl font-mono" 
                                required />
                            <div className="absolute bottom-2 left-0 right-0 text-center">
                                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Digital Display</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                            Lote (Identificação)
                        </label>
                        <input 
                            type="text" 
                            value={manualLot} 
                            onChange={e => setManualLot(e.target.value.toUpperCase())} 
                            placeholder="OPCIONAL" 
                            className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl bg-white font-mono font-bold outline-none focus:ring-4 focus:ring-gray-50 transition-all text-sm" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Data de Validade
                        </label>
                        <input 
                            type="date" 
                            value={manualExp} 
                            onChange={e => setManualExp(e.target.value)} 
                            className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl bg-white font-bold outline-none focus:ring-4 focus:ring-gray-50 transition-all text-sm" />
                    </div>

                    <div className="flex items-end">
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !selectedSupplierCpf || !selectedItemName} 
                            className={`w-full h-14 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 text-white flex items-center justify-center gap-3 ${manualType === 'entrada' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Gravando...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Confirmar Lançamento
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default WarehouseMovementForm;
