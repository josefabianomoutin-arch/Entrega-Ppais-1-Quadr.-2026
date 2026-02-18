
import React, { useState, useMemo, useRef } from 'react';
import type { WarehouseMovement, Supplier, ContractItem } from '../types';

interface AdminWarehouseLogProps {
    warehouseLog: WarehouseMovement[];
    suppliers: Supplier[];
    onDeleteEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
    onUpdateWarehouseEntry: (updatedEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

const AdminWarehouseLog: React.FC<AdminWarehouseLogProps> = ({ warehouseLog, suppliers, onDeleteEntry, onUpdateWarehouseEntry, onRegisterEntry, onRegisterWithdrawal }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'entrada' | 'saída'>('all');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<WarehouseMovement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredLog = useMemo(() => {
        return warehouseLog
            .filter(log => {
                const typeMatch = filterType === 'all' || log.type === filterType;
                const searchMatch = searchTerm === '' ||
                    log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (log.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
                return typeMatch && searchMatch;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date || a.timestamp).getTime();
                const dateB = new Date(b.date || b.timestamp).getTime();
                return dateB - dateA;
            });
    }, [warehouseLog, searchTerm, filterType]);

    // Lógica para o novo Painel de Validade (Shelf-Life)
    const validityAnalysis = useMemo(() => {
        return warehouseLog
            .filter(log => log.type === 'entrada' && log.date && log.expirationDate)
            .map(log => {
                const start = new Date(log.date + 'T00:00:00');
                const end = new Date(log.expirationDate + 'T00:00:00');
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return {
                    ...log,
                    shelfLifeDays: diffDays
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 20); // Mostra os 20 mais recentes para análise
    }, [warehouseLog]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let text = e.target?.result as string;
            const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            if (lines.length <= 1) return;

            setIsImporting(true);
            let successCount = 0;
            let errorCount = 0;
            let errorDetails: string[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                let cols = line.split(";");
                if (cols.length < 5) cols = line.split(",");
                if (cols.length < 6) { errorCount++; continue; }

                const [tipoRaw, csvItem, csvSupplier, nf, lote, qtd, data, venc, barras] = cols.map(c => c.trim());
                const isEntrada = tipoRaw.toUpperCase().includes('ENTRADA');
                
                const cleanQtdStr = qtd.replace(/['"]/g, '').trim(); 
                const sanitizedQty = cleanQtdStr.replace(/\./g, '').replace(',', '.');
                const qtyVal = parseFloat(sanitizedQty);

                if (isNaN(qtyVal)) { 
                    errorCount++; 
                    errorDetails.push(`Linha ${i+1}: Quantidade '${qtd}' inválida.`); 
                    continue; 
                }

                const supplier = suppliers.find(s => superNormalize(s.name) === superNormalize(csvSupplier));
                if (!supplier) { errorCount++; errorDetails.push(`Linha ${i+1}: Fornecedor '${csvSupplier}' não localizado.`); continue; }

                const officialItem = supplier.contractItems.find(ci => superNormalize(ci.name) === superNormalize(csvItem));
                if (!officialItem) { errorCount++; errorDetails.push(`Linha ${i+1}: Item '${csvItem}' não consta no contrato de ${supplier.name}.`); continue; }

                try {
                    let res;
                    const documentDate = data || new Date().toISOString().split('T')[0];
                    if (isEntrada) {
                        res = await onRegisterEntry({ supplierCpf: supplier.cpf, itemName: officialItem.name, invoiceNumber: nf, invoiceDate: documentDate, lotNumber: lote, quantity: qtyVal, expirationDate: venc || '', barcode: barras || '' });
                    } else {
                        res = await onRegisterWithdrawal({ supplierCpf: supplier.cpf, itemName: officialItem.name, outboundInvoice: nf, lotNumber: lote, quantity: qtyVal, expirationDate: venc || '', date: documentDate, barcode: barras || '' });
                    }

                    if (res.success) successCount++;
                    else { errorCount++; errorDetails.push(`Linha ${i+1}: ${res.message}`); }
                } catch (err) { errorCount++; }
            }

            setIsImporting(false);
            alert(`Concluído!\n✅ Sucessos: ${successCount}\n❌ Erros: ${errorCount}${errorDetails.length > 0 ? `\n\nResumo:\n${errorDetails.slice(0, 3).join('\n')}` : ''}`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const handlePrintLabel = (log: WarehouseMovement) => {
        const printWindow = window.open('', '_blank', 'width=600,height=400');
        if (!printWindow) return;

        const htmlContent = `
            <html>
            <head>
                <title>Etiqueta - ${log.itemName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 2px solid #000; margin: 10px; border-radius: 10px; }
                    h1 { font-size: 24px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }
                    h2 { font-size: 18px; margin: 5px 0; color: #333; }
                    .info { margin-top: 20px; text-align: left; font-size: 14px; }
                    .info p { margin: 5px 0; border-bottom: 1px dashed #ccc; padding-bottom: 2px; }
                    .info strong { display: inline-block; width: 120px; }
                    .barcode { margin-top: 20px; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
                    .footer { margin-top: 20px; font-size: 10px; color: #666; }
                    @media print {
                        body { border: none; margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>${log.itemName}</h1>
                <h2>${log.supplierName}</h2>
                
                <div class="info">
                    <p><strong>LOTE:</strong> ${log.lotNumber}</p>
                    <p><strong>VALIDADE:</strong> ${log.expirationDate ? log.expirationDate.split('-').reverse().join('/') : 'N/A'}</p>
                    <p><strong>DATA ENTRADA:</strong> ${log.date ? log.date.split('-').reverse().join('/') : 'N/A'}</p>
                    <p><strong>QUANTIDADE:</strong> ${log.quantity} kg</p>
                    <p><strong>NOTA FISCAL:</strong> ${log.inboundInvoice || log.outboundInvoice || 'N/A'}</p>
                </div>

                <div class="barcode">
                    ${log.barcode ? `* ${log.barcode} *` : ''}
                </div>

                <div class="footer">
                    Gerado em: ${new Date().toLocaleString('pt-BR')}
                </div>

                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleDelete = async (log: WarehouseMovement) => {
        const msg = log.type === 'entrada' 
            ? 'Excluir esta entrada? O lote será removido e o saldo voltará ao contrato.' 
            : 'Excluir esta saída? A quantidade voltará ao saldo do lote atual.';
            
        if (window.confirm(msg)) {
            setIsDeleting(log.id);
            const result = await onDeleteEntry(log);
            setIsDeleting(null);
            if (!result.success) {
                alert(`Erro ao excluir: ${result.message}`);
            }
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg max-w-7xl mx-auto border-t-8 border-gray-700 animate-fade-in space-y-12">
            
            {/* CABEÇALHO E FILTROS */}
            <div>
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Histórico de Estoque</h2>
                        <p className="text-gray-400 font-medium">Gerencie as movimentações e realize lançamentos retroativos usando a Data do Documento.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button 
                            onClick={() => setIsManualModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            Lançar Movimentação Manual
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-xl text-xs transition-colors flex items-center gap-2 disabled:bg-gray-50 border border-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            {isImporting ? 'Importando...' : 'Importar Planilha .CSV'}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <input type="text" placeholder="Pesquisar (Nome, Lote, Código de Barras)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-80 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all font-bold" />
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all bg-white font-bold">
                        <option value="all">Todos</option>
                        <option value="entrada">Entradas</option>
                        <option value="saída">Saídas</option>
                    </select>
                </div>

                <div className="overflow-x-auto max-h-[65vh] custom-scrollbar border rounded-xl shadow-inner">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0 z-10 border-b">
                            <tr>
                                <th className="p-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Tipo</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Data Doc.</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Produto</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Barras</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">Lote</th>
                                <th className="p-3 text-right text-[10px] font-black uppercase text-gray-500 tracking-widest">Quantidade</th>
                                <th className="p-3 text-left text-[10px] font-black uppercase text-gray-500 tracking-widest">NF/Doc</th>
                                <th className="p-3 text-center text-[10px] font-black uppercase text-gray-500 tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLog.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${log.type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.type}</span>
                                    </td>
                                    <td className="p-3 font-mono text-indigo-700 text-xs font-black">{(log.date || '').split('-').reverse().join('/')}</td>
                                    <td className="p-3">
                                        <p className="font-bold text-gray-800 uppercase text-xs">{log.itemName}</p>
                                        <p className="text-[9px] text-gray-400 uppercase">{log.supplierName}</p>
                                    </td>
                                    <td className="p-3 font-mono text-xs text-blue-600 font-bold">{log.barcode || '-'}</td>
                                    <td className="p-3 font-mono text-xs">{log.lotNumber}</td>
                                    <td className="p-3 text-right font-mono font-black text-gray-800">
                                        {(log.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                    </td>
                                    <td className="p-3 font-mono text-xs text-gray-500">{log.inboundInvoice || log.outboundInvoice || '-'}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button 
                                                onClick={() => handlePrintLabel(log)}
                                                className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
                                                title="Imprimir Etiqueta"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                </svg>
                                            </button>
                                            <button 
                                                onClick={() => setEditingLog(log)}
                                                className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors"
                                                title="Editar Registro"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(log)} 
                                                disabled={isDeleting === log.id}
                                                className="text-red-400 hover:text-red-700 p-2 rounded-full transition-colors disabled:opacity-50"
                                                title="Excluir Registro"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLog.length === 0 && (
                                <tr><td colSpan={8} className="p-20 text-center text-gray-400 italic font-medium uppercase tracking-widest">Nenhuma movimentação localizada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* NOVO CAMPO: MONITORAMENTO DE PRAZO DE VALIDADE (SHELF-LIFE) */}
            <div className="pt-10 border-t-2 border-dashed border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-amber-100 text-amber-600 p-2 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Análise de Shelf-Life (Vida Útil)</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Relacionamento entre Data de Entrada e Vencimento</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {validityAnalysis.length > 0 ? validityAnalysis.map(item => (
                        <div key={`shelf-${item.id}`} className="bg-slate-50 p-5 rounded-[2rem] border-2 border-white shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase shadow-sm">Entrada Recente</span>
                                    <div className={`px-3 py-1 rounded-lg text-white font-black text-[10px] uppercase shadow-sm ${
                                        item.shelfLifeDays > 180 ? 'bg-green-900 border border-green-700' : 
                                        item.shelfLifeDays > 30 ? 'bg-green-500' : 
                                        item.shelfLifeDays > 15 ? 'bg-orange-500' : 
                                        'bg-red-500'
                                    }`}>
                                        Prazo: {item.shelfLifeDays} dias
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-800 uppercase leading-tight line-clamp-1">{item.itemName}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">{item.supplierName}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 py-2 border-y border-gray-100">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase">Entrada</p>
                                        <p className="text-[11px] font-mono font-bold text-indigo-700">{(item.date || '').split('-').reverse().join('/')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-gray-400 uppercase">Vencimento</p>
                                        <p className="text-[11px] font-mono font-bold text-red-600">{(item.expirationDate || '').split('-').reverse().join('/')}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-[9px] text-gray-400 font-mono">Lote: {item.lotNumber}</p>
                                <span className={`text-[9px] font-black uppercase transition-colors ${item.shelfLifeDays > 180 ? 'text-green-800' : 'text-indigo-400'} group-hover:text-indigo-600`}>Giro Calculado</span>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-12 text-center bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-100 opacity-50">
                            <p className="text-gray-400 font-black uppercase tracking-widest italic">Aguardando entradas com validade informada para gerar análise.</p>
                        </div>
                    )}
                </div>
            </div>

            {isManualModalOpen && (
                <ManualWarehouseMovementModal 
                    suppliers={suppliers} 
                    onClose={() => setIsManualModalOpen(false)} 
                    onSave={async (type, payload) => {
                        const res = type === 'entrada' ? await onRegisterEntry(payload) : await onRegisterWithdrawal(payload);
                        if (res.success) setIsManualModalOpen(false);
                        else alert(res.message);
                    }}
                />
            )}

            {editingLog && (
                <EditWarehouseMovementModal 
                    suppliers={suppliers} 
                    logEntry={editingLog}
                    onClose={() => setEditingLog(null)}
                    onSave={async (updated) => {
                        const res = await onUpdateWarehouseEntry(updated);
                        if (res.success) setEditingLog(null);
                        else alert(res.message);
                    }}
                />
            )}

            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }`}</style>
        </div>
    );
};

// --- Modal de Edição de Registro ---
interface EditWarehouseMovementModalProps {
    suppliers: Supplier[];
    logEntry: WarehouseMovement;
    onClose: () => void;
    onSave: (updated: WarehouseMovement) => Promise<void>;
}

const EditWarehouseMovementModal: React.FC<EditWarehouseMovementModalProps> = ({ suppliers, logEntry, onClose, onSave }) => {
    const [type, setType] = useState<'entrada' | 'saída'>(logEntry.type);
    const [selectedCpf, setSelectedCpf] = useState(() => {
        const found = suppliers.find(s => superNormalize(s.name) === superNormalize(logEntry.supplierName));
        return found ? found.cpf : '';
    });
    const [itemName, setItemName] = useState(logEntry.itemName);
    const [lotNumber, setLotNumber] = useState(logEntry.lotNumber);
    const [barcode, setBarcode] = useState(logEntry.barcode || '');
    const [quantity, setQuantity] = useState(String(logEntry.quantity || 0).replace('.', ','));
    const [documentNumber, setDocumentNumber] = useState(logEntry.inboundInvoice || logEntry.outboundInvoice || '');
    const [date, setDate] = useState(logEntry.date || '');
    const [expirationDate, setExpirationDate] = useState(logEntry.expirationDate || '');
    const [isSaving, setIsSaving] = useState(false);

    const selectedSupplier = useMemo(() => suppliers.find(s => s.cpf === selectedCpf), [suppliers, selectedCpf]);
    const availableItems = useMemo(() => selectedSupplier ? (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)) : [], [selectedSupplier]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const qtyVal = parseFloat(quantity.replace(',', '.'));
        if (!selectedCpf || !itemName || isNaN(qtyVal) || qtyVal <= 0) {
            alert('Preencha todos os campos obrigatórios corretamente.');
            return;
        }

        setIsSaving(true);
        const updated: WarehouseMovement = {
            ...logEntry,
            type,
            date,
            lotNumber,
            itemName,
            barcode,
            supplierName: selectedSupplier?.name || logEntry.supplierName,
            quantity: qtyVal,
            inboundInvoice: type === 'entrada' ? documentNumber : '',
            outboundInvoice: type === 'saída' ? documentNumber : '',
            expirationDate
        };

        await onSave(updated);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[200] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-black text-blue-800 uppercase tracking-tighter">Editar Registro de Estoque</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">ID do Registro: {logEntry.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button type="button" onClick={() => setType('entrada')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${type === 'entrada' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Entrada</button>
                        <button type="button" onClick={() => setType('saída')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${type === 'saída' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>Saída</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fornecedor</label>
                            <select value={selectedCpf} onChange={e => { setSelectedCpf(e.target.value); setItemName(''); }} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 bg-white" required>
                                <option value="">-- SELECIONE --</option>
                                {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Item do Contrato</label>
                            <select value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 bg-white" required disabled={!selectedCpf}>
                                <option value="">-- SELECIONE --</option>
                                {availableItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-blue-600 uppercase ml-1">Código de Barras</label>
                            <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} className="w-full p-2 border-2 border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">Data do Documento</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border-2 border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/30" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">NF/Documento</label>
                            <input type="text" value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lote</label>
                            <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value.toUpperCase())} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-mono" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Quantidade (kg)</label>
                            <input type="text" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^0-9,]/g, ''))} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-mono" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data de Validade</label>
                            <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">Cancelar</button>
                        <button 
                            type="submit" 
                            disabled={isSaving || !selectedCpf || !itemName} 
                            className="px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
                        >
                            {isSaving ? 'Salvando...' : 'Atualizar Registro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Modal de Movimentação Manual ---
interface ManualWarehouseMovementModalProps {
    suppliers: Supplier[];
    onClose: () => void;
    onSave: (type: 'entrada' | 'saída', payload: any) => Promise<void>;
}

const ManualWarehouseMovementModal: React.FC<ManualWarehouseMovementModalProps> = ({ suppliers, onClose, onSave }) => {
    const [type, setType] = useState<'entrada' | 'saída'>('entrada');
    const [selectedCpf, setSelectedCpf] = useState('');
    const [itemName, setItemName] = useState('');
    const [lotNumber, setLotNumber] = useState('');
    const [barcode, setBarcode] = useState('');
    const [quantity, setQuantity] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [expirationDate, setExpirationDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const selectedSupplier = useMemo(() => suppliers.find(s => s.cpf === selectedCpf), [suppliers, selectedCpf]);
    const availableItems = useMemo(() => selectedSupplier ? (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)) : [], [selectedSupplier]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const qtyVal = parseFloat(quantity.replace(',', '.'));
        if (!selectedCpf || !itemName || isNaN(qtyVal) || qtyVal <= 0) {
            alert('Por favor, preencha todos os campos obrigatórios corretamente.');
            return;
        }

        setIsSaving(true);
        const payload = type === 'entrada' ? {
            supplierCpf: selectedCpf,
            itemName: itemName,
            invoiceNumber: documentNumber,
            invoiceDate: date,
            lotNumber: lotNumber || 'MANUAL',
            barcode: barcode,
            quantity: qtyVal,
            expirationDate: expirationDate
        } : {
            supplierCpf: selectedCpf,
            itemName: itemName,
            lotNumber: lotNumber || 'MANUAL',
            barcode: barcode,
            quantity: qtyVal,
            outboundInvoice: documentNumber,
            expirationDate: expirationDate,
            date: date 
        };

        await onSave(type, payload);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-fade-in-up">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Movimentação Manual de Estoque</h2>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Registrar entrada ou saída retroativa</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex p-1 bg-gray-100 rounded-xl">
                        <button 
                            type="button" 
                            onClick={() => setType('entrada')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${type === 'entrada' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Entrada de Estoque
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setType('saída')}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${type === 'saída' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Saída de Estoque
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fornecedor</label>
                            <select value={selectedCpf} onChange={e => { setSelectedCpf(e.target.value); setItemName(''); }} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 bg-white" required>
                                <option value="">-- SELECIONE O FORNECEDOR --</option>
                                {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Item do Contrato</label>
                            <select value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 bg-white" required disabled={!selectedCpf}>
                                <option value="">-- SELECIONE O ITEM --</option>
                                {availableItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-blue-600 uppercase ml-1">Código de Barras (Bipar)</label>
                            <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Bipar Código" className="w-full p-2 border-2 border-blue-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-mono" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">Data do Documento</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border-2 border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 font-bold bg-indigo-50/50" required />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nº NF ou Documento</label>
                            <input type="text" value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder="000123" className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Número do Lote</label>
                            <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value.toUpperCase())} placeholder="LOTE123" className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 font-mono" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Quantidade (kg)</label>
                            <input type="text" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 font-mono" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data de Validade</label>
                            <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">Cancelar</button>
                        <button 
                            type="submit" 
                            disabled={isSaving || !selectedCpf || !itemName} 
                            className={`px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 disabled:bg-gray-300 text-white ${type === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                            {isSaving ? 'Processando...' : `Confirmar ${type}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminWarehouseLog;
