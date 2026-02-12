
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Supplier, WarehouseMovement, ContractItem } from '../types';

interface AlmoxarifadoDashboardProps {
    suppliers: Supplier[];
    warehouseLog: WarehouseMovement[];
    onLogout: () => void;
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

const AlmoxarifadoDashboard: React.FC<AlmoxarifadoDashboardProps> = ({ suppliers, warehouseLog, onLogout, onRegisterEntry, onRegisterWithdrawal }) => {
    const [isImporting, setIsImporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'import' | 'manual'>('manual');
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    const recentMovements = useMemo(() => {
        return warehouseLog
            .slice()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 15);
    }, [warehouseLog]);

    const selectedSupplier = useMemo(() => 
        suppliers.find(s => s.cpf === selectedSupplierCpf), 
    [suppliers, selectedSupplierCpf]);

    const availableItems = useMemo(() => 
        selectedSupplier ? (selectedSupplier.contractItems || []).sort((a,b) => a.name.localeCompare(b.name)) : [], 
    [selectedSupplier]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const qtyVal = parseFloat(manualQuantity.replace(',', '.'));
        if (!selectedSupplierCpf || !selectedItemName || isNaN(qtyVal) || qtyVal <= 0) {
            alert('Preencha os campos obrigatórios corretamente.');
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
                    lotNumber: manualLot || 'MANUAL',
                    quantity: qtyVal,
                    expirationDate: manualExp,
                    barcode: manualBarcode
                })
                : await onRegisterWithdrawal({
                    supplierCpf: selectedSupplierCpf,
                    itemName: selectedItemName,
                    outboundInvoice: manualNf,
                    lotNumber: manualLot || 'MANUAL',
                    quantity: qtyVal,
                    expirationDate: manualExp,
                    date: manualDate,
                    barcode: manualBarcode
                });

            if (res.success) {
                // Limpa apenas os campos de item/barcode/qtd para facilitar o próximo lançamento
                setSelectedItemName('');
                setManualBarcode('');
                setManualQuantity('');
                barcodeInputRef.current?.focus();
            } else {
                alert(res.message);
            }
        } catch (err) {
            alert('Erro ao processar lançamento.');
        } finally {
            setIsSubmitting(false);
        }
    };

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

                // Esperado: Tipo; Item; Fornecedor; NF; Lote; Qtd; Data; Vencimento; CódigoBarras
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
            alert(`Processamento concluído!\n✅ Sucessos: ${successCount}\n❌ Erros: ${errorCount}${errorDetails.length > 0 ? `\n\nResumo de erros:\n${errorDetails.slice(0, 3).join('\n')}` : ''}`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 pb-20">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-20 border-b-2 border-blue-100">
                <div>
                    <h1 className="text-2xl font-bold text-blue-900 uppercase tracking-tighter">Módulo Almoxarifado</h1>
                    <p className="text-xs text-gray-500 font-medium">Gestão de Estoque com Suporte a Bipagem.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('manual')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Lançar Individual</button>
                        <button onClick={() => setActiveTab('import')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'import' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Importar CSV</button>
                    </div>
                    <button onClick={onLogout} className="bg-red-50 text-red-600 font-black py-2 px-6 rounded-xl text-xs uppercase border border-red-100 shadow-sm active:scale-95">Sair</button>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
                
                {activeTab === 'manual' ? (
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-indigo-600 animate-fade-in">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Lançamento por Item / Bipagem</h2>
                                <p className="text-gray-500 font-medium italic">Selecione o fornecedor e bipa o código de barras para registrar.</p>
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
                                <button type="button" onClick={() => setManualType('entrada')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${manualType === 'entrada' ? 'bg-white text-green-600 shadow-md' : 'text-gray-400'}`}>Entrada</button>
                                <button type="button" onClick={() => setManualType('saída')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${manualType === 'saída' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'}`}>Saída</button>
                            </div>
                        </div>

                        <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fornecedor</label>
                                <select value={selectedSupplierCpf} onChange={e => { setSelectedSupplierCpf(e.target.value); setSelectedItemName(''); }} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-400">
                                    <option value="">-- SELECIONAR --</option>
                                    {suppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Item do Contrato</label>
                                <select value={selectedItemName} onChange={e => setSelectedItemName(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-400" disabled={!selectedSupplierCpf}>
                                    <option value="">-- SELECIONAR --</option>
                                    {availableItems.map(ci => <option key={ci.name} value={ci.name}>{ci.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-blue-600 uppercase ml-1 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2h1v1h-1V5z" clipRule="evenodd" /><path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2H10a1 1 0 01-1-1zM7 11a1 1 0 100-2H4a1 1 0 100 2h3zM17 13a1 1 0 01-1 1h-2a1 1 0 110-2h2a1 1 0 011 1zM14 17a1 1 0 100-2h-3a1 1 0 100 2h3z" /></svg>
                                    Código de Barras (Bipar)
                                </label>
                                <input ref={barcodeInputRef} type="text" value={manualBarcode} onChange={e => setManualBarcode(e.target.value)} placeholder="Aguardando scanner..." className="w-full p-3 border rounded-xl bg-white border-blue-100 font-mono focus:ring-4 focus:ring-blue-100 outline-none" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Quantidade</label>
                                <input type="text" value={manualQuantity} onChange={e => setManualQuantity(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="0,00" className="w-full p-3 border rounded-xl bg-gray-50 font-black text-center text-lg outline-none focus:ring-2 focus:ring-blue-400" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">NF / Documento</label>
                                <input type="text" value={manualNf} onChange={e => setManualNf(e.target.value)} placeholder="Nº da Nota" className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lote</label>
                                <input type="text" value={manualLot} onChange={e => setManualLot(e.target.value.toUpperCase())} placeholder="Opcional" className="w-full p-3 border rounded-xl bg-gray-50 font-mono outline-none focus:ring-2 focus:ring-blue-400" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data do Movimento</label>
                                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Validade</label>
                                <input type="date" value={manualExp} onChange={e => setManualExp(e.target.value)} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-400" />
                            </div>
                            <div className="flex items-end">
                                <button type="submit" disabled={isSubmitting || !selectedSupplierCpf || !selectedItemName} className={`w-full py-4 rounded-xl font-black uppercase text-sm tracking-widest shadow-lg transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 text-white ${manualType === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                    {isSubmitting ? 'Registrando...' : `Confirmar ${manualType}`}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-600 text-center space-y-6 animate-fade-in">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H5a2 2 0 00-2 2v6a2 2 0 002 2h22a2 2 0 002-2v-6a2 2 0 00-2-2h-1a4 4 0 00-4 4v2m0-10l-4-4m0 0l-4 4m4-4v12" /></svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Atualizar Estoque em Massa</h2>
                            <p className="text-gray-500 font-medium">Selecione a planilha de histórico (CSV) para processar entradas e saídas.</p>
                        </div>
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isImporting}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-12 rounded-2xl transition-all shadow-lg active:scale-95 disabled:bg-gray-400 flex items-center gap-3 mx-auto uppercase tracking-widest text-sm"
                        >
                            {isImporting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Processando Arquivo...
                                </>
                            ) : 'Importar Planilha .CSV'}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                        
                        <div className="pt-4 text-left max-w-lg mx-auto bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">Formato da Planilha (9 colunas):</p>
                            <code className="text-[9px] font-mono text-blue-700 leading-none">Tipo; Item; Fornecedor; NF; Lote; Quantidade; Data; Validade; CódigoBarras</code>
                        </div>
                    </div>
                )}

                {/* Tabela de Movimentações Recentes */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <h3 className="text-xl font-black text-gray-800 uppercase mb-6 tracking-tight border-b pb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Últimas 15 Movimentações
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                    <th className="p-4 text-left">Tipo</th>
                                    <th className="p-4 text-left">Data do Doc</th>
                                    <th className="p-4 text-left">Item</th>
                                    <th className="p-4 text-left">Barras</th>
                                    <th className="p-4 text-right">Quantidade</th>
                                    <th className="p-4 text-left">NF/Documento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentMovements.length > 0 ? recentMovements.map(mov => (
                                    <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            {mov.type === 'entrada' ? (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Entrada</span>
                                            ) : (
                                                <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">Saída</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-indigo-700 font-mono font-bold">{(mov.date || '').split('-').reverse().join('/')}</td>
                                        <td className="p-4">
                                            <p className="font-bold text-gray-700 uppercase text-xs">{mov.itemName}</p>
                                            <p className="text-[9px] text-gray-400 uppercase font-medium">{mov.supplierName}</p>
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-400">{mov.barcode || '-'}</td>
                                        <td className="p-4 text-right font-mono font-black text-gray-800">
                                            {(mov.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                        </td>
                                        <td className="p-4 text-xs text-gray-500 font-mono">{mov.inboundInvoice || mov.outboundInvoice || '-'}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic">Nenhuma movimentação para exibir.</td></tr>
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
