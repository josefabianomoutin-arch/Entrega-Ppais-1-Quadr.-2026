
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement, Delivery } from '../types';
import ConfirmModal from './ConfirmModal';

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

    const itemAggregation = useMemo(() => {
        const map = new Map<string, any>();

        // 1. Agrega Metas de todos os Fornecedores
        suppliers.forEach(s => {
            Object.values(s.contractItems || {}).forEach((ci: any) => {
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
            (Object.values(s.deliveries || {}) as Delivery[]).forEach(del => {
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
        setConfirmConfig({
            isOpen: true,
            title: 'Excluir Item do Contrato',
            message: `Tem certeza que deseja excluir o item "${itemName}" de TODOS os contratos? Esta ação não pode ser desfeita.`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                const res = await onUpdateContractForItem(itemName, []);
                if (!res.success) alert(res.message);
            }
        });
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
                <div className="mb-6 flex justify-between items-center">
                    <input 
                        type="text" 
                        placeholder="Pesquisar produto no contrato..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-96 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 font-bold transition-all"
                    />
                    <button 
                        onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) {
                                alert('Por favor, permita popups para imprimir.');
                                return;
                            }
                            const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
                            const htmlContent = `
                                <html>
                                <head>
                                    <title>Relatório - Cálculo Geral</title>
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
                                    <h2>RELATÓRIO - CÁLCULO GERAL</h2>
                                    <div class="header-info">Data de emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th class="text-center">#</th>
                                                <th>Produto do Contrato</th>
                                                <th class="text-center">Unid.</th>
                                                <th class="text-right">Meta Total</th>
                                                <th class="text-right">Entregue</th>
                                                <th class="text-right">Saldo</th>
                                                <th class="text-right">Valor Contratado</th>
                                                <th class="text-right">Valor Entregue</th>
                                                <th class="text-right">Valor Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${filteredItems.map((item, index) => {
                                                const balance = Math.max(0, item.totalContracted - item.totalDelivered);
                                                const balanceValue = Math.max(0, item.totalValueContracted - item.totalValueDelivered);
                                                return `
                                                    <tr>
                                                        <td class="text-center">${index + 1}</td>
                                                        <td>${item.name}</td>
                                                        <td class="text-center">${item.unit.split('-')[0]}</td>
                                                        <td class="text-right">${item.totalContracted.toLocaleString('pt-BR')}</td>
                                                        <td class="text-right">${item.totalDelivered.toLocaleString('pt-BR')}</td>
                                                        <td class="text-right">${balance.toLocaleString('pt-BR')}</td>
                                                        <td class="text-right">${formatCurrency(item.totalValueContracted)}</td>
                                                        <td class="text-right">${formatCurrency(item.totalValueDelivered)}</td>
                                                        <td class="text-right">${formatCurrency(balanceValue)}</td>
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
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-black py-3 px-6 rounded-xl shadow-sm transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir PDF
                    </button>
                </div>

                <div className="border-2 border-gray-50 rounded-2xl flex flex-col">
                    <div 
                        className="overflow-x-auto custom-scrollbar"
                        onScroll={(e) => {
                            const bottomScroll = document.getElementById('contract-bottom-scroll');
                            if (bottomScroll) bottomScroll.scrollLeft = e.currentTarget.scrollLeft;
                        }}
                    >
                        <div id="contract-top-dummy" style={{ height: '1px' }}></div>
                    </div>
                    <div 
                        id="contract-bottom-scroll"
                        className="overflow-x-auto custom-scrollbar"
                        onScroll={(e) => {
                            const topScroll = e.currentTarget.previousElementSibling;
                            if (topScroll) topScroll.scrollLeft = e.currentTarget.scrollLeft;
                        }}
                    >
                        <table 
                            className="w-full text-sm"
                            ref={(el) => {
                                if (el) {
                                    const dummy = document.getElementById('contract-top-dummy');
                                    if (dummy) dummy.style.width = `${el.offsetWidth}px`;
                                }
                            }}
                        >
                            <thead className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                            <tr>
                                <th className="p-4 text-center w-12">#</th>
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
                                        <td className="p-4 text-center font-bold text-gray-400">{idx + 1}</td>
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

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                variant={confirmConfig.variant}
            />

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

// --- Modal de Gestão de Fornecedores por Item ---
export interface ManageContractSuppliersModalProps {
    itemName: string;
    currentSuppliers: { supplierName: string, supplierCpf: string, amount: number, price: number }[];
    allSuppliers: Supplier[];
    unit: string;
    category?: string;
    comprasCode?: string;
    becCode?: string;
    acquiredQuantity?: number;
    onClose: () => void;
    onSave: (assignments: { supplierCpf: string, totalKg: number, valuePerKg: number, unit?: string, category?: string, comprasCode?: string, becCode?: string }[]) => Promise<void>;
}

export const ManageContractSuppliersModal: React.FC<ManageContractSuppliersModalProps> = ({ itemName, currentSuppliers, allSuppliers, unit, category, comprasCode, becCode, acquiredQuantity, onClose, onSave }) => {
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
    const [saveError, setSaveError] = useState<string | null>(null);
    
    // PPAIS specific: Total Meta
    const [totalMeta, setTotalMeta] = useState(() => {
        if (category === 'PPAIS' && acquiredQuantity !== undefined) {
            return String(acquiredQuantity).replace('.', ',');
        }
        const sum = currentSuppliers.reduce((acc, s) => acc + s.amount, 0);
        return String(sum).replace('.', ',');
    });

    const availableSuppliers = useMemo(() => {
        return allSuppliers.filter(s => !assignments.some(a => a.supplierCpf === s.cpf)).sort((a,b) => a.name.localeCompare(b.name));
    }, [allSuppliers, assignments]);

    const distributeMeta = (currentAssignments: typeof assignments, metaValue: string) => {
        if (itemCategory !== 'PPAIS' || currentAssignments.length === 0) return currentAssignments;
        
        const total = parseFloat(metaValue.replace(',', '.')) || 0;
        const perSupplier = total / currentAssignments.length;
        const perSupplierStr = perSupplier.toFixed(4).replace('.', ',');
        
        return currentAssignments.map(a => ({
            ...a,
            totalKg: perSupplierStr
        }));
    };

    const handleAddSupplier = () => {
        if (!newSupplierCpf) return;
        
        // Limit to 15 for PPAIS
        if (itemCategory === 'PPAIS' && assignments.length >= 15) {
            alert('Limite de 15 fornecedores atingido para PPAIS.');
            return;
        }

        const s = allSuppliers.find(x => x.cpf === newSupplierCpf);
        if (s) {
            const newAssignments = [...assignments, {
                supplierCpf: s.cpf,
                supplierName: s.name,
                totalKg: '0',
                valuePerKg: assignments.length > 0 ? assignments[0].valuePerKg : '0',
                unit: unit
            }];
            
            setAssignments(distributeMeta(newAssignments, totalMeta));
            setNewSupplierCpf('');
        }
    };

    const handleRemoveAssignment = (cpf: string) => {
        const newAssignments = assignments.filter(a => a.supplierCpf !== cpf);
        setAssignments(distributeMeta(newAssignments, totalMeta));
    };

    const handleValueChange = (cpf: string, field: 'totalKg' | 'valuePerKg', value: string) => {
        const sanitizedValue = value.replace(/[^0-9,.]/g, '');
        setAssignments(assignments.map(a => a.supplierCpf === cpf ? { ...a, [field]: sanitizedValue } : a));
    };

    const handleTotalMetaChange = (value: string) => {
        const sanitizedValue = value.replace(/[^0-9,.]/g, '');
        setTotalMeta(sanitizedValue);
        setAssignments(distributeMeta(assignments, sanitizedValue));
    };

    const handleCategoryChange = (newCat: string) => {
        setItemCategory(newCat);
        if (newCat === 'PPAIS') {
            setAssignments(distributeMeta(assignments, totalMeta));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveError(null);
        const finalAssignments = assignments.map(a => ({
            supplierCpf: a.supplierCpf,
            totalKg: parseFloat(a.totalKg.replace(',', '.')),
            valuePerKg: parseFloat(a.valuePerKg.replace(',', '.')),
            unit: a.unit,
            category: itemCategory,
            comprasCode: itemComprasCode,
            becCode: itemBecCode
        })).filter(a => !isNaN(a.totalKg));

        const result = await onSave(finalAssignments);
        if (result && !result.success) {
            setSaveError(result.message);
        } else {
            onClose();
        }
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm flex justify-center items-center z-[200] p-2 md:p-4">
            <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-3xl animate-scale-in flex flex-col max-h-[85vh] overflow-hidden">
                <div className="bg-indigo-900 p-4 md:p-5 text-white flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter">Gestão de Fornecedores</h2>
                        <p className="text-indigo-200 font-bold uppercase text-[9px] tracking-widest mt-0.5">Item: {itemName}</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-light transition-colors">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5 space-y-4">
                    {saveError && (
                        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl text-red-600 font-black text-[10px] uppercase tracking-widest animate-pulse">
                            Erro ao salvar: {saveError}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 ml-1">Categoria do Item</label>
                            <select 
                                value={itemCategory} 
                                onChange={e => handleCategoryChange(e.target.value)}
                                className="w-full p-2 border-2 border-transparent bg-white rounded-lg font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="OUTROS">OUTROS</option>
                                <option value="KIT PPL">KIT PPL - HIGIÊNE E VESTUÁRIO</option>
                                <option value="PPAIS">PPAIS</option>
                                <option value="ESTOCÁVEIS">ESTOCÁVEIS</option>
                                <option value="PERECÍVEIS">PERECÍVEIS</option>
                                <option value="AUTOMAÇÃO">AUTOMAÇÃO</option>
                                <option value="PRODUTOS DE LIMPEZA">PRODUTOS DE LIMPEZA</option>
                            </select>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 ml-1">Código Compras</label>
                            <input 
                                type="text" 
                                value={itemComprasCode} 
                                onChange={e => setItemComprasCode(e.target.value)}
                                className="w-full p-2 border-2 border-transparent bg-white rounded-lg font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                                placeholder="Cód. Compras"
                            />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 ml-1">Código BEC</label>
                            <input 
                                type="text" 
                                value={itemBecCode} 
                                onChange={e => setItemBecCode(e.target.value)}
                                className="w-full p-2 border-2 border-transparent bg-white rounded-lg font-bold text-xs focus:border-indigo-500 outline-none transition-all"
                                placeholder="Cód. BEC"
                            />
                        </div>
                    </div>

                    {itemCategory === 'PPAIS' && (
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-fade-in">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-1">Meta Total do Item (PPAIS)</h3>
                                    <p className="text-[9px] text-indigo-600 font-medium italic">O peso será dividido igualmente entre até 15 fornecedores.</p>
                                </div>
                                <div className="w-40">
                                    <input 
                                        type="text" 
                                        value={totalMeta} 
                                        onChange={e => handleTotalMetaChange(e.target.value)}
                                        className="w-full p-3 border-2 border-indigo-200 rounded-xl text-center font-mono font-black text-indigo-900 focus:border-indigo-500 outline-none bg-white shadow-sm"
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fornecedores Vinculados ({assignments.length})</h3>
                            {itemCategory === 'PPAIS' && <span className="text-[9px] font-bold text-indigo-500 uppercase">Limite: 15</span>}
                        </div>
                        
                        <div className="space-y-2">
                            {assignments.map(a => (
                                <div key={a.supplierCpf} className="bg-white p-3 rounded-xl border-2 border-gray-50 flex flex-col md:flex-row items-center gap-3 group transition-all hover:border-indigo-100 hover:shadow-sm">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">Fornecedor</p>
                                        <p className="font-bold text-gray-800 uppercase text-[11px] truncate w-full">{a.supplierName}</p>
                                        {(() => {
                                            const s = allSuppliers.find(x => x.cpf === a.supplierCpf);
                                            if (s?.allowedWeeks && s.allowedWeeks.length > 0) {
                                                return (
                                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                                        {s.allowedWeeks.map(w => (
                                                            <span key={w} className="text-[7px] font-bold text-indigo-500 bg-indigo-50 px-1 rounded">S{w}</span>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <div className="w-full md:w-28">
                                        <label className="text-[8px] font-black text-gray-400 uppercase block mb-0.5 ml-1">Meta ({unit.split('-')[0]})</label>
                                        <input 
                                            type="text" 
                                            value={a.totalKg} 
                                            onChange={e => handleValueChange(a.supplierCpf, 'totalKg', e.target.value)} 
                                            readOnly={itemCategory === 'PPAIS'}
                                            className={`w-full p-2 border-2 border-gray-50 rounded-lg text-center font-mono text-xs focus:border-indigo-400 outline-none transition-all ${itemCategory === 'PPAIS' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white'}`}
                                        />
                                    </div>
                                    <div className="w-full md:w-28">
                                        <label className="text-[8px] font-black text-gray-400 uppercase block mb-0.5 ml-1">V. Mediana (R$)</label>
                                        <input 
                                            type="text" 
                                            value={a.valuePerKg} 
                                            onChange={e => handleValueChange(a.supplierCpf, 'valuePerKg', e.target.value)} 
                                            className="w-full p-2 border-2 border-gray-50 rounded-lg text-center font-mono text-xs focus:border-indigo-400 outline-none transition-all bg-white"
                                        />
                                    </div>
                                    <div className="flex items-center pt-3 md:pt-4">
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveAssignment(a.supplierCpf)}
                                            className="text-red-300 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all"
                                            title="Remover Fornecedor"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {assignments.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-2xl text-gray-300 font-bold uppercase tracking-widest text-[10px]">
                                    Nenhum fornecedor vinculado.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                        <h3 className="text-[9px] font-black text-indigo-600 uppercase mb-3 tracking-widest">Vincular Novo Fornecedor</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select 
                                value={newSupplierCpf} 
                                onChange={e => setNewSupplierCpf(e.target.value)}
                                className="flex-1 p-2.5 border-2 border-transparent bg-white rounded-lg outline-none focus:border-indigo-500 font-bold text-[11px] transition-all"
                            >
                                <option value="">-- SELECIONE UM FORNECEDOR --</option>
                                {availableSuppliers.map(s => <option key={s.cpf} value={s.cpf}>{s.name}</option>)}
                            </select>
                            <button 
                                type="button" 
                                onClick={handleAddSupplier}
                                disabled={!newSupplierCpf}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-2.5 rounded-lg shadow-md transition-all active:scale-95 uppercase text-[9px] tracking-widest disabled:bg-gray-300"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="bg-white border-2 border-gray-200 text-gray-500 px-6 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all hover:bg-gray-100">Cancelar</button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg font-black uppercase tracking-widest text-[9px] shadow-lg transition-all active:scale-95 disabled:bg-gray-400"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default AdminContractItems;
