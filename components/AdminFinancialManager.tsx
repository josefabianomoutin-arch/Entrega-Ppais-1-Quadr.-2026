
import React, { useState, useMemo } from 'react';
import type { FinancialRecord } from '../types';

interface AdminFinancialManagerProps {
  records: FinancialRecord[];
  onSave: (record: Omit<FinancialRecord, 'id'> & { id?: string }) => Promise<{ success: boolean; message?: string }>;
  onDelete: (id: string) => Promise<void>;
}

const PTRES_OPTIONS = ['380302', '380303', '380304', '38038', '380328'] as const;
const NATUREZA_OPTIONS = ['33903', '339039'] as const;

const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const AdminFinancialManager: React.FC<AdminFinancialManagerProps> = ({ records, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Partial<FinancialRecord>>({
    ptres: '380302',
    natureza: '33903',
    dataSolicitacao: new Date().toISOString().split('T')[0],
    valorSolicitado: 0,
    valorRecebido: 0,
    valorUtilizado: 0,
    status: 'PENDENTE'
  });
  const [isSaving, setIsSaving] = useState(false);

  // Cálculos de Soma
  const totalsByPtres = useMemo(() => {
    return PTRES_OPTIONS.map(p => ({
      ptres: p,
      total: records.filter(r => r.ptres === p).reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0)
    }));
  }, [records]);

  const totalsByNatureza = useMemo(() => {
    return NATUREZA_OPTIONS.map(n => ({
      natureza: n,
      total: records.filter(r => r.natureza === n).reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0)
    }));
  }, [records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await onSave(formData as FinancialRecord);
    if (res.success) {
      setFormData({
        ptres: '380302',
        natureza: '33903',
        dataSolicitacao: new Date().toISOString().split('T')[0],
        valorSolicitado: 0,
        valorRecebido: 0,
        valorUtilizado: 0,
        status: 'PENDENTE'
      });
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
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Soma por PTRES (Valor Utilizado)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {totalsByPtres.map(t => (
                    <div key={t.ptres} className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
                        <p className="text-[10px] font-black text-indigo-400 mb-1">{t.ptres}</p>
                        <p className="text-sm font-black text-indigo-700">{formatCurrency(t.total)}</p>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-emerald-600">
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Soma por Natureza (Valor Utilizado)</h3>
            <div className="grid grid-cols-2 gap-3">
                {totalsByNatureza.map(t => (
                    <div key={t.natureza} className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                        <p className="text-[10px] font-black text-emerald-400 mb-1">{t.natureza}</p>
                        <p className="text-sm font-black text-emerald-700">{formatCurrency(t.total)}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Formulário de Cadastro */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-gray-50">
        <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase tracking-tighter italic">Lançar Novo Processo</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">PTRES</label>
            <select value={formData.ptres} onChange={e => setFormData({...formData, ptres: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
                {PTRES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Seleção</label>
            <input type="text" value={formData.selecao || ''} onChange={e => setFormData({...formData, selecao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Digite..." />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Natureza de Despesa</label>
            <select value={formData.natureza} onChange={e => setFormData({...formData, natureza: e.target.value as any})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
                {NATUREZA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Data Solicitação</label>
            <input type="date" value={formData.dataSolicitacao} onChange={e => setFormData({...formData, dataSolicitacao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Valor Solicitado (R$)</label>
            <input type="number" step="0.01" value={formData.valorSolicitado || ''} onChange={e => setFormData({...formData, valorSolicitado: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono" placeholder="0,00" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Data Recebimento</label>
            <input type="date" value={formData.dataRecebimento || ''} onChange={e => setFormData({...formData, dataRecebimento: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Valor Recebido (R$)</label>
            <input type="number" step="0.01" value={formData.valorRecebido || ''} onChange={e => setFormData({...formData, valorRecebido: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono" placeholder="0,00" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Valor Utilizado (R$)</label>
            <input type="number" step="0.01" value={formData.valorUtilizado || ''} onChange={e => setFormData({...formData, valorUtilizado: Number(e.target.value)})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-mono font-black text-emerald-600" placeholder="0,00" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Justificativa</label>
            <input type="text" value={formData.justificativa || ''} onChange={e => setFormData({...formData, justificativa: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Motivo..." />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">Descrição</label>
            <input type="text" value={formData.descricao || ''} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" placeholder="O que foi comprado/solicitado?" />
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
            <label className="text-[10px] font-black text-gray-400 uppercase">Data Pagamento</label>
            <input type="date" value={formData.dataPagamento || ''} onChange={e => setFormData({...formData, dataPagamento: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Status</label>
            <input type="text" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value.toUpperCase()})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold" placeholder="Ex: PAGO, ATRASADO..." />
          </div>
          <div className="md:col-span-3 lg:col-span-4 flex justify-end">
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-12 py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm">
                {isSaving ? 'Salvando...' : 'Registrar Solicitação'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Registros */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-6 border-b bg-gray-50">
            <h3 className="text-xl font-black text-gray-800 uppercase">Lista Geral de Solicitações</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-medium">
                <thead className="bg-gray-900 text-white uppercase tracking-wider">
                    <tr>
                        <th className="p-4 text-left">PTRES / SELEÇÃO</th>
                        <th className="p-4 text-left">NATUREZA</th>
                        <th className="p-4 text-left">DATAS (SOL./REC.)</th>
                        <th className="p-4 text-right">VALORES (SOL./REC./UTIL.)</th>
                        <th className="p-4 text-left">PROCESSO / DESCRIÇÃO</th>
                        <th className="p-4 text-center">STATUS</th>
                        <th className="p-4 text-center">AÇÕES</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {records.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                                <p className="font-black text-indigo-700">{r.ptres}</p>
                                <p className="text-gray-400 text-[9px] uppercase">{r.selecao || '-'}</p>
                            </td>
                            <td className="p-4 font-bold text-gray-700">{r.natureza}</td>
                            <td className="p-4 text-gray-500 font-mono">
                                <p>S: {r.dataSolicitacao?.split('-').reverse().join('/')}</p>
                                <p>R: {r.dataRecebimento?.split('-').reverse().join('/') || '-'}</p>
                            </td>
                            <td className="p-4 text-right font-mono">
                                <p className="text-gray-400">S: {formatCurrency(r.valorSolicitado)}</p>
                                <p className="text-gray-400">R: {formatCurrency(r.valorRecebido)}</p>
                                <p className="font-black text-emerald-600">U: {formatCurrency(r.valorUtilizado)}</p>
                            </td>
                            <td className="p-4">
                                <p className="font-black text-gray-800">{r.numeroProcesso || '-'}</p>
                                <p className="text-gray-400 text-[10px] italic line-clamp-1">{r.descricao}</p>
                            </td>
                            <td className="p-4 text-center">
                                <span className="bg-gray-100 px-2 py-1 rounded text-[9px] font-black uppercase border">{r.status}</span>
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => { if(window.confirm('Excluir este registro financeiro?')) onDelete(r.id); }} className="text-red-400 hover:text-red-600 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancialManager;
