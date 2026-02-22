
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery } from '../types';

interface WeeklyScheduleControlProps {
    suppliers: Supplier[];
    title?: string;
    subtitle?: string;
    itespOnly?: boolean;
}

const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
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

const ITESP_SUPPLIERS_RAW = [
    'BENEDITO OSMAR RAVAZZI', 'ADAO MAXIMO DA FONSECA', 'ANTONIO JOAQUIM DE OLIVEIRA',
    'CLAUDEMIR LUIZ TURRA', 'CONSUELO ALCANTARA FERREIRA GUIMARARE', 'DANILO ANTONIO MAXIMO',
    'DOMINGOS APARECIDO ANTONINO', 'LEONARDO FELIPE VELHO MARSOLA', 'LIDIA BERNARDES MONTEIRO BARBOSA',
    'LUCIMARA MARQUES PEREIRA', 'MARCELO GIBERTONI', 'MARCOS DONADON AGOSTINHO',
    'MICHEL JOSE RAVAZZI', 'MOISES PINHEIRO DE SA', 'PAULO HENRIQUE PUGLIERI',
    'PEDRO TEODORO RODRIGUES', 'ROSA MARIA GARBIN VELLONE', 'SAULO ANTONINO',
    'SONIA REGINA COLOMBO CELESTINO', 'TANIA MARA BALDAO DE BARROS'
];

const WeeklyScheduleControl: React.FC<WeeklyScheduleControlProps> = ({ 
    suppliers, 
    title = "Controle Semanal de Entregas", 
    subtitle = "Acompanhamento de agendamentos vs faturamentos reais.",
    itespOnly = false
}) => {
    const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()));

    const filteredSuppliers = useMemo(() => {
        let list = suppliers;
        if (itespOnly) {
            const allowedSet = new Set(ITESP_SUPPLIERS_RAW.map(superNormalize));
            list = suppliers.filter(s => {
                const sn = superNormalize(s.name);
                return Array.from(allowedSet).some(allowed => sn.includes(allowed) || allowed.includes(sn));
            });
        }
        return list;
    }, [suppliers, itespOnly]);

    const weeklyData = useMemo(() => {
        return filteredSuppliers.map(supplier => {
            const weekDeliveries = (supplier.deliveries || []).filter(d => {
                const dDate = new Date(d.date + 'T00:00:00');
                return getWeekNumber(dDate) === selectedWeek;
            });

            const scheduledDates = weekDeliveries
                .filter(d => d.item === 'AGENDAMENTO PENDENTE')
                .map(d => d.date);

            const invoices = weekDeliveries
                .filter(d => d.item !== 'AGENDAMENTO PENDENTE' && d.invoiceNumber)
                .reduce((acc, d) => {
                    const nf = d.invoiceNumber!;
                    if (!acc.find(i => i.nf === nf)) {
                        acc.push({ nf, date: d.date });
                    }
                    return acc;
                }, [] as { nf: string, date: string }[]);

            const hasScheduled = scheduledDates.length > 0 || (supplier.allowedWeeks || []).includes(selectedWeek);
            const hasDelivered = invoices.length > 0;
            const failed = hasScheduled && !hasDelivered;

            return {
                supplier,
                scheduledDates,
                invoices,
                hasScheduled,
                hasDelivered,
                failed
            };
        }).filter(item => item.hasScheduled || item.hasDelivered);
    }, [filteredSuppliers, selectedWeek]);

    const stats = useMemo(() => {
        const total = weeklyData.length;
        const delivered = weeklyData.filter(d => d.hasDelivered).length;
        const failed = weeklyData.filter(d => d.failed).length;
        return { total, delivered, failed };
    }, [weeklyData]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-indigo-950 uppercase tracking-tighter">{title}</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{subtitle}</p>
                </div>
                <div className="flex items-center gap-3 bg-indigo-50 p-2 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-black text-indigo-400 uppercase ml-2">Semana Selecionada:</span>
                    <select 
                        value={selectedWeek} 
                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        className="bg-white border-2 border-indigo-200 rounded-xl px-4 py-2 font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                    >
                        {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                            <option key={w} value={w}>Semana {w}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-indigo-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total de Fornecedores na Semana</p>
                    <p className="text-2xl font-black text-indigo-700">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-green-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Entregas Realizadas (NF)</p>
                    <p className="text-2xl font-black text-green-700">{stats.delivered}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-red-500">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Falhas de Entrega</p>
                    <p className="text-2xl font-black text-red-600">{stats.failed}</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                                <th className="p-5 text-left">Fornecedor</th>
                                <th className="p-5 text-center">Agendamentos</th>
                                <th className="p-5 text-center">Notas Fiscais (Entradas)</th>
                                <th className="p-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {weeklyData.length > 0 ? weeklyData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-5">
                                        <p className="font-black text-gray-900 uppercase text-xs">{item.supplier.name}</p>
                                        <p className="text-[10px] font-mono text-gray-400">{item.supplier.cpf}</p>
                                    </td>
                                    <td className="p-5 text-center">
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {item.scheduledDates.length > 0 ? item.scheduledDates.map(d => (
                                                <span key={d} className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[9px] font-black border border-indigo-100">
                                                    {formatDate(d)}
                                                </span>
                                            )) : (
                                                <span className="text-[10px] text-gray-300 font-bold uppercase italic">Sem agendamento manual</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {item.invoices.length > 0 ? item.invoices.map(inv => (
                                                <div key={inv.nf} className="flex flex-col items-center bg-green-50 text-green-700 px-3 py-1 rounded-xl border border-green-100">
                                                    <span className="text-[10px] font-black">NF {inv.nf}</span>
                                                    <span className="text-[8px] font-bold opacity-70">{formatDate(inv.date)}</span>
                                                </div>
                                            )) : (
                                                <span className="text-[10px] text-red-300 font-bold uppercase italic">Nenhuma NF registrada</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        {item.failed ? (
                                            <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-sm border border-red-200 flex items-center justify-center gap-2 mx-auto w-fit">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                Falha na Entrega
                                            </span>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-sm border border-green-200 flex items-center justify-center gap-2 mx-auto w-fit">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                Entrega OK
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-20">
                                            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <p className="text-gray-600 font-black uppercase tracking-widest text-lg">Nenhuma atividade programada para esta semana.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WeeklyScheduleControl;
