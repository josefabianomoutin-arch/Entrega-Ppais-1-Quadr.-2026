
import React, { useState, useMemo } from 'react';
import type { AcquisitionItem, Supplier } from '../types';
import { ManageContractSuppliersModal } from './AdminContractItems';
import ConfirmModal from './ConfirmModal';

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
    const [isSaving, setIsSaving] = useState(false);

    // Confirmation Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    const filteredItems = items.filter(item => 
        item.category === category &&
        (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.comprasCode?.includes(searchTerm) ||
         item.becCode?.includes(searchTerm))
    );

    const totalCategoryValue = useMemo(() => {
        return filteredItems.reduce((sum, item) => {
            const quantity = category === 'PPAIS' ? item.acquiredQuantity : item.stockBalance;
            return sum + ((item.unitValue || 0) * quantity);
        }, 0);
    }, [filteredItems, category]);

    const topScrollRef = React.useRef<HTMLDivElement>(null);
    const bottomScrollRef = React.useRef<HTMLDivElement>(null);
    const tableRef = React.useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    React.useEffect(() => {
        if (!tableRef.current) return;
        const observer = new ResizeObserver(() => {
            if (tableRef.current) {
                setTableWidth(tableRef.current.offsetWidth);
            }
        });
        observer.observe(tableRef.current);
        return () => observer.disconnect();
    }, [filteredItems]);

    const handleTopScroll = () => {
        if (bottomScrollRef.current && topScrollRef.current) {
            bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleBottomScroll = () => {
        if (bottomScrollRef.current && topScrollRef.current) {
            topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Por favor, permita popups para imprimir.');
            return;
        }

        const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

        const htmlContent = `
            <html>
            <head>
                <title>Relatório - ${category}</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: Arial, sans-serif; font-size: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background-color: #f3f4f6; text-transform: uppercase; font-size: 9px; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    h2 { text-align: center; text-transform: uppercase; margin-bottom: 5px; }
                    .header-info { text-align: center; color: #666; margin-bottom: 20px; font-size: 11px; }
                </style>
            </head>
            <body>
                <h2>RELATÓRIO DE AQUISIÇÃO - ${category}</h2>
                <div class="header-info">Data de emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
                <table>
                    <thead>
                        <tr>
                            <th class="text-center">#</th>
                            <th>Produto para aquisição</th>
                            <th>Produto do Contrato</th>
                            <th class="text-center">Cod. Compras / BEC</th>
                            <th class="text-center">Natureza de Despesa</th>
                            <th class="text-center">Unid.</th>
                            <th class="text-right">Qtd. Adquirida</th>
                            ${category !== 'PPAIS' && category !== 'PERECÍVEIS' ? '<th class="text-right">Saldo Estoque</th>' : '<th class="text-right">Peso por Fornecedor</th><th class="text-right">Valor por Fornecedor</th>'}
                            <th class="text-right">Valor da Mediana</th>
                            <th class="text-right">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredItems.map((item, index) => {
                            const totalValue = item.acquiredQuantity * (item.unitValue || 0);
                            
                            let extraCols = '';
                            if (category !== 'PPAIS' && category !== 'PERECÍVEIS') {
                                extraCols = `<td class="text-right">${item.stockBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>`;
                            } else {
                                const suppliersForItem = suppliers.filter(s => (s.contractItems || []).some(ci => ci.name === item.name));
                                const numSuppliers = suppliersForItem.length || 1;
                                const weightPerSupplier = item.acquiredQuantity / numSuppliers;
                                const valuePerSupplier = totalValue / numSuppliers;
                                extraCols = `
                                    <td class="text-right">${weightPerSupplier.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td class="text-right">${formatCurrency(valuePerSupplier)}</td>
                                `;
                            }

                            return `
                                <tr>
                                    <td class="text-center">${index + 1}</td>
                                    <td>${item.name}</td>
                                    <td>${item.contractItemName || 'Não vinculado'}</td>
                                    <td class="text-center">C: ${item.comprasCode || '---'}<br>B: ${item.becCode || '---'}</td>
                                    <td class="text-center">${item.expenseNature || '---'}</td>
                                    <td class="text-center">${item.unit}</td>
                                    <td class="text-right">${item.acquiredQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    ${extraCols}
                                    <td class="text-right">${formatCurrency(item.unitValue || 0)}</td>
                                    <td class="text-right">${formatCurrency(totalValue)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleSave = async () => {
        if (!name) return;
        setIsSaving(true);
        try {
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
        } finally {
            setIsSaving(false);
        }
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
        <div className="animate-fade-in space-y-8 relative">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
                .grid-bg { 
                    background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
                    background-size: 20px 20px;
                }
            `}</style>

            {/* Status Board Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">System Live</span>
                    </div>
                    <div className="h-4 w-px bg-zinc-800"></div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Módulo de Aquisição</span>
                        <span className="text-[11px] font-black text-white uppercase tracking-wider">{category}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="text-right">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Última Atualização</span>
                        <span className="text-[10px] font-mono font-bold text-zinc-300">{new Date().toLocaleTimeString('pt-BR')}</span>
                    </div>
                    <div className="bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                        <span className="text-[10px] font-mono font-black text-indigo-400">v2.4.0-CC</span>
                    </div>
                </div>
            </div>

            {/* Painel de Controle Superior */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Busca e Filtros */}
                <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-12 h-12 text-zinc-900" fill="currentColor" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                    </div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Terminal de Pesquisa</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="FILTRAR POR NOME OU CÓDIGO..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-4 pr-4 py-3.5 bg-zinc-50 border-2 border-zinc-100 rounded-2xl outline-none font-black text-xs uppercase tracking-wider focus:border-indigo-500 focus:bg-white transition-all placeholder:text-zinc-300"
                        />
                    </div>
                </div>

                {/* KPIs de Alta Densidade */}
                <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12"></div>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] relative z-10">Valor Total Categoria</span>
                        <div className="mt-2 relative z-10">
                            <span className="text-2xl font-black text-zinc-900 font-mono tracking-tighter">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCategoryValue)}
                            </span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 relative z-10">
                            <div className="h-1 flex-1 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-2/3"></div>
                            </div>
                            <span className="text-[8px] font-black text-zinc-400 uppercase">67% do Orçamento</span>
                        </div>
                    </div>
                    {(category === 'PPAIS' || category === 'PERECÍVEIS') ? (
                        <div className="bg-emerald-900 p-6 rounded-3xl border border-emerald-800 shadow-lg flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] relative z-10">Média Mensal (8m)</span>
                            <div className="mt-2 text-white relative z-10">
                                <span className="text-2xl font-black font-mono tracking-tighter">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCategoryValue / 8)}
                                </span>
                            </div>
                            <div className="mt-4 flex items-center gap-2 relative z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Projeção Estável</span>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-indigo-900 p-6 rounded-3xl border border-indigo-800 shadow-lg flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] relative z-10">Itens Ativos</span>
                            <div className="mt-2 text-white relative z-10">
                                <span className="text-3xl font-black font-mono tracking-tighter">{filteredItems.length}</span>
                                <span className="text-[10px] font-bold ml-2 opacity-60 uppercase tracking-widest">SKUs</span>
                            </div>
                            <div className="mt-4 flex items-center gap-2 relative z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Inventário Monitorado</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Ações Rápidas */}
                <div className="lg:col-span-3 flex flex-col gap-3">
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.2em]">Adicionar Item</span>
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex-1 bg-white hover:bg-zinc-50 text-zinc-600 border-2 border-zinc-100 font-black rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3 group"
                    >
                        <svg className="h-4 w-4 text-zinc-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        <span className="text-[10px] uppercase tracking-[0.2em]">Gerar Relatório</span>
                    </button>
                </div>
            </div>

            {/* Tabela de Inventário */}
            <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-xl overflow-hidden flex flex-col relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
                
                {/* Top Scrollbar Sync */}
                <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto custom-scrollbar bg-zinc-50/50 border-b border-zinc-100">
                    <div style={{ width: tableWidth, height: '4px' }}></div>
                </div>
                
                {/* Main Table Container */}
                <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="overflow-x-auto custom-scrollbar">
                    <table ref={tableRef} className="w-full border-collapse">
                        <thead>
                            <tr className="bg-zinc-50/80 backdrop-blur-sm text-zinc-500 text-[10px] uppercase tracking-[0.15em] border-b border-zinc-200">
                                <th className="p-6 text-center w-16 border-r border-zinc-100 font-serif italic normal-case opacity-60">#</th>
                                <th className="p-6 text-left min-w-[320px] border-r border-zinc-100 font-serif italic normal-case">Identificação do Produto</th>
                                <th className="p-6 text-left min-w-[200px] border-r border-zinc-100 font-serif italic normal-case">Vínculo Contratual</th>
                                <th className="p-6 text-center whitespace-nowrap border-r border-zinc-100 font-serif italic normal-case">Classificação</th>
                                <th className="p-6 text-center border-r border-zinc-100 font-serif italic normal-case">Unid.</th>
                                <th className="p-6 text-right whitespace-nowrap border-r border-zinc-100 font-serif italic normal-case">Logística</th>
                                {category !== 'PPAIS' && category !== 'PERECÍVEIS' ? (
                                    <th className="p-6 text-right whitespace-nowrap border-r border-zinc-100 font-serif italic normal-case">Estoque</th>
                                ) : (
                                    <>
                                        <th className="p-6 text-right whitespace-nowrap border-r border-zinc-100 font-serif italic normal-case">Peso/Forn.</th>
                                        <th className="p-6 text-right whitespace-nowrap border-r border-zinc-100 font-serif italic normal-case">Vlr/Forn.</th>
                                    </>
                                )}
                                <th className="p-6 text-right whitespace-nowrap border-r border-zinc-100 font-serif italic normal-case">Financeiro</th>
                                <th className="p-6 text-center sticky right-0 bg-zinc-50/90 backdrop-blur-sm z-10 border-l border-zinc-200 font-serif italic normal-case">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {filteredItems.map((item, index) => (
                                <tr key={item.id} className="hover:bg-indigo-50/30 transition-all group">
                                    <td className="p-6 text-center font-mono text-[11px] font-bold text-zinc-400 border-r border-zinc-50">{String(index + 1).padStart(2, '0')}</td>
                                    <td className="p-6 border-r border-zinc-50">
                                        <div className="flex flex-col gap-1">
                                            <div className="font-black text-zinc-900 uppercase text-sm tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">{item.name}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded uppercase tracking-widest border border-zinc-200">ID: {item.id.split('-')[1] || '---'}</span>
                                                <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded uppercase tracking-widest border border-indigo-100">{category}</span>
                                            </div>
                                        </div>
                                        {(category === 'PPAIS' || category === 'PERECÍVEIS') && (
                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                {suppliers.filter(s => (s.contractItems || []).some(ci => ci.name === item.name)).map(s => (
                                                    <div key={s.cpf} className="flex items-center bg-white/50 px-2.5 py-1.5 rounded-xl border border-zinc-100 shadow-sm hover:border-indigo-200 transition-all">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-zinc-700 uppercase leading-none">{s.name.split(' ')[0]}</span>
                                                            <div className="mt-1 flex gap-1">
                                                                {(s.allowedWeeks || []).map(w => (
                                                                    <span key={w} className="text-[7px] font-bold text-zinc-400 bg-zinc-50 px-1 rounded">W{w}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-6 border-r border-zinc-50">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase italic leading-tight">
                                                {item.contractItemName || <span className="text-red-500 not-italic font-black bg-red-50 px-2 py-0.5 rounded border border-red-100">Pendente de Vínculo</span>}
                                            </div>
                                            {item.contractItemName && (
                                                <div className="flex items-center gap-1 opacity-40">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Linked to Contract</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6 text-center border-r border-zinc-50">
                                        <div className="flex flex-col gap-2 items-center">
                                            <div className="inline-flex flex-col gap-0.5 bg-zinc-900 px-3 py-1.5 rounded-xl shadow-md">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Compras</span>
                                                    <span className="text-[10px] font-mono font-bold text-indigo-400">{item.comprasCode || '---'}</span>
                                                </div>
                                                <div className="h-px bg-zinc-800 my-0.5"></div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">BEC</span>
                                                    <span className="text-[10px] font-mono font-bold text-emerald-400">{item.becCode || '---'}</span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-mono font-black text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                                                ND: {item.expenseNature || '---'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center border-r border-zinc-50">
                                        <span className="bg-zinc-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">{item.unit}</span>
                                    </td>
                                    <td className="p-6 text-right border-r border-zinc-50 bg-indigo-50/20">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Qtd. Adquirida</span>
                                            <span className="font-mono text-sm font-black text-indigo-600">
                                                {item.acquiredQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </td>
                                    {category !== 'PPAIS' && category !== 'PERECÍVEIS' ? (
                                        <td className="p-6 text-right border-r border-zinc-50 bg-emerald-50/20">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Saldo em Estoque</span>
                                                <span className="font-mono text-sm font-black text-emerald-600">
                                                    {item.stockBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </td>
                                    ) : (() => {
                                        const supplierCount = suppliers.filter(s => 
                                            (s.contractItems || []).some(ci => ci.name === item.name)
                                        ).length || 1;
                                        const weightPerSupplier = item.acquiredQuantity / supplierCount;
                                        const valuePerSupplier = (item.unitValue || 0) * weightPerSupplier;
                                        return (
                                            <>
                                                <td className="p-6 text-right border-r border-zinc-50">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Peso/Forn.</span>
                                                        <span className="font-mono text-sm font-bold text-zinc-600">
                                                            {weightPerSupplier.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right border-r border-zinc-50">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Vlr/Forn.</span>
                                                        <span className="font-mono text-sm font-bold text-zinc-900">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valuePerSupplier)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </>
                                        );
                                    })()}
                                    <td className="p-6 text-right border-r border-zinc-50">
                                        <div className="flex flex-col gap-2 items-end">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Vlr. Unitário</span>
                                                <span className="font-mono text-xs font-bold text-zinc-500">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitValue || 0)}
                                                </span>
                                            </div>
                                            <div className="h-px w-12 bg-zinc-100"></div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Total Item</span>
                                                <span className="font-mono text-sm font-black text-zinc-900 whitespace-nowrap">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.unitValue || 0) * ((category === 'PPAIS' || category === 'PERECÍVEIS') ? item.acquiredQuantity : item.stockBalance))}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center sticky right-0 bg-white/90 backdrop-blur-sm group-hover:bg-indigo-50/90 transition-all z-10 border-l border-zinc-200 shadow-[-12px_0_20px_-8px_rgba(0,0,0,0.1)]">
                                        <div className="flex flex-col gap-2">
                                            <button 
                                                onClick={() => setManageItem(item)}
                                                className="w-full bg-zinc-900 text-white hover:bg-indigo-600 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                                            >
                                                Vincular
                                            </button>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => startEdit(item)}
                                                    className="flex-1 p-2.5 text-zinc-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm"
                                                >
                                                    <svg className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setConfirmConfig({
                                                            isOpen: true,
                                                            title: 'Excluir Item',
                                                            message: 'Tem certeza que deseja excluir este item?',
                                                            variant: 'danger',
                                                            onConfirm: () => {
                                                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                                                onDelete(item.id);
                                                            }
                                                        });
                                                    }}
                                                    className="flex-1 p-2.5 text-zinc-400 hover:text-red-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-red-100 shadow-sm"
                                                >
                                                    <svg className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="bg-zinc-50 p-4 rounded-full">
                                                <svg className="h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                            </div>
                                            <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Nenhum produto encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Cadastro / Edição */}
            {isAdding && (
                <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex justify-center items-center z-[200] p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh] border border-zinc-200">
                        <div className="bg-zinc-900 p-8 text-white flex-shrink-0 relative overflow-hidden">
                            {/* Background Decoration */}
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                            
                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] block mb-2">Editor de Inventário</span>
                                    <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">
                                        {editingId ? 'Editar Produto' : 'Novo Registro'}
                                    </h3>
                                    <div className="mt-4 inline-flex items-center bg-white/10 px-3 py-1 rounded-full border border-white/10">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">{category}</span>
                                    </div>
                                </div>
                                <button onClick={resetForm} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Seção Principal */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome do Produto para Aquisição</label>
                                    <textarea 
                                        rows={2}
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-bold text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none"
                                        placeholder="Ex: ARROZ AGULHINHA TIPO 1"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Vínculo com Item do Contrato</label>
                                    <div className="relative">
                                        <select 
                                            value={contractItemName} 
                                            onChange={e => setContractItemName(e.target.value)}
                                            className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-bold text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all appearance-none"
                                        >
                                            <option value="">-- SELECIONE O ITEM DO CONTRATO --</option>
                                            {contractItems.map(ci => <option key={ci} value={ci}>{ci}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-zinc-400">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Grid de Códigos e Natureza */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cód. Compras</label>
                                    <input 
                                        type="text" 
                                        value={comprasCode} 
                                        onChange={e => setComprasCode(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-mono font-bold text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                        placeholder="00.000.000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cód. BEC</label>
                                    <input 
                                        type="text" 
                                        value={becCode} 
                                        onChange={e => setBecCode(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-mono font-bold text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                        placeholder="0000000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nat. Despesa</label>
                                    <input 
                                        type="text" 
                                        value={expenseNature} 
                                        onChange={e => setExpenseNature(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-mono font-bold text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                        placeholder="339030"
                                    />
                                </div>
                            </div>

                            {/* Grid de Valores e Unidade */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Unidade</label>
                                    <select 
                                        value={unit} 
                                        onChange={e => setUnit(e.target.value)}
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-bold text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all appearance-none"
                                    >
                                        <option value="un">un</option>
                                        <option value="kg">kg</option>
                                        <option value="litro">L</option>
                                        <option value="caixa">cx</option>
                                        <option value="embalagem">emb</option>
                                        <option value="dz">dz</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Qtd. Adq.</label>
                                    <input 
                                        type="text" 
                                        value={acquiredQuantity} 
                                        onChange={e => setAcquiredQuantity(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-mono font-bold text-sm text-right focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Saldo Est.</label>
                                    <input 
                                        type="text" 
                                        value={stockBalance} 
                                        onChange={e => setStockBalance(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-mono font-bold text-sm text-right focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Vlr. Mediana</label>
                                    <input 
                                        type="text" 
                                        value={unitValue} 
                                        onChange={e => setUnitValue(e.target.value)} 
                                        className="w-full bg-zinc-50 border-2 border-zinc-100 rounded-2xl p-4 font-mono font-bold text-sm text-right focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex gap-4 flex-shrink-0">
                            <button 
                                onClick={resetForm}
                                disabled={isSaving}
                                className="flex-1 bg-white border-2 border-zinc-200 hover:bg-zinc-100 text-zinc-500 font-black py-4 rounded-2xl transition-all uppercase text-[10px] tracking-[0.2em] disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[10px] tracking-[0.2em] disabled:bg-zinc-400"
                            >
                                {isSaving ? 'Processando...' : (editingId ? 'Atualizar Registro' : 'Confirmar Cadastro')}
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
                    acquiredQuantity={manageItem.acquiredQuantity}
                    onClose={() => setManageItem(null)} 
                    onSave={async (assignments) => {
                        const res = await onUpdateContractForItem(manageItem.name, assignments);
                        if (res.success) setManageItem(null);
                        else alert(res.message);
                    }}
                />
            )}

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                variant={confirmConfig.variant}
            />
        </div>
    );
};

export default AdminAcquisitionItems;
