
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';

interface AdminContractItemsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
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

const AdminContractItems: React.FC<AdminContractItemsProps> = ({ suppliers = [], warehouseLog = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const itemAggregation = useMemo(() => {
        const map = new Map<string, any>();

        // 1. Agrega Metas de todos os Fornecedores
        suppliers.forEach(s => {
            s.contractItems.forEach(ci => {
                const normName = superNormalize(ci.name);
                const existing = map.get(normName) || {
                    name: ci.name,
                    normName,
                    totalContracted: 0,
                    totalDelivered: 0,
                    unit: ci.unit || 'kg-1',
                    suppliersCount: 0,
                    details: []
                };

                existing.totalContracted += Number(ci.totalKg) || 0;
                existing.suppliersCount += 1;
                existing.details.push({ supplierName: s.name, amount: Number(ci.totalKg) });
                
                map.set(normName, existing);
            });
        });

        // 2. Agrega Entregas do Almoxarifado
        warehouseLog.forEach(log => {
            if (log.type !== 'entrada') return;
            const logINorm = superNormalize(log.itemName);
            
            // Procura match exato ou parcial (ex: "Banana" -> "Banana Nanica")
            for (const [normKey, data] of map.entries()) {
                if (normKey === logINorm || normKey.includes(logINorm) || logINorm.includes(normKey)) {
                    data.totalDelivered += Number(log.quantity) || 0;
                }
            }
        });

        return Array.from(map.values())
            .filter(item => item.totalContracted > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers, warehouseLog]);

    const filteredItems = useMemo(() => {
        return itemAggregation.filter(i => 
            i.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [itemAggregation, searchTerm]);

    const totals = useMemo(() => {
        return filteredItems.reduce((acc, item) => {
            acc.contracted += item.totalContracted;
            acc.delivered += item.totalDelivered;
            return acc;
        }, { contracted: 0, delivered: 0 });
    }, [filteredItems]);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-600">
                <h2 className="text-2xl font-bold text-gray-800 mb-2 uppercase tracking-tight italic">Gestão Geral por Item</h2>
                <p className="text-sm text-gray-500 font-medium">Consolidado de todos os contratos: O que foi comprado vs. O que entrou no estoque.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-lg border-b-8 border-indigo-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Contratado (Global)</p>
                    <p className="text-2xl font-black text-indigo-700">{totals.contracted.toLocaleString('pt-BR')} kg/L</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg border-b-8 border-green-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Recebido no Almoxarifado</p>
                    <p className="text-2xl font-black text-green-700">{totals.delivered.toLocaleString('pt-BR')} kg/L</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg border-b-8 border-blue-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saldo a Receber</p>
                    <p className="text-2xl font-black text-blue-700">{Math.max(0, totals.contracted - totals.delivered).toLocaleString('pt-BR')} kg/L</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-xl">
                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="Pesquisar produto no contrato..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-96 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 font-bold transition-all"
                    />
                </div>

                <div className="overflow-x-auto rounded-2xl border-2 border-gray-50">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                            <tr>
                                <th className="p-4 text-left">Produto do Contrato</th>
                                <th className="p-4 text-center">Unid.</th>
                                <th className="p-4 text-right">Meta Total</th>
                                <th className="p-4 text-right">Entregue</th>
                                <th className="p-4 text-right">Saldo</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length > 0 ? filteredItems.map((item, idx) => {
                                const balance = Math.max(0, item.totalContracted - item.totalDelivered);
                                const pct = Math.min(100, (item.totalDelivered / item.totalContracted) * 100);
                                
                                return (
                                    <tr key={idx} className="hover:bg-green-50/30 transition-colors">
                                        <td className="p-4">
                                            <p className="font-black text-gray-800 uppercase text-xs">{item.name}</p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{item.suppliersCount} Fornecedor(es) vinculado(s)</p>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase">{item.unit.split('-')[0]}</span>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-gray-600">{item.totalContracted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-4 text-right font-mono font-bold text-green-600">{item.totalDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-4 text-right font-mono font-black text-blue-600">{balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-4 text-center">
                                            <div className="w-24 bg-gray-100 rounded-full h-2 mx-auto overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }}></div>
                                            </div>
                                            <span className="text-[9px] font-black text-gray-400">{pct.toFixed(0)}%</span>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={6} className="p-20 text-center text-gray-400 italic font-black uppercase tracking-widest">Nenhum item localizado no contrato.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AdminContractItems;
