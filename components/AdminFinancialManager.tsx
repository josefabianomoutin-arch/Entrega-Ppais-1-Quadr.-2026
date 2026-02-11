
import React, { useState, useMemo } from 'react';
import type { FinancialRecord } from '../types';

interface AdminFinancialManagerProps {
  records: FinancialRecord[];
  onSave: (record: Omit<FinancialRecord, 'id'> & { id?: string }) => Promise<{ success: boolean; message?: string }>;
  onDelete: (id: string) => Promise<void>;
}

const PTRES_OPTIONS = ['380302', '380303', '380304', '380308', '380328'] as const;
const NATUREZA_OPTIONS = ['339030', '339039'] as const;

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
    dataPagamento: ''
  };

  const [formData, setFormData] = useState<Partial<FinancialRecord>>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!formData.id;

  // Cálculos de Soma e Saldo para os Cards do Topo
  const totalsByPtres = useMemo(() => {
    return PTRES_OPTIONS.map(p => {
      const rec = records.filter(r => r.ptres.trim() === p && r.tipo === 'RECURSO').reduce((acc, curr) => acc + (Number(curr.valorRecebido) || 0), 0);
      const gast = records.filter(r => r.ptres.trim() === p && r.tipo === 'DESPESA').reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0);
      return { ptres: p, recurso: rec, gasto: gast, saldo: rec - gast };
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
    if (isSaving) return; // Trava contra duplo clique

    setIsSaving(true);
    
    // Limpeza rigorosa de strings para evitar duplicidade visual por espaços
    const recordToSave: any = { 
        ...formData,
        ptres: formData.ptres?.trim(),
        descricao: formData.descricao?.trim(),
        justificativa: formData.justificativa?.trim(),
        numeroProcesso: formData.numeroProcesso?.trim(),
        modalidade: formData.modalidade?.trim()
    };

    if (formData.tipo === 'RECURSO') {
      delete recordToSave.valorUtilizado;
      delete recordToSave.localUtilizado;
      delete recordToSave.numeroProcesso;
      delete recordToSave.dataPagamento;
      delete recordToSave.modalidade;
    } else {
      delete recordToSave.dataSolicitacao;
      delete recordToSave.valorSolicitado;
      delete recordToSave.dataRecebimento;
      delete recordToSave.valorRecebido;
    }

    const res = await onSave(recordToSave as FinancialRecord);
    if (res.success) {
      setFormData(initialFormState);
    } else {
      alert(res.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20 max-w-6xl mx-auto">
      {/* 1. SUMÁRIO DE SALDOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {totalsByPtres.map(t => (
          <div key={t.ptres} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">{t.ptres}</p>
            <div>
              <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                <span>REC: {formatCurrency(t.recurso)}</span>
              </div>
              <p className={`text-sm font-black ${t.saldo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                {formatCurrency(t.saldo)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. FORMULÁRIO DE LANÇAMENTO */}
      <div className={`bg-white p-8 rounded-3xl shadow-xl border-2 transition-all ${isEditing ? 'border-orange-400' : 'border-gray-100'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">
              {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {formData.tipo === 'RECURSO' ? 'Entrada de Recurso / Cota' : 'Lançamento de Despesa / Gasto'}
            </p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
             <button type="button" onClick={() => !isEditing && setFormData({...formData, tipo: 'RECURSO'})} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.tipo === 'RECURSO' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400'} ${isEditing ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`} disabled={isEditing}>Entrada</button>
             <button type="button" onClick={() => !isEditing && setFormData({...formData, tipo: 'DESPESA'})} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.tipo === 'DESPESA' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'} ${isEditing ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`} disabled={isEditing}>Despesa</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">PTRES</label>
            <select value={formData.ptres} onChange={e => setFormData({...formData, ptres: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400">
                {PTRES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Natureza</label>
            <select value={formData.natureza} onChange={e => setFormData({...formData, natureza: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400">
                {NATUREZA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          
          {formData.tipo === 'RECURSO' ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data Rec.</label>
                <input type="date" value={formData.dataRecebimento} onChange={e => setFormData({...formData, dataRecebimento: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">Valor Creditado (R$)</label>
                <input type="number" step="0.01" value={formData.valorRecebido || ''} onChange={e => setFormData({...formData, valorRecebido: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-white border-indigo-100 font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Modalidade</label>
                <input type="text" value={formData.modalidade || ''} onChange={e => setFormData({...formData, modalidade: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold" placeholder="Ex: Dispensa..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-red-600 uppercase ml-1">Valor Gasto (R$)</label>
                <input type="number" step="0.01" value={formData.valorUtilizado || ''} onChange={e => setFormData({...formData, valorUtilizado: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-white border-red-100 font-black text-red-700 outline-none focus:ring-2 focus:ring-red-400" />
              </div>
            </>
          )}

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Descrição do Objeto / Serviço</label>
            <textarea rows={2} value={formData.descricao || ''} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-medium" placeholder="O que foi adquirido?" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Justificativa da Necessidade</label>
            <textarea rows={2} value={formData.justificativa || ''} onChange={e => setFormData({...formData, justificativa: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-medium italic" placeholder="Por que foi necessário?" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Status / Processo</label>
            <div className="flex gap-2">
                <input type="text" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value.toUpperCase()})} className="w-1/2 p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-black text-[10px]" placeholder="STATUS" />
                <input type="text" value={formData.numeroProcesso || ''} onChange={e => setFormData({...formData, numeroProcesso: e.target.value})} className="w-1/2 p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-[10px]" placeholder="Nº PROC" />
            </div>
          </div>

          <div className="md:col-span-1 flex items-end">
            <div className="flex gap-2 w-full">
              {isEditing && <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-500 font-black p-3 rounded-xl uppercase text-[10px]">Cancelar</button>}
              <button type="submit" disabled={isSaving} className={`flex-[2] font-black p-3 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest text-[10px] text-white ${isEditing ? 'bg-orange-500' : (formData.tipo === 'RECURSO' ? 'bg-indigo-600' : 'bg-red-600')}`}>
                {isSaving ? 'Gravando...' : (isEditing ? 'Salvar Alteração' : 'Registrar')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 3. VISUALIZAÇÃO DOS GASTOS AGRUPADOS POR PTRES */}
      <div className="space-y-12">
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
                <div className="flex items-baseline gap-3">
                  <h3 className="text-2xl font-black text-gray-800 tracking-tighter">PTRES {ptres}</h3>
                  <span className="text-[10px] font-black bg-gray-200 text-gray-600 px-3 py-1 rounded-full uppercase tracking-widest">
                    {ptresRecords.length} Movimentações
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Saldo do Grupo</p>
                  <p className={`font-black ${ptresTotals.rec - ptresTotals.gast >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                    {formatCurrency(ptresTotals.rec - ptresTotals.gast)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {ptresRecords.sort((a, b) => new Date(b.dataRecebimento || b.dataPagamento || 0).getTime() - new Date(a.dataRecebimento || a.dataPagamento || 0).getTime()).map((r, index) => (
                  <div key={r.id || `admin-rec-${index}`} className={`group bg-white p-6 rounded-3xl border-l-8 shadow-sm hover:shadow-md transition-all ${r.tipo === 'RECURSO' ? 'border-indigo-500' : 'border-red-500'}`}>
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      
                      {/* Coluna 1: Info Básica */}
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between">
                            <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase border ${r.tipo === 'RECURSO' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {r.tipo}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400">NATUREZA: {r.natureza}</span>
                            {r.tipo === 'DESPESA' && <span className="text-[10px] font-black text-indigo-500 uppercase">{r.modalidade || 'SEM MODALIDADE'}</span>}
                            </div>
                            <span className="text-[8px] font-mono text-gray-300 uppercase">UID: ...{r.id?.slice(-5)}</span>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição do Objeto</p>
                          <p className="text-sm font-bold text-gray-800 leading-relaxed uppercase">{r.descricao || 'Nenhuma descrição informada.'}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Justificativa da Despesa</p>
                          <p className="text-xs text-gray-500 italic leading-relaxed">{r.justificativa || 'Nenhuma justificativa informada.'}</p>
                        </div>
                      </div>

                      {/* Coluna 2: Valores e Datas */}
                      <div className="lg:w-64 bg-gray-50 p-4 rounded-2xl space-y-3 flex flex-col justify-center">
                        <div className="flex justify-between items-end border-b border-gray-200 pb-2">
                          <p className="text-[9px] font-black text-gray-400 uppercase">Valor</p>
                          <p className={`text-lg font-black ${r.tipo === 'RECURSO' ? 'text-indigo-700' : 'text-red-700'}`}>
                            {r.tipo === 'RECURSO' ? formatCurrency(r.valorRecebido) : formatCurrency(r.valorUtilizado)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase">Data</p>
                            <p className="text-[10px] font-mono font-bold text-gray-600">{(r.dataRecebimento || r.dataPagamento || r.dataSolicitacao || '-').split('-').reverse().join('/')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-black text-gray-400 uppercase">Status</p>
                            <p className="text-[10px] font-black text-indigo-600">{r.status || 'PENDENTE'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Coluna 3: Ações */}
                      <div className="lg:w-16 flex lg:flex-col justify-end lg:justify-center gap-2">
                        <button onClick={() => handleEdit(r)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => { if(window.confirm('Excluir este registro permanentemente?')) onDelete(r.id); }} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
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

        {records.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-bold uppercase tracking-widest italic">Nenhum registro financeiro localizado.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default AdminFinancialManager;
