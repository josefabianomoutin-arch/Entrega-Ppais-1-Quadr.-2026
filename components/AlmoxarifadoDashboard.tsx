
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Supplier, WarehouseMovement, ContractItem } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onLogout: () => void;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
    onResetExits: () => Promise<{ success: boolean; message: string }>;
}

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, warehouseLog, onLogout, onRegisterEntry, onRegisterWithdrawal, onResetExits }) => {
    const [activeTab, setActiveTab] = useState<'manual' | 'receipt' | 'agenda'>('manual');
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
    const [selectedAgendaDate, setSelectedAgendaDate] = useState(new Date().toISOString().split('T')[0]);
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

    const dailyDeliveries = useMemo(() => {
        const list: { supplierName: string; supplierCpf: string; time: string; arrivalTime?: string; status: 'AGENDADO' | 'FATURADO'; id: string }[] = [];
        
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.date === selectedAgendaDate) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    const existing = list.find(l => l.supplierName === s.name && l.time === d.time && l.status === (isFaturado ? 'FATURADO' : 'AGENDADO'));
                    if (!existing) {
                        list.push({
                            id: d.id,
                            supplierName: s.name,
                            supplierCpf: s.cpf,
                            time: d.time,
                            arrivalTime: d.arrivalTime,
                            status: isFaturado ? 'FATURADO' : 'AGENDADO'
                        });
                    }
                }
            });
        });
        return list.sort((a, b) => a.time.localeCompare(b.time));
    }, [suppliers, selectedAgendaDate]);

    const weeklyDeliveries = useMemo(() => {
        const list: { date: string; supplierName: string; time: string; status: 'AGENDADO' | 'FATURADO'; id: string }[] = [];
        
        const current = new Date(selectedAgendaDate + 'T12:00:00');
        const day = current.getDay();
        const diff = current.getDate() - day;
        const startOfWeek = new Date(current.setDate(diff));
        
        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            weekDates.push(d.toISOString().split('T')[0]);
        }

        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (weekDates.includes(d.date)) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    list.push({
                        id: d.id,
                        date: d.date,
                        supplierName: s.name,
                        time: d.time,
                        status: isFaturado ? 'FATURADO' : 'AGENDADO'
                    });
                }
            });
        });
        return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }, [suppliers, selectedAgendaDate]);

    const recentMovements = useMemo(() => {
        const entries = suppliers.flatMap(s => (s.deliveries || [])
            .filter(d => d.item !== 'AGENDAMENTO PENDENTE' && d.invoiceNumber)
            .map(d => ({
                id: d.id,
                type: 'entrada' as const,
                date: d.date,
                timestamp: d.date + 'T' + d.time, // Fallback timestamp
                itemName: d.item || 'N/A',
                supplierName: s.name,
                barcode: d.barcode || '—',
                quantity: d.kg || 0,
                invoice: d.invoiceNumber
            }))
        );

        const exits = warehouseLog
            .filter(l => l.type === 'saída' && l.outboundInvoice)
            .map(l => ({
                id: l.id,
                type: 'saída' as const,
                date: l.date,
                timestamp: l.timestamp,
                itemName: l.itemName,
                supplierName: l.supplierName,
                barcode: l.barcode || '—',
                quantity: l.quantity || 0,
                invoice: l.outboundInvoice
            }));

        const all = [...entries, ...exits];
        
        // Filtra conforme o tipo selecionado no formulário manual
        const filtered = all.filter(m => m.type === manualType);

        return filtered
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 15);
    }, [suppliers, warehouseLog, manualType]);

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
            // Busca nas entregas (notas fiscais) dos fornecedores
            for (const s of suppliers) {
                const foundDelivery = (s.deliveries || []).find(d => d.barcode === barcode);
                if (foundDelivery) {
                    setSelectedSupplierCpf(s.cpf);
                    setSelectedItemName(foundDelivery.item || '');
                    setManualInboundNf(foundDelivery.invoiceNumber || '');
                    
                    // Busca no warehouseLog para pegar lote e validade da entrada original
                    const entryLog = warehouseLog.find(l => l.barcode === barcode && l.type === 'entrada');
                    if (entryLog) {
                        setManualLot(entryLog.lotNumber || '');
                        setManualExp(entryLog.expirationDate || '');
                    }
                    return; // Encontrou, pode parar
                }
            }
        }
    }, [manualBarcode, suppliers, warehouseLog]);

    const receiptSupplier = useMemo(() => suppliers.find(s => s.cpf === receiptSupplierCpf), [suppliers, receiptSupplierCpf]);
    
    const supplierInvoices = useMemo(() => {
        if (!receiptSupplier) return [];
        const invoices = new Set<string>();
        (receiptSupplier.deliveries || []).forEach(d => {
            if (d.invoiceNumber) {
                invoices.add(d.invoiceNumber);
            }
        });
        return Array.from(invoices).sort();
    }, [receiptSupplier]);

    const receiptData = useMemo(() => {
        if (!receiptSupplier || !receiptInvoice) return null;
        const deliveries = (receiptSupplier.deliveries || []).filter(d => 
            d.invoiceNumber === receiptInvoice && d.item !== 'AGENDAMENTO PENDENTE'
        );
        if (deliveries.length === 0) return null;

        const items = deliveries.map(d => {
            const contractItem = receiptSupplier.contractItems.find(ci => ci.name === d.item);
            const unitPrice = contractItem?.valuePerKg || 0;
            const totalValue = (d.kg || 0) * unitPrice;
            
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
                name: d.item || 'N/A',
                quantity: d.kg || 0,
                unit,
                unitPrice,
                totalValue
            };
        });

        const totalInvoiceValue = items.reduce((sum, it) => sum + it.totalValue, 0);
        const invoiceDate = deliveries[0]?.date || ''; 
        const receiptDate = deliveries[0]?.date || ''; // Usando a data da entrega
        const barcode = deliveries.find(d => d.barcode)?.barcode || '';

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
    }, [receiptSupplier, receiptInvoice]);

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
                    inboundInvoice: manualInboundNf,
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
                setManualInboundNf('');
                setManualLot('');
                setManualExp('');
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
                        <button onClick={() => setActiveTab('agenda')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'agenda' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Agenda de Chegadas</button>
                        <button onClick={() => setActiveTab('receipt')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'receipt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Termo de Recebimento</button>
                    </div>
                    <button onClick={onLogout} className="bg-red-50 text-red-600 font-black py-2 px-6 rounded-xl text-xs uppercase border border-red-100 shadow-sm active:scale-95">Sair</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                
                {activeTab === 'manual' ? (
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in">
                        {/* Header do Card com Toggle Moderno */}
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
                                    className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 flex items-center justify-center gap-2 ${manualType === 'entrada' ? 'bg-white text-green-600 shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${manualType === 'entrada' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                    Entrada
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setManualType('saída')} 
                                    className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300 flex items-center justify-center gap-2 ${manualType === 'saída' ? 'bg-white text-red-600 shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${manualType === 'saída' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                    Saída
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleManualSubmit} className="p-6 md:p-8 space-y-10">
                            {/* Seção 1: Dados do Documento */}
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
                                            className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer"
                                        >
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
                                            className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm" 
                                        />
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
                                            className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-mono font-bold outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-sm placeholder:text-gray-300" 
                                        />
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
                                                disabled={!selectedSupplierCpf}
                                            >
                                                <option value="">-- SELECIONE A NF DE ENTRADA --</option>
                                                {manualSupplierInvoices.map(nf => <option key={nf} value={nf}>NF {nf}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Seção 2: Dados do Item e Bipagem */}
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
                                            placeholder="Aguardando leitura..." 
                                            className="w-full h-20 px-6 border-2 border-blue-100 rounded-3xl bg-white font-mono font-bold focus:ring-8 focus:ring-blue-50 outline-none text-lg placeholder:text-blue-200 transition-all shadow-sm" 
                                        />
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
                                            required 
                                        />
                                        <div className="absolute bottom-2 left-0 right-0 text-center">
                                            <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Digital Display</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Seção 3: Lote e Validade */}
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
                                        className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl bg-white font-mono font-bold outline-none focus:ring-4 focus:ring-gray-50 transition-all text-sm" 
                                    />
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
                                        className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl bg-white font-bold outline-none focus:ring-4 focus:ring-gray-50 transition-all text-sm" 
                                    />
                                </div>

                                <div className="flex items-end">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting || !selectedSupplierCpf || !selectedItemName} 
                                        className={`w-full h-14 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 text-white flex items-center justify-center gap-3 ${manualType === 'entrada' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                    >
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
                ) : activeTab === 'agenda' ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Seletor de Data Estilizado (Copiado da Subportaria) */}
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div>
                                    <h2 className="text-2xl font-black text-indigo-950 uppercase tracking-tighter italic">Agenda de Chegadas</h2>
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Visualização de Entregas Programadas</p>
                                </div>
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                                        <span className="text-xs font-black text-indigo-600 uppercase">{dailyDeliveries.length} Veículos</span>
                                    </div>
                                    <input 
                                        type="date" 
                                        value={selectedAgendaDate} 
                                        onChange={e => setSelectedAgendaDate(e.target.value)}
                                        className="p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-black text-indigo-900 transition-all text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Lista de Cards (Copiado da Subportaria) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {dailyDeliveries.length > 0 ? dailyDeliveries.map(item => (
                                <div 
                                    key={item.id} 
                                    className={`relative overflow-hidden bg-white rounded-[2rem] shadow-md border-2 transition-all ${
                                        item.status === 'FATURADO' 
                                            ? 'border-indigo-100 opacity-80' 
                                            : item.arrivalTime 
                                                ? 'border-green-200 bg-green-50/30' 
                                                : 'border-white'
                                    }`}
                                >
                                    <div className={`absolute top-0 left-0 w-2 h-full ${
                                        item.status === 'FATURADO' ? 'bg-indigo-900' : item.arrivalTime ? 'bg-green-500' : 'bg-slate-200'
                                    }`} />

                                    <div className="p-5 pl-7">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`px-4 py-2 rounded-xl text-lg font-black font-mono shadow-sm ${
                                                item.status === 'FATURADO' 
                                                    ? 'bg-indigo-900 text-white' 
                                                    : item.arrivalTime 
                                                        ? 'bg-green-600 text-white' 
                                                        : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {item.time}
                                            </div>
                                            
                                            <div className="text-right">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                    item.status === 'FATURADO' 
                                                        ? 'bg-indigo-100 text-indigo-700' 
                                                        : item.arrivalTime 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {item.status === 'FATURADO' ? '✓ Descarregado' : item.arrivalTime ? '● No Pátio' : '○ Aguardando'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fornecedor</p>
                                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight break-words">{item.supplierName}</h3>
                                        </div>

                                        {item.arrivalTime && (
                                            <div className="flex items-center gap-2 bg-white/60 p-3 rounded-2xl border border-green-100">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                <p className="text-xs font-bold text-green-700 uppercase">
                                                    Entrada registrada às <span className="text-sm font-black">{item.arrivalTime}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="md:col-span-2 text-center py-20 bg-white/50 rounded-[3rem] border-4 border-dashed border-slate-200">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Nenhum agendamento para esta data</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in">
                        <div className="p-6 md:p-8 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-teal-100 text-teal-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">Termo de Recebimento</h2>
                                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1 italic">Geração de Documento Oficial de Conferência</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={handlePrintReceipt}
                                disabled={!receiptData}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl shadow-teal-100 active:scale-95 disabled:bg-gray-100 disabled:text-gray-300 uppercase tracking-[0.2em] text-[10px] flex items-center gap-3"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Imprimir Termo
                            </button>
                        </div>

                        <div className="p-6 md:p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                        1. Selecionar Fornecedor
                                    </label>
                                    <select 
                                        value={receiptSupplierCpf} 
                                        onChange={e => { setReceiptSupplierCpf(e.target.value); setReceiptInvoice(''); }} 
                                        className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-teal-100 transition-all text-sm appearance-none cursor-pointer"
                                    >
                                        <option value="">-- SELECIONE O FORNECEDOR --</option>
                                        {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                        2. Selecionar Nota Fiscal
                                    </label>
                                    <select 
                                        value={receiptInvoice} 
                                        onChange={e => setReceiptInvoice(e.target.value)} 
                                        className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-teal-100 transition-all text-sm disabled:opacity-50 appearance-none cursor-pointer" 
                                        disabled={!receiptSupplierCpf}
                                    >
                                        <option value="">-- SELECIONE A NF --</option>
                                        {supplierInvoices.map(nf => <option key={nf} value={nf}>NF {nf}</option>)}
                                    </select>
                                </div>
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

                {/* Tabela de Movimentações Recentes ou Agenda da Semana */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                            {activeTab === 'agenda' ? (
                                <>
                                    <div className="w-2 h-2 rounded-full animate-pulse bg-indigo-600"></div>
                                    Agendamentos da Semana (Grade Completa)
                                </>
                            ) : (
                                <>
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${manualType === 'entrada' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                                    Últimos Registros de Notas Fiscais ({manualType === 'entrada' ? 'Entradas' : 'Saídas'})
                                </>
                            )}
                        </h3>
                        {activeTab !== 'agenda' && manualType === 'saída' && (
                            <button 
                                onClick={async () => {
                                    if (window.confirm('Deseja realmente ZERAR todos os registros de saída de Notas Fiscais? Esta ação não pode ser desfeita.')) {
                                        const res = await onResetExits();
                                        if (res.success) alert(res.message);
                                        else alert(res.message);
                                    }
                                }}
                                className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-red-100 shadow-sm"
                            >
                                Zerar Saídas (Reiniciar)
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto rounded-xl">
                        {activeTab === 'agenda' ? (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-900 text-[10px] font-black uppercase text-slate-100 tracking-widest">
                                        <th className="p-4 text-left">Data</th>
                                        <th className="p-4 text-left">Horário</th>
                                        <th className="p-4 text-left">Fornecedor</th>
                                        <th className="p-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {weeklyDeliveries.length > 0 ? weeklyDeliveries.map(item => (
                                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-4 text-xs text-slate-700 font-mono font-bold">{item.date.split('-').reverse().join('/')}</td>
                                            <td className="p-4 text-xs font-mono text-indigo-800 font-black">{item.time}</td>
                                            <td className="p-4 font-bold text-slate-900 uppercase text-xs">{item.supplierName}</td>
                                            <td className="p-4 text-center">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                    item.status === 'FATURADO' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {item.status === 'FATURADO' ? '✓ Descarregado' : '○ Aguardando'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">Nenhum agendamento para esta semana...</td></tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
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
                                            <td className="p-4 text-xs text-gray-500 font-mono">{mov.invoice || 'N/A'}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Aguardando novos lançamentos...</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </main>
            <style>{`
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;