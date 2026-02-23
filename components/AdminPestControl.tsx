
import React, { useState } from 'react';
import { PestControlLog } from '../types';

interface AdminPestControlProps {
    logs: PestControlLog[];
    onRegister: (log: Omit<PestControlLog, 'id'>) => Promise<{ success: boolean; message: string }>;
    onDelete: (id: string) => Promise<void>;
}

const AdminPestControl: React.FC<AdminPestControlProps> = ({ logs, onRegister, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Omit<PestControlLog, 'id'>>({
        date: new Date().toISOString().split('T')[0],
        locations: '',
        companyName: '',
        companyCnpj: '',
        monitoringResponsible: '',
        pestControlResponsible: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const res = await onRegister(formData);
        setIsSaving(false);
        if (res.success) {
            setIsModalOpen(false);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                locations: '',
                companyName: '',
                companyCnpj: '',
                monitoringResponsible: '',
                pestControlResponsible: ''
            });
        } else {
            alert(res.message);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-7xl mx-auto border-t-8 border-purple-500 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Controle de Dedetização</h2>
                    <p className="text-gray-400 font-medium">Gerencie os registros de dedetização e controle de pragas.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-black py-3 px-8 rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Novo Registro
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-4 text-left">Data</th>
                            <th className="p-4 text-left">Locais</th>
                            <th className="p-4 text-left">Empresa</th>
                            <th className="p-4 text-left">CNPJ</th>
                            <th className="p-4 text-left">Acompanhamento</th>
                            <th className="p-4 text-left">Responsável</th>
                            <th className="p-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length > 0 ? logs.sort((a, b) => b.date.localeCompare(a.date)).map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-mono font-bold text-purple-700">{log.date.split('-').reverse().join('/')}</td>
                                <td className="p-4 text-gray-700 font-medium">{log.locations}</td>
                                <td className="p-4 text-gray-700 font-bold uppercase">{log.companyName}</td>
                                <td className="p-4 font-mono text-gray-500">{log.companyCnpj}</td>
                                <td className="p-4 text-gray-600 uppercase text-xs">{log.monitoringResponsible}</td>
                                <td className="p-4 text-gray-600 uppercase text-xs">{log.pestControlResponsible}</td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => { if(window.confirm('Excluir este registro?')) onDelete(log.id); }}
                                        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-all"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-gray-400 italic">Nenhum registro de dedetização encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up">
                        <div className="bg-purple-800 p-8 text-white">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Novo Registro de Dedetização</h3>
                            <p className="text-purple-200 font-bold uppercase text-xs tracking-widest mt-1">Preencha os dados da prestadora e do serviço</p>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Data do Serviço</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                        className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">CNPJ da Prestadora</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="00.000.000/0000-00"
                                        value={formData.companyCnpj}
                                        onChange={e => setFormData({...formData, companyCnpj: e.target.value})}
                                        className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nome da Empresa</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="NOME DA EMPRESA PRESTADORA"
                                    value={formData.companyName}
                                    onChange={e => setFormData({...formData, companyName: e.target.value.toUpperCase()})}
                                    className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Locais Dedetizados</label>
                                <textarea 
                                    required
                                    placeholder="Ex: Cozinha, Refeitório, Almoxarifado..."
                                    value={formData.locations}
                                    onChange={e => setFormData({...formData, locations: e.target.value})}
                                    className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all h-24 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Responsável Acompanhamento</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="NOME DO SERVIDOR"
                                        value={formData.monitoringResponsible}
                                        onChange={e => setFormData({...formData, monitoringResponsible: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Responsável Dedetização</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="NOME DO TÉCNICO"
                                        value={formData.pestControlResponsible}
                                        onChange={e => setFormData({...formData, pestControlResponsible: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 bg-purple-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPestControl;
