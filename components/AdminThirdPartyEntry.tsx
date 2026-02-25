
import React, { useState } from 'react';
import { ThirdPartyEntryLog } from '../types';

interface AdminThirdPartyEntryProps {
    logs: ThirdPartyEntryLog[];
    onRegister: (log: Omit<ThirdPartyEntryLog, 'id'>) => Promise<{ success: boolean; message: string }>;
    onUpdate: (log: ThirdPartyEntryLog) => Promise<{ success: boolean; message: string }>;
    onDelete: (id: string) => Promise<void>;
}

const AdminThirdPartyEntry: React.FC<AdminThirdPartyEntryProps> = ({ logs, onRegister, onUpdate, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<ThirdPartyEntryLog, 'id'>>({
        date: new Date().toISOString().split('T')[0],
        time: '08:00',
        locations: '',
        companyName: '',
        companyCnpj: '',
        vehicle: '',
        plate: '',
        monitoringResponsible: '',
        pestControlResponsible: '',
        serviceExecutionNumber: '',
        contractNumber: '',
        status: 'agendado',
        serviceDetails: '',
        receiptTermDate: new Date().toISOString().split('T')[0]
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        try {
            let res;
            if (editingLogId) {
                res = await onUpdate({ ...formData, id: editingLogId } as ThirdPartyEntryLog);
            } else {
                res = await onRegister(formData as Omit<ThirdPartyEntryLog, 'id'>);
            }

            if (res.success) {
                setIsModalOpen(false);
                setEditingLogId(null);
                setFormData({
                    date: new Date().toISOString().split('T')[0],
                    time: '08:00',
                    locations: '',
                    companyName: '',
                    companyCnpj: '',
                    vehicle: '',
                    plate: '',
                    monitoringResponsible: '',
                    pestControlResponsible: '',
                    serviceExecutionNumber: '',
                    contractNumber: '',
                    status: 'agendado',
                    serviceDetails: '',
                    receiptTermDate: new Date().toISOString().split('T')[0]
                });
            } else {
                alert(res.message || 'Erro ao salvar');
            }
        } catch (error) {
            console.error("Error saving third party entry:", error);
            alert("Erro ao salvar. Verifique sua conexão ou tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (log: ThirdPartyEntryLog) => {
        const { id, ...rest } = log;
        setFormData({
            ...rest,
            time: log.time || '08:00',
            vehicle: log.vehicle || '',
            plate: log.plate || '',
            serviceExecutionNumber: log.serviceExecutionNumber || '',
            contractNumber: log.contractNumber || '',
            serviceDetails: log.serviceDetails || '',
            receiptTermDate: log.receiptTermDate || log.date
        });
        setEditingLogId(id);
        setIsModalOpen(true);
    };

    const handleOpenNew = () => {
        setEditingLogId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            time: '08:00',
            locations: '',
            companyName: '',
            companyCnpj: '',
            vehicle: '',
            plate: '',
            monitoringResponsible: '',
            pestControlResponsible: '',
            serviceExecutionNumber: '',
            contractNumber: '',
            status: 'agendado',
            serviceDetails: '',
            receiptTermDate: new Date().toISOString().split('T')[0]
        });
        setIsModalOpen(true);
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
                    <title>Relatório de Entrada de Terceiros</title>
                    <style>
                        @page { 
                            size: A4; 
                            margin: 0; 
                        }
                        @media print {
                            header, footer { display: none !important; }
                        }
                        body { 
                            font-family: Arial, sans-serif; 
                            padding: 20mm; 
                            color: #333; 
                            line-height: 1.4; 
                            margin: 0;
                        }
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
                    
                    <div class="report-title">Relatório de Controle de Entrada de Terceiros</div>

                    <table>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                <th>Nº Execução</th>
                                <th>Contrato</th>
                                <th>Empresa</th>
                                <th>Veículo/Placa</th>
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
                                    <td>${log.contractNumber || '-'}</td>
                                    <td>${log.companyName}</td>
                                    <td>${log.vehicle || '-'} / ${log.plate || '-'}</td>
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
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-7xl mx-auto border-t-8 border-gray-500 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Controle de Entrada de Terceiros</h2>
                    <p className="text-gray-400 font-medium">Gerencie os registros de entrada de prestadores de serviço e terceiros.</p>
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
                        onClick={handleOpenNew}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-black py-3 px-8 rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
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
                            <th className="p-4 text-left">Contrato</th>
                            <th className="p-4 text-left">Empresa</th>
                            <th className="p-4 text-left">Veículo/Placa</th>
                            <th className="p-4 text-left">Locais</th>
                            <th className="p-4 text-left">Acompanhamento</th>
                            <th className="p-4 text-left">Responsável</th>
                            <th className="p-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length > 0 ? logs.sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')).map(log => (
                            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <p className="font-mono font-bold text-gray-700">{log.date.split('-').reverse().join('/')}</p>
                                    <p className="text-[10px] font-black text-gray-400">{log.time || '--:--'}</p>
                                </td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${log.status === 'concluido' ? 'bg-green-100 text-green-700' : log.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="p-4 font-mono text-xs font-bold text-gray-800">{log.serviceExecutionNumber || '-'}</td>
                                <td className="p-4 font-mono text-xs font-bold text-gray-800">{log.contractNumber || '-'}</td>
                                <td className="p-4 text-gray-700 font-bold uppercase">{log.companyName}</td>
                                <td className="p-4">
                                    <p className="text-xs font-bold text-gray-800 uppercase">{log.vehicle || '-'}</p>
                                    <p className="text-[10px] font-mono text-gray-400">{log.plate || '-'}</p>
                                </td>
                                <td className="p-4 text-gray-700 font-medium">{log.locations}</td>
                                <td className="p-4 text-gray-600 uppercase text-xs">{log.monitoringResponsible}</td>
                                <td className="p-4 text-gray-600 uppercase text-xs">{log.pestControlResponsible}</td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            onClick={() => handleEdit(log)}
                                            className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-50 transition-all"
                                            title="Editar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={() => { if(window.confirm('Excluir este registro?')) onDelete(log.id); }}
                                            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-all"
                                            title="Excluir"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={9} className="p-12 text-center text-gray-400 italic">Nenhum registro de entrada encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex justify-center items-center p-2 animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-scale-up max-h-[95vh] flex flex-col">
                        <div className="bg-gray-800 p-4 text-white">
                            <h3 className="text-xl font-black uppercase tracking-tighter">
                                {editingLogId ? 'Editar Registro' : 'Novo Registro'}
                            </h3>
                            <p className="text-gray-300 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                                {editingLogId ? 'Atualize os dados do serviço' : 'Preencha os dados da prestadora'}
                            </p>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Data do Serviço</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={formData.date}
                                        onChange={e => {
                                            const newDate = e.target.value;
                                            setFormData({...formData, date: newDate, receiptTermDate: newDate });
                                        }}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Horário</label>
                                    <input 
                                        type="time" 
                                        required
                                        value={formData.time}
                                        onChange={e => setFormData({...formData, time: e.target.value})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</label>
                                    <select 
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    >
                                        <option value="agendado">Agendado</option>
                                        <option value="concluido">Concluído</option>
                                        <option value="cancelado">Cancelado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Termo Rec.</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={formData.receiptTermDate || ''}
                                        disabled
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none font-bold bg-gray-100 transition-all text-gray-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">CNPJ da Prestadora</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="00.000.000/0000-00"
                                        value={formData.companyCnpj}
                                        onChange={e => setFormData({...formData, companyCnpj: e.target.value})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Nº Execução</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="000/2026"
                                        value={formData.serviceExecutionNumber}
                                        onChange={e => setFormData({...formData, serviceExecutionNumber: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Nº Contrato</label>
                                    <input 
                                        type="text" 
                                        placeholder="000/2026"
                                        value={formData.contractNumber || ''}
                                        onChange={e => setFormData({...formData, contractNumber: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Empresa</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="NOME DA EMPRESA"
                                        value={formData.companyName}
                                        onChange={e => setFormData({...formData, companyName: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Detalhes do Serviço</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Troca de Lâmpadas, Reparo Hidráulico"
                                    value={formData.serviceDetails || ''}
                                    onChange={e => setFormData({...formData, serviceDetails: e.target.value})}
                                    className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Veículo</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: FIAT TORO BRANCA"
                                        value={formData.vehicle}
                                        onChange={e => setFormData({...formData, vehicle: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Placa</label>
                                    <input 
                                        type="text" 
                                        placeholder="ABC-1234"
                                        value={formData.plate}
                                        onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Locais</label>
                                <textarea 
                                    required
                                    placeholder="Ex: Cozinha, Refeitório..."
                                    value={formData.locations}
                                    onChange={e => setFormData({...formData, locations: e.target.value})}
                                    className="w-full border-2 border-gray-50 rounded-xl px-4 py-2 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all h-16 resize-none text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Resp. Acompanhamento</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="NOME DO SERVIDOR"
                                        value={formData.monitoringResponsible}
                                        onChange={e => setFormData({...formData, monitoringResponsible: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Resp. Técnico</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="NOME DO TÉCNICO"
                                        value={formData.pestControlResponsible}
                                        onChange={e => setFormData({...formData, pestControlResponsible: e.target.value.toUpperCase()})}
                                        className="w-full border-2 border-gray-50 rounded-xl px-4 py-2.5 outline-none focus:border-gray-400 font-bold bg-gray-50 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-gray-100 text-gray-500 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 bg-gray-700 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest hover:bg-gray-800 shadow-lg transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : editingLogId ? 'Atualizar' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminThirdPartyEntry;
