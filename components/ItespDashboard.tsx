
import React, { useMemo, useState } from 'react';
import type { Supplier, WarehouseMovement } from '../types';

interface ItespDashboardProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  onLogout: () => void;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const superNormalize = (text: string) => {
    return (text || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "") 
        .trim();
};

const normalizeInvoice = (text: string) => {
    return (text || "")
        .toString()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") 
        .replace(/^NF|^NFE/g, "")   
        .replace(/^0+/, "")         
        .trim();
};

const ItespDashboard: React.FC<ItespDashboardProps> = ({ suppliers = [], warehouseLog = [], onLogout }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('all'); 
    const [selectedMonth, setSelectedMonth] = useState('all');

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const summaryData = useMemo(() => {
        const totalContracted = suppliers.reduce((sum, p) => sum + (p.initialValue || 0), 0);
        const totalDelivered = suppliers.reduce((sum, p) => sum + (p.deliveries || []).filter(d => d.invoiceUploaded).reduce((dSum, d) => dSum + (d.value || 0), 0), 0);
        
        return {
            totalContracted,
            totalDelivered,
            progress: totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 0
        };
    }, [suppliers]);

    const comparisonData = useMemo(() => {
        if (!suppliers) return [];

        const billedGroups = new Map<string, { 
            supplierReal: string, 
            itemReal: string, 
            month: string, 
            nfDisplay: string, 
            kg: number,
            price: number 
        }>();

        const receivedGroups = new Map<string, number>();

        suppliers.forEach(s => {
            const supplierNorm = superNormalize(s.name);
            (s.deliveries || []).forEach(d => {
                if (d.invoiceUploaded && d.invoiceNumber && d.item && d.item !== 'AGENDAMENTO PENDENTE') {
                    const itemNorm = superNormalize(d.item);
                    const nfNorm = normalizeInvoice(d.invoiceNumber);
                    const key = `${supplierNorm}|${itemNorm}|${nfNorm}`;
                    
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const mName = months[dateObj.getMonth()];
                    
                    const existing = billedGroups.get(key);
                    const price = s.contractItems.find(ci => superNormalize(ci.name) === itemNorm)?.valuePerKg || 0;

                    billedGroups.set(key, {
                        supplierReal: s.name,
                        itemReal: d.item,
                        month: mName,
                        nfDisplay: d.invoiceNumber,
                        kg: (existing?.kg || 0) + (d.kg || 0),
                        price: price
                    });
                }
            });
        });

        warehouseLog.forEach(log => {
            if (log.type === 'entrada' && log.inboundInvoice) {
                const sNorm = superNormalize(log.supplierName);
                const iNorm = superNormalize(log.itemName);
                const nfNorm = normalizeInvoice(log.inboundInvoice);
                const key = `${sNorm}|${iNorm}|${nfNorm}`;
                
                const current = receivedGroups.get(key) || 0;
                receivedGroups.set(key, current + (log.quantity || 0));
            }
        });

        const result: any[] = [];
        
        billedGroups.forEach((data, key) => {
            const receivedKg = receivedGroups.get(key) || 0;
            const shortfall = Math.max(0, data.kg - receivedKg);

            result.push({
                id: key,
                supplierName: data.supplierReal,
                productName: data.itemReal,
                invoice: data.nfDisplay,
                month: data.month,
                billedKg: data.kg,
                receivedKg: receivedKg,
                shortfallKg: shortfall,
                financialLoss: shortfall * data.price
            });
        });

        receivedGroups.forEach((qty, key) => {
            if (!billedGroups.has(key)) {
                const [sNorm, iNorm, nfNorm] = key.split('|');
                result.push({
                    id: key,
                    supplierName: sNorm.toUpperCase() + " (S/ NOTA)",
                    productName: iNorm.toUpperCase(),
                    invoice: nfNorm,
                    month: "Desconhecido",
                    billedKg: 0,
                    receivedKg: qty,
                    shortfallKg: 0,
                    financialLoss: 0
                });
            }
        });

        return result.sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
    }, [suppliers, warehouseLog]);

    const filteredData = useMemo(() => {
        return comparisonData.filter(item => {
            const searchMatch = item.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.invoice.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               item.productName.toLowerCase().includes(searchTerm.toLowerCase());
            const monthMatch = selectedMonth === 'all' || item.month === selectedMonth;
            const roomMatch = selectedRoom === 'all' || item.supplierName === selectedRoom;
            return searchMatch && monthMatch && roomMatch;
        });
    }, [comparisonData, searchTerm, selectedMonth, selectedRoom]);

    const totalLoss = useMemo(() => filteredData.reduce((sum, item) => sum + item.financialLoss, 0), [filteredData]);

    const supplierOptions = useMemo(() => {
        const uniqueNames = [...new Set(suppliers.map(s => s.name))];
        return uniqueNames.sort().map(name => ({ value: name, displayName: name }));
    }, [suppliers]);

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-800 pb-20">
            <header className="bg-white/80 backdrop-blur-sm shadow-md p-4 flex justify-between items-center sticky top-0 z-20">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-green-800">Módulo ITESP</h1>
                    <p className="text-sm text-gray-500 font-medium">Auditoria de Entregas e Divergências</p>
                </div>
                <button
                    onClick={onLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm text-sm"
                >
                    Sair
                </button>
            </header>

            <main className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
                {/* Resumo Visual Superior */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-md border-b-8 border-green-500 transition-all hover:shadow-lg">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Contratado</p>
                        <p className="text-2xl font-black text-gray-800">{formatCurrency(summaryData.totalContracted)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-md border-b-8 border-blue-500 transition-all hover:shadow-lg">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Faturado</p>
                        <p className="text-2xl font-black text-blue-600">{formatCurrency(summaryData.totalDelivered)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-md border-b-8 border-red-500 transition-all hover:shadow-lg">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Preconceito (Divergência)</p>
                        <p className="text-2xl font-black text-red-600">{formatCurrency(totalLoss)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl animate-fade-in border border-gray-100">
                    {/* Barra de Filtros conforme Imagem */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div className="w-full md:w-80">
                            <input 
                                type="text" 
                                placeholder="Pesquisar fornecedor ou nota..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm border-gray-200"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <select 
                                value={selectedRoom} 
                                onChange={(e) => setSelectedRoom(e.target.value)}
                                className="w-full md:w-64 border-2 border-blue-500 rounded-lg px-4 py-2.5 text-sm font-medium outline-none text-gray-700 bg-white cursor-pointer"
                            >
                                <option value="all">Todos os quartos</option>
                                {supplierOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.displayName}</option>
                                ))}
                            </select>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full md:w-48 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium outline-none text-gray-700 bg-white cursor-pointer"
                            >
                                <option value="all">Todos os Meses</option>
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Tabela com cabeçalhos e cores da imagem */}
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead className="bg-[#F9FAFB] text-[#9CA3AF] text-[10px] uppercase font-black tracking-widest border-b">
                                <tr>
                                    <th className="p-4 text-left border-b min-w-[300px]">NÃO SE TRATA DE UM PROBLEMA DE SNOOKER.</th>
                                    <th className="p-4 text-left border-b">PRODUTO</th>
                                    <th className="p-4 text-left border-b">Nº NOTA</th>
                                    <th className="p-4 text-left border-b">MÊS (NOTA)</th>
                                    <th className="p-4 text-right border-b">PESO NA NOTA</th>
                                    <th className="p-4 text-right border-b">PESO NO ESTOQUE</th>
                                    <th className="p-4 text-right border-b">FALTA (KG)</th>
                                    <th className="p-4 text-right border-b">PRECONCEITO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredData.length > 0 ? filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors group">
                                        <td className="p-4 font-black text-gray-900 uppercase text-xs">
                                            {item.supplierName}
                                        </td>
                                        <td className="p-4 text-[#6B7280] uppercase text-[11px] font-medium">
                                            {item.productName}
                                        </td>
                                        <td className="p-4 font-bold text-blue-600 font-mono text-xs">
                                            {item.invoice}
                                        </td>
                                        <td className="p-4 font-bold text-[#6B7280]">
                                            {item.month}
                                        </td>
                                        <td className="p-4 text-right font-bold text-[#4B5563] font-mono">
                                            {item.billedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className="p-4 text-right font-black text-green-600 font-mono">
                                            {item.receivedKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                        </td>
                                        <td className={`p-4 text-right font-black font-mono ${item.shortfallKg > 0.01 ? 'text-red-500' : 'text-[#E5E7EB]'}`}>
                                            {item.shortfallKg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`p-4 text-right font-black ${item.financialLoss > 0.01 ? 'text-red-600' : 'text-[#E5E7EB]'}`}>
                                            {formatCurrency(item.financialLoss)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="p-20 text-center text-gray-400 italic font-medium uppercase tracking-widest bg-gray-50/50">
                                            Nenhuma informação disponível para os filtros selecionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <style>{`
              @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
              .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ItespDashboard;
