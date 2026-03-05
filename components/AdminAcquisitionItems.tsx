
import React, { useState, useMemo } from 'react';
import type { AcquisitionItem, Supplier } from '../types';
import { ManageContractSuppliersModal } from './AdminContractItems';

interface AdminAcquisitionItemsProps {
    items: AcquisitionItem[];
    category: 'KIT PPL' | 'PPAIS' | 'ESTOCÁVEIS' | 'PERECÍVEIS' | 'AUTOMAÇÃO' | 'PRODUTOS DE LIMPEZA';
    onUpdate: (item: AcquisitionItem) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    contractItems?: string[]; // Lista de nomes de itens do contrato para vinculação
    suppliers?: Supplier[];
    onUpdateContractForItem?: (itemName: string, assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string, category?: string, comprasCode?: string, becCode?: string }[]) => Promise<{ success: boolean, message: string }>;
}

const AdminAcquisitionItems: React.FC<AdminAcquisitionItemsProps> = ({ items, category, onUpdate, onDelete, contractItems = [], suppliers = [], onUpdateContractForItem }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [manageItem, setManageItem] = useState<AcquisitionItem | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [contractItemName, setContractItemName] = useState('');
    const [comprasCode, setComprasCode] = useState('');
    const [becCode, setBecCode] = useState('');
    const [expenseNature, setExpenseNature] = useState('');
    const [unit, setUnit] = useState('un');
    const [acquiredQuantity, setAcquiredQuantity] = useState('0');
    const [stockBalance, setStockBalance] = useState('0');
    const [unitValue, setUnitValue] = useState('0');

    const filteredItems = items.filter(item => 
        item.category === category &&
        (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.comprasCode?.includes(searchTerm) ||
         item.becCode?.includes(searchTerm))
    );

    const handleSave = async () => {
        if (!name) return;

        const item: AcquisitionItem = {
            id: editingId || `acq-${Date.now()}`,
            name: name.toUpperCase(),
            contractItemName,
            comprasCode,
            becCode,
            expenseNature,
            unit,
            acquiredQuantity: parseFloat(acquiredQuantity.replace(',', '.')) || 0,
            stockBalance: parseFloat(stockBalance.replace(',', '.')) || 0,
            unitValue: parseFloat(unitValue.replace(',', '.')) || 0,
            category
        };

        await onUpdate(item);
        resetForm();
    };

    const resetForm = () => {
        setName('');
        setContractItemName('');
        setComprasCode('');
        setBecCode('');
        setExpenseNature('');
        setUnit('un');
        setAcquiredQuantity('0');
        setStockBalance('0');
        setUnitValue('0');
        setIsAdding(false);
        setEditingId(null);
    };

    const startEdit = (item: AcquisitionItem) => {
        setName(item.name);
        setContractItemName(item.contractItemName || '');
        setComprasCode(item.comprasCode || '');
        setBecCode(item.becCode || '');
        setExpenseNature(item.expenseNature || '');
        setUnit(item.unit);
        setAcquiredQuantity(String(item.acquiredQuantity).replace('.', ','));
        setStockBalance(String(item.stockBalance).replace('.', ','));
        setUnitValue(String(item.unitValue || 0).replace('.', ','));
        setEditingId(item.id);
        setIsAdding(true);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-xl border-b-4 border-indigo-600">
                <div className="relative flex-1 w-full">
                    <input 
                        type="text" 
                        placeholder="Pesquisar produto..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold transition-all shadow-inner"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Novo Produto
                </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-2xl overflow-x-auto border border-gray-100">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                            <th className="p-5 text-left min-w-[250px]">Produto para aquisição</th>
                            <th className="p-5 text-left min-w-[150px]">Produto do Contrato</th>
                            <th className="p-5 text-center whitespace-nowrap">Cod. Compras / BEC</th>
                            <th className="p-5 text-center whitespace-nowrap">Natureza de Despesa</th>
                            <th className="p-5 text-center">Unid.</th>
                            <th className="p-5 text-right whitespace-nowrap">Qtd. Adquirida</th>
                            <th className="p-5 text-right whitespace-nowrap">Saldo Estoque</th>
                            <th className="p-5 text-right whitespace-nowrap">Valor Unit.</th>
                            <th className="p-5 text-right whitespace-nowrap">Valor Total</th>
                            <th className="p-5 text-center sticky right-0 bg-gray-900 z-10">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredItems.map(item => (
                            <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="p-5 font-black text-indigo-950 uppercase text-xs">{item.name}</td>
                                <td className="p-5 font-bold text-gray-500 uppercase text-[10px] italic">
                                    {item.contractItemName || <span className="text-red-300">Não vinculado</span>}
                                </td>
                                <td className="p-5 text-center">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-gray-400">C: {item.comprasCode || '---'}</span>
                                        <span className="text-[10px] font-bold text-gray-400">B: {item.becCode || '---'}</span>
                                    </div>
                                </td>
                                <td className="p-5 text-center font-mono font-bold text-gray-500 text-[10px]">
                                    {item.expenseNature || '---'}
                                </td>
                                <td className="p-5 text-center">
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{item.unit}</span>
                                </td>
                                <td className="p-5 text-right font-mono font-bold text-indigo-600">
                                    {item.acquiredQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-5 text-right font-mono font-bold text-green-600">
                                    {item.stockBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-5 text-right font-mono font-bold text-gray-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitValue || 0)}
                                </td>
                                <td className="p-5 text-right font-mono font-bold text-indigo-900 whitespace-nowrap">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.unitValue || 0) * item.stockBalance)}
                                </td>
                                <td className="p-5 text-center sticky right-0 bg-white group-hover:bg-indigo-50 transition-colors z-10 border-l border-gray-100 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            onClick={() => setManageItem(item)}
                                            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm"
                                            title="Vincular Fornecedores"
                                        >
                                            Vincular
                                        </button>
                                        <button 
                                            onClick={() => startEdit(item)}
                                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.707.707-2.828-2.828.707-.707zM11.36 6.336l-2.828 2.828 2.828 2.828 2.828-2.828-2.828-2.828zM7.36 10.336l-5.086 5.086a1 1 0 00-.293.707V19a1 1 0 001 1h2.879a1 1 0 00.707-.293l5.086-5.086-5.086-5.086z" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => { if(window.confirm('Excluir este item?')) onDelete(item.id); }}
                                            className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredItems.length === 0 && (
                            <tr>
                                <td colSpan={10} className="p-10 text-center text-gray-400 font-medium italic">Nenhum produto cadastrado nesta categoria.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAdding && (
                <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm flex justify-center items-center z-[200] p-2 md:p-4">
                    <div className="bg-white w-full max-w-lg rounded-[1.5rem] shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh]">
                        <div className="bg-indigo-900 p-4 md:p-5 text-white flex-shrink-0">
                            <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter">{editingId ? 'Editar Produto' : 'Novo Produto para Aquisição'}</h3>
                            <p className="text-indigo-200 text-[9px] font-bold uppercase tracking-widest mt-0.5">{category}</p>
                        </div>
                        <div className="p-4 md:p-5 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Nome do Produto para Aquisição</label>
                                <textarea 
                                    rows={2}
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-xs resize-none"
                                    placeholder="Ex: ARROZ AGULHINHA"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Vincular ao Produto do Contrato</label>
                                <select 
                                    value={contractItemName} 
                                    onChange={e => setContractItemName(e.target.value)}
                                    className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all appearance-none bg-white text-xs"
                                >
                                    <option value="">-- SELECIONE O ITEM DO CONTRATO --</option>
                                    {contractItems.map(ci => <option key={ci} value={ci}>{ci}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Cód. Compras</label>
                                    <input 
                                        type="text" 
                                        value={comprasCode} 
                                        onChange={e => setComprasCode(e.target.value)} 
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-xs"
                                        placeholder="Código Compras"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Cód. BEC</label>
                                    <input 
                                        type="text" 
                                        value={becCode} 
                                        onChange={e => setBecCode(e.target.value)} 
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-xs"
                                        placeholder="Código BEC"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Natureza de Despesa</label>
                                    <input 
                                        type="text" 
                                        value={expenseNature} 
                                        onChange={e => setExpenseNature(e.target.value)} 
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-xs"
                                        placeholder="Ex: 339030"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Unidade</label>
                                    <select 
                                        value={unit} 
                                        onChange={e => setUnit(e.target.value)}
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all appearance-none bg-white text-xs"
                                    >
                                        <option value="un">Unidade (un)</option>
                                        <option value="kg">Quilograma (kg)</option>
                                        <option value="litro">Litro (L)</option>
                                        <option value="caixa">Caixa (cx)</option>
                                        <option value="embalagem">Embalagem (emb)</option>
                                        <option value="dz">Dúzia (dz)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Qtd. Adq.</label>
                                    <input 
                                        type="text" 
                                        value={acquiredQuantity} 
                                        onChange={e => setAcquiredQuantity(e.target.value)} 
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-right font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Saldo Est.</label>
                                    <input 
                                        type="text" 
                                        value={stockBalance} 
                                        onChange={e => setStockBalance(e.target.value)} 
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-right font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Vlr. Unit.</label>
                                    <input 
                                        type="text" 
                                        value={unitValue} 
                                        onChange={e => setUnitValue(e.target.value)} 
                                        className="w-full p-2.5 border-2 border-gray-100 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-bold transition-all text-right font-mono text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-100 flex gap-3 flex-shrink-0">
                            <button 
                                onClick={resetForm}
                                className="flex-1 bg-white border-2 border-gray-200 hover:bg-gray-100 text-gray-500 font-black py-2.5 rounded-lg transition-all uppercase text-[9px] tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-lg shadow-lg transition-all active:scale-95 uppercase text-[9px] tracking-widest"
                            >
                                Salvar Produto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {manageItem && onUpdateContractForItem && (
                <ManageContractSuppliersModal 
                    itemName={manageItem.name} 
                    currentSuppliers={suppliers.flatMap(s => 
                        (s.contractItems || [])
                            .filter(ci => ci.name === manageItem.name)
                            .map(ci => ({
                                supplierName: s.name,
                                supplierCpf: s.cpf,
                                amount: ci.totalKg,
                                price: ci.valuePerKg
                            }))
                    )} 
                    allSuppliers={suppliers} 
                    unit={`${manageItem.unit}-1`}
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
        </div>
    );
};

export default AdminAcquisitionItems;
