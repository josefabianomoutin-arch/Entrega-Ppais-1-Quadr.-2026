import React, { useState, useMemo } from 'react';
import type { WarehouseMovement } from '../types';

interface AdminWarehouseLogProps {
    warehouseLog: WarehouseMovement[];
}

const AdminWarehouseLog: React.FC<AdminWarehouseLogProps> = ({ warehouseLog }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'entrada' | 'saída'>('all');

    const filteredLog = useMemo(() => {
        return warehouseLog
            .filter(log => {
                const typeMatch = filterType === 'all' || log.type === filterType;
                const searchMatch = searchTerm === '' ||
                    log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (log.outboundInvoice && log.outboundInvoice.includes(searchTerm));
                return typeMatch && searchMatch;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [warehouseLog, searchTerm, filterType]);

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
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">Fornecedor</th>
                            <th className="p-3 text-left text-xs font-bold uppercase text-gray-600">NF Saída</th>
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
                                <td className="p-3 text-gray-600 truncate max-w-xs">{log.supplierName}</td>
                                <td className="p-3 font-mono text-gray-600">{log.outboundInvoice || 'N/A'}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-gray-400 italic">
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