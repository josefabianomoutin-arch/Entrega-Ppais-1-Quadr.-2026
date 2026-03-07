
import React, { useState } from 'react';
import type { PerCapitaSupplier } from '../types';

interface AdminPerCapitaSuppliersProps {
    suppliers: PerCapitaSupplier[];
    onUpdate: (suppliers: PerCapitaSupplier[]) => void;
    type: 'PRODUTOR' | 'FORNECEDOR';
    colorScheme?: 'emerald' | 'indigo';
}

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const AdminPerCapitaSuppliers: React.FC<AdminPerCapitaSuppliersProps> = ({ suppliers, onUpdate, type, colorScheme = 'emerald' }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [name, setName] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [processNumber, setProcessNumber] = useState('');
    const [monthlySchedule, setMonthlySchedule] = useState<Record<string, number[]>>({});

    const filteredSuppliers = suppliers.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cpfCnpj.includes(searchTerm) ||
        p.processNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const resetForm = () => {
        setName('');
        setCpfCnpj('');
        setProcessNumber('');
        setMonthlySchedule({});
        setIsAdding(false);
        setEditingId(null);
    };

    const handleEdit = (supplier: PerCapitaSupplier) => {
        setName(supplier.name);
        setCpfCnpj(supplier.cpfCnpj);
        setProcessNumber(supplier.processNumber);
        setMonthlySchedule(supplier.monthlySchedule || {});
        setEditingId(supplier.id);
        setIsAdding(true);
    };

    const handleSave = () => {
        if (!name || !cpfCnpj || !processNumber) {
            alert(`Preencha os campos obrigatórios: Nome, CPF/CNPJ e Número do Processo.`);
            return;
        }

        const newSupplier: PerCapitaSupplier = {
            id: editingId || crypto.randomUUID(),
            name: name.toUpperCase(),
            cpfCnpj,
            processNumber,
            monthlySchedule,
            contractItems: editingId ? suppliers.find(p => p.id === editingId)?.contractItems : []
        };

        let updatedSuppliers: PerCapitaSupplier[];
        if (editingId) {
            updatedSuppliers = suppliers.map(p => p.id === editingId ? newSupplier : p);
        } else {
            updatedSuppliers = [...suppliers, newSupplier];
        }

        onUpdate(updatedSuppliers);
        resetForm();
    };

    const handleDelete = (id: string) => {
        if (window.confirm(`Tem certeza que deseja excluir este ${type.toLowerCase()}?`)) {
            onUpdate(suppliers.filter(p => p.id !== id));
        }
    };

    const toggleWeek = (month: string, week: number) => {
        setMonthlySchedule(prev => {
            const currentWeeks = prev[month] || [];
            const newWeeks = currentWeeks.includes(week)
                ? currentWeeks.filter(w => w !== week)
                : [...currentWeeks, week].sort();
            
            return {
                ...prev,
                [month]: newWeeks
            };
        });
    };

    const colorClasses = {
        emerald: {
            border: 'border-emerald-600',
            focus: 'focus:border-emerald-500',
            bg: 'bg-emerald-600',
            hover: 'hover:bg-emerald-700',
            text: 'text-emerald-600',
            textDark: 'text-emerald-900',
            bgLight: 'bg-emerald-50',
            borderLight: 'border-emerald-100',
            shadow: 'hover:shadow-emerald-200'
        },
        indigo: {
            border: 'border-indigo-600',
            focus: 'focus:border-indigo-500',
            bg: 'bg-indigo-600',
            hover: 'hover:bg-indigo-700',
            text: 'text-indigo-600',
            textDark: 'text-indigo-900',
            bgLight: 'bg-indigo-50',
            borderLight: 'border-indigo-100',
            shadow: 'hover:shadow-indigo-200'
        }
    }[colorScheme];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className={`flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-xl border-b-4 ${colorClasses.border}`}>
                <div className="relative w-full md:max-w-md">
                    <input 
                        type="text" 
                        placeholder={`Pesquisar ${type.toLowerCase()}, CPF ou processo...`} 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent ${colorClasses.focus} rounded-2xl outline-none font-bold transition-all shadow-inner`}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className={`w-full md:w-auto ${colorClasses.bg} ${colorClasses.hover} text-white font-black py-4 px-8 rounded-2xl shadow-lg ${colorClasses.shadow} transition-all active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    Novo {type}
                </button>
            </div>

            {isAdding && (
                <div className={`bg-white p-8 rounded-[2rem] shadow-2xl border-2 ${colorClasses.borderLight} animate-fade-in`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className={`text-xl font-black ${colorClasses.textDark} uppercase tracking-tighter`}>
                            {editingId ? `Editar ${type}` : `Cadastrar Novo ${type}`}
                        </h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black ${colorClasses.text} uppercase tracking-widest ml-1`}>Nome do {type}</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={`w-full p-4 bg-gray-50 border-2 border-transparent ${colorClasses.focus} rounded-xl outline-none font-bold transition-all`}
                                placeholder="NOME COMPLETO"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black ${colorClasses.text} uppercase tracking-widest ml-1`}>CPF / CNPJ</label>
                            <input 
                                type="text"
                                value={cpfCnpj}
                                onChange={e => setCpfCnpj(e.target.value.replace(/[^\d]/g, ''))}
                                className={`w-full p-4 bg-gray-50 border-2 border-transparent ${colorClasses.focus} rounded-xl outline-none font-bold transition-all font-mono`}
                                placeholder="000.000.000-00"
                                maxLength={14}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black ${colorClasses.text} uppercase tracking-widest ml-1`}>Número do Processo</label>
                            <input 
                                type="text"
                                value={processNumber}
                                onChange={e => setProcessNumber(e.target.value)}
                                className={`w-full p-4 bg-gray-50 border-2 border-transparent ${colorClasses.focus} rounded-xl outline-none font-bold transition-all`}
                                placeholder="PROCESSO SEI"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <label className={`text-[10px] font-black ${colorClasses.text} uppercase tracking-widest ml-1`}>Agenda de Entregas (Semanas por Mês)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {months.map(month => (
                                <div key={month} className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <div className="text-[9px] font-black text-gray-400 uppercase mb-2 ml-1">{month}</div>
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 4, 5].map(week => (
                                            <button
                                                key={week}
                                                onClick={() => toggleWeek(month, week)}
                                                className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border-2 ${
                                                    (monthlySchedule[month] || []).includes(week)
                                                    ? `${colorClasses.bg} ${colorClasses.border} text-white shadow-sm` 
                                                    : 'bg-white border-gray-200 text-gray-400 hover:border-emerald-200'
                                                }`}
                                            >
                                                S{week}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={resetForm}
                            className="px-8 py-4 bg-gray-100 text-gray-500 font-black rounded-xl uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSave}
                            className={`px-8 py-4 ${colorClasses.bg} text-white font-black rounded-xl uppercase text-xs tracking-widest ${colorClasses.hover} shadow-lg transition-all active:scale-95`}
                        >
                            {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className={`${colorClasses.bgLight}/50`}>
                                <th className={`p-6 text-[10px] font-black ${colorClasses.text} uppercase tracking-widest border-b ${colorClasses.borderLight}`}>{type}</th>
                                <th className={`p-6 text-[10px] font-black ${colorClasses.text} uppercase tracking-widest border-b ${colorClasses.borderLight}`}>Documento</th>
                                <th className={`p-6 text-[10px] font-black ${colorClasses.text} uppercase tracking-widest border-b ${colorClasses.borderLight}`}>Processo</th>
                                <th className={`p-6 text-[10px] font-black ${colorClasses.text} uppercase tracking-widest border-b ${colorClasses.borderLight}`}>Agenda Semanal</th>
                                <th className={`p-6 text-[10px] font-black ${colorClasses.text} uppercase tracking-widest border-b ${colorClasses.borderLight} text-right`}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSuppliers.length > 0 ? (
                                filteredSuppliers.map(supplier => (
                                    <tr key={supplier.id} className={`${colorClasses.bgLight}/30 transition-colors group`}>
                                        <td className="p-6">
                                            <div className="font-black text-gray-800 uppercase tracking-tight">{supplier.name}</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-mono text-xs text-gray-500">{supplier.cpfCnpj}</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-bold text-sm text-indigo-600">{supplier.processNumber}</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-2 max-w-[300px]">
                                                {months.filter(m => (supplier.monthlySchedule?.[m] || []).length > 0).length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {months.filter(m => (supplier.monthlySchedule?.[m] || []).length > 0).map(m => (
                                                            <div key={m} className={`flex flex-col ${colorClasses.bgLight} border ${colorClasses.borderLight} rounded-lg p-1.5 min-w-[60px]`}>
                                                                <span className={`text-[8px] font-black ${colorClasses.text} uppercase mb-1 border-b ${colorClasses.borderLight} pb-0.5`}>{m.substring(0, 3)}</span>
                                                                <div className="flex gap-0.5">
                                                                    {(supplier.monthlySchedule[m] || []).map(w => (
                                                                        <span key={w} className={`w-4 h-4 flex items-center justify-center ${colorClasses.bg} text-white rounded-[4px] text-[7px] font-black`}>
                                                                            {w}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300 italic text-[10px]">Nenhum agendamento</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEdit(supplier)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Editar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00-2 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(supplier.id)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-gray-300">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            <p className="font-bold uppercase text-xs tracking-widest">Nenhum {type.toLowerCase()} encontrado</p>
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

export default AdminPerCapitaSuppliers;
