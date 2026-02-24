
import React, { useState, useMemo } from 'react';
import type { Supplier, Delivery, ThirdPartyEntryLog } from '../types';
import WeeklyScheduleControl from './WeeklyScheduleControl';

interface AdminScheduleViewProps {
  suppliers: Supplier[];
  thirdPartyEntries: ThirdPartyEntryLog[];
  onCancelDeliveries: (supplierCpf: string, deliveryIds: string[]) => void;
  onDeleteThirdPartyEntry: (id: string) => Promise<void>;
}

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
};

const AdminScheduleView: React.FC<AdminScheduleViewProps> = ({ suppliers, thirdPartyEntries, onCancelDeliveries, onDeleteThirdPartyEntry }) => {
    const [activeSubTab, setActiveSubTab] = useState<'daily' | 'weekly' | 'report'>('daily');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // States for Report
    const [reportSupplierCpf, setReportSupplierCpf] = useState('');
    const [reportSelectedDate, setReportSelectedDate] = useState('');
    const [reportSeiNumber, setReportSeiNumber] = useState('');

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(p => {
            const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const dateMatch = !dateFilter || (p.deliveries || []).some(d => d.date === dateFilter);
            return nameMatch && dateMatch;
        });
    }, [suppliers, searchTerm, dateFilter]);

    const reportSuppliers = useMemo(() => {
        // Suppliers that have at least one delivery with an invoice number (or just any delivery?)
        // The user said "BUSCAR OS DADOS NA ABA Consulta de Notas Fiscais", which implies invoices.
        // So we filter suppliers that have deliveries with invoice numbers.
        return suppliers.filter(s => (s.deliveries || []).some(d => d.invoiceNumber)).sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliers]);

    const reportAvailableDates = useMemo(() => {
        if (!reportSupplierCpf) return [];
        const supplier = suppliers.find(s => s.cpf === reportSupplierCpf);
        if (!supplier) return [];
        
        // Get unique dates from deliveries that have invoice numbers
        const dates = Array.from(new Set((supplier.deliveries || [])
            .filter(d => d.invoiceNumber)
            .map(d => d.date)
        ));
        return dates.sort().reverse(); // Newest first
    }, [suppliers, reportSupplierCpf]);

    const handleGenerateReport = () => {
        const supplier = suppliers.find(s => s.cpf === reportSupplierCpf);
        if (!supplier || !reportSelectedDate) return;

        const items = (supplier.deliveries || []).filter(d => d.date === reportSelectedDate && d.invoiceNumber);
        
        if (items.length === 0) {
            alert('Nenhum item encontrado para esta data/fornecedor.');
            return;
        }

        const totalWeight = items.reduce((sum, item) => sum + (item.kg || 0), 0);
        const totalValue = items.reduce((sum, item) => sum + (item.value || 0), 0);
        const invoiceNumber = items[0].invoiceNumber; // Assuming same invoice number for the date, or listing all

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cronograma de Entrega</title>
                <style>
                    @page { size: A4; margin: 2cm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.5; color: #000; }
                    .header { text-align: center; margin-bottom: 3rem; border-bottom: 2px solid #000; padding-bottom: 1rem; }
                    .header img { height: 80px; margin-bottom: 1rem; }
                    .header h1 { font-size: 16pt; font-weight: bold; margin: 0; text-transform: uppercase; }
                    .header h2 { font-size: 12pt; font-weight: normal; margin: 5px 0 0 0; }
                    
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
                    .info-item { margin-bottom: 0.5rem; }
                    .label { font-weight: bold; text-transform: uppercase; font-size: 10pt; }
                    .value { font-size: 11pt; border-bottom: 1px dotted #ccc; display: inline-block; min-width: 200px; }

                    .section-title { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 2rem 0 1rem 0; text-align: center; background: #f0f0f0; padding: 5px; border: 1px solid #000; }

                    table { w-full; width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 10pt; }
                    th { background-color: #f0f0f0; font-weight: bold; text-transform: uppercase; text-align: center; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }

                    .footer { margin-top: 4rem; text-align: center; }
                    .signature-line { border-top: 1px solid #000; width: 60%; margin: 0 auto; padding-top: 5px; }
                    .signature-text { font-size: 10pt; font-weight: bold; text-transform: uppercase; }
                    .signature-sub { font-size: 9pt; }

                    .timestamp { position: fixed; bottom: 1cm; right: 1cm; font-size: 8pt; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Cronograma de Entrega</h1>
                    <h2>Gestão de Almoxarifado e Nutrição</h2>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Processo SEI:</span><br>
                        <span class="value">${reportSeiNumber || '_______________________'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Data do Agendamento (NF):</span><br>
                        <span class="value">${formatDate(reportSelectedDate)}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Fornecedor:</span><br>
                        <span class="value">${supplier.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">CPF/CNPJ:</span><br>
                        <span class="value">${supplier.cpf}</span>
                    </div>
                </div>

                <div class="section-title">Relação de Itens a Ser Entregue</div>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Nota Fiscal</th>
                            <th class="text-center">Peso (Kg)</th>
                            <th class="text-right">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.item}</td>
                                <td class="text-center">${item.invoiceNumber || '-'}</td>
                                <td class="text-center">${item.kg?.toFixed(3)}</td>
                                <td class="text-right">${formatCurrency(item.value || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f9f9f9; font-weight: bold;">
                            <td colspan="2" class="text-right">TOTAIS</td>
                            <td class="text-center">${totalWeight.toFixed(3)} Kg</td>
                            <td class="text-right">${formatCurrency(totalValue)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="footer">
                    <div class="signature-line"></div>
                    <div class="signature-text">${supplier.name}</div>
                    <div class="signature-sub">CPF/CNPJ: ${supplier.cpf}</div>
                </div>

                <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const filteredThirdParties = useMemo(() => {
        return (thirdPartyEntries || []).filter(log => {
            const nameMatch = log.companyName.toLowerCase().includes(searchTerm.toLowerCase());
            const dateMatch = !dateFilter || log.date === dateFilter;
            return nameMatch && dateMatch;
        });
    }, [thirdPartyEntries, searchTerm, dateFilter]);
    
    const sortedSuppliers = useMemo(() => {
        return [...filteredSuppliers].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredSuppliers]);

    const sortedThirdParties = useMemo(() => {
        return [...filteredThirdParties].sort((a, b) => a.companyName.localeCompare(b.companyName));
    }, [filteredThirdParties]);

    const handleCancel = (supplierCpf: string, deliveryIds: string[], date: string, isInvoice: boolean) => {
        const type = isInvoice ? 'FATURAMENTO' : 'AGENDAMENTO';
        if (window.confirm(`ATENÇÃO: Deseja realmente EXCLUIR o ${type} do dia ${formatDate(date)}?\n\nEsta ação removerá o registro permanentemente.`)) {
            onCancelDeliveries(supplierCpf, deliveryIds);
        }
    };

    const handleDeleteThirdParty = async (id: string, company: string, date: string) => {
        if (window.confirm(`ATENÇÃO: Deseja realmente EXCLUIR o agendamento de ${company} do dia ${formatDate(date)}?`)) {
            await onDeleteThirdPartyEntry(id);
        }
    };

    const handleClearDayForSupplier = (supplierCpf: string, supplierName: string, date: string) => {
        const p = suppliers.find(s => s.cpf === supplierCpf);
        if (!p) return;
        const deliveriesOnDate = (p.deliveries || []).filter(d => d.date === date);
        if (deliveriesOnDate.length === 0) return;

        if (window.confirm(`ATENÇÃO: Deseja excluir TODOS os registros (${deliveriesOnDate.length}) do fornecedor ${supplierName} no dia ${formatDate(date)}?`)) {
            onCancelDeliveries(supplierCpf, deliveriesOnDate.map(d => d.id));
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex bg-white p-1 rounded-2xl shadow-md border border-purple-100 max-w-md mx-auto">
                <button 
                    onClick={() => setActiveSubTab('daily')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'daily' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-purple-50'}`}
                >
                    Agenda Diária
                </button>
                <button 
                    onClick={() => setActiveSubTab('weekly')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'weekly' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-purple-50'}`}
                >
                    Controle Semanal
                </button>
                <button 
                    onClick={() => setActiveSubTab('report')} 
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'report' ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-purple-50'}`}
                >
                    Cronograma de Entrega
                </button>
            </div>

            {activeSubTab === 'daily' ? (
                <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-purple-600">
                    {/* ... existing daily content ... */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b pb-6">
                        <div>
                            <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Agenda de Entregas</h2>
                            <p className="text-gray-400 font-medium">Gerencie os agendamentos. Use os filtros abaixo para localizar datas específicas.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Pesquisar Fornecedor</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Dominato..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                                />
                            </div>
                            <div className="w-full sm:w-48">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filtrar por Data</label>
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all bg-white"
                                />
                            </div>
                            {dateFilter && (
                                <button 
                                    onClick={() => setDateFilter('')}
                                    className="mt-5 text-xs text-purple-600 font-bold hover:underline"
                                >
                                    Limpar Data
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                        {/* Seção de Terceiros */}
                        {sortedThirdParties.length > 0 && (
                            <div className="space-y-4 mb-8">
                                <h3 className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    Agendamentos de Terceiros
                                </h3>
                                {sortedThirdParties.map(log => (
                                    <div key={log.id} className="p-5 border rounded-2xl bg-amber-50/30 hover:bg-white transition-all border-l-8 border-l-amber-400 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-black text-lg text-amber-900 uppercase">{log.companyName}</h3>
                                                <p className="text-[10px] font-mono text-gray-400">{log.companyCnpj}</p>
                                                <div className="flex gap-4 mt-2">
                                                    <span className="text-xs font-black text-amber-800 font-mono">{formatDate(log.date)}</span>
                                                    <span className="text-[10px] font-bold text-amber-600 uppercase">Agendado p/ {log.time || '00:00'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                    log.status === 'concluido' ? 'bg-green-100 text-green-700' : log.arrivalTime ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {log.status === 'concluido' ? '✓ Concluído' : log.arrivalTime ? '● Em Serviço' : '○ Aguardando'}
                                                </span>
                                                <button 
                                                    onClick={() => handleDeleteThirdParty(log.id, log.companyName, log.date)}
                                                    className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Seção de Fornecedores */}
                        {sortedSuppliers.length > 0 && (
                             <h3 className="text-xs font-black text-purple-600 uppercase tracking-[0.2em] ml-2 flex items-center gap-2 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                Entregas de Fornecedores
                            </h3>
                        )}
                        {sortedSuppliers.length > 0 ? sortedSuppliers.map(supplier => {
                            const displayDeliveries = dateFilter 
                                ? (supplier.deliveries || []).filter(d => d.date === dateFilter)
                                : (supplier.deliveries || []);

                            const sortedDeliveries = [...displayDeliveries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            const pendingDeliveries = sortedDeliveries.filter(d => d.item === 'AGENDAMENTO PENDENTE');
                            const realDeliveries = sortedDeliveries.filter(d => d.item !== 'AGENDAMENTO PENDENTE');

                            return (
                                <div key={supplier.cpf} className="p-5 border rounded-2xl bg-gray-50/50 hover:bg-white transition-all border-l-8 border-l-purple-400 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-lg text-purple-900 uppercase">{supplier.name}</h3>
                                            <p className="text-[10px] font-mono text-gray-400">{supplier.cpf}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            {dateFilter && displayDeliveries.length > 0 && (
                                                <button 
                                                    onClick={() => handleClearDayForSupplier(supplier.cpf, supplier.name, dateFilter)}
                                                    className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    Limpar este dia
                                                </button>
                                            )}
                                            <span className="text-[10px] font-black text-gray-400 uppercase block">Resultados no Filtro</span>
                                            <span className="font-mono font-bold text-purple-600">{sortedDeliveries.length} registro(s)</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-4 rounded-xl border shadow-inner">
                                            <h4 className="text-[10px] font-black uppercase text-red-600 mb-3 tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                Agendamentos em Aberto (Aguardando)
                                            </h4>
                                            {pendingDeliveries.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                            {pendingDeliveries.map(delivery => (
                                                                <div key={delivery.id} className="flex flex-col gap-2 p-3 bg-red-50/50 rounded-xl border border-red-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-red-800 font-mono">{formatDate(delivery.date)}</span>
                                                                        <span className="text-[10px] font-bold text-red-600">Agendado p/ {delivery.time}</span>
                                                                        <button 
                                                                            onClick={() => handleCancel(supplier.cpf, [delivery.id], delivery.date, false)}
                                                                            className="hover:bg-red-600 hover:text-white bg-white rounded-lg p-1 text-red-500 transition-all border border-red-100 shadow-sm ml-auto"
                                                                            title="Excluir Agendamento"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    </div>
                                                            
                                                            {/* INFORMAÇÃO DA SUBPORTARIA ABERTA AQUI */}
                                                            {delivery.arrivalTime && (
                                                                <div className="bg-green-600 text-white px-3 py-1.5 rounded-lg flex items-center justify-between shadow-sm animate-pulse">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                                        <span className="text-[10px] font-black uppercase tracking-tight">Veículo em Pátio</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold">Entrou às {delivery.arrivalTime}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-300 italic">Nenhum agendamento nesta visualização.</p>
                                            )}
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border shadow-inner">
                                            <h4 className="text-[10px] font-black uppercase text-green-500 mb-3 tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                                Faturamentos Concluídos
                                            </h4>
                                            {realDeliveries.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {(() => {
                                                        const invoices = new Map<string, { date: string, invoiceNumber: string, ids: string[] }>();
                                                        realDeliveries.forEach(d => {
                                                            const nf = (d.invoiceNumber || '').toString().trim();
                                                            const key = nf || `no-nf-${d.id}`;
                                                            if (!invoices.has(key)) {
                                                                invoices.set(key, { date: d.date, invoiceNumber: nf || 'S/N', ids: [] });
                                                            }
                                                            invoices.get(key)!.ids.push(d.id);
                                                        });
                                                        return Array.from(invoices.values()).map((inv, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 bg-green-50 text-green-700 text-xs font-black px-3 py-1.5 rounded-xl border border-green-100">
                                                                <span className="font-mono">{formatDate(inv.date)}</span>
                                                                <span className="text-[9px] px-1 bg-green-100 rounded">NF {inv.invoiceNumber}</span>
                                                                <button 
                                                                    onClick={() => handleCancel(supplier.cpf, inv.ids, inv.date, true)}
                                                                    className="hover:bg-red-600 hover:text-white bg-white rounded-lg p-1 text-red-500 transition-all border border-red-100 shadow-sm"
                                                                    title="Excluir Faturamento"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-300 italic">Nenhum faturamento nesta visualização.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed">
                                <p className="text-gray-400 font-bold uppercase tracking-widest">Nenhum registro encontrado para estes filtros.</p>
                                {dateFilter && <p className="text-xs text-gray-400 mt-2">Dica: Verifique se o dia {formatDate(dateFilter)} realmente possui entregas agendadas.</p>}
                            </div>
                        )}
                    </div>
                </div>
            ) : activeSubTab === 'report' ? (
                <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-4xl mx-auto border-t-8 border-purple-600">
                    <h2 className="text-2xl font-black text-purple-900 uppercase tracking-tighter mb-6">Gerador de Cronograma de Entrega</h2>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">1. Selecione o Fornecedor (Com Notas Fiscais)</label>
                            <select 
                                value={reportSupplierCpf} 
                                onChange={e => { setReportSupplierCpf(e.target.value); setReportSelectedDate(''); }}
                                className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 font-bold text-gray-700 bg-white"
                            >
                                <option value="">Selecione um fornecedor...</option>
                                {reportSuppliers.map(s => (
                                    <option key={s.cpf} value={s.cpf}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {reportSupplierCpf && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">2. Selecione a Data da Nota Fiscal</label>
                                <select 
                                    value={reportSelectedDate} 
                                    onChange={e => setReportSelectedDate(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 font-bold text-gray-700 bg-white"
                                >
                                    <option value="">Selecione uma data...</option>
                                    {reportAvailableDates.map(date => (
                                        <option key={date} value={date}>{formatDate(date)}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {reportSelectedDate && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">3. Número do Processo SEI</label>
                                <input 
                                    type="text" 
                                    value={reportSeiNumber} 
                                    onChange={e => setReportSeiNumber(e.target.value)}
                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 font-bold text-gray-700"
                                    placeholder="Ex: 12345.000000/2026-00"
                                />
                            </div>
                        )}

                        <button 
                            onClick={handleGenerateReport}
                            disabled={!reportSupplierCpf || !reportSelectedDate}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 px-8 rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-purple-200 active:scale-95 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-4"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Gerar PDF do Cronograma
                        </button>
                    </div>
                </div>
            ) : (
                <WeeklyScheduleControl suppliers={suppliers} thirdPartyEntries={thirdPartyEntries} />
            )}
             <style>{`.custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }`}</style>
        </div>
    );
};

export default AdminScheduleView;
