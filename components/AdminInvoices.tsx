
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ContractItem } from '../types';

interface InvoiceInfo {
    id: string;
    supplierName: string;
    supplierCpf: string;
    invoiceNumber: string;
    barcode?: string;
    date: string; // The earliest date associated with this invoice
    totalValue: number;
    items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[];
}

interface AdminInvoicesProps {
    suppliers: Supplier[];
    onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onDeleteInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onUpdateInvoiceItems: (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, newInvoiceNumber?: string, newDate?: string) => Promise<{ success: boolean; message?: string }>;
    onManualInvoiceEntry: (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string) => Promise<{ success: boolean; message?: string }>;
    mode?: 'admin' | 'warehouse_entry' | 'warehouse_exit';
    onRegisterExit?: (payload: any) => Promise<{ success: boolean; message: string }>;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string) => {
    if (!dateString || dateString === "Invalid Date") return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('pt-BR');
};

const getDisplayUnit = (item: ContractItem | undefined): string => {
    if (!item || !item.unit) return 'Kg';
    const [unitType] = item.unit.split('-');
    const unitMap: { [key: string]: string } = {
        kg: 'Kg', un: 'Kg', saco: 'Kg', balde: 'Kg', pacote: 'Kg', pote: 'Kg',
        litro: 'L', l: 'L', caixa: 'L', embalagem: 'L',
        dz: 'Dz'
    };
    return unitMap[unitType] || 'Un';
};

const handlePrintLabels = (invoices: InvoiceInfo[]) => {
    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (!printWindow) return;

    // Flatten items for printing
    const labels = invoices.flatMap(inv => 
        inv.items.map(item => ({
            itemName: item.name,
            supplierName: inv.supplierName,
            lotNumber: item.lotNumber || 'N/A',
            expirationDate: item.expirationDate || 'N/A',
            date: inv.date,
            quantity: item.kg,
            invoiceNumber: inv.invoiceNumber,
            barcode: inv.barcode
        }))
    );

    const htmlContent = `
        <html>
        <head>
            <title>Etiquetas de Notas Fiscais</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <style>
                @page { size: A4; margin: 10mm; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f0f0f0; }
                .page-container { width: 190mm; margin: 0 auto; background: white; }
                .label-card {
                    width: 90mm; height: 60mm; border: 1px solid #000; padding: 5mm;
                    box-sizing: border-box; display: inline-block; vertical-align: top;
                    margin: 2mm; text-align: center; position: relative; overflow: hidden; border-radius: 4mm;
                }
                h1 { font-size: 14pt; font-weight: bold; margin: 0 0 2mm 0; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                h2 { font-size: 10pt; margin: 0 0 3mm 0; color: #444; border-bottom: 1px solid #eee; padding-bottom: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .info { text-align: left; font-size: 9pt; }
                .info p { margin: 1mm 0; display: flex; justify-content: space-between; border-bottom: 0.5px dashed #ddd; }
                .info strong { font-size: 7pt; color: #666; }
                .barcode-container { margin-top: 3mm; display: flex; flex-direction: column; align-items: center; }
                .barcode-svg { max-width: 100%; height: 15mm !important; }
                .footer { position: absolute; bottom: 2mm; left: 0; right: 0; font-size: 6pt; color: #999; }
                @media print {
                    body { background: white; }
                    .page-container { width: 100%; margin: 0; }
                    .label-card { border: 1px solid #000; margin: 1mm; page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="page-container">
                ${labels.map((label, index) => `
                    <div class="label-card">
                        <h1>${label.itemName}</h1>
                        <h2>${label.supplierName}</h2>
                        <div class="info">
                            <p><strong>LOTE:</strong> <span>${label.lotNumber}</span></p>
                            <p><strong>VAL:</strong> <span>${label.expirationDate ? label.expirationDate.split('-').reverse().join('/') : 'N/A'}</span></p>
                            <p><strong>ENT:</strong> <span>${label.date ? label.date.split('-').reverse().join('/') : 'N/A'}</span></p>
                            <p><strong>QTD:</strong> <span>${label.quantity.toFixed(2).replace('.', ',')} kg</span></p>
                            <p><strong>NF:</strong> <span>${label.invoiceNumber}</span></p>
                        </div>
                        <div class="barcode-container">
                            ${label.barcode ? `<svg id="barcode-${index}" class="barcode-svg"></svg>` : '<p style="font-size: 8pt; color: #ccc; margin-top: 5mm;">SEM CÓDIGO</p>'}
                        </div>
                        <div class="footer">${new Date().toLocaleString('pt-BR')}</div>
                    </div>
                `).join('')}
            </div>
            <script>
                window.onload = function() {
                    ${labels.map((label, index) => label.barcode ? `
                        try {
                            JsBarcode("#barcode-${index}", "${label.barcode}", {
                                format: "CODE128", width: 2, height: 40, displayValue: true, fontSize: 10, margin: 0
                            });
                        } catch (e) { console.error(e); }
                    ` : '').join('')}
                    setTimeout(() => { window.print(); window.close(); }, 1000);
                }
            </script>
        </body>
        </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

const AdminInvoices: React.FC<AdminInvoicesProps> = ({ suppliers, onReopenInvoice, onDeleteInvoice, onUpdateInvoiceItems, onManualInvoiceEntry, mode = 'admin', onRegisterExit }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<'supplierName' | 'date' | 'totalValue'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<InvoiceInfo | null>(null);
    const [exitingInvoice, setExitingInvoice] = useState<InvoiceInfo | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const allInvoices = useMemo((): InvoiceInfo[] => {
        const invoicesMap = new Map<string, InvoiceInfo>();
        (suppliers || []).forEach(supplier => {
            const deliveriesByInvoice = new Map<string, Delivery[]>();
            (supplier.deliveries || []).forEach(delivery => {
                if (delivery.invoiceNumber && delivery.invoiceNumber.trim() !== "") {
                    const existing = deliveriesByInvoice.get(delivery.invoiceNumber) || [];
                    deliveriesByInvoice.set(delivery.invoiceNumber, [...existing, delivery]);
                }
            });
            deliveriesByInvoice.forEach((deliveries, invoiceNumber) => {
                const invoiceId = `${supplier.cpf}-${invoiceNumber}`;
                const totalValue = deliveries.reduce((sum, d) => sum + (d.value || 0), 0);
                const items = deliveries
                    .filter(d => d.item && d.item !== 'AGENDAMENTO PENDENTE')
                    .map(d => ({ 
                        name: d.item || 'Item não especificado', 
                        kg: d.kg || 0, 
                        value: d.value || 0,
                        lotNumber: d.lots?.[0]?.lotNumber,
                        expirationDate: d.lots?.[0]?.expirationDate
                    }));
                if(items.length === 0 && totalValue === 0) return;
                const validDates = deliveries.map(d => d.date).filter(d => d && d !== "Invalid Date");
                const earliestDate = validDates.length > 0 ? validDates.sort()[0] : new Date().toISOString().split('T')[0];
                const barcode = deliveries.find(d => d.barcode)?.barcode;
                invoicesMap.set(invoiceId, { id: invoiceId, supplierName: supplier.name, supplierCpf: supplier.cpf, invoiceNumber, barcode, date: earliestDate, totalValue, items });
            });
        });
        return Array.from(invoicesMap.values());
    }, [suppliers]);
    
    const filteredAndSortedInvoices = useMemo(() => {
        const filtered = allInvoices.filter(invoice => invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
        return filtered.sort((a, b) => {
            let comp = 0;
            if (sortKey === 'supplierName') comp = a.supplierName.localeCompare(b.supplierName);
            else if (sortKey === 'date') comp = new Date(b.date).getTime() - new Date(a.date).getTime();
            else if (sortKey === 'totalValue') comp = b.totalValue - a.totalValue;
            return sortDirection === 'asc' ? -comp : comp;
        });
    }, [allInvoices, searchTerm, sortKey, sortDirection]);

    const handleSort = (key: 'supplierName' | 'date' | 'totalValue') => {
        if (key === sortKey) setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDirection('desc'); }
    };
    
    const handleExitSave = async (outboundNf: string, exitDate: string, itemsToExit: { name: string; kg: number; lotNumber?: string; expirationDate?: string }[]) => {
        if (!onRegisterExit || !exitingInvoice) return;
        setIsSavingEdit(true);
        let successCount = 0;
        let failCount = 0;

        for (const item of itemsToExit) {
            const payload = {
                type: 'saida',
                supplierCpf: exitingInvoice.supplierCpf,
                supplierName: exitingInvoice.supplierName,
                itemName: item.name,
                quantity: item.kg,
                lotNumber: item.lotNumber,
                expirationDate: item.expirationDate,
                outboundInvoice: outboundNf, // NF de saída (manual)
                inboundInvoice: exitingInvoice.invoiceNumber, // NF de entrada (origem)
                date: exitDate,
                barcode: exitingInvoice.barcode
            };
            try {
                const res = await onRegisterExit(payload);
                if (res.success) successCount++;
                else failCount++;
            } catch (error) {
                console.error("Erro ao registrar saída:", error);
                failCount++;
            }
        }
        setIsSavingEdit(false);
        if (failCount === 0) {
            alert('Saída registrada com sucesso!');
            setExitingInvoice(null);
        } else {
            alert(`Saída parcial: ${successCount} itens registrados, ${failCount} falharam.`);
        }
    };

    const handleEditSave = async (updatedItems: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, newInvoiceNumber?: string, newDate?: string) => {
        if (!editingInvoice) return;
        setIsSavingEdit(true);
        const res = await onUpdateInvoiceItems(editingInvoice.supplierCpf, editingInvoice.invoiceNumber, updatedItems, barcode, newInvoiceNumber, newDate);
        setIsSavingEdit(false);
        if (res.success) setEditingInvoice(null);
        else alert(res.message || 'Erro ao salvar alterações.');
    };

    const handleManualEntrySave = async (cpf: string, date: string, nf: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string) => {
        setIsSavingEdit(true);
        const res = await onManualInvoiceEntry(cpf, date, nf, items, barcode);
        setIsSavingEdit(false);
        if (res.success) setIsManualModalOpen(false);
        else alert(res.message || 'Erro ao salvar lançamento manual.');
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-7xl mx-auto border-t-8 border-teal-500 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                 <div>
                    <h2 className="text-3xl font-black text-teal-900 uppercase tracking-tighter">Consulta de Notas Fiscais</h2>
                    <p className="text-gray-400 font-medium">Visualize as faturas ou lance manualmente caso o fornecedor não consiga agendar.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => handlePrintLabels(filteredAndSortedInvoices)}
                        disabled={filteredAndSortedInvoices.length === 0}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2 disabled:bg-gray-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
                        Imprimir Etiquetas (Filtradas)
                    </button>
                    {mode !== 'warehouse_exit' && (
                        <button onClick={() => setIsManualModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            Lançar NF Manualmente
                        </button>
                    )}
                    <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400 transition-all w-full md:w-auto" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('supplierName')}>Fornecedor</th>
                            <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('date')}>Data</th>
                            <th className="p-3 text-left">Nº Nota Fiscal</th>
                            <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('totalValue')}>Valor Total</th>
                            <th className="p-3 text-center">Itens</th>
                            <th className="p-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedInvoices.length > 0 ? filteredAndSortedInvoices.map(invoice => {
                            const isExpanded = expandedInvoiceId === invoice.id;
                            return (
                                <React.Fragment key={invoice.id}>
                                    <tr className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-3">
                                            <p className="font-bold text-gray-800 uppercase leading-none">{invoice.supplierName}</p>
                                            <p className="text-[10px] font-mono text-gray-400 mt-1">{invoice.supplierCpf}</p>
                                        </td>
                                        <td className="p-3 font-mono">{formatDate(invoice.date)}</td>
                                        <td className="p-3 font-mono">
                                            {invoice.invoiceNumber}
                                            {invoice.barcode && (
                                                <div className="text-[9px] text-gray-400 mt-1 font-mono truncate max-w-[150px]" title={invoice.barcode}>
                                                    CHAVE: {invoice.barcode}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-green-700">{formatCurrency(invoice.totalValue)}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)} className="p-2 rounded-full hover:bg-gray-200" title="Ver itens">
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {mode === 'warehouse_exit' ? (
                                                    <button 
                                                        onClick={() => setExitingInvoice(invoice)}
                                                        className="bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors shadow-md"
                                                        title="Registrar Saída"
                                                    >
                                                        Registrar Saída
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={() => handlePrintLabels([invoice])}
                                                            className="bg-amber-100 text-amber-700 hover:bg-amber-200 p-2 rounded-lg transition-colors"
                                                            title="Imprimir Etiquetas desta Nota"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                            </svg>
                                                        </button>
                                                        <button onClick={() => setEditingInvoice(invoice)} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors" title="Editar">Editar</button>
                                                        <button onClick={() => { if(window.confirm('Reabrir nota?')) onReopenInvoice(invoice.supplierCpf, invoice.invoiceNumber); }} className="bg-orange-100 text-orange-700 hover:bg-orange-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors" title="Reabrir">Reabrir</button>
                                                        <button onClick={() => { if(window.confirm('Excluir nota?')) onDeleteInvoice(invoice.supplierCpf, invoice.invoiceNumber); }} className="bg-red-100 text-red-700 hover:bg-red-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors" title="Excluir">Excluir</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-100">
                                            <td colSpan={6} className="p-4">
                                                <div className="bg-white p-4 rounded-lg shadow-inner">
                                                    <h4 className="text-xs font-bold uppercase text-gray-600 mb-2">Detalhamento da NF {invoice.invoiceNumber}</h4>
                                                    <ul className="space-y-1 text-xs">
                                                        {invoice.items.length > 0 ? invoice.items.map((item, index) => (
                                                            <li key={index} className="flex justify-between items-center p-2 border-b last:border-b-0">
                                                                <span className="font-semibold text-gray-700 uppercase">{item.name} <span className="text-gray-400 font-normal">({(item.kg || 0).toFixed(2).replace('.',',')} Kg)</span></span>
                                                                <span className="font-mono text-gray-600">{formatCurrency(item.value)}</span>
                                                            </li>
                                                        )) : <li className="p-2 text-gray-400 italic">Nota fiscal sem itens registrados.</li>}
                                                    </ul>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        }) : (<tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Nenhuma nota fiscal registrada.</td></tr>)}
                    </tbody>
                </table>
            </div>

            {editingInvoice && (
                <EditInvoiceModal invoice={editingInvoice} supplier={suppliers.find(s => s.cpf === editingInvoice.supplierCpf)!} onClose={() => setEditingInvoice(null)} onSave={handleEditSave} isSaving={isSavingEdit} />
            )}

            {exitingInvoice && (
                <ExitInvoiceModal invoice={exitingInvoice} supplier={suppliers.find(s => s.cpf === exitingInvoice.supplierCpf)!} onClose={() => setExitingInvoice(null)} onSave={handleExitSave} isSaving={isSavingEdit} />
            )}

            {isManualModalOpen && (
                <ManualInvoiceModal suppliers={suppliers} onClose={() => setIsManualModalOpen(false)} onSave={handleManualEntrySave} isSaving={isSavingEdit} />
            )}
        </div>
    )
};

// --- Modal de Lançamento Manual ---
interface ManualInvoiceModalProps {
    suppliers: Supplier[];
    onClose: () => void;
    onSave: (cpf: string, date: string, nf: string, items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string) => void;
    isSaving: boolean;
}

const ManualInvoiceModal: React.FC<ManualInvoiceModalProps> = ({ suppliers, onClose, onSave, isSaving }) => {
    const [selectedCpf, setSelectedCpf] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [nf, setNf] = useState('');
    const [barcode, setBarcode] = useState('');
    const [items, setItems] = useState<{ id: string; name: string; kg: string; lot: string; exp: string }[]>([{ id: 'init-1', name: '', kg: '', lot: '', exp: '' }]);

    const selectedSupplier = useMemo(() => suppliers.find(s => s.cpf === selectedCpf), [suppliers, selectedCpf]);
    const availableContractItems = useMemo(() => selectedSupplier ? (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)) : [], [selectedSupplier]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCpf || !nf || !date) return alert('Preencha fornecedor, data e número da nota.');
        const finalItems = items.map(it => {
            const contract = selectedSupplier?.contractItems.find(ci => ci.name === it.name);
            const kg = parseFloat(it.kg.replace(',', '.'));
            if (!contract || isNaN(kg) || kg <= 0) return null;
            return { name: it.name, kg, value: kg * contract.valuePerKg, lotNumber: it.lot, expirationDate: it.exp };
        }).filter(Boolean) as { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[];
        if (finalItems.length === 0) return alert('Adicione pelo menos um item válido.');
        onSave(selectedCpf, date, nf, finalItems, barcode);
    };

    const totalValue = useMemo(() => {
        return items.reduce((sum, it) => {
            const contract = selectedSupplier?.contractItems.find(ci => ci.name === it.name);
            const kg = parseFloat(it.kg.replace(',', '.'));
            return (contract && !isNaN(kg)) ? sum + (kg * contract.valuePerKg) : sum;
        }, 0);
    }, [items, selectedSupplier]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-2xl font-black text-teal-800 uppercase tracking-tighter">Lançamento de Nota Manual</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Fornecedor</label>
                            <select value={selectedCpf} onChange={e => setSelectedCpf(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-400 bg-white" required>
                                <option value="">-- SELECIONE --</option>
                                {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Data do Faturamento</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-400" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Nº Nota Fiscal</label>
                            <input type="text" value={nf} onChange={e => setNf(e.target.value)} placeholder="000123" className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-400" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Chave de Acesso (Código de Barras)</label>
                            <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="44 dígitos" className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-teal-400 font-mono" />
                        </div>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {items.map(item => (
                            <div key={item.id} className="bg-gray-50 p-4 rounded-xl border space-y-3">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Item</label>
                                        <select value={item.name} onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))} className="w-full p-2 border rounded-lg text-sm bg-white" required>
                                            <option value="">-- Selecione o Item --</option>
                                            {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Quantidade</label>
                                        <input type="text" value={item.kg} onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, kg: e.target.value.replace(/[^0-9,]/g, '') } : it))} placeholder="0,00" className="w-full p-2 border rounded-lg text-sm text-center font-mono" required />
                                    </div>
                                    <button type="button" onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))} className="text-red-400 hover:text-red-600 p-2 mb-0.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Lote</label>
                                        <input type="text" value={item.lot} onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, lot: e.target.value.toUpperCase() } : it))} placeholder="LOTE" className="w-full p-2 border rounded-lg text-xs font-mono" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Validade</label>
                                        <input type="date" value={item.exp} onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, exp: e.target.value } : it))} className="w-full p-2 border rounded-lg text-xs" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={() => setItems([...items, { id: `new-${Date.now()}`, name: '', kg: '', lot: '', exp: '' }])} className="w-full py-2 border-2 border-dashed border-teal-200 text-teal-600 font-bold rounded-xl text-xs uppercase hover:bg-teal-50 transition-colors">+ Adicionar Item</button>
                    </div>
                    <div className="flex justify-between items-center pt-6 border-t">
                        <div className="text-right"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Valor Total NF</p><p className="text-2xl font-black text-green-700 leading-none">{formatCurrency(totalValue)}</p></div>
                        <div className="space-x-3">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs">Cancelar</button>
                            <button type="submit" disabled={isSaving || !selectedCpf} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg disabled:bg-gray-400">{isSaving ? 'Salvando...' : 'Confirmar Lançamento'}</button>
                        </div>
                    </div>
                </form>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }`}</style>
        </div>
    );
};

interface EditInvoiceModalProps {
    invoice: InvoiceInfo;
    supplier: Supplier;
    onClose: () => void;
    onSave: (items: { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[], barcode?: string, newInvoiceNumber?: string, newDate?: string) => void;
    isSaving: boolean;
}

const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({ invoice, supplier, onClose, onSave, isSaving }) => {
    const initialItems = invoice.items.length > 0 
        ? invoice.items.map((it, idx) => ({ id: `edit-${idx}`, name: it.name, kg: String(it.kg).replace('.', ','), lot: it.lotNumber || '', exp: it.expirationDate || '' }))
        : [{ id: `new-0`, name: '', kg: '', lot: '', exp: '' }];
    const [items, setItems] = useState(initialItems);
    const [barcode, setBarcode] = useState(invoice.barcode || '');
    const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
    const [date, setDate] = useState(invoice.date);

    const availableContractItems = useMemo(() => (supplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)), [supplier.contractItems]);
    const handleItemChange = (id: string, field: 'name' | 'kg' | 'lot' | 'exp', value: string) => { setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it)); };
    const totalValue = useMemo(() => items.reduce((sum, it) => {
        const contract = supplier.contractItems.find(ci => ci.name === it.name);
        const kg = parseFloat(it.kg.replace(',', '.'));
        return (contract && !isNaN(kg)) ? sum + (kg * contract.valuePerKg) : sum;
    }, 0), [items, supplier.contractItems]);
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalItems = items.map(it => {
            const contract = supplier.contractItems.find(ci => ci.name === it.name);
            const kg = parseFloat(it.kg.replace(',', '.'));
            if (!contract || isNaN(kg)) return null;
            return { name: it.name, kg, value: kg * contract.valuePerKg, lotNumber: it.lot, expirationDate: it.exp };
        }).filter(Boolean) as { name: string; kg: number; value: number; lotNumber?: string; expirationDate?: string }[];
        if (finalItems.length === 0) return alert('Adicione pelo menos um item válido.');
        onSave(finalItems, barcode, invoiceNumber, date);
    };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div><h2 className="text-xl font-bold text-gray-800">Editar NF {invoice.invoiceNumber}</h2><p className="text-xs text-gray-500 uppercase font-black">{invoice.supplierName}</p></div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase">Nº Nota Fiscal</label>
                            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-400" />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase">Data de Entrada</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-400" />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase">Chave de Acesso</label>
                            <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="44 dígitos" className="w-full p-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-400" />
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {items.map(item => {
                            const contract = supplier.contractItems.find(ci => ci.name === item.name);
                            const unit = getDisplayUnit(contract);
                            return (
                                <div key={item.id} className="bg-gray-50 p-4 rounded-xl border space-y-3">
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1"><label className="text-[9px] font-black text-gray-400 uppercase">Item</label>
                                            <select value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white" required>
                                                <option value="">-- Selecione o Item --</option>
                                                {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-28"><label className="text-[9px] font-black text-gray-400 uppercase">Qtd ({unit})</label>
                                            <input type="text" value={item.kg} onChange={e => handleItemChange(item.id, 'kg', e.target.value)} placeholder="0,00" className="w-full p-2 border rounded-lg text-sm text-center font-mono" required />
                                        </div>
                                        <button type="button" onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))} className="text-red-400 hover:text-red-600 p-1 mt-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase">Lote</label>
                                            <input type="text" value={item.lot} onChange={e => handleItemChange(item.id, 'lot', e.target.value.toUpperCase())} placeholder="LOTE" className="w-full p-2 border rounded-lg text-xs font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase">Validade</label>
                                            <input type="date" value={item.exp} onChange={e => handleItemChange(item.id, 'exp', e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button type="button" onClick={() => setItems([...items, { id: `new-${Date.now()}`, name: '', kg: '', lot: '', exp: '' }])} className="w-full py-2 border-2 border-dashed border-teal-200 text-teal-600 font-bold rounded-lg text-xs uppercase hover:bg-teal-50 transition-colors">+ Adicionar Item à Nota</button>
                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-right"><p className="text-[10px] text-gray-400 font-black uppercase">Novo Total</p><p className="text-xl font-black text-green-700">{formatCurrency(totalValue)}</p></div>
                        <div className="space-x-2"><button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm">Cancelar</button><button type="submit" disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:bg-gray-400">{isSaving ? 'Gravando...' : 'Salvar Alterações'}</button></div>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ExitInvoiceModalProps {
    invoice: InvoiceInfo;
    supplier: Supplier;
    onClose: () => void;
    onSave: (outboundNf: string, exitDate: string, itemsToExit: { name: string; kg: number; lotNumber?: string; expirationDate?: string }[]) => void;
    isSaving: boolean;
}

const ExitInvoiceModal: React.FC<ExitInvoiceModalProps> = ({ invoice, supplier, onClose, onSave, isSaving }) => {
    const [items, setItems] = useState(invoice.items.map((it, idx) => ({ id: `exit-${idx}`, name: it.name, kg: '0,00', maxKg: it.kg, lot: it.lotNumber, exp: it.expirationDate })));
    const [outboundNf, setOutboundNf] = useState('');
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);

    const handleItemChange = (id: string, value: string) => {
        setItems(prev => prev.map(it => it.id === id ? { ...it, kg: value.replace(/[^0-9,]/g, '') } : it));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!outboundNf || !exitDate) return alert('Preencha a NF de Saída e a Data.');
        
        const itemsToExit = items.map(it => {
            const kg = parseFloat(it.kg.replace(',', '.'));
            if (isNaN(kg) || kg <= 0) return null;
            if (kg > it.maxKg) {
                alert(`Quantidade de saída para ${it.name} excede a quantidade disponível (${it.maxKg} kg).`);
                return 'ERROR';
            }
            return { name: it.name, kg, lotNumber: it.lot, expirationDate: it.exp };
        });

        if (itemsToExit.includes('ERROR')) return;
        const validItems = itemsToExit.filter(Boolean) as { name: string; kg: number; lotNumber?: string; expirationDate?: string }[];
        
        if (validItems.length === 0) return alert('Informe a quantidade de saída para pelo menos um item.');
        onSave(outboundNf, exitDate, validItems);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-red-800 uppercase">Registrar Saída - NF {invoice.invoiceNumber}</h2>
                        <p className="text-xs text-gray-500 uppercase font-black">{invoice.supplierName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 space-y-1">
                            <label className="text-[9px] font-black text-red-400 uppercase">NF de Saída (Manual)</label>
                            <input type="text" value={outboundNf} onChange={e => setOutboundNf(e.target.value)} placeholder="Número da NF de Saída" className="w-full p-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-red-400" required />
                        </div>
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 space-y-1">
                            <label className="text-[9px] font-black text-red-400 uppercase">Data de Saída</label>
                            <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400" required />
                        </div>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Selecione os itens e quantidades para saída:</p>
                        {items.map(item => {
                            const contract = supplier.contractItems.find(ci => ci.name === item.name);
                            const unit = getDisplayUnit(contract);
                            return (
                                <div key={item.id} className="bg-gray-50 p-4 rounded-xl border space-y-3">
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-gray-700 uppercase">{item.name}</p>
                                            <p className="text-[10px] text-gray-400">Disponível: {item.maxKg.toFixed(2).replace('.', ',')} {unit}</p>
                                            {item.lot && <p className="text-[10px] text-gray-400 font-mono">Lote: {item.lot}</p>}
                                        </div>
                                        <div className="w-32">
                                            <label className="text-[9px] font-black text-gray-400 uppercase">Qtd Saída ({unit})</label>
                                            <input 
                                                type="text" 
                                                value={item.kg} 
                                                onChange={e => handleItemChange(item.id, e.target.value)} 
                                                placeholder="0,00" 
                                                className="w-full p-2 border rounded-lg text-sm text-center font-mono focus:ring-2 focus:ring-red-400 outline-none" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end items-center pt-4 border-t space-x-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm uppercase">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold text-sm uppercase shadow-lg disabled:bg-gray-400">{isSaving ? 'Registrando...' : 'Confirmar Saída'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminInvoices;
