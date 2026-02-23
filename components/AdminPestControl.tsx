
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
        time: '08:00',
        locations: '',
        companyName: '',
        companyCnpj: '',
        monitoringResponsible: '',
        pestControlResponsible: '',
        serviceExecutionNumber: '',
        status: 'agendado'
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
                time: '08:00',
                locations: '',
                companyName: '',
                companyCnpj: '',
                monitoringResponsible: '',
                pestControlResponsible: '',
                serviceExecutionNumber: '',
                status: 'agendado'
            });
        } else {
            alert(res.message);
        }
    };

    const handlePrintReport = () => {
        if (logs.length === 0) {
            alert('Não há registros para gerar o relatório.');
            return;
        }

        const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));

        const printContent = `
            <html>
                <head>
                    <title>Relatório de Dedetização</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        .header-sap { font-size: 14px; margin-bottom: 2px; }
                        .header-unit { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
                        .header-address { font-size: 11px; }
                        .header-contact { font-size: 11px; }
                        .report-title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 10px; }
                        th { background-color: #f5f5f5; font-weight: bold; text-transform: uppercase; }
                        .footer { margin-top: 60px; display: flex; justify-content: space-around; }
                        .sig { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: bold; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="header-sap">Secretaria da Administração Penitenciária</div>
                        <div class="header-unit">Polícia Penal - Penitenciária de Taiúva</div>
                        <div class="header-address">Rodovia Brigadeiro Faria Lima, SP 326, KM 359,6 Taiúva/SP - CEP: 14.720-000</div>
                        <div class="header-contact">Fone: (16) 3247-6261 - E-mail: dg@ptaiuva.sap.gov.br</div>
                    </div>
                    
                    <div class="report-title">Relatório de Controle de Dedetização</div>

                    <table>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Nº Execução</th>
                                <th>Empresa</th>
                                <th>Locais</th>
                                <th>Acompanhamento</th>
                                <th>Responsável</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedLogs.map(log => `
                                <tr>
                                    <td>${log.date.split('-').reverse().join('/')} ${log.time || ''}</td>
                                    <td>${log.serviceExecutionNumber || '-'}</td>
                                    <td>${log.companyName}</td>
                                    <td>${log.locations}</td>
                                    <td>${log.monitoringResponsible}</td>
                                    <td>${log.pestControlResponsible}</td>
                                    <td style="text-transform: uppercase; font-weight: bold;">${log.status}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        <div class="sig">Responsável (Unidade)</div>
                        <div class="sig">Diretor (Núcleo de Infraestrutura)</div>
                    </div>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(printContent);
            win.document.close();
            setTimeout(() => {
                win.print();
            }, 500);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-7xl mx-auto border-t-8 border-purple-500 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Controle de Dedetização</h2>
                    <p className="text-gray-400 font-medium">Gerencie os registros de dedetização e controle de pragas.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handlePrintReport}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-black py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir
                    </button>
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
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-4 text-left">Data/Hora</th>
                            <th className="p-4 text-left">Status</th>
                            <th className="p-4 text-left">Nº Execução</th>
                            <th className="p-4 text-left">Locais</th>
                            <th className="p-4 text-left">Empresa</th>
                            <th className="p-4 text-left">CNPJ</th>
                            <th className="p-4 text-left">Acompanhamento</th>
                            <th className="p-4 text-left">Responsável</th>
                            <th className="p-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length > 0 ? logs.sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')).map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <p className="font-mono font-bold text-purple-700">{log.date.split('-').reverse().join('/')}</p>
                                    <p className="text-[10px] font-black text-gray-400">{log.time || '--:--'}</p>
                                </td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${log.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="p-4 font-mono text-xs font-bold text-gray-800">{log.serviceExecutionNumber || '-'}</td>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Horário</label>
                                    <input 
                                        type="time" 
                                        required
                                        value={formData.time}
                                        onChange={e => setFormData({...formData, time: e.target.value})}
                                        className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</label>
                                    <select 
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                                        className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-purple-400 font-bold bg-gray-50 transition-all"
                                    >
                                        <option value="agendado">Agendado</option>
                                        <option value="concluido">Concluído</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nº de Execução de Serviços</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="000/2026"
                                    value={formData.serviceExecutionNumber}
                                    onChange={e => setFormData({...formData, serviceExecutionNumber: e.target.value.toUpperCase()})}
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
