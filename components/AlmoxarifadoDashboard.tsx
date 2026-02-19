
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Supplier, WarehouseMovement, ContractItem } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onLogout: () => void;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

declare var JsBarcode: any;

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, warehouseLog, onLogout, onRegisterEntry, onRegisterWithdrawal }) => {
    const [activeTab, setActiveTab] = useState<'entrada' | 'saida'>('entrada');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- ESTADO ENTRADA (NOVA NF) ---
    const [entrySupplierCpf, setEntrySupplierCpf] = useState('');
    const [entryNfNumber, setEntryNfNumber] = useState('');
    const [entryNfBarcode, setEntryNfBarcode] = useState('');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [entryItems, setEntryItems] = useState<{ id: string; itemName: string; quantity: string; unitPrice: string; expirationDate: string; lot: string }[]>([
        { id: Math.random().toString(), itemName: '', quantity: '', unitPrice: '', expirationDate: '', lot: '' }
    ]);

    // --- ESTADO SAÍDA (BAIXA POR NF) ---
    const [exitNfBarcodeSearch, setExitNfBarcodeSearch] = useState('');
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [foundNfMovements, setFoundNfMovements] = useState<WarehouseMovement[]>([]);
    const [exitQuantities, setExitQuantities] = useState<Record<string, string>>({});

    const selectedSupplier = useMemo(() => suppliers.find(s => s.cpf === entrySupplierCpf), [suppliers, entrySupplierCpf]);
    const availableContractItems = useMemo(() => selectedSupplier ? (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)) : [], [selectedSupplier]);

    // --- LÓGICA DE SALDO POR NF ---
    const getNfBalances = (barcode: string) => {
        const nfMovements = warehouseLog.filter(m => m.barcode === barcode);
        const balances: Record<string, number> = {};
        
        nfMovements.forEach(m => {
            if (!balances[m.itemName]) balances[m.itemName] = 0;
            if (m.type === 'entrada') balances[m.itemName] += (m.quantity || 0);
            if (m.type === 'saída') balances[m.itemName] -= (m.quantity || 0);
        });
        return balances;
    };

    // --- AÇÕES ENTRADA ---
    const handleAddEntryItem = () => setEntryItems([...entryItems, { id: Math.random().toString(), itemName: '', quantity: '', unitPrice: '', expirationDate: '', lot: '' }]);
    const handleRemoveEntryItem = (index: number) => setEntryItems(entryItems.filter((_, i) => i !== index));
    const handleEntryItemChange = (index: number, field: string, value: string) => {
        const newItems = [...entryItems];
        (newItems[index] as any)[field] = value;
        setEntryItems(newItems);
    };

    const handleEntrySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entrySupplierCpf || !entryNfNumber || !entryNfBarcode) return alert('Preencha os dados da NF.');

        setIsSubmitting(true);
        let successCount = 0;

        for (const item of entryItems) {
            const qty = parseFloat(item.quantity.replace(',', '.'));
            const price = parseFloat(item.unitPrice.replace(',', '.'));
            if (item.itemName && !isNaN(qty) && qty > 0) {
                const res = await onRegisterEntry({
                    supplierCpf: entrySupplierCpf,
                    itemName: item.itemName,
                    invoiceNumber: entryNfNumber,
                    invoiceDate: entryDate,
                    lotNumber: item.lot || `NF-${entryNfNumber}`,
                    quantity: qty,
                    unitPrice: price || 0,
                    barcode: entryNfBarcode,
                    expirationDate: item.expirationDate
                });
                if (res.success) successCount++;
            }
        }

        setIsSubmitting(false);
        alert(`${successCount} item(ns) cadastrados na NF ${entryNfNumber}`);
        // Resetamos após salvar
        setEntryNfNumber('');
        setEntryNfBarcode('');
        setEntryItems([{ id: Math.random().toString(), itemName: '', quantity: '', unitPrice: '', expirationDate: '', lot: '' }]);
    };

    // --- IMPRESSÃO DE ETIQUETAS ---
    const generateLabelHtml = (items: typeof entryItems) => {
        const supplierName = selectedSupplier?.name || 'FORNECEDOR';
        
        return `
            <html>
                <head>
                    <style>
                        @page { size: auto; margin: 0; }
                        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 20px; background: #eee; }
                        .label-container { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
                        .label { 
                            width: 380px; 
                            height: 250px; 
                            background: white; 
                            border: 2px solid #000; 
                            border-radius: 25px; 
                            padding: 20px; 
                            box-sizing: border-box; 
                            page-break-inside: avoid;
                            position: relative;
                        }
                        .title { text-align: center; font-size: 20px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
                        .subtitle { text-align: center; font-size: 14px; font-weight: 700; color: #444; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 12px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; font-weight: 700; color: #222; }
                        .row .key { text-transform: uppercase; }
                        .row .dots { flex: 1; border-bottom: 1px dotted #888; margin: 0 5px; position: relative; top: -4px; }
                        .row .value { min-width: 60px; text-align: right; }
                        .barcode-container { text-align: center; position: absolute; bottom: 10px; width: calc(100% - 40px); }
                        .barcode-container svg { width: 180px; height: 45px; }
                        .timestamp { font-size: 8px; color: #999; position: absolute; bottom: 5px; right: 20px; }
                        @media print {
                            body { background: white; padding: 0; }
                            .label-container { gap: 0; }
                            .label { margin: 10px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        ${items.map((it, idx) => `
                            <div class="label">
                                <div class="title">${it.itemName || 'ITEM NÃO INFORMADO'}</div>
                                <div class="subtitle">${supplierName}</div>
                                <div class="row"><span class="key">LOTE:</span><span class="dots"></span><span class="value">${it.lot || '-'}</span></div>
                                <div class="row"><span class="key">VAL:</span><span class="dots"></span><span class="value">${it.expirationDate ? it.expirationDate.split('-').reverse().join('/') : '-'}</span></div>
                                <div class="row"><span class="key">ENT:</span><span class="dots"></span><span class="value">${entryDate.split('-').reverse().join('/')}</span></div>
                                <div class="row"><span class="key">QTD:</span><span class="dots"></span><span class="value">${it.quantity || '0,00'} kg</span></div>
                                <div class="row"><span class="key">NF:</span><span class="dots"></span><span class="value">${entryNfNumber || '-'}</span></div>
                                
                                <div class="barcode-container">
                                    <svg id="barcode-${idx}"></svg>
                                </div>
                                <div class="timestamp">${new Date().toLocaleString('pt-BR')}</div>
                            </div>
                        `).join('')}
                    </div>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <script>
                        window.onload = function() {
                            ${items.map((it, idx) => `
                                JsBarcode("#barcode-${idx}", "${entryNfBarcode || '000000'}", {
                                    format: "CODE128",
                                    displayValue: false,
                                    fontSize: 10,
                                    margin: 0
                                });
                            `).join('')}
                            setTimeout(() => { window.print(); window.close(); }, 500);
                        }
                    </script>
                </body>
            </html>
        `;
    };

    const handlePrintLabel = (item?: typeof entryItems[0]) => {
        if (!entryNfBarcode) return alert('Bipe o Código de Barras da Nota primeiro!');
        const content = item ? [item] : entryItems;
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(generateLabelHtml(content));
            printWindow.document.close();
        }
    };

    // --- AÇÕES SAÍDA ---
    const handleSearchNf = () => {
        const movements = warehouseLog.filter(m => m.barcode === exitNfBarcodeSearch && m.type === 'entrada');
        if (movements.length === 0) {
            alert('Nenhuma entrada localizada para este código de barras de Nota Fiscal.');
            setFoundNfMovements([]);
            return;
        }
        
        const uniqueItems: WarehouseMovement[] = [];
        const seen = new Set();
        movements.forEach(m => {
            if(!seen.has(m.itemName)){
                uniqueItems.push(m);
                seen.add(m.itemName);
            }
        });

        setFoundNfMovements(uniqueItems);
        setExitQuantities({});
    };

    const handleExitQuantityChange = (itemName: string, value: string) => {
        setExitQuantities(prev => ({ ...prev, [itemName]: value }));
    };

    const handleExitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const balances = getNfBalances(exitNfBarcodeSearch);
        
        setIsSubmitting(true);
        let successCount = 0;

        for (const item of foundNfMovements) {
            const qtyRequested = parseFloat((exitQuantities[item.itemName] || '0').replace(',', '.'));
            if (qtyRequested <= 0) continue;

            const currentBalance = balances[item.itemName] || 0;
            if (qtyRequested > currentBalance) {
                alert(`Erro no item ${item.itemName}: Quantidade solicitada (${qtyRequested}) excede o saldo da nota (${currentBalance.toFixed(2)}).`);
                setIsSubmitting(false);
                return;
            }

            const res = await onRegisterWithdrawal({
                supplierCpf: suppliers.find(s => s.name === item.supplierName)?.cpf || '',
                itemName: item.itemName,
                outboundInvoice: `SAIDA-NF-${item.inboundInvoice}`,
                lotNumber: item.lotNumber,
                quantity: qtyRequested,
                date: exitDate,
                barcode: exitNfBarcodeSearch
            });
            if (res.success) successCount++;
        }

        setIsSubmitting(false);
        alert(`${successCount} item(ns) baixados da NF.`);
        setExitNfBarcodeSearch('');
        setFoundNfMovements([]);
        setExitQuantities({});
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
            <header className="bg-indigo-900 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-[100]">
                <div>
                    <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">Almoxarifado 2026</h1>
                    <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-1">Controle por Nota Fiscal e Etiquetas</p>
                </div>
                <div className="flex items-center gap-4">
                    <nav className="hidden md:flex bg-indigo-800/50 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('entrada')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'entrada' ? 'bg-white text-indigo-900' : 'text-indigo-200 hover:text-white'}`}>Entrada (NF)</button>
                        <button onClick={() => setActiveTab('saida')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'saida' ? 'bg-white text-indigo-900' : 'text-indigo-200 hover:text-white'}`}>Saída (Baixa)</button>
                    </nav>
                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-xl text-xs font-black uppercase transition-all active:scale-95 shadow-lg">Sair</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                
                {activeTab === 'entrada' ? (
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border-t-8 border-green-600 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Cadastro de Entrada (Nota Fiscal)</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase mt-1">Registre a fatura e gere as etiquetas de identificação</p>
                            </div>
                            <button type="button" onClick={() => handlePrintLabel()} disabled={!entryNfBarcode || entryItems.length === 0} className="bg-indigo-900 hover:bg-black text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center gap-2 disabled:bg-slate-200 disabled:text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Imprimir Todas Etiquetas
                            </button>
                        </div>

                        <form onSubmit={handleEntrySubmit} className="space-y-8">
                            {/* Cabeçalho da NF */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fornecedor</label>
                                    <select value={entrySupplierCpf} onChange={e => setEntrySupplierCpf(e.target.value)} className="w-full p-3 border-2 border-white rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-green-500 font-bold text-sm bg-white" required>
                                        <option value="">-- SELECIONE --</option>
                                        {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nº Nota Fiscal</label>
                                    <input type="text" value={entryNfNumber} onChange={e => setEntryNfNumber(e.target.value)} placeholder="Ex: 3684" className="w-full p-3 border-2 border-white rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm bg-white" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-green-600 uppercase ml-1">Código de Barras NF</label>
                                    <input type="text" value={entryNfBarcode} onChange={e => setEntryNfBarcode(e.target.value)} placeholder="Bipar Código da Nota..." className="w-full p-3 border-2 border-green-100 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm bg-white" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data Entrada</label>
                                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-3 border-2 border-white rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white" required />
                                </div>
                            </div>

                            {/* Lista de Itens */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Produtos e Prazos</h3>
                                    <button type="button" onClick={handleAddEntryItem} className="bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">+ Adicionar Produto</button>
                                </div>
                                <div className="space-y-4">
                                    {entryItems.map((item, idx) => (
                                        <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-5 bg-white border-2 border-slate-50 rounded-[2rem] shadow-sm hover:border-green-100 transition-all relative">
                                            <div className="md:col-span-4">
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Item Contratado</label>
                                                <select value={item.itemName} onChange={e => handleEntryItemChange(idx, 'itemName', e.target.value)} className="w-full p-2.5 border rounded-xl bg-slate-50 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-green-500" required disabled={!entrySupplierCpf}>
                                                    <option value="">-- Selecione --</option>
                                                    {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Lote (Opcional)</label>
                                                <input type="text" value={item.lot} onChange={e => handleEntryItemChange(idx, 'lot', e.target.value.toUpperCase())} className="w-full p-2.5 border rounded-xl text-center font-mono text-xs" placeholder="Ex: 1402" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Vencimento</label>
                                                <input type="date" value={item.expirationDate} onChange={e => handleEntryItemChange(idx, 'expirationDate', e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Qtd.</label>
                                                <input type="text" value={item.quantity} onChange={e => handleEntryItemChange(idx, 'quantity', e.target.value.replace(/[^0-9,.]/g, ''))} className="w-full p-2.5 border rounded-xl text-center font-mono font-black text-xs" placeholder="0,00" required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Preço</label>
                                                <input type="text" value={item.unitPrice} onChange={e => handleEntryItemChange(idx, 'unitPrice', e.target.value.replace(/[^0-9,.]/g, ''))} className="w-full p-2.5 border rounded-xl text-center font-mono text-xs" placeholder="0,00" />
                                            </div>
                                            <div className="md:col-span-2 flex items-center gap-2 justify-end">
                                                <button type="button" onClick={() => handlePrintLabel(item)} title="Imprimir Etiqueta" className="p-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-md">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                </button>
                                                <button type="button" onClick={() => handleRemoveEntryItem(idx)} className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all" disabled={entryItems.length === 1}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t">
                                <button type="submit" disabled={isSubmitting || !entrySupplierCpf} className="w-full py-6 bg-green-600 hover:bg-green-700 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400">
                                    {isSubmitting ? 'Gravando e Validando...' : 'Confirmar Recebimento e Salvar NF'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border-t-8 border-orange-500 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Saída de Gêneros (Baixa por NF)</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase mt-1">Use o leitor para bipar a etiqueta e processar a retirada</p>
                        </div>

                        <div className="space-y-8">
                            {/* Busca por Código de Barras */}
                            <div className="bg-orange-50 p-8 rounded-3xl border-2 border-orange-100 flex flex-col md:flex-row items-end gap-4 shadow-inner">
                                <div className="flex-1 w-full space-y-1">
                                    <label className="text-[10px] font-black text-orange-700 uppercase ml-1">Escanear Código de Barras da Nota Fiscal</label>
                                    <input 
                                        type="text" 
                                        value={exitNfBarcodeSearch} 
                                        onChange={e => setExitNfBarcodeSearch(e.target.value)} 
                                        onKeyPress={e => e.key === 'Enter' && handleSearchNf()}
                                        placeholder="Bipar etiqueta da nota..." 
                                        className="w-full h-16 px-6 border-2 border-white rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-orange-200 font-mono text-xl font-black bg-white" 
                                    />
                                </div>
                                <button onClick={handleSearchNf} className="h-16 px-10 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Buscar Itens</button>
                            </div>

                            {foundNfMovements.length > 0 && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem da Nota</p>
                                            <h3 className="text-lg font-black text-slate-700 uppercase">{foundNfMovements[0].supplierName}</h3>
                                            <p className="text-xs font-bold text-slate-400">NF: {foundNfMovements[0].inboundInvoice} • Data Entrada: {foundNfMovements[0].date.split('-').reverse().join('/')}</p>
                                        </div>
                                        <div className="w-full md:w-48">
                                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data da Retirada</label>
                                            <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="w-full p-2 border rounded-xl bg-slate-50 font-bold" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {foundNfMovements.map(item => {
                                            const balances = getNfBalances(exitNfBarcodeSearch);
                                            const balance = balances[item.itemName] || 0;
                                            const currentInput = parseFloat((exitQuantities[item.itemName] || '0').replace(',', '.'));
                                            const isOverBalance = currentInput > balance;

                                            return (
                                                <div key={item.id} className={`p-5 border-2 rounded-3xl transition-all shadow-sm flex flex-col justify-between ${isOverBalance ? 'border-red-500 bg-red-50' : 'border-slate-50 bg-slate-50/30'}`}>
                                                    <div className="mb-4">
                                                        <h4 className="font-black text-slate-800 uppercase text-xs mb-1">{item.itemName}</h4>
                                                        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase">Saldo nesta NF</span>
                                                            <span className={`text-sm font-mono font-black ${balance > 0 ? 'text-green-700' : 'text-slate-400'}`}>{balance.toFixed(2).replace('.', ',')} kg/L</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className={`text-[9px] font-black uppercase ml-1 ${isOverBalance ? 'text-red-600' : 'text-slate-400'}`}>Qtd p/ Retirar</label>
                                                        <input 
                                                            type="text" 
                                                            value={exitQuantities[item.itemName] || ''} 
                                                            onChange={e => handleExitQuantityChange(item.itemName, e.target.value.replace(/[^0-9,.]/g, ''))}
                                                            placeholder="0,00"
                                                            className={`w-full p-3 rounded-xl border-2 font-mono font-black text-center shadow-inner outline-none transition-all ${isOverBalance ? 'border-red-300 bg-white text-red-600 focus:ring-4 focus:ring-red-100' : 'border-white bg-white focus:ring-4 focus:ring-orange-100'}`}
                                                            disabled={balance <= 0}
                                                        />
                                                    </div>
                                                    
                                                    {isOverBalance && (
                                                        <p className="text-[8px] font-black text-red-600 uppercase text-center mt-2 animate-pulse">Quantidade maior que o saldo da nota!</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button 
                                        onClick={handleExitSubmit}
                                        disabled={isSubmitting || foundNfMovements.some(item => (parseFloat((exitQuantities[item.itemName] || '0').replace(',', '.')) || 0) > (getNfBalances(exitNfBarcodeSearch)[item.itemName] || 0))}
                                        className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Processando Saída...' : 'Confirmar Baixa de Itens'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
            
            <style>{`
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.2, 1, 0.3, 1) forwards; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(0); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;
