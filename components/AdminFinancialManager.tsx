
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

  // Cálculos de Soma e Saldo (Abatimento automático baseado nos totais de entrada vs despesa)
  const totalsByPtres = useMemo(() => {
    return PTRES_OPTIONS.map(p => {
      const rec = records.filter(r => r.ptres === p && r.tipo === 'RECURSO').reduce((acc, curr) => acc + (Number(curr.valorRecebido) || 0), 0);
      const gast = records.filter(r => r.ptres === p && r.tipo === 'DESPESA').reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0);
      return { ptres: p, recurso: rec, gasto: gast, saldo: rec - gast };
    });
  }, [records]);

  const totalsByNatureza = useMemo(() => {
    return NATUREZA_OPTIONS.map(n => {
      const rec = records.filter(r => r.natureza === n && r.tipo === 'RECURSO').reduce((acc, curr) => acc + (Number(curr.valorRecebido) || 0), 0);
      const gast = records.filter(r => r.natureza === n && r.tipo === 'DESPESA').reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0);
      return { natureza: n, recurso: rec, gasto: gast, saldo: rec - gast };
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
    setIsSaving(true);
    
    // Limpeza de campos não pertinentes ao tipo antes de salvar para consistência do banco
    const recordToSave = { ...formData };
    if (formData.tipo === 'RECURSO') {
      delete recordToSave.valorUtilizado;
      delete recordToSave.localUtilizado;
      delete recordToSave.numeroProcesso;
      delete recordToSave.dataPagamento;
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
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Sumário Superior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-600">
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest flex justify-between items-center">
              <span>Abatimento por PTRES</span>
              <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[8px]">Entradas - Saídas</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {totalsByPtres.map(t => (
                    <div key={t.ptres} className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <p className="text-[10px] font-black text-indigo-400 mb-1">{t.ptres}</p>
                        <div className="flex justify-between items-end">
                          <p className="text-[10px] font-bold text-gray-400">Rec: {formatCurrency(t.recurso)}</p>
                          <p className={`text-xs font-black ${t.saldo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>Saldo: {formatCurrency(t.saldo)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-emerald-600">
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest flex justify-between items-center">
              <span>Abatimento por Natureza</span>
              <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[8px]">Entradas - Saídas</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {totalsByNatureza.map(t => (
                    <div key={t.natureza} className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-400 mb-1">{t.natureza}</p>
                        <div className="flex justify-between items-end">
                          <p className="text-[10px] font-bold text-gray-400">Rec: {formatCurrency(t.recurso)}</p>
                          <p className={`text-xs font-black ${t.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Saldo: {formatCurrency(t.saldo)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Formulário de Lançamento Dinâmico */}
      <div className={`bg-white p-8 rounded-3xl shadow-xl border-2 transition-all ${isEditing ? 'border-orange-400' : 'border-gray-50'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">
              {isEditing ? 'Editar Lançamento' : 'Lançamento Financeiro'}
            </h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {isEditing ? 'Atualize as informações do registro selecionado' : `Preencha os campos abaixo para registrar ${formData.tipo === 'RECURSO' ? 'uma Entrada' : 'uma Despesa'}`}
            </p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner w-full sm:w-auto">
             <button 
                type="button" 
                onClick={() => !isEditing && setFormData({...formData, tipo: 'RECURSO'})} 
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.tipo === 'RECURSO' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400'} ${isEditing ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`}
                disabled={isEditing}
             >
                Entrada de Recurso
             </button>
             <button 
                type="button" 
                onClick={() => !isEditing && setFormData({...formData, tipo: 'DESPESA'})} 
                className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.tipo === 'DESPESA' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'} ${isEditing ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`}
                disabled={isEditing}
             >
                Lançar Despesa
             </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">PTRES</label>
            <select value={formData.ptres} onChange={e => setFormData({...formData, ptres: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
                {PTRES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Natureza de Despesa</label>
            <select value={formData.natureza} onChange={e => setFormData({...formData, natureza: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
                {NATUREZA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Seleção (Digitável)</label>
            <input type="text" value={formData.selecao || ''} onChange={e => setFormData({...formData, selecao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold" placeholder="Identificador..." />
          </div>

          {/* CAMPOS EXCLUSIVOS DA ENTRADA DE RECURSO */}
          {formData.tipo === 'RECURSO' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Data da Solicitação</label>
                <input type="date" value={formData.dataSolicitacao} onChange={e => setFormData({...formData, dataSolicitacao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Valor Solicitado (R$)</label>
                <input type="number" step="0.01" value={formData.valorSolicitado || ''} onChange={e => setFormData({...formData, valorSolicitado: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Data do Recebimento</label>
                <input type="date" value={formData.dataRecebimento || ''} onChange={e => setFormData({...formData, dataRecebimento: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase text-indigo-600">Valor Recebido (R$)</label>
                <input type="number" step="0.01" value={formData.valorRecebido || ''} onChange={e => setFormData({...formData, valorRecebido: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-white border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-400 font-mono font-black text-indigo-700 shadow-sm" placeholder="0,00" />
              </div>
            </>
          )}

          {/* CAMPOS EXCLUSIVOS DA DESPESA */}
          {formData.tipo === 'DESPESA' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase text-red-600">Valor Utilizado (R$)</label>
                <input type="number" step="0.01" value={formData.valorUtilizado || ''} onChange={e => setFormData({...formData, valorUtilizado: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-white border-red-200 outline-none focus:ring-2 focus:ring-red-400 font-mono font-black text-red-700 shadow-sm" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Local Utilizado</label>
                <input type="text" value={formData.localUtilizado || ''} onChange={e => setFormData({...formData, localUtilizado: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Setor..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Número Processo</label>
                <input type="text" value={formData.numeroProcesso || ''} onChange={e => setFormData({...formData, numeroProcesso: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono" placeholder="Ex: 2026/001" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Data do Pagamento</label>
                <input type="date" value={formData.dataPagamento || ''} onChange={e => setFormData({...formData, dataPagamento: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </>
          )}
          
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Justificativa</label>
            <input type="text" value={formData.justificativa || ''} onChange={e => setFormData({...formData, justificativa: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Motivo..." />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Descrição</label>
            <input type="text" value={formData.descricao || ''} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="O que foi comprado/recebido?" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Status</label>
            <input type="text" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value.toUpperCase()})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold" placeholder="Ex: PAGO, PENDENTE..." />
          </div>

          <div className="md:col-span-3 lg:col-span-4 flex justify-end pt-4 gap-3">
            {isEditing && (
              <button 
                type="button" 
                onClick={handleCancelEdit} 
                className="font-black px-10 py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm text-gray-600 bg-gray-200 hover:bg-gray-300"
              >
                Cancelar Edição
              </button>
            )}
            <button 
                type="submit" 
                disabled={isSaving} 
                className={`font-black px-16 py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm text-white ${isEditing ? 'bg-orange-500 hover:bg-orange-600' : (formData.tipo === 'RECURSO' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700')}`}
            >
                {isSaving ? 'Gravando...' : (isEditing ? 'Salvar Alterações' : `Registrar ${formData.tipo}`)}
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Movimentações */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800 uppercase italic">Histórico de Movimentações</h3>
            <span className="text-[10px] font-black bg-gray-200 text-gray-600 px-3 py-1 rounded-full uppercase">{records.length} registros</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-medium">
                <thead className="bg-gray-900 text-white uppercase tracking-wider">
                    <tr>
                        <th className="p-4 text-left">TIPO / PTRES</th>
                        <th className="p-4 text-left">NAT. / SELEÇÃO</th>
                        <th className="p-4 text-left">DATAS</th>
                        <th className="p-4 text-right">VALORES</th>
                        <th className="p-4 text-left">DETALHES / PROCESSO</th>
                        <th className="p-4 text-center">STATUS</th>
                        <th className="p-4 text-center">AÇÕES</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {records.map(r => (
                        <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${r.tipo === 'RECURSO' ? 'bg-indigo-50/20' : 'bg-red-50/10'}`}>
                            <td className="p-4">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-1 inline-block ${r.tipo === 'RECURSO' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>{r.tipo}</span>
                                <p className="font-black text-gray-800 text-xs">{r.ptres}</p>
                            </td>
                            <td className="p-4">
                                <p className="font-bold text-gray-600">{r.natureza}</p>
                                <p className="text-[9px] text-gray-400 font-mono uppercase">{r.selecao || '-'}</p>
                            </td>
                            <td className="p-4 text-gray-500 font-mono leading-tight">
                                {r.tipo === 'RECURSO' ? (
                                  <>
                                    <p><span className="text-[8px] uppercase">Sol:</span> {r.dataSolicitacao?.split('-').reverse().join('/')}</p>
                                    <p><span className="text-[8px] uppercase font-bold text-indigo-600">Rec:</span> {r.dataRecebimento?.split('-').reverse().join('/') || '-'}</p>
                                  </>
                                ) : (
                                  <>
                                    <p><span className="text-[8px] uppercase font-bold text-red-600">Pag:</span> {r.dataPagamento?.split('-').reverse().join('/') || 'Pendente'}</p>
                                  </>
                                )}
                            </td>
                            <td className="p-4 text-right font-mono">
                                {r.tipo === 'RECURSO' ? (
                                  <>
                                    <p className="text-gray-400 text-[9px]">S: {formatCurrency(r.valorSolicitado)}</p>
                                    <p className="font-black text-indigo-700">{formatCurrency(r.valorRecebido)}</p>
                                  </>
                                ) : (
                                  <p className="font-black text-red-600">{formatCurrency(r.valorUtilizado)}</p>
                                )}
                            </td>
                            <td className="p-4">
                                <p className="font-black text-gray-700 truncate max-w-[150px]">{r.descricao || '-'}</p>
                                <p className="text-gray-400 text-[9px] uppercase">{r.tipo === 'DESPESA' ? `Proc: ${r.numeroProcesso || '-'}` : `Just: ${r.justificativa || '-'}`}</p>
                            </td>
                            <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${r.status === 'PAGO' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{r.status}</span>
                            </td>
                            <td className="p-4 text-center">
                                <div className="flex gap-2 justify-center">
                                    <button 
                                      onClick={() => handleEdit(r)} 
                                      className="text-indigo-400 hover:text-indigo-600 transition-colors"
                                      title="Editar registro"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button 
                                      onClick={() => { if(window.confirm('Excluir este registro financeiro?')) onDelete(r.id); }} 
                                      className="text-red-300 hover:text-red-600 transition-colors"
                                      title="Excluir registro"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {records.length === 0 && (
                        <tr><td colSpan={7} className="p-20 text-center text-gray-400 italic">Nenhum lançamento financeiro registrado.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancialManager;
