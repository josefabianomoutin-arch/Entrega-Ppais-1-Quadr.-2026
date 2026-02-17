
import React, { useState, useMemo } from 'react';
import type { FinancialRecord } from '../types';

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
    numeroEmpenho: ''
  };

  const [formData, setFormData] = useState<Partial<FinancialRecord>>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  
  const isEditing = !!formData.id;

  // Cálculo detalhado para os quadros de saldo vinculados
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
            const n = parseFloat(String(val).replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };
        const recordToSave: any = { 
            ...formData,
            id: formData.id || null, 
            ptres: formData.ptres?.trim(),
            descricao: formData.descricao?.trim() || '',
            justificativa: formData.justificativa?.trim() || '',
            numeroProcesso: formData.numeroProcesso?.trim() || '',
            numeroEmpenho: formData.numeroEmpenho?.trim() || '',
            dataFinalizacaoProcesso: formData.dataFinalizacaoProcesso || '',
            modalidade: formData.modalidade?.trim() || '',
            status: formData.status?.trim() || 'PENDENTE'
        };
        if (formData.tipo === 'RECURSO') {
          recordToSave.valorRecebido = sanitizeNum(formData.valorRecebido);
          recordToSave.valorSolicitado = sanitizeNum(formData.valorSolicitado);
          delete recordToSave.valorUtilizado;
          delete recordToSave.localUtilizado;
          delete recordToSave.numeroProcesso;
          delete recordToSave.numeroEmpenho;
          delete recordToSave.dataFinalizacaoProcesso;
          delete recordToSave.dataPagamento;
          delete recordToSave.modalidade;
        } else {
          recordToSave.valorUtilizado = sanitizeNum(formData.valorUtilizado);
          delete recordToSave.dataSolicitacao;
          delete recordToSave.valorSolicitado;
          delete recordToSave.dataRecebimento;
          delete recordToSave.valorRecebido;
        }
        const res = await onSave(recordToSave as FinancialRecord);
        if (res && res.success) setFormData(initialFormState);
        else alert(res?.message || 'Falha ao salvar registro.');
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
                    <input type="text" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value.toUpperCase()})} className="w-full p-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400 font-black text-[10px]" placeholder="STATUS" />
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
        {PTRES_OPTIONS.map(ptres => {
          const ptresRecords = records.filter(r => r.ptres.trim() === ptres);
          if (ptresRecords.length === 0) return null;

          const ptresTotals = ptresRecords.reduce((acc, r) => ({
            rec: acc.rec + (r.tipo === 'RECURSO' ? (Number(r.valorRecebido) || 0) : 0),
            gast: acc.gast + (r.tipo === 'DESPESA' ? Number(r.valorUtilizado) : 0)
          }), { rec: 0, gast: 0 });

          return (
            <div key={ptres} className="animate-fade-in-up">
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

              <div className="grid grid-cols-1 gap-4">
                {ptresRecords.sort((a, b) => {
                  return new Date(b.dataRecebimento || b.dataPagamento || 0).getTime() - new Date(a.dataRecebimento || a.dataPagamento || 0).getTime();
                }).map((r, index) => (
                  <div key={r.id || `admin-rec-${index}`} className={`group bg-white p-6 rounded-3xl border-l-[12px] shadow-sm hover:shadow-md transition-all ${r.tipo === 'RECURSO' ? 'border-indigo-500' : 'border-red-500'} ${formData.id === r.id ? 'ring-4 ring-orange-300' : ''}`}>
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between">
                            <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${r.tipo === 'RECURSO' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {r.tipo}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400">NATUREZA: {r.natureza}</span>
                            {r.tipo === 'DESPESA' && <span className="text-[10px] font-black text-indigo-500 uppercase">{r.modalidade || 'DISPENSA'}</span>}
                            </div>
                            <span className="text-[8px] font-mono text-gray-300 uppercase">ID: ...{r.id?.slice(-4)}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição do Objeto</p>
                          <p className="text-sm font-bold text-gray-800 leading-relaxed uppercase">{r.descricao || 'N/A'}</p>
                          
                          {/* EXIBIÇÃO PROCESSO / EMPENHO NO HISTÓRICO ADMIN */}
                          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-50 text-[9px] font-bold uppercase text-gray-400">
                             {r.numeroProcesso && <span>PROCESSO: <span className="text-gray-600">{r.numeroProcesso}</span></span>}
                             {r.numeroEmpenho && <span>EMPENHO: <span className="text-gray-600">{r.numeroEmpenho}</span></span>}
                             {r.dataFinalizacaoProcesso && <span>CONCLUÍDO EM: <span className="text-gray-600">{r.dataFinalizacaoProcesso.split('-').reverse().join('/')}</span></span>}
                          </div>
                        </div>
                      </div>

                      <div className="lg:w-64 bg-gray-50 p-4 rounded-2xl space-y-3 flex flex-col justify-center">
                        <div className="flex justify-between items-end border-b border-gray-200 pb-2">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Valor</p>
                          <p className={`text-lg font-black ${r.tipo === 'RECURSO' ? 'text-indigo-700' : 'text-red-700'}`}>
                            {r.tipo === 'RECURSO' ? formatCurrency(r.valorRecebido) : formatCurrency(r.valorUtilizado)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Data</p>
                            <p className="text-[10px] font-mono font-bold text-gray-600">{(r.dataRecebimento || r.dataPagamento || '-').split('-').reverse().join('/')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Status</p>
                            <p className="text-[10px] font-black text-indigo-600">{r.status || 'PENDENTE'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="lg:w-16 flex lg:flex-col justify-end lg:justify-center gap-2">
                        <button onClick={() => handleEdit(r)} className={`p-3 rounded-2xl transition-all ${formData.id === r.id ? 'bg-orange-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => { if(window.confirm('Excluir este registro?')) onDelete(r.id); }} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
