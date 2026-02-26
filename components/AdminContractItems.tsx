
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';

interface AdminContractItemsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  onUpdateContractForItem: (itemName: string, assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string }[]) => Promise<{ success: boolean, message: string }>;
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

const AdminContractItems: React.FC<AdminContractItemsProps> = ({ suppliers = [], warehouseLog = [], onUpdateContractForItem }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [manageItem, setManageItem] = useState<any | null>(null);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('kg-1');

    const itemAggregation = useMemo(() => {
        const map = new Map<string, any>();

        // 1. Agrega Metas de todos os Fornecedores
        suppliers.forEach(s => {
            (s.contractItems || []).forEach(ci => {
                const normName = superNormalize(ci.name);
                const existing = map.get(normName) || {
                    name: ci.name,
                    normName,
                    totalContracted: 0,
                    totalValueContracted: 0,
                    totalDelivered: 0,
                    totalValueDelivered: 0,
                    totalExited: 0,
                    totalValueExited: 0,
                    unit: ci.unit || 'kg-1',
                    suppliersCount: 0,
                    details: []
                };

                existing.totalContracted += Number(ci.totalKg) || 0;
                existing.totalValueContracted += (Number(ci.totalKg) || 0) * (Number(ci.valuePerKg) || 0);
                existing.suppliersCount += 1;
                existing.details.push({ 
                    supplierName: s.name, 
                    supplierCpf: s.cpf, 
                    amount: Number(ci.totalKg), 
                    price: Number(ci.valuePerKg) 
                });
                
                map.set(normName, existing);
            });

            // 2. Agrega Entradas de Notas Fiscais (Deliveries)
            (s.deliveries || []).forEach(del => {
                if (del.item === 'AGENDAMENTO PENDENTE') return;
                const delINorm = superNormalize(del.item || '');
                
                for (const [normKey, data] of map.entries()) {
                    if (normKey === delINorm || normKey.includes(delINorm) || delINorm.includes(normKey)) {
                        data.totalDelivered += Number(del.kg) || 0;
                        data.totalValueDelivered += Number(del.value) || 0;
                    }
                }
            });
        });

        // 3. Agrega Saídas de Notas Fiscais (WarehouseLog com outboundInvoice)
        warehouseLog.forEach(log => {
            if (log.type !== 'saída' || !log.outboundInvoice) return; // Somente saídas com NF
            
            const logINorm = superNormalize(log.itemName);
            
            for (const [normKey, data] of map.entries()) {
                if (normKey === logINorm || normKey.includes(logINorm) || logINorm.includes(normKey)) {
                    const supplierDetail = data.details.find((d: any) => superNormalize(d.supplierName) === superNormalize(log.supplierName));
                    const price = supplierDetail ? supplierDetail.price : (data.details[0]?.price || 0);
                    const qty = Number(log.quantity) || 0;

                    data.totalExited += qty;
                    data.totalValueExited += qty * price;
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
            acc.contractedWeight += item.totalContracted;
            acc.contractedValue += item.totalValueContracted;
            acc.deliveredWeight += item.totalDelivered;
            acc.deliveredValue += item.totalValueDelivered;
            acc.exitedWeight += item.totalExited;
            acc.exitedValue += item.totalValueExited;
            return acc;
        }, { 
            contractedWeight: 0, contractedValue: 0, 
            deliveredWeight: 0, deliveredValue: 0, 
            exitedWeight: 0, exitedValue: 0 
        });
    }, [filteredItems]);

    const handleAddNewItem = () => {
        if (!newItemName.trim()) return;
        setManageItem({
            name: newItemName.toUpperCase(),
            unit: newItemUnit,
            details: []
        });
        setIsAddingItem(false);
        setNewItemName('');
    };

    const handleDeleteItem = async (itemName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir o item "${itemName}" de TODOS os contratos? Esta ação não pode ser desfeita.`)) {
            const res = await onUpdateContractForItem(itemName, []);
            if (!res.success) alert(res.message);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-600 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2 uppercase tracking-tight italic">Gestão Geral por Item</h2>
                    <p className="text-sm text-gray-500 font-medium">Consolidado de todos os contratos: O que foi comprado vs. O que foi entregue (Notas Fiscais).</p>
                </div>
                <button 
                    onClick={() => setIsAddingItem(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-black py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 uppercase text-xs flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Adicionar Novo Item
                </button>
            </div>

            {isAddingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[200] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fade-in-up">
                        <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tighter mb-6">Novo Item de Contrato</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome do Produto</label>
                                <input 
                                    type="text" 
                                    value={newItemName} 
                                    onChange={e => setNewItemName(e.target.value)} 
                                    className="w-full p-3 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-green-400 outline-none font-bold"
                                    placeholder="EX: ARROZ AGULHINHA"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Unidade Padrão</label>
                                <select 
                                    value={newItemUnit} 
                                    onChange={e => setNewItemUnit(e.target.value)}
                                    className="w-full p-3 border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-green-400 outline-none font-bold"
                                >
                                    <option value="kg-1">Quilograma (kg)</option>
                                    <option value="L-1">Litro (L)</option>
                                    <option value="un-1">Unidade (un)</option>
                                    <option value="cx-1">Caixa (cx)</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setIsAddingItem(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold uppercase text-xs">Cancelar</button>
                                <button onClick={handleAddNewItem} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs shadow-md">Continuar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-indigo-500">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Total Contratado (Valor)</p>
                        <p className="text-xl font-black text-indigo-700">{totals.contractedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-green-500">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Entradas (Notas Fiscais)</p>
                        <p className="text-xl font-black text-green-700">{totals.deliveredValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-red-500">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Saídas (Notas Fiscais)</p>
                        <p className="text-xl font-black text-red-700">{totals.exitedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-blue-500">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Saldo a Entregar (Valor)</p>
                        <p className="text-xl font-black text-blue-700">{Math.max(0, totals.contractedValue - totals.deliveredValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-indigo-400">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Total Contratado (Peso)</p>
                        <p className="text-xl font-black text-indigo-600">{totals.contractedWeight.toLocaleString('pt-BR')} kg/L</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-green-400">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Entradas (Peso)</p>
                        <p className="text-xl font-black text-green-600">{totals.deliveredWeight.toLocaleString('pt-BR')} kg/L</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-red-400">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Saídas (Peso)</p>
                        <p className="text-xl font-black text-red-600">{totals.exitedWeight.toLocaleString('pt-BR')} kg/L</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-blue-400">
                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Saldo a Entregar (Peso)</p>
                        <p className="text-xl font-black text-blue-600">{Math.max(0, totals.contractedWeight - totals.deliveredWeight).toLocaleString('pt-BR')} kg/L</p>
                    </div>
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
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length > 0 ? filteredItems.map((item, idx) => {
                                const balance = Math.max(0, item.totalContracted - item.totalDelivered);
                                const pct = Math.min(100, (item.totalDelivered / item.totalContracted) * 100);
                                
                                return (
                                    <tr key={idx} className="hover:bg-green-50/30 transition-colors">
                                        <td className="p-4">
                                            <p className="font-black text-gray-800 uppercase text-xs mb-1.5">{item.name}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {item.details.map((det: any, dIdx: number) => (
                                                    <span key={dIdx} className="inline-block bg-gray-100 text-gray-500 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-gray-200">
                                                        {det.supplierName}
                                                    </span>
                                                ))}
                                            </div>
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
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button 
                                                    onClick={() => setManageItem(item)}
                                                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm"
                                                >
                                                    Gerenciar
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteItem(item.name)}
                                                    className="bg-red-50 text-red-500 hover:bg-red-600 hover:text-white p-2 rounded-lg transition-all shadow-sm"
                                                    title="Excluir Item"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={7} className="p-20 text-center text-gray-400 italic font-black uppercase tracking-widest">Nenhum item localizado no contrato.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {manageItem && (
                <ManageContractSuppliersModal 
                    itemName={manageItem.name} 
                    currentSuppliers={manageItem.details} 
                    allSuppliers={suppliers} 
                    unit={manageItem.unit}
                    category={manageItem.category}
                    comprasCode={manageItem.comprasCode}
                    becCode={manageItem.becCode}
                    onClose={() => setManageItem(null)} 
                    onSave={async (assignments) => {
                        const res = await onUpdateContractForItem(manageItem.name, assignments);
                        if (res.success) setManageItem(null);
                        else alert(res.message);
                    }}
                />
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

// --- Modal de Gestão de Fornecedores por Item ---
interface ManageContractSuppliersModalProps {
    itemName: string;
    currentSuppliers: { supplierName: string, supplierCpf: string, amount: number, price: number }[];
    allSuppliers: Supplier[];
    unit: string;
    category?: string;
    comprasCode?: string;
    becCode?: string;
    onClose: () => void;
    onSave: (assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string, category?: string, comprasCode?: string, becCode?: string }[]) => Promise<void>;
}

const ManageContractSuppliersModal: React.FC<ManageContractSuppliersModalProps> = ({ itemName, currentSuppliers, allSuppliers, unit, category, comprasCode, becCode, onClose, onSave }) => {
    const [assignments, setAssignments] = useState(() => currentSuppliers.map(s => ({
        supplierCpf: s.supplierCpf,
        supplierName: s.supplierName,
        totalKg: String(s.amount).replace('.', ','),
        valuePerKg: String(s.price).replace('.', ','),
        unit: unit,
        category: category || 'OUTROS',
        comprasCode: comprasCode || '',
        becCode: becCode || ''
    })));

    const [itemCategory, setItemCategory] = useState(category || 'OUTROS');
    const [itemComprasCode, setItemComprasCode] = useState(comprasCode || '');
    const [itemBecCode, setItemBecCode] = useState(becCode || '');
    const [newSupplierCpf, setNewSupplierCpf] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const availableSuppliers = useMemo(() => {
        return allSuppliers.filter(s => !assignments.some(a => a.supplierCpf === s.cpf)).sort((a,b) => a.name.localeCompare(b.name));
    }, [allSuppliers, assignments]);

    const handleAddSupplier = () => {
        if (!newSupplierCpf) return;
        const s = allSuppliers.find(x => x.cpf === newSupplierCpf);
        if (s) {
            setAssignments([...assignments, {
                supplierCpf: s.cpf,
                supplierName: s.name,
                totalKg: '0',
                valuePerKg: '0',
                unit: unit
            }]);
            setNewSupplierCpf('');
        }
    };

    const handleRemoveAssignment = (cpf: string) => {
        setAssignments(assignments.filter(a => a.supplierCpf !== cpf));
    };

    const handleValueChange = (cpf: string, field: 'totalKg' | 'valuePerKg', value: string) => {
        setAssignments(assignments.map(a => a.supplierCpf === cpf ? { ...a, [field]: value.replace(/[^0-9,.]/g, '') } : a));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const finalAssignments = assignments.map(a => ({
            supplierCpf: a.supplierCpf,
            totalKg: parseFloat(a.totalKg.replace(',', '.')),
            valuePerKg: parseFloat(a.valuePerKg.replace(',', '.')),
            unit: a.unit,
            category: itemCategory,
            comprasCode: itemComprasCode,
            becCode: itemBecCode
        })).filter(a => !isNaN(a.totalKg));

        await onSave(finalAssignments);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[200] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-8 animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-start mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-black text-indigo-900 uppercase tracking-tighter">Gestão de Fornecedores</h2>
                        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Item: {itemName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="mb-6 bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Categoria do Item</label>
                        <select 
                            value={itemCategory} 
                            onChange={e => setItemCategory(e.target.value)}
                            className="w-full p-2 border rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                        >
                            <option value="OUTROS">OUTROS</option>
                            <option value="KIT PPL">KIT PPL - HIGIÊNE E VESTUÁRIO</option>
                            <option value="PPAIS">PPAIS</option>
                            <option value="ESTOCÁVEIS">ESTOCÁVEIS</option>
                            <option value="PERECÍVEIS">PERECÍVEIS</option>
                            <option value="AUTOMAÇÃO">AUTOMAÇÃO</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Código Compras</label>
                            <input 
                                type="text" 
                                value={itemComprasCode} 
                                onChange={e => setItemComprasCode(e.target.value)}
                                className="w-full p-2 border rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                placeholder="Cód. Compras"
                            />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Código BEC</label>
                            <input 
                                type="text" 
                                value={itemBecCode} 
                                onChange={e => setItemBecCode(e.target.value)}
                                className="w-full p-2 border rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                placeholder="Cód. BEC"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {assignments.map(a => (
                            <div key={a.supplierCpf} className="bg-gray-50 p-4 rounded-2xl border flex flex-col md:flex-row items-center gap-4 group transition-all hover:bg-white hover:shadow-md">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Fornecedor</p>
                                    <p className="font-bold text-gray-800 uppercase text-xs truncate w-full">{a.supplierName}</p>
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Meta ({unit.split('-')[0]})</label>
                                    <input 
                                        type="text" 
                                        value={a.totalKg} 
                                        onChange={e => handleValueChange(a.supplierCpf, 'totalKg', e.target.value)} 
                                        className="w-full p-2 border rounded-xl text-center font-mono text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                    />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">V. Unit. (R$)</label>
                                    <input 
                                        type="text" 
                                        value={a.valuePerKg} 
                                        onChange={e => handleValueChange(a.supplierCpf, 'valuePerKg', e.target.value)} 
                                        className="w-full p-2 border rounded-xl text-center font-mono text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                    />
                                </div>
                                <div className="flex items-center pt-5">
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveAssignment(a.supplierCpf)}
                                        className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                        title="Remover Fornecedor deste item"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {assignments.length === 0 && (
                            <div className="p-12 text-center border-2 border-dashed rounded-3xl text-gray-400 font-bold uppercase tracking-widest">
                                Nenhum fornecedor vinculado a este produto.
                            </div>
                        )}
                    </div>

                    <div className="mt-8 bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                        <h3 className="text-xs font-black text-indigo-600 uppercase mb-4 tracking-widest">Vincular Novo Fornecedor</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <select 
                                value={newSupplierCpf} 
                                onChange={e => setNewSupplierCpf(e.target.value)}
                                className="flex-1 p-3 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                            >
                                <option value="">-- SELECIONE UM FORNECEDOR --</option>
                                {availableSuppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                            </select>
                            <button 
                                type="button" 
                                onClick={handleAddSupplier}
                                disabled={!newSupplierCpf}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3 rounded-xl shadow-md transition-all active:scale-95 uppercase text-[10px] tracking-widest disabled:bg-gray-300"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">Cancelar</button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700 text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 disabled:bg-gray-400"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default AdminContractItems;
