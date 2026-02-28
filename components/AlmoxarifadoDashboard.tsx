
import React, { useState, useMemo, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import type { Supplier, WarehouseMovement, ContractItem, ThirdPartyEntryLog } from '../types';
import AdminInvoices from './AdminInvoices';
import AgendaChegadas from './AgendaChegadas';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onLogout: () => void;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
    onResetExits: () => Promise<{ success: boolean; message: string }>;
    onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onDeleteInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onUpdateInvoiceItems: (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, newInvoiceNumber?: string, newDate?: string, receiptTermNumber?: string, invoiceDate?: string) => Promise<{ success: boolean; message?: string }>;
    onManualInvoiceEntry: (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, receiptTermNumber?: string, invoiceDate?: string) => Promise<{ success: boolean; message?: string }>;
    thirdPartyEntries: ThirdPartyEntryLog[];
}

const Barcode: React.FC<{ value: string }> = ({ value }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: 1.5,
                    height: 30,
                    displayValue: true,
                    fontSize: 12,
                    margin: 0
                });
            } catch (e) {
                console.error("Barcode generation error:", e);
            }
        }
    }, [value]);

    return <svg ref={svgRef}></svg>;
};

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ 
    suppliers, 
    warehouseLog, 
    onLogout, 
    onRegisterEntry, 
    onRegisterWithdrawal, 
    onResetExits,
    onReopenInvoice,
    onDeleteInvoice,
    onUpdateInvoiceItems,
    onManualInvoiceEntry,
    thirdPartyEntries
}) => {
    const [activeTab, setActiveTab] = useState<'entry' | 'exit' | 'receipt' | 'agenda'>('entry');
    const [selectedAgendaDate, setSelectedAgendaDate] = useState(new Date().toISOString().split('T')[0]);
    const [receiptSupplierCpf, setReceiptSupplierCpf] = useState('');
    const [receiptInvoice, setReceiptInvoice] = useState('');
    const [receiptProcessoSei, setReceiptProcessoSei] = useState('');

    const [isScheduleReportOpen, setIsScheduleReportOpen] = useState(false);
    const [scheduleReportSeiNumber, setScheduleReportSeiNumber] = useState('');
    const [selectedScheduleSuppliers, setSelectedScheduleSuppliers] = useState<string[]>([]);

    const dailyDeliveries = useMemo(() => {
        const list: { supplierName: string; supplierCpf: string; time: string; arrivalTime?: string; status: 'AGENDADO' | 'CONCLUÍDO' | 'TERCEIRO' | 'CANCELADO'; id: string; type: 'FORNECEDOR' | 'TERCEIRO' }[] = [];
        
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.date === selectedAgendaDate) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    const status = isFaturado ? 'CONCLUÍDO' : 'AGENDADO';
                    const existing = list.find(l => l.supplierName === s.name && l.time === d.time && l.status === status);
                    if (!existing) {
                        list.push({
                            id: d.id,
                            supplierName: s.name,
                            supplierCpf: s.cpf,
                            time: d.time,
                            arrivalTime: d.arrivalTime,
                            status: status,
                            type: 'FORNECEDOR'
                        });
                    }
                }
            });
        });

        (thirdPartyEntries || []).forEach(log => {
            if (log.date === selectedAgendaDate) {
                let status: 'AGENDADO' | 'CONCLUÍDO' | 'TERCEIRO' | 'CANCELADO' = 'TERCEIRO';
                if (log.status === 'concluido') status = 'CONCLUÍDO';
                else if (log.status === 'cancelado') status = 'CANCELADO';
                else if (log.status === 'agendado') status = 'AGENDADO';

                list.push({
                    id: log.id,
                    supplierName: log.companyName,
                    supplierCpf: log.companyCnpj,
                    time: log.time || '00:00',
                    arrivalTime: log.arrivalTime,
                    status: status,
                    type: 'TERCEIRO'
                });
            }
        });

        return list.sort((a, b) => a.time.localeCompare(b.time));
    }, [suppliers, thirdPartyEntries, selectedAgendaDate]);

    const weeklyDeliveries = useMemo(() => {
        const list: { date: string; supplierName: string; time: string; status: 'AGENDADO' | 'CONCLUÍDO' | 'TERCEIRO' | 'CANCELADO'; id: string; type: 'FORNECEDOR' | 'TERCEIRO'; itemName?: string }[] = [];
        
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
                        status: isFaturado ? 'CONCLUÍDO' : 'AGENDADO',
                        type: 'FORNECEDOR',
                        itemName: d.item
                    });
                }
            });
        });

        (thirdPartyEntries || []).forEach(log => {
            if (weekDates.includes(log.date)) {
                let status: 'AGENDADO' | 'CONCLUÍDO' | 'TERCEIRO' | 'CANCELADO' = 'TERCEIRO';
                if (log.status === 'concluido') status = 'CONCLUÍDO';
                else if (log.status === 'cancelado') status = 'CANCELADO';
                else if (log.status === 'agendado') status = 'AGENDADO';

                list.push({
                    id: log.id,
                    date: log.date,
                    supplierName: log.companyName,
                    time: log.time || '00:00',
                    status: status,
                    type: 'TERCEIRO',
                    itemName: 'ENTRADA DE TERCEIROS'
                });
            }
        });

        return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }, [suppliers, thirdPartyEntries, selectedAgendaDate]);

    const uniqueWeeklySuppliers = useMemo(() => {
        const suppliersMap = new Set<string>();
        weeklyDeliveries.forEach(d => {
            if (d.type === 'FORNECEDOR') {
                suppliersMap.add(d.supplierName);
            }
        });
        return Array.from(suppliersMap).sort();
    }, [weeklyDeliveries]);

    const handlePrintScheduleReport = () => {
        const filteredDeliveries = weeklyDeliveries.filter(d => 
            d.type === 'FORNECEDOR' && selectedScheduleSuppliers.includes(d.supplierName)
        );

        if (filteredDeliveries.length === 0) {
            alert('Nenhum agendamento encontrado para os produtores selecionados.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita popups para imprimir o cronograma.');
            return;
        }

        const htmlContent = `
            <html>
            <head>
                <title>Cronograma de Entregas</title>
                <style>
                    @page { 
                        size: A4; 
                        margin: 0; 
                    }
                    @media print {
                        header, footer { display: none !important; }
                    }
                    body { 
                        font-family: 'Times New Roman', Times, serif; 
                        padding: 20mm; 
                        line-height: 1.5; 
                        color: #000; 
                        font-size: 12pt; 
                        margin: 0;
                    }
                    .header { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .info-section { margin-bottom: 20px; }
                    .info-row { margin-bottom: 5px; }
                    .info-label { font-weight: bold; text-transform: uppercase; display: inline-block; width: 220px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
                    th, td { border: 1px solid #000; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; text-transform: uppercase; font-weight: bold; }
                    .text-center { text-align: center; }
                    .footer-text { margin-top: 30px; text-align: justify; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    CRONOGRAMA DE ENTREGAS
                </div>

                <div class="info-section">
                    <div class="info-row"><span class="info-label">PROCESSO SEI Nº:</span> ${scheduleReportSeiNumber || 'N/A'}</div>
                    <div class="info-row"><span class="info-label">DATA DE EMISSÃO:</span> ${new Date().toLocaleDateString('pt-BR')}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>DATA</th>
                            <th>HORÁRIO</th>
                            <th>PRODUTOR</th>
                            <th>ITEM AGENDADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredDeliveries.map(d => `
                            <tr>
                                <td class="text-center">${d.date.split('-').reverse().join('/')}</td>
                                <td class="text-center">${d.time}</td>
                                <td>${d.supplierName}</td>
                                <td>${d.itemName || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer-text">
                    <p>Cronograma gerado para conferência e acompanhamento das entregas de gêneros alimentícios.</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            // printWindow.close(); // Optional: keep open for review
        }, 500);
    };



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
        const invoiceDate = deliveries.find(d => d.invoiceDate)?.invoiceDate || deliveries[0]?.date || ''; 
        const receiptDate = invoiceDate; // Data do documento igual a data de recebimento (que é a data da NF)
        const barcode = deliveries.find(d => d.barcode)?.barcode || '';
        const receiptTermNumber = deliveries.find(d => d.receiptTermNumber)?.receiptTermNumber || '';

        return {
            supplierName: receiptSupplier.name,
            supplierCpf: receiptSupplier.cpf,
            invoiceNumber: receiptInvoice,
            invoiceDate,
            receiptDate,
            totalInvoiceValue,
            items,
            barcode,
            receiptTermNumber,
            processoSei: receiptProcessoSei
        };
    }, [receiptSupplier, receiptInvoice, receiptProcessoSei]);

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
                    @page { 
                        size: A4; 
                        margin: 0; 
                    }
                    @media print {
                        header, footer { display: none !important; }
                    }
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 0; 
                        margin: 0;
                        background: white;
                    }
                    .page {
                        width: 210mm;
                        min-height: 297mm;
                        padding: 15mm;
                        margin: 0 auto;
                        box-sizing: border-box;
                        background: white;
                    }
                    .header { 
                        text-align: center; 
                        font-weight: bold; 
                        text-transform: uppercase; 
                        margin-bottom: 25px; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 15px;
                        font-size: 13pt;
                    }
                    .info-section { margin-bottom: 20px; font-size: 11pt; }
                    .info-row { margin-bottom: 8px; display: flex; align-items: flex-start; }
                    .info-label { font-weight: bold; text-transform: uppercase; width: 200px; flex-shrink: 0; }
                    .info-value { flex: 1; }
                    
                    .barcode-row { margin-top: 15px; display: flex; align-items: center; }
                    .barcode-label { font-weight: bold; text-transform: uppercase; width: 200px; flex-shrink: 0; }
                    .barcode-container { flex: 1; display: flex; flex-direction: column; align-items: center; }
                    .barcode-svg { width: 100%; height: 18mm !important; }
                    .barcode-text { font-size: 8pt; font-family: monospace; margin-top: 2px; }

                    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 9pt; }
                    th, td { border: 1px solid #000; padding: 6px; text-align: left; }
                    th { background-color: #f2f2f2; text-transform: uppercase; font-weight: bold; text-align: center; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    
                    .footer-text { margin-top: 30px; text-align: justify; font-size: 11pt; line-height: 1.4; }
                    .location-date { margin-top: 40px; text-align: center; font-weight: bold; font-size: 12pt; text-transform: uppercase; }
                    
                    .signature-section { margin-top: 60px; text-align: center; }
                    .signature-title { font-weight: bold; margin-bottom: 50px; text-transform: uppercase; font-size: 11pt; }
                    .signature-line { border-top: 1px solid #000; width: 350px; margin: 0 auto 10px auto; }
                    .signature-name { font-weight: bold; margin: 0; text-transform: uppercase; font-size: 11pt; }
                    .signature-info { margin: 0; font-size: 10pt; text-transform: uppercase; }

                    @media print {
                        body { margin: 0; padding: 0; }
                        .page { margin: 0; border: none; box-shadow: none; padding: 15mm; }
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        ATESTAMOS O RECEBIMENTO DOS MATERIAIS/SERVIÇOS RELACIONADOS, ENTREGA PELA EMPRESA:
                    </div>

                    <div class="info-section">
                        <div class="info-row"><span class="info-label">FORNECEDOR:</span> <span class="info-value">${receiptData.supplierName.toUpperCase()}</span></div>
                        <div class="info-row"><span class="info-label">C.N.P.J.:</span> <span class="info-value">${receiptData.supplierCpf}</span></div>
                        <div class="info-row"><span class="info-label">PROCESSO SEI:</span> <span class="info-value">${receiptData.processoSei || 'N/A'}</span></div>
                        <div class="info-row"><span class="info-label">NOTA FISCAL Nº:</span> <span class="info-value">${receiptData.invoiceNumber}</span></div>
                        <div class="info-row"><span class="info-label">NOTA DE EMPENHO:</span> <span class="info-value">${receiptData.receiptTermNumber || 'N/A'}</span></div>
                        <div class="info-row"><span class="info-label">VALOR TOTAL NOTA FISCAL:</span> <span class="info-value">${formatCurrency(receiptData.totalInvoiceValue)}</span></div>
                        
                        ${receiptData.barcode ? `
                        <div class="barcode-row">
                            <span class="barcode-label">CÓD. BARRAS NF:</span>
                            <div class="barcode-container">
                                <svg id="barcode-receipt" class="barcode-svg"></svg>
                                <div class="barcode-text">${receiptData.barcode}</div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px;">ITEM</th>
                                <th style="width: 80px;">QUANT.</th>
                                <th style="width: 60px;">UNID.</th>
                                <th>DESCRIÇÃO</th>
                                <th style="width: 100px;">VR.UNIT.</th>
                                <th style="width: 120px;">VR. TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${receiptData.items.map((it, idx) => `
                                <tr>
                                    <td class="text-center">${String(idx + 1).padStart(2, '0')}</td>
                                    <td class="text-right">${(it.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td class="text-center">${it.unit || 'N/A'}</td>
                                    <td>${it.name || 'N/A'}</td>
                                    <td class="text-right">${formatCurrency(it.unitPrice)}</td>
                                    <td class="text-right">${formatCurrency(it.totalValue)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="font-weight: bold; background-color: #f2f2f2;">
                                <td colspan="5" class="text-right">TOTAL GERAL:</td>
                                <td class="text-right">${formatCurrency(receiptData.totalInvoiceValue)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="footer-text">
                        Recebemos em ordem e na quantidade devida os materiais/serviços acima discriminados, os quais foram inspecionados pela comissão de recepção materiais, foi considerado de acordo com solicitado, satisfazendo as especificações e demais exigências do empenho conforme determina o inciso II do artigo 140 da lei nº 14.133/21.
                    </div>

                    <div class="signature-section">
                        <div class="signature-title">COMISSÃO DE RECEPÇÃO DE MATERIAIS/SERVIÇOS</div>
                        <div class="signature-line"></div>
                        <div class="signature-name">FERNANDO RODRIGUES SOARES</div>
                        <div class="signature-info">CPF: 347.810.448-32</div>
                        <div class="signature-info">PRESIDENTE</div>
                    </div>

                    <script>
                        window.onload = function() {
                            ${receiptData.barcode ? `
                            try {
                                JsBarcode("#barcode-receipt", "${receiptData.barcode}", {
                                    format: "CODE128",
                                    width: 2,
                                    height: 50,
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
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
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
                        <button onClick={() => setActiveTab('entry')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'entry' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Entrada de Materiais</button>
                        <button onClick={() => setActiveTab('exit')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'exit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Saída de Materiais</button>
                        <button onClick={() => setActiveTab('agenda')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'agenda' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Agenda de Chegadas</button>
                        <button onClick={() => setActiveTab('receipt')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'receipt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Termo de Recebimento</button>
                    </div>
                    <button onClick={onLogout} className="bg-red-50 text-red-600 font-black py-2 px-6 rounded-xl text-xs uppercase border border-red-100 shadow-sm active:scale-95">Sair</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                
                {activeTab === 'entry' ? (
                    <AdminInvoices 
                        suppliers={suppliers} 
                        warehouseLog={warehouseLog}
                        onReopenInvoice={onReopenInvoice} 
                        onDeleteInvoice={onDeleteInvoice} 
                        onUpdateInvoiceItems={onUpdateInvoiceItems} 
                        onManualInvoiceEntry={onManualInvoiceEntry}
                        mode="warehouse_entry"
                    />
                ) : activeTab === 'exit' ? (
                    <AdminInvoices 
                        suppliers={suppliers} 
                        warehouseLog={warehouseLog}
                        onReopenInvoice={onReopenInvoice} 
                        onDeleteInvoice={onDeleteInvoice} 
                        onUpdateInvoiceItems={onUpdateInvoiceItems} 
                        onManualInvoiceEntry={onManualInvoiceEntry}
                        mode="warehouse_exit"
                        onRegisterExit={onRegisterWithdrawal}
                    />
                ) : activeTab === 'agenda' ? (
                    <AgendaChegadas 
                        suppliers={suppliers} 
                        thirdPartyEntries={thirdPartyEntries} 
                        embedded={true} 
                    />
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
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        3. Processo SEI
                                    </label>
                                    <input 
                                        type="text" 
                                        value={receiptProcessoSei} 
                                        onChange={e => setReceiptProcessoSei(e.target.value)} 
                                        placeholder="Nº do Processo SEI"
                                        className="w-full h-14 px-4 border-2 border-white rounded-2xl bg-white shadow-sm font-bold outline-none focus:ring-4 focus:ring-teal-100 transition-all text-sm" 
                                    />
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
                                        <p><span className="font-bold inline-block w-48">PROCESSO SEI:</span> {receiptData.processoSei || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">NOTA FISCAL Nº:</span> {receiptData.invoiceNumber || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">NOTA DE EMPENHO:</span> {receiptData.receiptTermNumber || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">DATA NOTA FISCAL:</span> {(receiptData.invoiceDate || '').split('-').reverse().join('/') || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">DATA RECEBIMENTO:</span> {(receiptData.receiptDate || '').split('-').reverse().join('/') || 'N/A'}</p>
                                        <p><span className="font-bold inline-block w-48">VALOR TOTAL NF:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receiptData.totalInvoiceValue || 0)}</p>
                                        <p className="flex items-center gap-2">
                                            <span className="font-bold inline-block w-48">CÓD. BARRAS NF:</span> 
                                            {receiptData.barcode ? <Barcode value={receiptData.barcode} /> : 'N/A'}
                                        </p>
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
                                        TAIÚVA, {receiptData.receiptDate ? new Date(receiptData.receiptDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() : 'DATA NÃO INFORMADA'}
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

                {/* Tabela de Agendamentos da Semana */}
                {activeTab === 'agenda' && (
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full animate-pulse bg-indigo-600"></div>
                                Agendamentos da Semana (Grade Completa)
                            </h3>
                        </div>
                        <div className="overflow-x-auto rounded-xl">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-900 text-[10px] font-black uppercase text-slate-100 tracking-widest">
                                        <th className="p-4 text-left">Data</th>
                                        <th className="p-4 text-left">Horário</th>
                                        <th className="p-4 text-left">Tipo</th>
                                        <th className="p-4 text-left">Fornecedor / Empresa</th>
                                        <th className="p-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {weeklyDeliveries.length > 0 ? weeklyDeliveries.map(item => (
                                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-4 text-xs text-slate-700 font-mono font-bold">{item.date.split('-').reverse().join('/')}</td>
                                            <td className="p-4 text-xs font-mono text-indigo-800 font-black">{item.time}</td>
                                            <td className="p-4 text-[9px] font-black uppercase text-slate-400">{item.type}</td>
                                            <td className="p-4 font-bold text-slate-900 uppercase text-xs">{item.supplierName}</td>
                                            <td className="p-4 text-center">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${ 
                                                    item.status === 'CONCLUÍDO' 
                                                        ? 'bg-indigo-100 text-indigo-700' 
                                                        : item.status === 'CANCELADO'
                                                            ? 'bg-red-100 text-red-700'
                                                            : item.status === 'TERCEIRO'
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">Nenhum agendamento para esta semana...</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
            <style>{`
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};

export default AlmoxarifadoDashboard;