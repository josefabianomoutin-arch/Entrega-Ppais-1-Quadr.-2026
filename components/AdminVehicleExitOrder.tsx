
import React, { useState, useMemo } from 'react';
import { VehicleExitOrder, VehicleAsset, DriverAsset } from '../types';

interface AdminVehicleExitOrderProps {
    orders: VehicleExitOrder[];
    onRegister: (order: Omit<VehicleExitOrder, 'id'>) => Promise<{ success: boolean; message: string; id?: string }>;
    onUpdate: (order: VehicleExitOrder) => Promise<{ success: boolean; message: string }>;
    onDelete: (id: string) => Promise<void>;
    vehicleAssets: VehicleAsset[];
    onRegisterVehicleAsset: (asset: Omit<VehicleAsset, 'id'>) => Promise<{ success: boolean; message: string }>;
    onUpdateVehicleAsset: (asset: VehicleAsset) => Promise<{ success: boolean; message: string }>;
    onDeleteVehicleAsset: (id: string) => Promise<void>;
    driverAssets: DriverAsset[];
    onRegisterDriverAsset: (asset: Omit<DriverAsset, 'id'>) => Promise<{ success: boolean; message: string }>;
    onUpdateDriverAsset: (asset: DriverAsset) => Promise<{ success: boolean; message: string }>;
    onDeleteDriverAsset: (id: string) => Promise<void>;
    readOnly?: boolean;
    securityMode?: boolean;
    hideAssets?: boolean;
    hideEdit?: boolean;
}

const AdminVehicleExitOrder: React.FC<AdminVehicleExitOrderProps> = ({ 
    orders, onRegister, onUpdate, onDelete,
    vehicleAssets, onRegisterVehicleAsset, onUpdateVehicleAsset, onDeleteVehicleAsset,
    driverAssets, onRegisterDriverAsset, onUpdateDriverAsset, onDeleteDriverAsset,
    readOnly = false,
    securityMode = false,
    hideAssets = false,
    hideEdit = false
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'orders' | 'assets'>('orders');
    const [activeAssetTab, setActiveAssetTab] = useState<'vehicles' | 'drivers'>('vehicles');
    
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

    // Asset Modals State
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<VehicleAsset | null>(null);
    const [vehicleFormData, setVehicleFormData] = useState<Omit<VehicleAsset, 'id'>>({
        model: '',
        plate: '',
        assetNumber: ''
    });

    const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState<DriverAsset | null>(null);
    const [driverFormData, setDriverFormData] = useState<Omit<DriverAsset, 'id'>>({
        name: '',
        role: '',
        cnhCategory: 'B',
        isFitToDrive: true
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
                    body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000; margin: 0; padding: 0; }
                    .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px; }
                    .header h1 { font-size: 13pt; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                    .header h2 { font-size: 10pt; margin: 2px 0; font-weight: normal; font-style: italic; }
                    
                    .title { text-align: center; font-weight: bold; font-size: 14pt; margin: 15px 0; text-transform: uppercase; text-decoration: underline; }
                    
                    .content-section { margin-bottom: 15px; text-align: justify; }
                    .field-value { border-bottom: 1px solid #000; display: inline-block; padding: 0 5px; font-weight: bold; text-transform: uppercase; }
                    
                    .companions-section { margin-top: 15px; border: 1px solid #000; padding: 10px; border-radius: 5px; }
                    .companions-title { font-weight: bold; text-transform: uppercase; font-size: 9pt; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
                    .companions-table { width: 100%; border-collapse: collapse; }
                    .companions-table td { padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 10pt; }
                    .companions-table tr:last-child td { border-bottom: none; }
                    
                    .footer-note { font-size: 8pt; text-align: center; margin: 15px 0; padding: 8px; border: 1px dashed #666; background-color: #f9f9f9; line-height: 1.2; }
                    
                    .signatures-container { margin-top: 20px; }
                    .signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
                    .signature-box { border: 1px solid #000; padding: 10px; min-height: 80px; position: relative; display: flex; flex-direction: column; justify-content: space-between; }
                    .signature-box .box-title { font-weight: bold; font-size: 8pt; text-transform: uppercase; margin-bottom: 5px; }
                    .signature-line { border-top: 1px solid #000; text-align: center; font-size: 8pt; margin-top: 10px; padding-top: 2px; font-weight: bold; }
                    
                    .date-location { text-align: right; margin: 15px 0; font-weight: bold; }
                    
                    .fct-section { display: flex; align-items: center; justify-content: center; border: 1px solid #000; padding: 10px; font-size: 10pt; }
                    
                    @media print {
                        .no-print { display: none; }
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>SECRETARIA DA ADMINISTRAÇÃO PENITENCIÁRIA</h1>
                    <h2>Coordenadoria das Unidades Prisionais da Região Noroeste do Estado</h2>
                    <h1 style="margin-top: 2px; font-size: 14pt;">PENITENCIÁRIA DE TAIÚVA</h1>
                </div>

                <div class="title">ORDEM DE SAÍDA DE VEÍCULO</div>

                <div class="content-section">
                    Autorizo a saída do veículo <span class="field-value" style="min-width: 150px;">${order.vehicle}</span>, 
                    placa <span class="field-value" style="min-width: 80px;">${order.plate}</span>, 
                    patrimônio <span class="field-value" style="min-width: 60px;">${order.assetNumber}</span>, sob a 
                    responsabilidade do Policial Penal <span class="field-value" style="min-width: 250px;">${order.responsibleServer}</span>, 
                    ocupante do cargo de <span class="field-value" style="min-width: 180px;">${order.serverRole}</span>.
                </div>
                
                <div class="content-section">
                    O referido deslocamento tem como destino a cidade/local de: <span class="field-value" style="min-width: 300px;">${order.destination}</span>.
                </div>

                <div class="date-location">
                    TAIÚVA, <span class="field-value" style="min-width: 30px;">${day}</span> de <span class="field-value" style="min-width: 100px;">${month}</span> de <span class="field-value" style="min-width: 50px;">${year}</span>.
                </div>

                <div class="companions-section">
                    <div class="companions-title">Acompanhantes da Missão</div>
                    <table class="companions-table">
                        ${order.companions.filter(c => c.name.trim() !== '').map((c, i) => `
                            <tr>
                                <td style="width: 25px; font-weight: bold;">${i + 1}.</td>
                                <td><span style="font-weight: bold; text-transform: uppercase;">${c.name}</span></td>
                                <td style="width: 30px; text-align: right; padding-right: 5px;">RG:</td>
                                <td style="width: 120px;"><span style="font-weight: bold;">${c.rg}</span></td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align: center; color: #999;">Nenhum acompanhante registrado</td></tr>'}
                    </table>
                </div>

                <div class="footer-note">
                    <strong>IMPORTANTE:</strong> PARA FINS DE PROTOCOLIZAÇÃO DA DIÁRIA, APRESENTAR ESTE DOCUMENTO JUNTO COM A SOLICITAÇÃO DE DIÁRIA E FCT DENTRO DO PRAZO DE 3 DIAS ÚTEIS APÓS O REGRESSO.
                </div>

                <div class="signatures-container">
                    <div class="signatures-grid">
                        <div class="signature-box">
                            <div class="box-title">Registro de Saída</div>
                            <div>DATA: ____/____/____</div>
                            <div>HORÁRIO: ___________</div>
                            <div class="signature-line">Ass. Policial Penal Sub-Portaria</div>
                        </div>
                        <div class="signature-box">
                            <div class="box-title">Registro de Retorno</div>
                            <div>DATA: ____/____/____</div>
                            <div>HORÁRIO: ___________</div>
                            <div class="signature-line">Ass. Policial Penal Sub-Portaria</div>
                        </div>
                    </div>

                    <div class="signatures-grid">
                        <div class="signature-box">
                            <div class="box-title">Autorização Superior</div>
                            <div style="flex-grow: 1;"></div>
                            <div class="signature-line">Chefe de Seção</div>
                        </div>
                        <div class="fct-section">
                            <div>
                                <strong>Anexar FCT nº:</strong> <span class="field-value" style="min-width: 100px;">${order.fctNumber}</span>
                                ${order.observations ? `<br><div style="margin-top: 5px; font-size: 8pt; font-style: italic;"><strong>Obs:</strong> ${order.observations}</div>` : ''}
                            </div>
                        </div>
                    </div>
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
            observations: order.observations || '',
            exitTime: order.exitTime || '',
            returnTime: order.returnTime || ''
        });
        setIsModalOpen(true);
    };

    const handleVehicleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingVehicle) {
            await onUpdateVehicleAsset({ ...vehicleFormData, id: editingVehicle.id });
        } else {
            await onRegisterVehicleAsset(vehicleFormData);
        }
        setIsVehicleModalOpen(false);
        setEditingVehicle(null);
        setVehicleFormData({ model: '', plate: '', assetNumber: '' });
    };

    const handleDriverSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDriver) {
            await onUpdateDriverAsset({ ...driverFormData, id: editingDriver.id });
        } else {
            await onRegisterDriverAsset(driverFormData);
        }
        setIsDriverModalOpen(false);
        setEditingDriver(null);
        setDriverFormData({ name: '', role: '', cnhCategory: 'B', isFitToDrive: true });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">Ordem de Saída de Veículo</h2>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">Gestão de Deslocamentos Oficiais</p>
                </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setActiveSubTab('orders')}
                                            className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'orders' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                        >
                                            Ordens
                                        </button>
                                        {!readOnly && !securityMode && !hideAssets && (
                                            <button 
                                                onClick={() => setActiveSubTab('assets')}
                                                className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeSubTab === 'assets' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            >
                                                Cadastros
                                            </button>
                                        )}
                                    </div>
            </div>

            {activeSubTab === 'orders' ? (
                <>
                    {!readOnly && !securityMode && (
                        <div className="flex justify-end">
                            <button 
                                onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-95 uppercase text-[10px] tracking-widest flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Nova Ordem
                            </button>
                        </div>
                    )}

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
                                        {(securityMode || orders.some(o => o.exitTime || o.returnTime)) && (
                                            <>
                                                <th className="p-4 text-center">Saída</th>
                                                <th className="p-4 text-center">Retorno</th>
                                            </>
                                        )}
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
                                            {(securityMode || orders.some(o => o.exitTime || o.returnTime)) && (
                                                <>
                                                    <td className="p-4 text-center">
                                                        <span className={`font-black text-xs ${order.exitTime ? 'text-indigo-600' : 'text-gray-300 italic'}`}>
                                                            {order.exitTime || '--:--'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`font-black text-xs ${order.returnTime ? 'text-emerald-600' : 'text-gray-300 italic'}`}>
                                                            {order.returnTime || '--:--'}
                                                        </span>
                                                    </td>
                                                </>
                                            )}
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    {securityMode ? (
                                                        <button 
                                                            onClick={() => handleEdit(order)}
                                                            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                            title="Registrar Horários"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handlePrint(order)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors" title="Imprimir">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                            </button>
                                                            {!readOnly && !hideEdit && (
                                                                <button onClick={() => handleEdit(order)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors" title="Editar">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                </button>
                                                            )}
                                                            {!readOnly && (
                                                                <button onClick={() => { if(window.confirm('Excluir esta ordem?')) onDelete(order.id); }} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors" title="Excluir">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
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
                </>
            ) : (
                <div className="space-y-6">
                    <div className="flex gap-4 border-b border-gray-100 pb-2">
                        <button 
                            onClick={() => setActiveAssetTab('vehicles')}
                            className={`px-4 py-2 font-black text-[9px] uppercase tracking-widest transition-all ${activeAssetTab === 'vehicles' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Veículos
                        </button>
                        <button 
                            onClick={() => setActiveAssetTab('drivers')}
                            className={`px-4 py-2 font-black text-[9px] uppercase tracking-widest transition-all ${activeAssetTab === 'drivers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Motoristas / Acompanhantes
                        </button>
                    </div>

                    {activeAssetTab === 'vehicles' ? (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => { setEditingVehicle(null); setVehicleFormData({ model: '', plate: '', assetNumber: '' }); setIsVehicleModalOpen(true); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-6 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95 uppercase text-[9px] tracking-widest flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Novo Veículo
                                </button>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[9px] uppercase text-gray-400 font-black">
                                        <tr>
                                            <th className="p-3 text-left">Modelo</th>
                                            <th className="p-3 text-left">Placa</th>
                                            <th className="p-3 text-left">Patrimônio</th>
                                            <th className="p-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {vehicleAssets.map(v => (
                                            <tr key={v.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-bold text-gray-700 uppercase">{v.model}</td>
                                                <td className="p-3 font-mono text-indigo-600 font-bold">{v.plate}</td>
                                                <td className="p-3 text-gray-500">{v.assetNumber}</td>
                                                <td className="p-3">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => { setEditingVehicle(v); setVehicleFormData({ model: v.model, plate: v.plate, assetNumber: v.assetNumber }); setIsVehicleModalOpen(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                                        <button onClick={() => { if(window.confirm('Excluir veículo?')) onDeleteVehicleAsset(v.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => { setEditingDriver(null); setDriverFormData({ name: '', role: '', cnhCategory: 'B', isFitToDrive: true }); setIsDriverModalOpen(true); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-6 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-95 uppercase text-[9px] tracking-widest flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Novo Motorista / Acompanhante
                                </button>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[9px] uppercase text-gray-400 font-black">
                                        <tr>
                                            <th className="p-3 text-left">Nome</th>
                                            <th className="p-3 text-left">Cargo</th>
                                            <th className="p-3 text-center">CNH</th>
                                            <th className="p-3 text-center">Status</th>
                                            <th className="p-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {driverAssets.map(d => (
                                            <tr key={d.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-bold text-gray-700 uppercase">{d.name}</td>
                                                <td className="p-3 text-gray-500 uppercase text-[10px]">{d.role}</td>
                                                <td className="p-3 text-center font-black text-indigo-600">{d.cnhCategory}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${d.isFitToDrive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                        {d.isFitToDrive ? 'Apto' : 'Inapto'}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => { setEditingDriver(d); setDriverFormData({ name: d.name, role: d.role, cnhCategory: d.cnhCategory, isFitToDrive: d.isFitToDrive }); setIsDriverModalOpen(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                                        <button onClick={() => { if(window.confirm('Excluir motorista?')) onDeleteDriverAsset(d.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Nova Ordem Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 md:p-4">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/20">
                        <div className="p-4 md:p-6">
                            <div className="flex justify-between items-center mb-4 border-b pb-3">
                                <div>
                                    <h3 className="text-lg md:text-xl font-black text-gray-900 uppercase tracking-tighter italic">
                                        {securityMode ? 'Registrar Horários' : editingOrder ? 'Editar Ordem' : 'Nova Ordem de Saída'}
                                    </h3>
                                    <p className="text-gray-400 font-bold text-[8px] uppercase tracking-widest mt-0.5">
                                        {securityMode ? 'Informe os horários de saída e retorno' : 'Preencha os dados do deslocamento'}
                                    </p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {securityMode ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Horário de Saída</label>
                                            <input 
                                                type="time" 
                                                value={formData.exitTime || ''} 
                                                onChange={e => setFormData({ ...formData, exitTime: e.target.value })}
                                                className="w-full h-12 px-3 border-2 border-indigo-100 rounded-xl bg-indigo-50 font-black text-indigo-900 focus:bg-white focus:border-indigo-500 transition-all outline-none text-lg text-center"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Horário de Retorno</label>
                                            <input 
                                                type="time" 
                                                value={formData.returnTime || ''} 
                                                onChange={e => setFormData({ ...formData, returnTime: e.target.value })}
                                                className="w-full h-12 px-3 border-2 border-emerald-100 rounded-xl bg-emerald-50 font-black text-emerald-900 focus:bg-white focus:border-emerald-500 transition-all outline-none text-lg text-center"
                                            />
                                        </div>
                                        <div className="col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Resumo da Ordem</p>
                                            <p className="text-xs font-bold text-gray-700">{formData.vehicle} - {formData.plate}</p>
                                            <p className="text-[10px] font-medium text-gray-500">{formData.responsibleServer}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
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
                                            list="vehicle-models"
                                            required
                                            placeholder="Ex: VW CARGO"
                                            value={formData.vehicle}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                const found = vehicleAssets.find(v => v.model === val);
                                                if (found) {
                                                    setFormData({ ...formData, vehicle: found.model, plate: found.plate, assetNumber: found.assetNumber });
                                                } else {
                                                    setFormData({ ...formData, vehicle: val });
                                                }
                                            }}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                        <datalist id="vehicle-models">
                                            {vehicleAssets.map(v => <option key={v.id} value={v.model}>{v.plate}</option>)}
                                        </datalist>
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
                                            list="driver-names"
                                            required
                                            placeholder="Nome Completo"
                                            value={formData.responsibleServer}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                const found = driverAssets.find(d => d.name === val);
                                                if (found) {
                                                    setFormData({ ...formData, responsibleServer: found.name, serverRole: found.role });
                                                } else {
                                                    setFormData({ ...formData, responsibleServer: val });
                                                }
                                            }}
                                            className="w-full h-9 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 transition-all outline-none text-xs"
                                        />
                                        <datalist id="driver-names">
                                            {driverAssets.map(d => <option key={d.id} value={d.name}>{d.role}</option>)}
                                        </datalist>
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
                                        {securityMode ? 'Salvar Horários' : editingOrder ? 'Salvar Alterações' : 'Confirmar Registro'}
                                    </button>
                                </div>
                                    </>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Vehicle Asset Modal */}
            {isVehicleModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-md border border-white/20">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">{editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}</h3>
                                <button onClick={() => setIsVehicleModalOpen(false)} className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <form onSubmit={handleVehicleSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Modelo</label>
                                    <input type="text" required value={vehicleFormData.model} onChange={e => setVehicleFormData({ ...vehicleFormData, model: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 outline-none text-xs" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Placa</label>
                                        <input type="text" required value={vehicleFormData.plate} onChange={e => setVehicleFormData({ ...vehicleFormData, plate: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 outline-none text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Patrimônio</label>
                                        <input type="text" required value={vehicleFormData.assetNumber} onChange={e => setVehicleFormData({ ...vehicleFormData, assetNumber: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 outline-none text-xs" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full h-12 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all uppercase text-[10px] tracking-widest mt-4">
                                    {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Driver Asset Modal */}
            {isDriverModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-md border border-white/20">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">{editingDriver ? 'Editar Motorista' : 'Novo Motorista'}</h3>
                                <button onClick={() => setIsDriverModalOpen(false)} className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <form onSubmit={handleDriverSubmit} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Nome Completo</label>
                                    <input type="text" required value={driverFormData.name} onChange={e => setDriverFormData({ ...driverFormData, name: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 outline-none text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Cargo</label>
                                    <input type="text" required value={driverFormData.role} onChange={e => setDriverFormData({ ...driverFormData, role: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 outline-none text-xs" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Categoria CNH</label>
                                        <select value={driverFormData.cnhCategory} onChange={e => setDriverFormData({ ...driverFormData, cnhCategory: e.target.value })} className="w-full h-10 px-3 border-2 border-gray-100 rounded-xl bg-gray-50 font-bold focus:bg-white focus:border-indigo-500 outline-none text-xs">
                                            <option value="A">A</option>
                                            <option value="B">B</option>
                                            <option value="C">C</option>
                                            <option value="D">D</option>
                                            <option value="E">E</option>
                                            <option value="AB">AB</option>
                                            <option value="AC">AC</option>
                                            <option value="AD">AD</option>
                                            <option value="AE">AE</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Apto a Dirigir?</label>
                                        <div className="flex items-center h-10 gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={driverFormData.isFitToDrive} onChange={() => setDriverFormData({ ...driverFormData, isFitToDrive: true })} className="w-4 h-4 text-indigo-600" />
                                                <span className="text-[10px] font-black uppercase text-emerald-600">Sim</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={!driverFormData.isFitToDrive} onChange={() => setDriverFormData({ ...driverFormData, isFitToDrive: false })} className="w-4 h-4 text-red-600" />
                                                <span className="text-[10px] font-black uppercase text-red-600">Não</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" className="w-full h-12 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all uppercase text-[10px] tracking-widest mt-4">
                                    {editingDriver ? 'Salvar Alterações' : 'Cadastrar Motorista'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVehicleExitOrder;
