
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Supplier, WarehouseMovement, ContractItem } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onLogout: () => void;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, warehouseLog, onLogout, onRegisterEntry, onRegisterWithdrawal }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'receipt'>('manual');
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Estados para o formulário manual/individual
    const [manualType, setManualType] = useState<'entrada' | 'saída'>('entrada');
    const [selectedSupplierCpf, setSelectedSupplierCpf] = useState('');
    const [selectedItemName, setSelectedItemName] = useState('');
    const [manualBarcode, setManualBarcode] = useState('');
    const [manualQuantity, setManualQuantity] = useState('');
    const [manualNf, setManualNf] = useState('');
    const [manualLot, setManualLot] = useState('');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualExp, setManualExp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estados para o Termo de Recebimento
    const [receiptSupplierCpf, setReceiptSupplierCpf] = useState('');
    const [receiptInvoice, setReceiptInvoice] = useState('');

    // Efeito para auto-focar o campo de barras ao trocar de tipo ou carregar
    useEffect(() => {
        if (activeTab === 'manual') {
            barcodeInputRef.current?.focus();
        }
    }, [activeTab, manualType]);

    const recentMovements = useMemo(() => {
        return warehouseLog
            .slice()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 15);
    }, [warehouseLog]);

    const selectedSupplier = useMemo(() => 
        suppliers.find(s => s.cpf === selectedSupplierCpf), 
    [suppliers, selectedSupplierCpf]);

    const availableItems = useMemo(() => {
        if (selectedSupplier) {
            return (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name));
        }
        // Se for saída e nenhum fornecedor selecionado, podemos listar todos os itens de todos os fornecedores
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

    // Efeito para buscar item automaticamente pelo código de barras
    useEffect(() => {
        const barcode = manualBarcode.trim();
        if (barcode.length >= 8) {
            // Busca nas movimentações de entrada para localizar o item e fornecedor
            const found = warehouseLog.find(m => m.barcode === barcode && m.type === 'entrada');
            if (found) {
                const supplier = suppliers.find(s => s.name === found.supplierName);
                if (supplier) {
                    setSelectedSupplierCpf(supplier.cpf);
                    setSelectedItemName(found.itemName);
                }
            }
        }
    }, [manualBarcode, warehouseLog, suppliers]);

    const receiptSupplier = useMemo(() => suppliers.find(s => s.cpf === receiptSupplierCpf), [suppliers, receiptSupplierCpf]);
    
    const supplierInvoices = useMemo(() => {
        if (!receiptSupplier) return [];
        const invoices = new Set<string>();
        warehouseLog.forEach(log => {
            if (log.type === 'entrada' && log.supplierName === receiptSupplier.name && log.inboundInvoice) {
                invoices.add(log.inboundInvoice);
            }
        });
        return Array.from(invoices).sort();
    }, [receiptSupplier, warehouseLog]);

    const receiptData = useMemo(() => {
        if (!receiptSupplier || !receiptInvoice) return null;
        const entries = warehouseLog.filter(log => 
            log.type === 'entrada' && 
            log.supplierName === receiptSupplier.name && 
            log.inboundInvoice === receiptInvoice
        );
        if (entries.length === 0) return null;

        const items = entries.map(entry => {
            const contractItem = receiptSupplier.contractItems.find(ci => ci.name === entry.itemName);
            const unitPrice = contractItem?.valuePerKg || 0;
            const totalValue = (entry.quantity || 0) * unitPrice;
            
            // Determinar unidade de exibição
            let unit = 'Kg';
            if (contractItem?.unit) {
                const [unitType] = contractItem.unit.split('-');
                const unitMap: { [key: string]: string } = {
                    kg: 'Kg', un: 'Un', saco: 'Sc', balde: 'Bd', pacote: 'Pct', pote: 'Pt',
                    litro: 'L', l: 'L', caixa: 'Cx', embalagem: 'Emb', dz: 'Dz'
                };
                unit = unitMap[unitType] || 'Un';
            }

            return {
                name: entry.itemName,
                quantity: entry.quantity || 0,
                unit,
                unitPrice,
                totalValue
            };
        });

        const totalInvoiceValue = items.reduce((sum, it) => sum + it.totalValue, 0);
        const invoiceDate = entries[0]?.date || ''; 
        const receiptDate = (entries[0]?.timestamp || '').split('T')[0] || '';
        const barcode = entries[0]?.barcode || '';

        return {
            supplierName: receiptSupplier.name,
            supplierCpf: receiptSupplier.cpf,
            invoiceNumber: receiptInvoice,
            invoiceDate,
            receiptDate,
            totalInvoiceValue,
            items,
            barcode
        };
    }, [receiptSupplier, receiptInvoice, warehouseLog]);

    const handlePrintReceipt = () => {
        if (!receiptData) return;
        
        const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
        const formatDate = (dateStr: string) => (dateStr || '').split('-').reverse().join('/') || 'N/A';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita popups para imprimir o termo.');
            return;
        }

        const htmlContent = `
            <html>
            <head>
                <title>Termo de Recebimento - NF ${receiptData.invoiceNumber}</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 20mm; line-height: 1.5; color: #000; font-size: 12pt; }
                    .header { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .info-section { margin-bottom: 20px; }
                    .info-row { margin-bottom: 5px; }
                    .info-label { font-weight: bold; text-transform: uppercase; display: inline-block; width: 220px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
                    th, td { border: 1px solid #000; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; text-transform: uppercase; font-weight: bold; }
                    .text-right { text-align: right; }
                    .footer-text { margin-top: 30px; text-align: justify; }
                    .signature-section { margin-top: 60px; text-align: center; }
                    .signature-line { border-top: 1px solid #000; width: 300px; margin: 0 auto 10px auto; }
                    .location-date { margin-top: 40px; text-align: center; font-weight: bold; }
                    .barcode-section { margin-top: 40px; text-align: center; display: flex; flex-direction: column; align-items: center; }
                    .barcode-svg { max-width: 100%; height: 15mm !important; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    ATESTAMOS O RECEBIMENTO DOS MATERIAIS/SERVIÇOS RELACIONADOS, ENTREGA PELA EMPRESA:
                </div>

                <div class="info-section">
                    <div class="info-row"><span class="info-label">FORNECEDOR:</span> ${receiptData.supplierName}</div>
                    <div class="info-row"><span class="info-label">C.N.P.J.:</span> ${receiptData.supplierCpf}</div>
                    <div class="info-row"><span class="info-label">NOTA FISCAL Nº:</span> ${receiptData.invoiceNumber}</div>
                    <div class="info-row"><span class="info-label">DATA NOTA FISCAL:</span> ${formatDate(receiptData.invoiceDate)}</div>
                    <div class="info-row"><span class="info-label">DATA RECEBIMENTO:</span> ${formatDate(receiptData.receiptDate)}</div>
                    <div class="info-row"><span class="info-label">VALOR TOTAL NOTA FISCAL:</span> ${formatCurrency(receiptData.totalInvoiceValue)}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>ITEM</th>
                            <th>QUANT.</th>
                            <th>UNID.</th>
                            <th>DESCRIÇÃO</th>
                            <th>VR.UNIT.</th>
                            <th>VR. TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receiptData.items.map((it, idx) => `
                            <tr>
                                <td style="text-align: center;">${String(idx + 1).padStart(2, '0')}</td>
                                <td class="text-right">${(it.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td style="text-align: center;">${it.unit || 'N/A'}</td>
                                <td>${it.name || 'N/A'}</td>
                                <td class="text-right">${formatCurrency(it.unitPrice)}</td>
                                <td class="text-right">${formatCurrency(it.totalValue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="text-right" style="font-weight: bold;">TOTAL GERAL:</td>
                            <td class="text-right" style="font-weight: bold;">${formatCurrency(receiptData.totalInvoiceValue)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="footer-text">
                    Recebemos em ordem e na quantidade devida os materiais/serviços acima discriminados, os quais foram inspecionados pela comissão de recepção materiais, foi considerado de acordo com solicitado, satisfazendo as especificações e demais exigências do empenho conforme determina o inciso II do artigo 140 da lei nº 14.133/21.
                </div>

                <div class="location-date">
                    TAIÚVA, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
                </div>

                <div class="signature-section">
                    <p style="font-weight: bold; margin-bottom: 40px; text-transform: uppercase;">COMISSÃO DE RECEPÇÃO DE MATERIAIS/SERVIÇOS</p>
                    <div class="signature-line"></div>
                    <p style="font-weight: bold; margin: 0;">FERNANDO RODRIGUES SOARES</p>
                    <p style="margin: 0;">CPF: 347.810.448-32</p>
                    <p style="margin: 0;">PRESIDENTE</p>
                </div>

                ${receiptData.barcode ? `
                <div class="barcode-section">
                    <svg id="barcode-receipt" class="barcode-svg"></svg>
                    <p style="font-size: 8pt; margin-top: 2mm; font-family: monospace;">${receiptData.barcode}</p>
                </div>
                ` : ''}

                <script>
                    window.onload = function() {
                        ${receiptData.barcode ? `
                        try {
                            JsBarcode("#barcode-receipt", "${receiptData.barcode}", {
                                format: "CODE128",
                                width: 2,
                                height: 40,
                                displayValue: false,
                                margin: 0
                            });
                        } catch (e) { console.error(e); }
                        ` : ''}
                        
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

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
                    lotNumber: manualLot || 'UNICO',
                    quantity: qtyVal,
                    expirationDate: manualExp,
                    date: manualDate,
                    barcode: manualBarcode
                });

            if (res.success) {
                // Limpa campos específicos para facilitar bipagem sequencial
                setManualBarcode('');
                setManualQuantity('');
                // Mantém Fornecedor, Data e NF para evitar redigitação se for a mesma carga
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
        <div className="min-h-screen bg-gray-100 text-gray-800 pb-20">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-20 border-b-2 border-indigo-100">
                <div>
                    <h1 className="text-xl font-bold text-indigo-900 uppercase tracking-tighter leading-none">Módulo de Estoque</h1>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1">Controle de Dados Finanças 2026</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('manual')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Bipagem / Manual</button>
                        <button onClick={() => setActiveTab('receipt')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'receipt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Termo de Recebimento</button>
                    </div>
                    <button onClick={onLogout} className="bg-red-50 text-red-600 font-black py-2 px-6 rounded-xl text-xs uppercase border border-red-100 shadow-sm active:scale-95">Sair</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                
                {activeTab === 'manual' ? (
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-indigo-600 animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b pb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Lançamento por Código de Barras</h2>
                                <p className="text-gray-500 font-medium italic text-xs">Vincule Itens, Notas Fiscais e Lotes através da bipagem rápida.</p>
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner scale-90 sm:scale-100">
                                <button type="button" onClick={() => setManualType('entrada')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${manualType === 'entrada' ? 'bg-white text-green-600 shadow-md' : 'text-gray-400'}`}>Entrada (Compra)</button>
                                <button type="button" onClick={() => setManualType('saída')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${manualType === 'saída' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'}`}>Saída (Consumo)</button>
                            </div>
                        </div>

                        <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-8">
                            {/* Bloco 1: Identificação da Carga */}
                            <div className="space-y-4 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                                        {manualType === 'entrada' ? '1. Fornecedor / Origem' : '1. Origem (Fornecedor)'}
                                    </label>
                                    <select value={selectedSupplierCpf} onChange={e => { setSelectedSupplierCpf(e.target.value); setSelectedItemName(''); }} className="w-full p-3 border rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-indigo-400 text-sm">
                                        <option value="">-- SELECIONE --</option>
                                        {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">2. Data do Documento</label>
                                    <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                                        {manualType === 'entrada' ? '3. Número da Nota Fiscal' : '3. Nº Requisição / Ordem'}
                                    </label>
                                    <input type="text" value={manualNf} onChange={e => setManualNf(e.target.value)} placeholder={manualType === 'entrada' ? "Nº da Nota / Cupom" : "Nº do Pedido / Destino"} className="w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-mono" />
                                </div>
                            </div>

                            {/* Bloco 2: O Item (Bipagem) */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">4. Selecionar Item do Contrato</label>
                                <select 
                                    value={selectedItemName} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (manualType === 'saída' && !selectedSupplierCpf) {
                                            // Se for saída global, o valor contém o CPF do fornecedor
                                            const [itemName, supplierCpf] = val.split('|');
                                            setSelectedSupplierCpf(supplierCpf);
                                            setSelectedItemName(itemName);
                                        } else {
                                            setSelectedItemName(val);
                                        }
                                    }} 
                                    className="w-full p-4 border-2 border-indigo-50 rounded-xl bg-white font-black outline-none focus:ring-2 focus:ring-indigo-400 text-sm disabled:opacity-50" 
                                    disabled={manualType === 'entrada' && !selectedSupplierCpf}
                                >
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

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-blue-600 uppercase ml-1 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zM11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2H10a1 1 0 01-1-1zM7 11a1 1 0 100-2H4a1 1 0 100 2h3z" /></svg>
                                    5. Código de Barras (Bipar)
                                </label>
                                <input ref={barcodeInputRef} type="text" value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} placeholder="Passe o leitor de barras..." className="w-full p-4 border-2 border-indigo-50 rounded-xl bg-white font-mono focus:ring-4 focus:ring-indigo-100 outline-none text-sm placeholder:italic" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">6. Quantidade / Peso</label>
                                <input type="text" value={manualQuantity} onChange={e => setManualQuantity(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" className="w-full p-4 border-2 border-indigo-50 rounded-xl bg-indigo-50 font-black text-center text-xl outline-none focus:ring-2 focus:ring-indigo-400" required />
                            </div>

                            {/* Bloco 3: Dados Complementares */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">7. Lote (Se houver)</label>
                                <input type="text" value={manualLot} onChange={e => setManualLot(e.target.value.toUpperCase())} placeholder="OPCIONAL" className="w-full p-3 border rounded-xl bg-gray-50 font-mono outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">8. Validade (Se houver)</label>
                                <input type="date" value={manualExp} onChange={e => setManualExp(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                            </div>

                            <div className="flex items-end">
                                <button type="submit" disabled={isSubmitting || !selectedSupplierCpf || !selectedItemName} className={`w-full py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-lg transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 text-white ${manualType === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                    {isSubmitting ? 'Gravando...' : `Confirmar Lançamento`}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-teal-600 animate-fade-in space-y-8">
                        <div className="flex justify-between items-center border-b pb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Termo de Recebimento</h2>
                                <p className="text-gray-500 font-medium text-xs">Gere o documento oficial de conferência e ateste de materiais.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={handlePrintReceipt}
                                disabled={!receiptData}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-black py-3 px-8 rounded-2xl transition-all shadow-lg active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 uppercase tracking-widest text-xs flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
                                Imprimir Termo
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">1. Selecionar Fornecedor</label>
                                <select value={receiptSupplierCpf} onChange={e => { setReceiptSupplierCpf(e.target.value); setReceiptInvoice(''); }} className="w-full p-3 border rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-teal-400 text-sm">
                                    <option value="">-- SELECIONE O FORNECEDOR --</option>
                                    {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">2. Selecionar Nota Fiscal</label>
                                <select value={receiptInvoice} onChange={e => setReceiptInvoice(e.target.value)} className="w-full p-3 border rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-teal-400 text-sm disabled:opacity-50" disabled={!receiptSupplierCpf}>
                                    <option value="">-- SELECIONE A NF --</option>
                                    {supplierInvoices.map(nf => <option key={nf} value={nf}>NF {nf}</option>)}
                                </select>
                            </div>
                        </div>

                        {receiptData ? (
                            <div className="border-2 border-dashed border-gray-200 rounded-3xl p-8 bg-white shadow-inner max-h-[500px] overflow-y-auto custom-scrollbar">
                                <div className="max-w-3xl mx-auto space-y-8 text-gray-800 font-serif">
                                    <div className="text-center font-bold uppercase border-b-2 border-black pb-4">
                                        ATESTAMOS O RECEBIMENTO DOS MATERIAIS/SERVIÇOS RELACIONADOS, ENTREGA PELA EMPRESA:
                                    </div>

                                    <div className="space-y-2 uppercase text-sm">
                                        <p><span className="font-bold inline-block w-48">FORNECEDOR:</span> {receiptData.supplierName || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">C.N.P.J.:</span> {receiptData.supplierCpf || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">NOTA FISCAL Nº:</span> {receiptData.invoiceNumber || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">DATA NOTA FISCAL:</span> {(receiptData.invoiceDate || '').split('-').reverse().join('/') || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">DATA RECEBIMENTO:</span> {(receiptData.receiptDate || '').split('-').reverse().join('/') || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">VALOR TOTAL NF:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receiptData.totalInvoiceValue || 0)}</p>
                                        <p><span className="font-bold inline-block w-48">CÓD. BARRAS NF:</span> {receiptData.barcode || 'N/A'}</p>
                                    </div>

                                    <table className="w-full border-collapse border border-black text-[10px]">
                                        <thead>
                                            <tr className="bg-gray-100 uppercase font-bold">
                                                <th className="border border-black p-1">ITEM</th>
                                                <th className="border border-black p-1">QUANT.</th>
                                                <th className="border border-black p-1">UNID.</th>
                                                <th className="border border-black p-1">DESCRIÇÃO</th>
                                                <th className="border border-black p-1">VR.UNIT.</th>
                                                <th className="border border-black p-1">VR. TOTAL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {receiptData.items.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                                                    <td className="border border-black p-1 text-right">{(it.quantity || 0).toFixed(2)}</td>
                                                    <td className="border border-black p-1 text-center">{it.unit || 'N/A'}</td>
                                                    <td className="border border-black p-1">{it.name || 'N/A'}</td>
                                                    <td className="border border-black p-1 text-right">{(it.unitPrice || 0).toFixed(2)}</td>
                                                    <td className="border border-black p-1 text-right">{(it.totalValue || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="text-xs text-justify leading-relaxed">
                                        Recebemos em ordem e na quantidade devida os materiais/serviços acima discriminados, os quais foram inspecionados pela comissão de recepção materiais, foi considerado de acordo com solicitado, satisfazendo as especificações e demais exigências do empenho conforme determina o inciso II do artigo 140 da lei nº 14.133/21.
                                    </div>

                                    <div className="text-center font-bold pt-4">
                                        TAIÚVA, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
                                    </div>

                                    <div className="text-center space-y-1 pt-8">
                                        <p className="font-bold uppercase">COMISSÃO DE RECEPÇÃO DE MATERIAIS/SERVIÇOS</p>
                                        <div className="w-64 h-px bg-black mx-auto mt-8 mb-2"></div>
                                        <p className="font-bold">FERNANDO RODRIGUES SOARES</p>
                                        <p>CPF: 347.810.448-32</p>
                                        <p>PRESIDENTE</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold uppercase tracking-widest">Selecione um fornecedor e uma nota fiscal para visualizar o termo.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabela de Movimentações Recentes */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                    <h3 className="text-xl font-black text-gray-800 uppercase mb-6 tracking-tight border-b pb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                        Últimos Registros de Estoque
                    </h3>
                    <div className="overflow-x-auto rounded-xl">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-900 text-[10px] font-black uppercase text-slate-100 tracking-widest">
                                    <th className="p-4 text-left">Fluxo</th>
                                    <th className="p-4 text-left">Documento</th>
                                    <th className="p-4 text-left">Item / Fornecedor</th>
                                    <th className="p-4 text-left">Cód. Barras</th>
                                    <th className="p-4 text-right">Peso/Qtd</th>
                                    <th className="p-4 text-left">NF/Cupom</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentMovements.length > 0 ? recentMovements.map(mov => (
                                    <tr key={mov.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="p-4">
                                            {mov.type === 'entrada' ? (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Entrada</span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Saída</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-slate-700 font-mono font-bold">{(mov.date || '').split('-').reverse().join('/')}</td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-900 uppercase text-xs">{mov.itemName}</p>
                                            <p className="text-[9px] text-indigo-400 uppercase font-bold">{mov.supplierName}</p>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-indigo-800 font-black">{mov.barcode || '—'}</td>
                                        <td className="p-4 text-right font-mono font-black text-slate-800">
                                            {(mov.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500 font-mono">{mov.inboundInvoice || mov.outboundInvoice || 'N/A'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Aguardando novos lançamentos...</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            <style>{`.animate-fade-in { animation: fade-in 0.5s ease-out forwards; } @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;