import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ContractItem } from '../types';

interface InvoiceInfo {
    id: string;
    supplierName: string;
    supplierCpf: string;
    invoiceNumber: string;
    barcode?: string;
    date: string;
    totalValue: number;
    items: { name: string; kg: number; value: number; inclusionId: string }[];
}

interface AdminInvoicesProps {
    suppliers: Supplier[];
    onReopenInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onDeleteInvoice: (supplierCpf: string, invoiceNumber: string) => void;
    onUpdateInvoiceItems: (supplierCpf: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[], barcode?: string) => Promise<{ success: boolean; message?: string }>;
    onManualInvoiceEntry: (supplierCpf: string, date: string, invoiceNumber: string, items: { name: string; kg: number; value: number }[]) => Promise<{ success: boolean; message?: string }>;
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

const extractInclusionTime = (id: string) => {
    try {
        const parts = id.split('-');
        const timestampStr = parts.find(p => p.length >= 10 && !isNaN(Number(p)));
        if (timestampStr) {
            return new Date(Number(timestampStr)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    } catch (e) {}
    return '--:--:--';
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

const AdminInvoices: React.FC<AdminInvoicesProps> = ({ suppliers, onReopenInvoice, onDeleteInvoice, onUpdateInvoiceItems, onManualInvoiceEntry }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<'supplierName' | 'date' | 'totalValue'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<InvoiceInfo | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [selectedSupplierReport, setSelectedSupplierReport] = useState('all');

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
                const barcode = deliveries.find(d => d.barcode)?.barcode;
                const items = deliveries
                    .filter(d => d.item && d.item !== 'AGENDAMENTO PENDENTE')
                    .map(d => ({ name: d.item || 'Item não especificado', kg: d.kg || 0, value: d.value || 0, inclusionId: d.id }));
                
                if(items.length === 0 && totalValue === 0) return;
                const validDates = deliveries.map(d => d.date).filter(d => d && d !== "Invalid Date");
                const earliestDate = validDates.length > 0 ? validDates.sort()[0] : new Date().toISOString().split('T')[0];
                invoicesMap.set(invoiceId, { id: invoiceId, supplierName: supplier.name, supplierCpf: supplier.cpf, invoiceNumber, barcode, date: earliestDate, totalValue, items });
            });
        });
        return Array.from(invoicesMap.values());
    }, [suppliers]);
    
    const filteredAndSortedInvoices = useMemo(() => {
        const filtered = allInvoices.filter(invoice => 
            invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (invoice.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
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

    const handlePrintCronograma = () => {
        // Filtragem para o relatório baseada na seleção
        const reportData = selectedSupplierReport === 'all' 
            ? filteredAndSortedInvoices 
            : filteredAndSortedInvoices.filter(inv => inv.supplierCpf === selectedSupplierReport);

        if (reportData.length === 0) return alert('Nenhuma nota fiscal encontrada para o fornecedor selecionado.');

        const reportContent = `
          <html>
            <head>
              <title>Cronograma de Entregas (NFs) - Taiúva 2026</title>
              <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: Arial, sans-serif; font-size: 10px; color: #333; line-height: 1.3; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                .header-sap { font-size: 12px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
                .header-unit { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                .header-address { font-size: 8px; color: #666; }
                .report-title { text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0; text-transform: uppercase; text-decoration: underline; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #000; padding: 5px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; font-size: 8px; }
                .footer { margin-top: 40px; display: flex; justify-content: space-around; page-break-inside: avoid; }
                .sig { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 5px; font-size: 9px; font-weight: bold; }
                .date-print { text-align: right; font-size: 7px; color: #999; margin-top: 10px; }
                .money { text-align: right; font-family: monospace; white-space: nowrap; }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="header-sap">Secretaria da Administração Penitenciária</div>
                <div class="header-unit">Polícia Penal - Penitenciária de Taiúva</div>
                <div class="header-address">Rodovia Brigadeiro Faria Lima, SP 326, KM 359,6 Taiúva/SP - CEP: 14.720-000<br>Fone: (16) 3247-6261</div>
              </div>
              
              <div class="report-title">CRONOGRAMA DE ENTREGAS (NOTAS FISCAIS LANÇADAS)</div>

              <table>
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th style="width: 80px;">Data Entrega</th>
                    <th style="width: 80px;">H. Inclusão Sist.</th>
                    <th style="width: 60px;">NF</th>
                    <th>Item Entregue</th>
                    <th style="width: 70px; text-align: right;">Qtd.</th>
                    <th style="width: 90px; text-align: right;">Valor Entrega</th>
                    <th style="width: 100px; text-align: right;">Total Contratado</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportData.flatMap(invoice => {
                      const supplier = suppliers.find(s => s.cpf === invoice.supplierCpf);
                      const totalContracted = supplier?.initialValue || 0;
                      
                      return invoice.items.map((item, idx) => `
                        <tr>
                          <td style="font-weight: bold; font-size: 9px;">${idx === 0 ? invoice.supplierName : ''}</td>
                          <td>${formatDate(invoice.date)}</td>
                          <td style="font-mono; font-size: 9px;">${extractInclusionTime(item.inclusionId)}</td>
                          <td>${invoice.invoiceNumber}</td>
                          <td style="text-transform: uppercase;">${item.name}</td>
                          <td style="text-align: right; font-weight: bold;">${item.kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td class="money">${formatCurrency(item.value)}</td>
                          <td class="money" style="background: #f9f9f9; font-weight: bold;">${idx === 0 ? formatCurrency(totalContracted) : ''}</td>
                        </tr>
                      `);
                  }).join('')}
                </tbody>
              </table>
              
              <div class="footer">
                <div class="sig">Responsável Almoxarifado<br>(Conferência)</div>
                <div class="sig">Diretoria de Centro<br>(Visto)</div>
              </div>

              <div class="date-print">Relatório extraído em: ${new Date().toLocaleString('pt-BR')}</div>
            </body>
          </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(reportContent);
            win.document.close();
            setTimeout(() => { win.print(); }, 500);
        }
    };
    
    const handleEditSave = async (updatedItems: { name: string; kg: number; value: number }[], updatedBarcode?: string) => {
        if (!editingInvoice) return;
        setIsSavingEdit(true);
        const res = await onUpdateInvoiceItems(editingInvoice.supplierCpf, editingInvoice.invoiceNumber, updatedItems, updatedBarcode);
        setIsSavingEdit(false);
        if (res.success) setEditingInvoice(null);
        else alert(res.message || 'Erro ao salvar alterações.');
    };

    const handleManualInvoiceEntry = async (cpf: string, date: string, nf: string, items: { name: string; kg: number; value: number }[]) => {
        setIsSavingEdit(true);
        const res = await onManualInvoiceEntry(cpf, date, nf, items);
        setIsSavingEdit(false);
        if (res.success) setIsManualModalOpen(false);
        else alert(res.message || 'Erro ao salvar lançamento manual.');
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-7xl mx-auto border-t-8 border-teal-500 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                 <div>
                    <h2 className="text-3xl font-black text-teal-900 uppercase tracking-tighter">Consulta de Notas Fiscais</h2>
                    <p className="text-gray-400 font-medium">Visualize faturas, lance notas manuais ou exporte relatórios.</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Fornecedor do Relatório</label>
                        <select 
                            value={selectedSupplierReport} 
                            onChange={e => setSelectedSupplierReport(e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-black uppercase text-indigo-900 outline-none focus:ring-2 focus:ring-teal-400 h-10 min-w-[200px]"
                        >
                            <option value="all">TODOS OS FORNECEDORES</option>
                            {suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                                <option key={s.cpf} value={s.cpf}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handlePrintCronograma}
                        className="bg-gray-800 hover:bg-black text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-[10px] flex items-center gap-2 h-10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Exportar Cronograma NFs
                    </button>
                    <button onClick={() => setIsManualModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-md active:scale-95 tracking-widest text-[10px] flex items-center gap-2 h-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Lançar Manual
                    </button>
                    <input type="text" placeholder="Filtrar tela..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-400 transition-all w-full md:w-48 h-10" />
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
                                        <td className="p-3 font-bold text-gray-800 uppercase">
                                            {invoice.supplierName}
                                            {invoice.barcode && (
                                                <div className="text-[9px] font-mono text-indigo-500 font-black mt-1">BARRAS: {invoice.barcode}</div>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono">{formatDate(invoice.date)}</td>
                                        <td className="p-3 font-mono">{invoice.invoiceNumber}</td>
                                        <td className="p-3 text-right font-mono font-bold text-green-700">{formatCurrency(invoice.totalValue)}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)} className="p-2 rounded-full hover:bg-gray-200" title="Ver itens">
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => setEditingInvoice(invoice)} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors" title="Editar">Editar</button>
                                                <button onClick={() => { if(window.confirm('Reabrir nota?')) onReopenInvoice(invoice.supplierCpf, invoice.invoiceNumber); }} className="bg-orange-100 text-orange-700 hover:bg-orange-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors" title="Reabrir">Reabrir</button>
                                                <button onClick={() => { if(window.confirm('Excluir nota?')) onDeleteInvoice(invoice.supplierCpf, invoice.invoiceNumber); }} className="bg-red-100 text-red-700 hover:bg-red-200 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors" title="Excluir">Excluir</button>
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
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-700 uppercase">{item.name} <span className="text-gray-400 font-normal">({(item.kg || 0).toFixed(2).replace('.',',')} Kg)</span></span>
                                                                    <span className="text-[9px] text-indigo-500 font-bold uppercase">Incluído às {extractInclusionTime(item.inclusionId)}</span>
                                                                </div>
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

            {isManualModalOpen && (
                /* Fix: Change handleManualEntrySave to handleManualInvoiceEntry */
                <ManualInvoiceModal suppliers={suppliers} onClose={() => setIsManualModalOpen(false)} onSave={handleManualInvoiceEntry} isSaving={isSavingEdit} />
            )}
        </div>
    )
};

// --- Modal de Lançamento Manual ---
interface ManualInvoiceModalProps {
    suppliers: Supplier[];
    onClose: () => void;
    onSave: (cpf: string, date: string, nf: string, items: { name: string; kg: number; value: number }[]) => void;
    isSaving: boolean;
}

const ManualInvoiceModal: React.FC<ManualInvoiceModalProps> = ({ suppliers, onClose, onSave, isSaving }) => {
    const [selectedCpf, setSelectedCpf] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [nf, setNf] = useState('');
    const [items, setItems] = useState<{ id: string; name: string; kg: string }[]>([{ id: 'init-1', name: '', kg: '' }]);

    const selectedSupplier = useMemo(() => suppliers.find(s => s.cpf === selectedCpf), [suppliers, selectedCpf]);
    const availableContractItems = useMemo(() => selectedSupplier ? (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)) : [], [selectedSupplier]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCpf || !nf || !date) return alert('Preencha fornecedor, data e número da nota.');
        const finalItems = items.map(it => {
            const contract = selectedSupplier?.contractItems.find(ci => ci.name === it.name);
            const kg = parseFloat(it.kg.replace(',', '.'));
            if (!contract || isNaN(kg) || kg <= 0) return null;
            return { name: it.name, kg, value: kg * contract.valuePerKg };
        }).filter(Boolean) as { name: string; kg: number; value: number }[];
        if (finalItems.length === 0) return alert('Adicione pelo menos um item válido.');
        onSave(selectedCpf, date, nf, finalItems);
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {items.map(item => (
                            <div key={item.id} className="flex gap-2 items-end bg-gray-50 p-3 rounded-xl border">
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
                        ))}
                        <button type="button" onClick={() => setItems([...items, { id: `new-${Date.now()}`, name: '', kg: '' }])} className="w-full py-2 border-2 border-dashed border-teal-200 text-teal-600 font-bold rounded-xl text-xs uppercase hover:bg-teal-50 transition-colors">+ Adicionar Item</button>
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
    onSave: (items: { name: string; kg: number; value: number }[], barcode?: string) => void;
    isSaving: boolean;
}

const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({ invoice, supplier, onClose, onSave, isSaving }) => {
    const initialItems = invoice.items.length > 0 
        ? invoice.items.map((it, idx) => ({ id: `edit-${idx}`, name: it.name, kg: String(it.kg).replace('.', ',') }))
        : [{ id: `new-0`, name: '', kg: '' }];
    
    const [items, setItems] = useState(initialItems);
    const [barcode, setBarcode] = useState(invoice.barcode || '');

    const availableContractItems = useMemo(() => (supplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)), [supplier.contractItems]);
    
    const handleItemChange = (id: string, field: 'name' | 'kg', value: string) => { 
        setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it)); 
    };

    const totalValue = useMemo(() => items.reduce((sum, it) => {
        /* Fix: 'item' was used instead of 'it' */
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
            return { name: it.name, kg, value: kg * contract.valuePerKg };
        }).filter(Boolean) as { name: string; kg: number; value: number }[];
        
        if (finalItems.length === 0) return alert('Adicione pelo menos um item válido.');
        onSave(finalItems, barcode);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Editar Detalhes da NF {invoice.invoiceNumber}</h2>
                        <p className="text-xs text-gray-500 uppercase font-black">{invoice.supplierName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>
                
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Código de Barras da Nota Fiscal</label>
                        <input 
                            type="text" 
                            value={barcode} 
                            onChange={e => setBarcode(e.target.value)} 
                            placeholder="Bipar ou digitar código de barras da nota..." 
                            className="w-full p-3 border-2 border-indigo-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 font-mono font-black text-lg bg-white"
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Itens da Nota</label>
                        {items.map(item => {
                            const contract = supplier.contractItems.find(ci => ci.name === item.name);
                            const unit = getDisplayUnit(contract);
                            return (
                                <div key={item.id} className="flex gap-2 items-center bg-gray-50 p-3 rounded-lg border">
                                    <div className="flex-1"><label className="text-[9px] font-black text-gray-400 uppercase">Item</label>
                                        <select value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white" required>
                                            <option value="">-- Selecione o Item --</option>
                                            {availableContractItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-28"><label className="text-[9px] font-black text-gray-400 uppercase">Qtd ({unit})</label>
                                        <input type="text" value={item.kg} onChange={e => handleItemChange(item.id, 'kg', e.target.value.replace(/[^0-9,]/g, ''))} placeholder="0,00" className="w-full p-2 border rounded-lg text-sm text-center font-mono" required />
                                    </div>
                                    <button type="button" onClick={() => setItems(prev => prev.filter(it => it.id !== item.id))} className="text-red-400 hover:text-red-600 p-1 mt-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            );
                        })}
                    </div>
                    
                    <button type="button" onClick={() => setItems([...items, { id: `new-${Date.now()}`, name: '', kg: '' }])} className="w-full py-2 border-2 border-dashed border-teal-200 text-teal-600 font-bold rounded-lg text-xs uppercase hover:bg-teal-50 transition-colors">+ Adicionar Item à Nota</button>
                    
                    <div className="flex justify-between items-center pt-4 border-t">
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Valor Total NF</p>
                            <p className="text-xl font-black text-green-700 leading-none">{formatCurrency(totalValue)}</p>
                        </div>
                        <div className="space-x-2">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs">Cancelar</button>
                            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg disabled:bg-gray-400">
                                {isSaving ? 'Gravando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }`}</style>
        </div>
    );
};

export default AdminInvoices;