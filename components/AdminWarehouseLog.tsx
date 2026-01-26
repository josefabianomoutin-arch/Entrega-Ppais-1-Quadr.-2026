import React, { useState, useMemo } from 'react';
import type { WarehouseMovement } from '../types';

interface AdminWarehouseLogProps {
    warehouseLog: WarehouseMovement[];
    onDeleteEntry: (logEntry: WarehouseMovement) => Promise<{ success: boolean; message: string }>;
}

const AdminWarehouseLog: React.FC<AdminWarehouseLogProps> = ({ warehouseLog, onDeleteEntry }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'entrada' | 'saída'>('all');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const filteredLog = useMemo(() => {
        return warehouseLog
            .filter(log => {
                const typeMatch = filterType === 'all' || log.type === filterType;
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

    const handleDelete = async (log: WarehouseMovement) => {
        const confirmationMessage = `Tem certeza que deseja excluir esta entrada?\n\nItem: ${log.itemName}\nLote: ${log.lotNumber}\nQuantidade: ${(log.quantity || 0).toFixed(2).replace('.', ',')} Kg\nFornecedor: ${log.supplierName}\n\nEsta ação irá remover o lote do estoque e devolver o saldo ao contrato. A ação não pode ser desfeita.`;
        if (window.confirm(confirmationMessage)) {
            setIsDeleting(log.id);
            const result = await onDeleteEntry(log);
            alert(result.message); // Simple feedback
            setIsDeleting(null);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-gray-700 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Controle de Almoxarifado</h2>
                    <p className="text-gray-400 font-medium">Histórico de entradas e saídas de lotes.</p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-auto border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all"
                    />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-400 transition-all bg-white"
                    >
                        <option value="all">Todos os Tipos</option>
                        <option value="entrada">Apenas Entradas</option>
                        <option value="saída">Apenas Saídas</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[65vh] pr-2 custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
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
                                    {log.type === 'entrada' ? (
                                        <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">Entrada</span>
                                    ) : (
                                        <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded-full">Saída</span>
                                    )}
                                </td>
                                <td className="p-3 font-mono text-gray-600">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                <td className="p-3 font-semibold text-gray-800">{log.itemName}</td>
                                <td className="p-3 font-mono">{log.lotNumber}</td>
                                <td className="p-3 font-mono text-gray-600">
                                    {log.expirationDate ? new Date(log.expirationDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                </td>
                                <td className="p-3 text-gray-600 truncate max-w-xs">{log.supplierName}</td>
                                <td className="p-3 text-right font-mono text-gray-800">
                                    {log.quantity !== undefined ? `${log.quantity.toFixed(2).replace('.', ',')} Kg` : '-'}
                                </td>
                                <td className="p-3 font-mono text-gray-600">
                                    {log.type === 'entrada' ? log.inboundInvoice || 'N/A' : log.outboundInvoice || 'N/A'}
                                </td>
                                <td className="p-3 text-center">
                                    {log.type === 'entrada' && (
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
            `}</style>
        </div>
    );
};

export default AdminWarehouseLog;