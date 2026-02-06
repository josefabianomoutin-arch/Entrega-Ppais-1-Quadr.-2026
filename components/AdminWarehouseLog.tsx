
import React, { useState, useMemo, useRef } from 'react';
import type { WarehouseMovement, Supplier } from '../types';

interface AdminWarehouseLogProps {
    warehouseLog: WarehouseMovement[];
    suppliers: Supplier[];
    onDeleteEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

// Normalização absoluta para comparação de strings
const superNormalize = (text: string) => {
    return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

const AdminWarehouseLog: React.FC<AdminWarehouseLogProps> = ({ warehouseLog, suppliers, onDeleteEntry, onRegisterEntry, onRegisterWithdrawal }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'entrada' | 'saída'>('all');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredLog = useMemo(() => {
        return warehouseLog
            .filter(log => {
                const typeMatch = filterType === 'all' || log.type === filterType;
                const searchMatch = searchTerm === '' ||
                    log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
                return typeMatch && searchMatch;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [warehouseLog, searchTerm, filterType]);

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

                const [tipoRaw, csvItem, csvSupplier, nf, lote, qtd, data, venc] = cols.map(c => c.trim());
                const isEntrada = tipoRaw.toUpperCase().includes('ENTRADA');
                
                // Melhoria no parsing: Remove pontos (milhar) e troca vírgula por ponto (decimal)
                const sanitizedQty = qtd.replace(/\./g, '').replace(',', '.');
                const qtyVal = parseFloat(sanitizedQty);

                if (isNaN(qtyVal)) { errorCount++; errorDetails.push(`Linha ${i+1}: Quantidade '${qtd}' inválida.`); continue; }

                // Busca o fornecedor ignorando acentos
                const supplier = suppliers.find(s => superNormalize(s.name) === superNormalize(csvSupplier));
                if (!supplier) { errorCount++; errorDetails.push(`Linha ${i+1}: Fornecedor '${csvSupplier}' não localizado.`); continue; }

                // Busca o item exato no contrato (Tradução Fuzzy)
                const officialItem = supplier.contractItems.find(ci => superNormalize(ci.name) === superNormalize(csvItem));
                if (!officialItem) { errorCount++; errorDetails.push(`Linha ${i+1}: Item '${csvItem}' não consta no contrato de ${supplier.name}.`); continue; }

                try {
                    let res;
                    if (isEntrada) {
                        res = await onRegisterEntry({ supplierCpf: supplier.cpf, itemName: officialItem.name, invoiceNumber: nf, invoiceDate: data || new Date().toISOString().split('T')[0], lotNumber: lote, quantity: qtyVal, expirationDate: venc || '' });
                    } else {
                        res = await onRegisterWithdrawal({ supplierCpf: supplier.cpf, itemName: officialItem.name, outboundInvoice: nf, lotNumber: lote, quantity: qtyVal, expirationDate: venc || '' });
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
        <div className="bg-white p-6 rounded-2xl shadow shadow-lg max-w-7xl mx-auto border-t-8 border-gray-700 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Histórico de Estoque</h2>
                    <p className="text-gray-400 font-medium">Gerencie as movimentações e importe planilhas de entrada/saída.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-2 disabled:bg-indigo-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        {isImporting ? 'Importando...' : 'Importar Planilha'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv" />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-64 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all" />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all bg-white">
                    <option value="all">Todos</option>
                    <option value="entrada">Entradas</option>
                    <option value="saída">Saídas</option>
                </select>
            </div>

            <div className="overflow-x-auto max-h-[65vh] custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Tipo</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Data</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Produto</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Lote</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Fornecedor</th>
                            <th className="p-3 text-right text-xs font-bold uppercase text-gray-600">Quantidade</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">NF</th>
                            <th className="p-3 text-center text-xs font-bold uppercase text-gray-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLog.map(log => (
                            <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${log.type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.type}</span>
                                </td>
                                <td className="p-3 font-mono text-gray-600">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</td>
                                <td className="p-3 font-semibold text-gray-800 uppercase">{log.itemName}</td>
                                <td className="p-3 font-mono">{log.lotNumber}</td>
                                <td className="p-3 text-gray-600">{log.supplierName}</td>
                                <td className="p-3 text-right font-mono text-gray-800">
                                    {(log.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                                </td>
                                <td className="p-3 font-mono text-gray-600">{log.inboundInvoice || log.outboundInvoice || '-'}</td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => handleDelete(log)} 
                                        disabled={isDeleting === log.id}
                                        className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                                        title="Excluir Registro"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }`}</style>
        </div>
    );
};

export default AdminWarehouseLog;
