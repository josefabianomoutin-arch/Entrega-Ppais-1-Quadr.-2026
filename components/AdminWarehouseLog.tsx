
import React, { useState, useMemo, useRef } from 'react';
import type { WarehouseMovement, Supplier } from '../types';

interface AdminWarehouseLogProps {
    warehouseLog: WarehouseMovement[];
    suppliers: Supplier[];
    onDeleteEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
    onRegisterEntry: (payload: any) => Promise<{ success: boolean; message: string }>;
    onRegisterWithdrawal: (payload: any) => Promise<{ success: boolean; message: string }>;
}

// Helper para normalizar strings para comparação (remove acentos e espaços extras)
const fuzzyNormalize = (text: string) => {
    return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9]/g, "") // remove tudo que não for letra ou número
        .trim();
};

const normalizeType = (type: string) => {
    return type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const AdminWarehouseLog: React.FC<AdminWarehouseLogProps> = ({ warehouseLog, suppliers, onDeleteEntry, onRegisterEntry, onRegisterWithdrawal }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'entrada' | 'saída'>('all');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mapeia unidades para exibição amigável
    const itemUnitInfoMap = useMemo(() => {
        const map = new Map<string, { name: string; factorToKg: number }>();
        suppliers.forEach(s => {
            (s.contractItems || []).forEach(ci => {
                const itemName = ci.name.toUpperCase().trim();
                if (!map.has(itemName)) {
                    if (!ci.unit) {
                        map.set(itemName, { name: 'Kg', factorToKg: 1 });
                    } else {
                        const [type, weightStr] = ci.unit.split('-');
                        const nameMap: { [key: string]: string } = { saco: 'Sacos', balde: 'Baldes', embalagem: 'Litros', kg: 'Kg', litro: 'Litros', caixa: 'Litros', pacote: 'Pacotes', pote: 'Potes', dz: 'Dúzias', un: 'Unidades' };
                        const name = nameMap[type] || 'Unidades';
                        let factorToKg = parseFloat(weightStr);
                        if (type === 'dz') factorToKg = 0;
                        else if (isNaN(factorToKg)) factorToKg = 1;
                        map.set(itemName, { name, factorToKg });
                    }
                }
            });
        });
        return map;
    }, [suppliers]);

    const existingSignatures = useMemo(() => {
        const signatures = new Set<string>();
        warehouseLog.forEach(log => {
            const nf = (log.inboundInvoice || log.outboundInvoice || '').trim().toUpperCase();
            const type = normalizeType(log.type);
            const sig = `${type}|${log.itemName.toUpperCase().trim()}|${log.supplierName.toUpperCase().trim()}|${nf}|${log.lotNumber.toUpperCase().trim()}|${(log.quantity || 0).toFixed(4)}`;
            signatures.add(sig);
        });
        return signatures;
    }, [warehouseLog]);

    const filteredLog = useMemo(() => {
        return warehouseLog
            .filter(log => {
                const typeMatch = filterType === 'all' || normalizeType(log.type) === normalizeType(filterType);
                const searchMatch = searchTerm === '' ||
                    log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (log.outboundInvoice && log.outboundInvoice.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (log.inboundInvoice && log.inboundInvoice.toLowerCase().includes(searchTerm.toLowerCase()));
                return typeMatch && searchMatch;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [warehouseLog, searchTerm, filterType]);

    const getDisplayQuantity = (log: WarehouseMovement): string => {
        const unitInfo = itemUnitInfoMap.get(log.itemName.toUpperCase().trim());
        const quantityKg = log.quantity || 0;

        if (unitInfo && unitInfo.factorToKg > 0) {
            const quantityInUnit = quantityKg / unitInfo.factorToKg;
            return `${quantityInUnit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${unitInfo.name}`;
        }
        return `${quantityKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg`;
    };

    const handleDelete = async (log: WarehouseMovement) => {
        const displayQuantity = getDisplayQuantity(log);
        const confirmationMessage = `Tem certeza que deseja excluir esta entrada?\n\nItem: ${log.itemName}\nLote: ${log.lotNumber}\nQuantidade: ${displayQuantity}\nFornecedor: ${log.supplierName}\n\nEsta ação irá remover o lote do estoque e devolver o saldo ao contrato. A ação não pode ser desfeita.`;
        if (window.confirm(confirmationMessage)) {
            setIsDeleting(log.id);
            const result = await onDeleteEntry(log);
            alert(result.message);
            setIsDeleting(null);
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ["Tipo (ENTRADA ou SAIDA)", "Item (Nome Exato)", "Fornecedor (Nome Exato)", "NF", "Lote", "Quantidade (em Kg ou Litro)", "Data Movimentacao (AAAA-MM-DD)", "Vencimento (AAAA-MM-DD)"];
        const csvContent = "\uFEFF" + headers.join(";");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_estoque_offline.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let text = e.target?.result as string;
            text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            
            const lines = text.split('\n');
            if (lines.length <= 1) {
                alert("Arquivo vazio ou inválido.");
                return;
            }

            setIsImporting(true);
            let successCount = 0;
            let errorCount = 0;
            let duplicateCount = 0;
            let errorDetails: string[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                let columns = line.split(";");
                if (columns.length < 5) columns = line.split(",");
                
                if (columns.length < 6) {
                    errorCount++;
                    continue;
                }

                const [tipoRaw, csvItemName, supplierName, nf, lote, qtd, data, venc] = columns.map(c => c.trim());
                const isEntrada = tipoRaw.toUpperCase().includes('ENTRADA');
                const tipoNormalized = isEntrada ? 'entrada' : 'saida';
                const qtyVal = parseFloat(qtd.replace(',', '.'));
                
                if (isNaN(qtyVal)) {
                    errorCount++;
                    errorDetails.push(`Linha ${i+1}: Qtd inválida.`);
                    continue;
                }

                // Busca o fornecedor primeiro
                const supplier = suppliers.find(s => fuzzyNormalize(s.name) === fuzzyNormalize(supplierName));
                if (!supplier) {
                    errorCount++;
                    errorDetails.push(`Linha ${i+1}: Fornecedor '${supplierName}' não localizado.`);
                    continue;
                }

                // Busca o item exato no contrato desse fornecedor (Fuzzy Match)
                const officialItem = supplier.contractItems.find(ci => fuzzyNormalize(ci.name) === fuzzyNormalize(csvItemName));
                if (!officialItem) {
                    errorCount++;
                    errorDetails.push(`Linha ${i+1}: Item '${csvItemName}' não existe no contrato de ${supplier.name}.`);
                    continue;
                }

                // Agora usamos o nome oficial para a assinatura de duplicidade e registro
                const officialName = officialItem.name;
                const rowSignature = `${tipoNormalized}|${officialName.toUpperCase().trim()}|${supplier.name.toUpperCase().trim()}|${nf.toUpperCase().trim()}|${lote.toUpperCase().trim()}|${qtyVal.toFixed(4)}`;
                
                if (existingSignatures.has(rowSignature)) {
                    duplicateCount++;
                    continue;
                }

                try {
                    let result;
                    if (isEntrada) {
                        result = await onRegisterEntry({
                            supplierCpf: supplier.cpf,
                            itemName: officialName,
                            invoiceNumber: nf,
                            invoiceDate: data || new Date().toISOString().split('T')[0],
                            lotNumber: lote,
                            quantity: qtyVal,
                            expirationDate: venc || ''
                        });
                    } else {
                        result = await onRegisterWithdrawal({
                            supplierCpf: supplier.cpf,
                            itemName: officialName,
                            outboundInvoice: nf,
                            lotNumber: lote,
                            quantity: qtyVal,
                            expirationDate: venc || ''
                        });
                    }

                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                        errorDetails.push(`Linha ${i+1}: ${result.message}`);
                    }
                } catch (err) {
                    errorCount++;
                }
            }

            setIsImporting(false);
            alert(`Processamento Concluído!\n\n` +
                  `✅ Novos registros: ${successCount}\n` +
                  `⏭️ Já existiam (puldados): ${duplicateCount}\n` +
                  `❌ Erros: ${errorCount}` +
                  (errorDetails.length > 0 ? `\n\nResumo de erros:\n${errorDetails.slice(0, 3).join('\n')}` : ''));
            
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-gray-700 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Histórico de Estoque</h2>
                    <p className="text-gray-400 font-medium">Visualize movimentações e importe planilhas (Duplicidades são ignoradas).</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <button 
                        onClick={handleDownloadTemplate}
                        className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg text-xs border border-gray-300 transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Modelo CSV
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-2 shadow-md disabled:bg-indigo-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        {isImporting ? 'Lendo Arquivo...' : 'Importar Planilha'}
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".csv"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4 flex-wrap w-full">
                    <input
                        type="text"
                        placeholder="Pesquisar por item, fornecedor, NF ou lote..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all"
                    />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all bg-white"
                    >
                        <option value="all">Todos os Tipos</option>
                        <option value="entrada">Entradas</option>
                        <option value="saída">Saídas</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[65vh] pr-2 custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Tipo</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Data e Hora</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Produto</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Lote</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Vencimento</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Fornecedor</th>
                            <th className="p-3 text-right text-xs font-bold uppercase text-gray-600">Quantidade</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Nota Fiscal</th>
                            <th className="p-3 text-center text-xs font-bold uppercase text-gray-600">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLog.length > 0 ? filteredLog.map(log => (
                            <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-3">
                                    {normalizeType(log.type) === 'entrada' ? (
                                        <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">Entrada</span>
                                    ) : (
                                        <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded-full">Saída</span>
                                    )}
                                </td>
                                <td className="p-3 font-mono text-gray-600">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                <td className="p-3 font-semibold text-gray-800 uppercase">{log.itemName}</td>
                                <td className="p-3 font-mono">{log.lotNumber}</td>
                                <td className="p-3 font-mono text-gray-600">
                                    {log.expirationDate ? new Date(log.expirationDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                </td>
                                <td className="p-3 text-gray-600 truncate max-w-xs">{log.supplierName}</td>
                                <td className="p-3 text-right font-mono text-gray-800">
                                    {getDisplayQuantity(log)}
                                </td>
                                <td className="p-3 font-mono text-gray-600">
                                    {normalizeType(log.type) === 'entrada' ? (log.inboundInvoice || 'N/A') : (log.outboundInvoice || 'N/A')}
                                </td>
                                <td className="p-3 text-center">
                                    {normalizeType(log.type) === 'entrada' && (
                                        <button
                                            onClick={() => handleDelete(log)}
                                            disabled={isDeleting === log.id}
                                            className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-wait p-1 rounded-full transition-colors"
                                            title="Excluir Entrada"
                                        >
                                            {isDeleting === log.id ? (
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            )}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={9} className="p-12 text-center text-gray-400 italic">
                                    Nenhuma movimentação encontrada para os filtros selecionados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminWarehouseLog;
