
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FinancialRecord } from '../types';
import ConfirmModal from './ConfirmModal';

interface AdminFinancialManagerProps {
  records: FinancialRecord[];
  onSave: (record: Omit<FinancialRecord, 'id'> & { id?: string }) => Promise<{ success: boolean; message?: string }>;
  onDelete: (id: string) => Promise<void>;
}

const PTRES_OPTIONS = ['380302', '380303', '380304', '380308', '380328'] as const;
const NATUREZA_OPTIONS = ['339030', '339039'] as const;

const PTRES_DESCRIPTIONS: Record<string, string> = {
    '380302': 'Materiais para o Setor de Saúde',
    '380303': 'Recurso para Atender peças e serviços de viaturas',
    '380304': 'Recurso para atender despesas de materiais e serviços administrativos',
    '380308': 'Recurso para atender peças e serviço para manutenção e conservação da Unidade',
    '380328': 'Recurso para Diárias e Outras Despesas'
};

const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const PtresTable: React.FC<{ ptres: string, ptresRecords: FinancialRecord[], formData: Partial<FinancialRecord>, handleEdit: (r: FinancialRecord) => void, onDelete: (id: string) => void }> = ({ ptres, ptresRecords, formData, handleEdit, onDelete }) => {
    const topScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    
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

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !bottomScroll) return;

        const handleTopScroll = () => {
            bottomScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleBottomScroll = () => {
            topScroll.scrollLeft = bottomScroll.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
        };
    }, []);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const table = tableRef.current;
        if (!topScroll || !table) return;

        const resizeObserver = new ResizeObserver(() => {
            if (topScroll.firstChild) {
                (topScroll.firstChild as HTMLElement).style.width = `${table.offsetWidth}px`;
            }
        });

        resizeObserver.observe(table);
        return () => resizeObserver.disconnect();
    }, [ptresRecords]);

    const ptresTotals = ptresRecords.reduce((acc, r) => ({
        rec: acc.rec + (r.tipo === 'RECURSO' ? (Number(r.valorRecebido) || 0) : 0),
        gast: acc.gast + (r.tipo === 'DESPESA' ? Number(r.valorUtilizado) : 0)
    }), { rec: 0, gast: 0 });

    return (
        <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-4 border-b-2 border-gray-200 pb-2 px-2">
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-3">
                        <h3 className="text-2xl font-black text-gray-800 tracking-tighter italic">Histórico PTRES {ptres}</h3>
                        <span className="text-[10px] font-black bg-gray-200 text-gray-600 px-3 py-1 rounded-full uppercase tracking-widest">
                            {ptresRecords.length} Movimentos
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Saldo do Grupo</p>
                    <p className={`font-black ${ptresTotals.rec - ptresTotals.gast >= 0 ? 'text-indigo-600' : 'text-red-700'}`}>
                        {formatCurrency(ptresTotals.rec - ptresTotals.gast)}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div 
                    ref={topScrollRef} 
                    className="overflow-x-auto overflow-y-hidden custom-scrollbar border-b border-gray-100" 
                    style={{ height: '12px' }}
                >
                    <div style={{ height: '1px' }}></div>
                </div>
                <div ref={bottomScrollRef} className="overflow-x-auto custom-scrollbar">
                    <table ref={tableRef} className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                                <th className="p-3 text-center w-12">#</th>
                                <th className="p-3 text-left">Tipo</th>
                                <th className="p-3 text-left">Natureza / Modalidade</th>
                                <th className="p-3 text-left">Descrição</th>
                                <th className="p-3 text-left">Processo / Empenho</th>
                                <th className="p-3 text-left">Data</th>
                                <th className="p-3 text-left">Status</th>
                                <th className="p-3 text-right">Valor</th>
                                <th className="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ptresRecords.sort((a, b) => new Date(b.dataRecebimento || b.dataPagamento || 0).getTime() - new Date(a.dataRecebimento || a.dataPagamento || 0).getTime()).map((r, index) => {
                                const statusUpper = (r.status || '').toUpperCase().trim();
                                const isFinalizado = ['FINALIZADO', 'CONCLUIDO', 'CONCLUÍDO'].includes(statusUpper);
                                const isEmAndamentoEmpenhado = statusUpper === 'EM ANDAMENTO' && !!r.numeroEmpenho;
                                
                                return (
                                    <tr key={r.id || `admin-rec-${index}`} className={`border-b hover:bg-gray-50 transition-colors ${formData.id === r.id ? 'bg-orange-50' : ''}`}>
                                        <td className="p-3 text-center font-mono text-gray-500">{index + 1}</td>
                                        <td className="p-3">
                                            <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border shadow-sm ${isFinalizado ? 'bg-green-100 text-green-700 border-green-200' : isEmAndamentoEmpenhado ? 'bg-orange-100 text-orange-700 border-orange-200' : (r.tipo === 'RECURSO' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100')}`}>
                                                {r.tipo}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="text-[10px] font-bold text-gray-600">NAT: {r.natureza}</div>
                                            {r.tipo === 'DESPESA' && <div className={`text-[10px] font-black uppercase mt-1 ${isFinalizado ? 'text-green-600' : isEmAndamentoEmpenhado ? 'text-orange-600' : 'text-indigo-500'}`}>{r.modalidade || 'DISPENSA'}</div>}
                                        </td>
                                        <td className="p-3 max-w-xs">
                                            <div className="text-sm font-bold text-gray-800 uppercase truncate" title={r.descricao}>{r.descricao || 'N/A'}</div>
                                            <div className="text-[8px] font-mono text-gray-300 uppercase mt-1">ID: ...{r.id?.slice(-4)}</div>
                                        </td>
                                        <td className="p-3 text-[9px] font-bold uppercase text-gray-500">
                                            {r.numeroProcesso && <div className="mb-1">PROC: <span className={isFinalizado ? "text-green-700 font-black" : isEmAndamentoEmpenhado ? "text-orange-700 font-black" : "text-gray-800"}>{r.numeroProcesso}</span></div>}
                                            {r.numeroEmpenho && <div className="mb-1">EMP: <span className={isEmAndamentoEmpenhado ? "text-orange-700 font-black" : "text-gray-800"}>{r.numeroEmpenho}</span></div>}
                                            {r.notaCredito && <div>CRÉD: <span className="text-gray-800">{r.notaCredito}</span></div>}
                                        </td>
                                        <td className="p-3 font-mono text-[10px] text-gray-600">
                                            {(r.dataRecebimento || r.dataPagamento || '-').split('-').reverse().join('/')}
                                            {(!isFinalizado && r.dataFinalizacaoProcesso) && <div className="text-[8px] mt-1 text-gray-400">PREV: {r.dataFinalizacaoProcesso.split('-').reverse().join('/')}</div>}
                                            {(isFinalizado && r.dataFinalizacaoProcesso) && <div className="text-[8px] mt-1 text-green-600 font-bold">CONCL: {r.dataFinalizacaoProcesso.split('-').reverse().join('/')}</div>}
                                        </td>
                                        <td className="p-3">
                                            <span className={`text-[10px] font-black ${isFinalizado ? 'text-green-700' : isEmAndamentoEmpenhado ? 'text-orange-600' : 'text-indigo-600'}`}>{r.status || 'PENDENTE'}</span>
                                        </td>
                                        <td className={`p-3 text-right font-black ${isFinalizado ? 'text-green-700' : isEmAndamentoEmpenhado ? 'text-orange-700' : (r.tipo === 'RECURSO' ? 'text-indigo-700' : 'text-red-700')}`}>
                                            {r.tipo === 'RECURSO' ? formatCurrency(r.valorRecebido) : formatCurrency(r.valorUtilizado)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(r)} className={`p-2 rounded-lg transition-all ${formData.id === r.id ? 'bg-orange-500 text-white' : (isFinalizado ? 'bg-green-100 text-green-700 hover:bg-green-600 hover:text-white' : isEmAndamentoEmpenhado ? 'bg-orange-100 text-orange-700 hover:bg-orange-600 hover:text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white')}`} title="Editar">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button onClick={() => { 
                                                    setConfirmConfig({
                                                        isOpen: true,
                                                        title: 'Excluir Registro',
                                                        message: 'Deseja realmente excluir este registro? Esta ação não pode ser desfeita.',
                                                        onConfirm: () => {
                                                            onDelete(r.id);
                                                            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                                        },
                                                        variant: 'danger'
                                                    });
                                                }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all" title="Excluir">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmModal 
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                variant={confirmConfig.variant}
            />
        </div>
    );
};

const AdminFinancialManager: React.FC<AdminFinancialManagerProps> = ({ records, onSave, onDelete }) => {
  const initialFormState: Partial<FinancialRecord> = {
    tipo: 'DESPESA',
    ptres: '380302',
    natureza: '339030',
    modalidade: '',
    dataSolicitacao: new Date().toISOString().split('T')[0],
    valorSolicitado: 0,
    valorRecebido: 0,
    valorUtilizado: 0,
    status: 'PENDENTE',
    selecao: '',
    dataRecebimento: '',
    justificativa: '',
    descricao: '',
    localUtilizado: '',
    numeroProcesso: '',
    dataPagamento: '',
    dataFinalizacaoProcesso: '',
    numeroEmpenho: '',
    notaCredito: ''
  };

  const [formData, setFormData] = useState<Partial<FinancialRecord>>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  
  const isEditing = !!formData.id;

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório Financeiro</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background-color: #f2f2f2; }
                h1 { color: #333; font-size: 18px; }
                h2 { color: #555; font-size: 14px; margin-top: 30px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .text-green-600 { color: #16a34a; }
                .text-red-600 { color: #dc2626; }
                .text-indigo-600 { color: #4f46e5; }
                @media print {
                    @page { size: A4 landscape; margin: 10mm; }
                }
            </style>
        </head>
        <body>
            <h1>Relatório Financeiro</h1>
            <p>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            
            ${PTRES_OPTIONS.map(ptres => {
                const ptresRecords = records.filter(r => r.ptres.trim() === ptres);
                if (ptresRecords.length === 0) return '';

                const ptresTotals = ptresRecords.reduce((acc, r) => ({
                    rec: acc.rec + (r.tipo === 'RECURSO' ? (Number(r.valorRecebido) || 0) : 0),
                    gast: acc.gast + (r.tipo === 'DESPESA' ? Number(r.valorUtilizado) : 0)
                }), { rec: 0, gast: 0 });

                return `
                    <h2>PTRES ${ptres} - Saldo: ${formatCurrency(ptresTotals.rec - ptresTotals.gast)}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th class="text-center">#</th>
                                <th>Tipo</th>
                                <th>Natureza</th>
                                <th>Modalidade</th>
                                <th>Descrição</th>
                                <th>Processo / Empenho</th>
                                <th>Data</th>
                                <th>Status</th>
                                <th class="text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ptresRecords.sort((a, b) => new Date(b.dataRecebimento || b.dataPagamento || 0).getTime() - new Date(a.dataRecebimento || a.dataPagamento || 0).getTime()).map((r, index) => `
                                <tr>
                                    <td class="text-center">${index + 1}</td>
                                    <td class="font-bold ${r.tipo === 'RECURSO' ? 'text-indigo-600' : 'text-red-600'}">${r.tipo}</td>
                                    <td>${r.natureza}</td>
                                    <td>${r.modalidade || '-'}</td>
                                    <td>${r.descricao || '-'}</td>
                                    <td>
                                        ${r.numeroProcesso ? `Proc: ${r.numeroProcesso}<br>` : ''}
                                        ${r.numeroEmpenho ? `Emp: ${r.numeroEmpenho}<br>` : ''}
                                        ${r.notaCredito ? `Créd: ${r.notaCredito}` : ''}
                                    </td>
                                    <td>${(r.dataRecebimento || r.dataPagamento || '-').split('-').reverse().join('/')}</td>
                                    <td>${r.status || 'PENDENTE'}</td>
                                    <td class="text-right font-bold ${r.tipo === 'RECURSO' ? 'text-indigo-600' : 'text-red-600'}">
                                        ${r.tipo === 'RECURSO' ? formatCurrency(r.valorRecebido) : formatCurrency(r.valorUtilizado)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }).join('')}
            <script>
                window.onload = () => {
                    window.print();
                    window.close();
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const linkedBalances = useMemo(() => {
    return PTRES_OPTIONS.map(p => {
      const naturezas = NATUREZA_OPTIONS.map(n => {
        const rec = records.filter(r => r.ptres.trim() === p && r.natureza === n && r.tipo === 'RECURSO')
                           .reduce((acc, curr) => acc + (Number(curr.valorRecebido) || 0), 0);
        const gast = records.filter(r => r.ptres.trim() === p && r.natureza === n && r.tipo === 'DESPESA')
                            .reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0);
        return { 
            codigo: n, 
            label: n === '339030' ? 'Peças / Materiais' : 'Outros Serviços', 
            recurso: rec, 
            gasto: gast, 
            saldo: rec - gast 
        };
      });

      const totalRecurso = naturezas.reduce((a, b) => a + b.recurso, 0);
      const totalGasto = naturezas.reduce((a, b) => a + b.gasto, 0);

      return { 
          ptres: p, 
          naturezas, 
          totalSaldo: totalRecurso - totalGasto 
      };
    });
  }, [records]);

  const handleEdit = (record: FinancialRecord) => {
    setFormData({ ...record });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setFormData(initialFormState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
        const sanitizeNum = (val: any) => {
            if (typeof val === 'number') return val;
            const n = parseFloat(String(val || '0').replace(/\./g, '').replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };

        const recordToSave: any = { 
            ...formData,
            id: formData.id || null, 
            ptres: formData.ptres?.trim(),
            descricao: formData.descricao?.trim() || '',
            status: (formData.status || 'PENDENTE').toUpperCase().trim(),
            numeroProcesso: formData.numeroProcesso?.trim() || '',
            numeroEmpenho: formData.numeroEmpenho?.trim() || '',
            notaCredito: formData.notaCredito?.trim() || '',
            dataFinalizacaoProcesso: formData.dataFinalizacaoProcesso || '',
            modalidade: formData.modalidade?.trim() || ''
        };

        if (formData.tipo === 'RECURSO') {
          recordToSave.valorRecebido = sanitizeNum(formData.valorRecebido);
          recordToSave.valorSolicitado = sanitizeNum(formData.valorSolicitado);
          // Garantir que campos de despesa não poluam registros de entrada
          delete recordToSave.valorUtilizado;
          delete recordToSave.numeroEmpenho;
          delete recordToSave.notaCredito;
        } else {
          recordToSave.valorUtilizado = sanitizeNum(formData.valorUtilizado);
          // Garantir que campos de entrada não poluam registros de gasto
          delete recordToSave.valorRecebido;
          delete recordToSave.valorSolicitado;
        }

        const res = await onSave(recordToSave as FinancialRecord);
        if (res && res.success) {
            setFormData(initialFormState);
            alert('Registro salvo com sucesso!');
        } else {
            alert(res?.message || 'Falha ao salvar registro.');
        }
    } catch (error) {
        alert("Erro de conexão. Tente novamente.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-12 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      
      {/* 1. QUADROS DE SALDO */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {linkedBalances.map(group => (
            <div key={group.ptres} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-t-8 border-indigo-900 flex flex-col h-full animate-fade-in-up">
                <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-4xl font-black text-indigo-950 uppercase tracking-tighter italic">PTRES {group.ptres}</h3>
                            <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest hidden sm:inline-block">
                                {PTRES_DESCRIPTIONS[group.ptres] || 'Cota Orçamentária'}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Saldos Vinculados por Natureza</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Saldo Consolidado</p>
                        <p className={`text-2xl font-black ${group.totalSaldo >= 0 ? 'text-indigo-800' : 'text-red-700'}`}>{formatCurrency(group.totalSaldo)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                    {group.naturezas.map(nat => (
                        <div key={nat.codigo} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col justify-between group hover:shadow-lg ${nat.saldo >= 0 ? 'bg-gray-50 border-gray-100 hover:bg-white' : 'bg-red-50 border-red-100 hover:bg-red-100/50'}`}>
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${nat.codigo === '339030' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        NAT {nat.codigo}
                                    </span>
                                    <span className="text-[11px] font-black text-gray-400">
                                        {nat.codigo === '339030' ? '📦 PEÇAS' : '🛠️ SERVIÇOS'}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-gray-800 uppercase mb-6 leading-tight">
                                    {nat.label}
                                </p>
                            </div>

                            <div className="space-y-2 border-t border-gray-100 pt-4">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500 font-medium uppercase tracking-tighter">Recurso:</span>
                                    <span className="text-gray-800 font-bold">{formatCurrency(nat.recurso)}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-gray-500 font-medium uppercase tracking-tighter">Gasto:</span>
                                    <span className="text-gray-800 font-bold">{formatCurrency(nat.gasto)}</span>
                                </div>
                                <div className="flex justify-between items-baseline pt-2">
                                    <span className="text-[11px] font-black text-indigo-900 uppercase">Saldo:</span>
                                    <span className={`text-lg font-black ${nat.saldo >= 0 ? 'text-indigo-600' : 'text-red-700'}`}>
                                        {formatCurrency(nat.saldo)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>

      {/* 2. FORMULÁRIO DE LANÇAMENTO */}
      <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border-2 transition-all ${isEditing ? 'border-orange-500 ring-4 ring-orange-50' : 'border-gray-100'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">
                    {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h2>
                {isEditing && <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Edição Ativa</span>}
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              {formData.tipo === 'RECURSO' ? 'Entrada de Recurso / Cota' : 'Lançamento de Despesa / Gasto'}
            </p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
             <button type="button" onClick={() => !isEditing && setFormData({...formData, tipo: 'RECURSO'})} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.tipo === 'RECURSO' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400'} ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isEditing}>Entrada</button>
             <button type="button" onClick={() => !isEditing && setFormData({...formData, tipo: 'DESPESA'})} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.tipo === 'DESPESA' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'} ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isEditing}>Despesa</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">PTRES</label>
            <select value={formData.ptres} onChange={e => setFormData({...formData, ptres: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all text-sm">
                {PTRES_OPTIONS.map(o => <option key={o} value={o}>{o} - {PTRES_DESCRIPTIONS[o]?.slice(0,25)}...</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Natureza</label>
            <select value={formData.natureza} onChange={e => setFormData({...formData, natureza: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all text-sm">
                {NATUREZA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          
          {formData.tipo === 'RECURSO' ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data Rec.</label>
                <input type="date" value={formData.dataRecebimento} onChange={e => setFormData({...formData, dataRecebimento: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">Valor Creditado (R$)</label>
                <input type="text" value={formData.valorRecebido ?? ''} onChange={e => setFormData({...formData, valorRecebido: e.target.value as any})} placeholder="0,00" className="w-full p-3 border rounded-xl bg-white border-indigo-100 font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Modalidade</label>
                <input type="text" value={formData.modalidade || ''} onChange={e => setFormData({...formData, modalidade: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-sm" placeholder="Dispensa, Pregão..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-red-600 uppercase ml-1">Valor Gasto (R$)</label>
                <input type="text" value={formData.valorUtilizado ?? ''} onChange={e => setFormData({...formData, valorUtilizado: e.target.value as any})} placeholder="0,00" className="w-full p-3 border rounded-xl bg-white border-red-100 font-black text-red-700 outline-none focus:ring-2 focus:ring-red-400" />
              </div>
            </>
          )}

          <div className="md:col-span-2 lg:col-span-4 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Descrição do Objeto / Serviço</label>
            <textarea rows={1} value={formData.descricao || ''} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-medium text-sm" placeholder="O que foi adquirido?" />
          </div>

          {/* NOVO BLOCO: PROCESSO E EMPENHO */}
          <div className="md:col-span-3 lg:col-span-4 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Informações do Processo e Empenho</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase ml-1">Status</span>
                    <input type="text" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value.toUpperCase()})} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-black text-[10px]" placeholder="EX: CONCLUÍDO" />
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase ml-1">Nº Processo</span>
                    <input type="text" value={formData.numeroProcesso || ''} onChange={e => setFormData({...formData, numeroProcesso: e.target.value})} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-[10px]" placeholder="Nº PROC" />
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase ml-1">Finalização</span>
                    <input type="date" value={formData.dataFinalizacaoProcesso || ''} onChange={e => setFormData({...formData, dataFinalizacaoProcesso: e.target.value})} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400 text-[10px]" />
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase ml-1">Nº Empenho</span>
                    <input type="text" value={formData.numeroEmpenho || ''} onChange={e => setFormData({...formData, numeroEmpenho: e.target.value})} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-[10px]" placeholder="Nº EMP" />
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase ml-1">Nota de Crédito</span>
                    <input type="text" value={formData.notaCredito || ''} onChange={e => setFormData({...formData, notaCredito: e.target.value})} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-[10px]" placeholder="Nº CRÉDITO" />
                </div>
            </div>
          </div>

          <div className="md:col-span-1 flex items-end">
            <div className="flex gap-2 w-full">
              {isEditing && (
                <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-200 text-gray-600 font-black p-3 rounded-xl uppercase text-[10px] shadow-sm hover:bg-gray-300 transition-colors">Cancelar</button>
              )}
              <button type="submit" disabled={isSaving} className={`flex-[2] font-black p-3 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-[10px] text-white ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : (formData.tipo === 'RECURSO' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700')}`}>
                {isSaving ? 'Gravando...' : (isEditing ? 'Salvar Alterações' : 'Registrar Lançamento')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 3. VISUALIZAÇÃO DOS GASTOS AGRUPADOS POR PTRES */}
      <div className="space-y-16">
        <div className="flex justify-end mb-4">
            <button 
                onClick={handlePrintPDF}
                className="bg-gray-800 hover:bg-gray-900 text-white font-black py-2 px-6 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest text-xs flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Imprimir PDF
            </button>
        </div>
        {PTRES_OPTIONS.map(ptres => {
          const ptresRecords = records.filter(r => r.ptres.trim() === ptres);
          if (ptresRecords.length === 0) return null;

          return (
            <PtresTable
              key={ptres}
              ptres={ptres}
              ptresRecords={ptresRecords}
              formData={formData}
              handleEdit={handleEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminFinancialManager;
