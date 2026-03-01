
import React, { useState, useMemo } from 'react';
import { VehicleExitOrder } from '../types';

interface AdminVehicleExitOrderProps {
    orders: VehicleExitOrder[];
    onRegister: (order: Omit<VehicleExitOrder, 'id'>) => Promise<{ success: boolean; message: string }>;
    onUpdate: (order: VehicleExitOrder) => Promise<{ success: boolean; message: string }>;
    onDelete: (id: string) => Promise<void>;
}

const AdminVehicleExitOrder: React.FC<AdminVehicleExitOrderProps> = ({ orders, onRegister, onUpdate, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<VehicleExitOrder | null>(null);
    const [formData, setFormData] = useState<Omit<VehicleExitOrder, 'id'>>({
        date: new Date().toISOString().split('T')[0],
        vehicle: '',
        plate: '',
        assetNumber: '',
        responsibleServer: '',
        serverRole: '',
        destination: '',
        fctNumber: '',
        companions: [{ name: '', rg: '' }, { name: '', rg: '' }, { name: '', rg: '' }],
        observations: ''
    });

    const handlePrint = (order: VehicleExitOrder) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateObj = new Date(order.date + 'T12:00:00');
        const day = dateObj.getDate().toString().padStart(2, '0');
        const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
        const month = monthNames[dateObj.getMonth()];
        const year = dateObj.getFullYear();

        const htmlContent = `
            <html>
            <head>
                <title>Ordem de Saída de Veículo - ${order.plate}</title>
                <style>
                    @page { size: A4; margin: 15mm; }
                    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; }
                    .header { text-align: center; margin-bottom: 20px; position: relative; }
                    .header h1 { font-size: 12pt; margin: 0; text-transform: uppercase; }
                    .header h2 { font-size: 10pt; margin: 2px 0; font-weight: normal; }
                    .header .logos { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                    .logo-placeholder { width: 60px; height: 60px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999; }
                    
                    .title { text-align: center; font-weight: bold; font-size: 14pt; text-decoration: underline; margin: 20px 0; text-transform: uppercase; }
                    
                    .content-row { margin-bottom: 15px; }
                    .field-label { font-weight: normal; }
                    .field-value { border-bottom: 1px solid #000; display: inline-block; padding: 0 5px; min-width: 50px; font-weight: bold; text-transform: uppercase; }
                    
                    .companions-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .companions-table td { border-bottom: 1px solid #000; padding: 5px 0; }
                    
                    .footer-note { font-size: 8pt; text-transform: uppercase; font-weight: bold; text-align: center; margin: 20px 0; line-height: 1.2; }
                    
                    .signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; }
                    .signature-box { border: 1px solid #000; padding: 10px; height: 100px; position: relative; }
                    .signature-box .box-title { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 10px; padding-bottom: 5px; }
                    .signature-box .signature-line { position: absolute; bottom: 10px; left: 10px; right: 10px; border-top: 1px solid #000; text-align: center; font-size: 8pt; padding-top: 2px; }
                    
                    .obs-row { margin-top: 20px; font-weight: bold; }
                    
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logos">
                        <div class="logo-placeholder">BRASÃO SP</div>
                        <div>
                            <h1>SECRETARIA DA ADMINISTRAÇÃO PENITENCIÁRIA</h1>
                            <h2>Coordenadoria das Unidades Prisionais da Região Noroeste do Estado</h2>
                            <h1 style="margin-top: 5px;">PENITENCIÁRIA DE TAIÚVA</h1>
                        </div>
                        <div class="logo-placeholder">LOGO SAP</div>
                    </div>
                </div>

                <div class="title">ORDEM DE SAÍDA DE VEÍCULO</div>

                <div class="content-row">
                    Veículo <span class="field-value" style="min-width: 150px;">${order.vehicle}</span>, 
                    placa <span class="field-value" style="min-width: 100px;">${order.plate}</span>, 
                    patrimônio <span class="field-value" style="min-width: 80px;">${order.assetNumber}</span> sob
                </div>
                
                <div class="content-row">
                    a responsabilidade do funcionário <span class="field-value" style="min-width: 300px;">${order.responsibleServer}</span> cargo
                </div>
                
                <div class="content-row">
                    <span class="field-value" style="min-width: 250px;">${order.serverRole}</span>, está autorizado a deixar a área deste
                </div>
                
                <div class="content-row">
                    estabelecimento para ir a(o) <span class="field-value" style="min-width: 350px;">${order.destination}</span>
                </div>

                <div class="content-row" style="text-align: center; margin-top: 30px;">
                    TAIÚVA, <span class="field-value" style="min-width: 30px;">${day}</span> de <span class="field-value" style="min-width: 120px;">${month}</span> de <span class="field-value" style="min-width: 50px;">${year}</span>
                </div>

                <table class="companions-table">
                    ${order.companions.map((c, i) => `
                        <tr>
                            <td style="width: 120px;">Acompanhante (${i + 1}):</td>
                            <td><span style="font-weight: bold; text-transform: uppercase;">${c.name}</span></td>
                            <td style="width: 40px; text-align: right;">RG:</td>
                            <td style="width: 150px;"><span style="font-weight: bold;">${c.rg}</span></td>
                        </tr>
                    `).join('')}
                </table>

                <div class="footer-note">
                    PARA FINS DE PROTOCOLIZAÇÃO DA DIÁRIA, APRESENTAR ESTE DOCUMENTO JUNTO COM A SOLICITAÇÃO DE DIÁRIA E FCT DENTRO DO PRAZO DE 3 DIAS ÚTEIS APÓS O REGRESSO
                </div>

                <div class="signatures-grid">
                    <div class="signature-box">
                        <div class="box-title">SAÍDA EM ____/____/____</div>
                        <div>HORÁRIO: ___________</div>
                        <div class="signature-line">Ass. Fun. Sub-Portaria</div>
                    </div>
                    <div style="text-align: center; display: flex; flex-direction: column; justify-content: flex-end;">
                        <div style="border-top: 1px solid #000; width: 200px; margin: 0 auto;"></div>
                        <div style="font-size: 9pt; font-weight: bold; margin-top: 5px;">Diretor Responsável</div>
                    </div>
                </div>

                <div class="signatures-grid">
                    <div class="signature-box">
                        <div class="box-title">RETORNO EM ____/____/____</div>
                        <div>HORÁRIO: ___________</div>
                        <div class="signature-line">Ass. Fun. Sub-Portaria</div>
                    </div>
                </div>

                <div class="obs-row">
                    Obs: Anexar FCT nº. <span class="field-value" style="min-width: 150px;">${order.fctNumber}</span>
                </div>
                
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingOrder) {
            await onUpdate({ ...formData, id: editingOrder.id });
        } else {
            await onRegister(formData);
        }
        setIsModalOpen(false);
        setEditingOrder(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            vehicle: '',
            plate: '',
            assetNumber: '',
            responsibleServer: '',
            serverRole: '',
            destination: '',
            fctNumber: '',
            companions: [{ name: '', rg: '' }, { name: '', rg: '' }, { name: '', rg: '' }],
            observations: ''
        });
    };

    const handleEdit = (order: VehicleExitOrder) => {
        setEditingOrder(order);
        setFormData({
            date: order.date,
            vehicle: order.vehicle,
            plate: order.plate,
            assetNumber: order.assetNumber,
            responsibleServer: order.responsibleServer,
            serverRole: order.serverRole,
            destination: order.destination,
            fctNumber: order.fctNumber,
            companions: order.companions.length > 0 ? order.companions : [{ name: '', rg: '' }, { name: '', rg: '' }, { name: '', rg: '' }],
            observations: order.observations || ''
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">Ordem de Saída de Veículo</h2>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">Gestão de Deslocamentos Oficiais</p>
                </div>
                <button 
                    onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-95 uppercase text-[10px] tracking-widest flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nova Ordem
                </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black">
                            <tr>
                                <th className="p-4 text-left">Data</th>
                                <th className="p-4 text-left">Veículo / Placa</th>
                                <th className="p-4 text-left">Responsável</th>
                                <th className="p-4 text-left">Destino</th>
                                <th className="p-4 text-left">FCT</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders.length > 0 ? orders.sort((a,b) => b.date.localeCompare(a.date)).map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-600">{order.date.split('-').reverse().join('/')}</td>
                                    <td className="p-4">
                                        <div className="font-black text-gray-800 uppercase">{order.vehicle}</div>
                                        <div className="text-[10px] text-indigo-500 font-mono">{order.plate}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-700 uppercase">{order.responsibleServer}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">{order.serverRole}</div>
                                    </td>
                                    <td className="p-4 font-bold text-gray-600 uppercase">{order.destination}</td>
                                    <td className="p-4 font-mono text-gray-500">{order.fctNumber}</td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handlePrint(order)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors" title="Imprimir">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            <button onClick={() => handleEdit(order)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors" title="Editar">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => { if(window.confirm('Excluir esta ordem?')) onDelete(order.id); }} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Excluir">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={6} className="p-20 text-center text-gray-400 italic font-bold uppercase tracking-widest">Nenhuma ordem registrada</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 md:p-4">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/20">
                        <div className="p-4 md:p-6">
                            <div className="flex justify-between items-center mb-4 border-b pb-3">
                                <div>
                                    <h3 className="text-lg md:text-xl font-black text-gray-900 uppercase tracking-tighter italic">{editingOrder ? 'Editar Ordem' : 'Nova Ordem de Saída'}</h3>
                                    <p className="text-gray-400 font-bold text-[8px] uppercase tracking-widest mt-0.5">Preencha os dados do deslocamento</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Data</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Veículo (Modelo)</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Ex: VW CARGO"
                                            value={formData.vehicle}
                                            onChange={e => setFormData({ ...formData, vehicle: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Placa</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Ex: FSP4J81"
                                            value={formData.plate}
                                            onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Patrimônio</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Ex: 1710"
                                            value={formData.assetNumber}
                                            onChange={e => setFormData({ ...formData, assetNumber: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1 md:col-span-3">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Funcionário Responsável</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Nome Completo"
                                            value={formData.responsibleServer}
                                            onChange={e => setFormData({ ...formData, responsibleServer: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Cargo</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Ex: POLICIAL PENAL"
                                            value={formData.serverRole}
                                            onChange={e => setFormData({ ...formData, serverRole: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Destino</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Ex: ARARAQUARA - SP"
                                            value={formData.destination}
                                            onChange={e => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-3">
                                    <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        Acompanhantes
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {formData.companions.map((c, i) => (
                                            <div key={i} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm space-y-1.5">
                                                <div className="space-y-0.5">
                                                    <label className="text-[7px] font-black text-gray-400 uppercase">Nome ({i + 1})</label>
                                                    <input 
                                                        type="text" 
                                                        value={c.name}
                                                        onChange={e => {
                                                            const newCompanions = [...formData.companions];
                                                            newCompanions[i].name = e.target.value.toUpperCase();
                                                            setFormData({ ...formData, companions: newCompanions });
                                                        }}
                                                        className="w-full h-8 px-2 border border-gray-100 rounded-lg bg-gray-50 font-bold outline-none focus:border-indigo-500 transition-all text-[10px]"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <label className="text-[7px] font-black text-gray-400 uppercase">RG</label>
                                                    <input 
                                                        type="text" 
                                                        value={c.rg}
                                                        onChange={e => {
                                                            const newCompanions = [...formData.companions];
                                                            newCompanions[i].rg = e.target.value.toUpperCase();
                                                            setFormData({ ...formData, companions: newCompanions });
                                                        }}
                                                        className="w-full h-8 px-2 border border-gray-100 rounded-lg bg-gray-50 font-bold outline-none focus:border-indigo-500 transition-all text-[10px]"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Número da FCT (Anexar)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: 1630/2025"
                                            value={formData.fctNumber}
                                            onChange={e => setFormData({ ...formData, fctNumber: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Observações</label>
                                        <input 
                                            type="text" 
                                            placeholder="Opcional"
                                            value={formData.observations}
                                            onChange={e => setFormData({ ...formData, observations: e.target.value.toUpperCase() })}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button 
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 h-10 bg-gray-100 text-gray-500 font-black rounded-xl hover:bg-gray-200 transition-all uppercase text-[9px] tracking-widest"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-[2] h-10 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase text-[9px] tracking-widest active:scale-95"
                                    >
                                        {editingOrder ? 'Salvar Alterações' : 'Confirmar Registro'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVehicleExitOrder;
