
import React, { useMemo, useState } from 'react';
import type { FinancialRecord } from '../types';

interface FinanceDashboardProps {
  records: FinancialRecord[];
  onLogout: () => void;
}

const PTRES_OPTIONS = ['380302', '380303', '380304', '380308', '380328'] as const;
const NATUREZA_OPTIONS = ['339030', '339039'] as const;

const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ records, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const totalsGlobal = useMemo(() => {
      return records.reduce((acc, curr) => ({
          utilizado: acc.utilizado + (curr.tipo === 'DESPESA' ? Number(curr.valorUtilizado) : 0),
          recurso: acc.recurso + (curr.tipo === 'RECURSO' ? (Number(curr.valorRecebido) || Number(curr.valorSolicitado)) : 0)
      }), { utilizado: 0, recurso: 0 });
  }, [records]);

  const totalsByPtres = useMemo(() => {
    return PTRES_OPTIONS.map(p => {
      const rec = records.filter(r => r.ptres === p && r.tipo === 'RECURSO').reduce((acc, curr) => acc + (Number(curr.valorRecebido) || 0), 0);
      const gast = records.filter(r => r.ptres === p && r.tipo === 'DESPESA').reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0);
      return { ptres: p, recurso: rec, gasto: gast, saldo: rec - gast };
    }).filter(t => t.recurso > 0 || t.gasto > 0);
  }, [records]);

  const totalsByNatureza = useMemo(() => {
    return NATUREZA_OPTIONS.map(n => {
      const rec = records.filter(r => r.natureza === n && r.tipo === 'RECURSO').reduce((acc, curr) => acc + (Number(curr.valorRecebido) || 0), 0);
      const gast = records.filter(r => r.natureza === n && r.tipo === 'DESPESA').reduce((acc, curr) => acc + Number(curr.valorUtilizado), 0);
      return { natureza: n, recurso: rec, gasto: gast, saldo: rec - gast };
    }).filter(t => t.recurso > 0 || t.gasto > 0);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
        r.ptres.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.numeroProcesso || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.modalidade || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.dataRecebimento || b.dataPagamento || '').getTime() - new Date(a.dataRecebimento || a.dataPagamento || '').getTime());
  }, [records, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 font-sans">
      <header className="bg-white shadow-xl p-4 flex justify-between items-center border-b-4 border-indigo-700 sticky top-0 z-[100]">
        <div>
            <h1 className="text-xl md:text-2xl font-black text-indigo-900 uppercase tracking-tighter italic leading-none">Visão Financeira Institucional</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Monitoramento de Recursos e Despesas</p>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg transition-all active:scale-95">Sair</button>
      </header>

      <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-12 animate-fade-in">
        
        {/* 1. CARDS GLOBAIS COM ESTILO PREMIUM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-indigo-600 flex justify-between items-center transition-transform hover:scale-[1.02]">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Recursos Recebidos (Total)</p>
                    <p className="text-3xl font-black text-indigo-700">{formatCurrency(totalsGlobal.recurso)}</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-red-500 flex justify-between items-center transition-transform hover:scale-[1.02]">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Gasto Total Realizado</p>
                    <p className="text-3xl font-black text-red-600">{formatCurrency(totalsGlobal.utilizado)}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
            </div>
            <div className={`bg-white p-8 rounded-3xl shadow-xl border-b-8 flex justify-between items-center transition-transform hover:scale-[1.02] ${totalsGlobal.recurso - totalsGlobal.utilizado >= 0 ? 'border-green-600' : 'border-red-900'}`}>
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Saldo Geral Disponível</p>
                    <p className={`text-4xl font-black ${totalsGlobal.recurso - totalsGlobal.utilizado >= 0 ? 'text-green-700' : 'text-red-900'}`}>{formatCurrency(totalsGlobal.recurso - totalsGlobal.utilizado)}</p>
                </div>
                <div className={`p-4 rounded-2xl ${totalsGlobal.recurso - totalsGlobal.utilizado >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-100 text-red-900'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                </div>
            </div>
        </div>

        {/* 2. BREAKDOWNS ESPECÍFICOS (PTRES E NATUREZA) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border-t-4 border-indigo-900">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                    Saldos por PTRES
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {totalsByPtres.map(t => (
                        <div key={t.ptres} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-between group hover:bg-white hover:shadow-md transition-all">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">PTRES {t.ptres}</p>
                            <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-bold text-gray-500">Rec: {formatCurrency(t.recurso)}</span>
                                <span className={`text-sm font-black ${t.saldo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatCurrency(t.saldo)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-2xl border-t-4 border-emerald-800">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                    Saldos por Natureza de Despesa
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {totalsByNatureza.map(t => (
                        <div key={t.natureza} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-between group hover:bg-white hover:shadow-md transition-all">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Natureza {t.natureza}</p>
                            <div className="flex justify-between items-baseline">
                                <span className="text-[9px] font-bold text-gray-500">Rec: {formatCurrency(t.recurso)}</span>
                                <span className={`text-sm font-black ${t.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(t.saldo)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 3. VISUALIZAÇÃO DEDICADA POR PTRES */}
        <div className="space-y-16">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b-2 border-gray-200 pb-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter italic">Movimentações Detalhadas</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Histórico completo agrupado por PTRES</p>
                </div>
                <div className="w-full md:w-96">
                    <input 
                        type="text" 
                        placeholder="Filtrar descrição, modalidade ou processo..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full border-2 border-gray-100 rounded-2xl px-6 py-3 outline-none focus:border-indigo-400 font-bold bg-white transition-all text-sm shadow-sm" 
                    />
                </div>
            </div>

            {PTRES_OPTIONS.map(ptres => {
                const ptresRecords = filteredRecords.filter(r => r.ptres === ptres);
                if (ptresRecords.length === 0 && searchTerm === '') return null;
                if (ptresRecords.length === 0) return null;

                const ptresBal = totalsByPtres.find(t => t.ptres === ptres);

                return (
                    <div key={ptres} className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <div className="flex items-baseline gap-4">
                                <h3 className="text-4xl font-black text-indigo-900 tracking-tighter italic">PTRES {ptres}</h3>
                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                    {ptresRecords.length} Movimentações
                                </span>
                            </div>
                            <div className="text-right bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Saldo Deste PTRES</p>
                                <p className={`text-xl font-black ${ptresBal?.saldo && ptresBal.saldo >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                    {formatCurrency(ptresBal?.saldo || 0)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {ptresRecords.map(r => (
                                <div key={r.id} className={`bg-white p-6 rounded-[2.5rem] shadow-lg border-l-[12px] flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1 ${r.tipo === 'RECURSO' ? 'border-indigo-500' : 'border-red-500'}`}>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border shadow-sm ${r.tipo === 'RECURSO' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                {r.tipo}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                                {(r.dataRecebimento || r.dataPagamento || r.dataSolicitacao || '-').split('-').reverse().join('/')}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Objeto / Serviço</p>
                                            <p className="text-sm font-black text-gray-800 leading-tight uppercase line-clamp-2" title={r.descricao}>{r.descricao || 'Sem descrição'}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                                            <div>
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Natureza</p>
                                                <p className="text-[10px] font-bold text-indigo-600">{r.natureza}</p>
                                            </div>
                                            {r.tipo === 'DESPESA' && (
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Modalidade</p>
                                                    <p className="text-[10px] font-bold text-gray-600 uppercase truncate">{r.modalidade || '-'}</p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {r.justificativa && (
                                            <div className="bg-gray-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Justificativa</p>
                                                <p className="text-[10px] text-gray-500 italic leading-relaxed line-clamp-2">{r.justificativa}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 flex justify-between items-end">
                                        <div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Processo</p>
                                            <p className="text-[10px] font-mono font-black text-gray-600">{r.numeroProcesso || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Valor</p>
                                            <p className={`text-xl font-black ${r.tipo === 'RECURSO' ? 'text-indigo-700' : 'text-red-700'}`}>
                                                {r.tipo === 'RECURSO' ? `+ ${formatCurrency(r.valorRecebido)}` : `- ${formatCurrency(r.valorUtilizado)}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>

        {filteredRecords.length === 0 && (
            <div className="text-center py-40 bg-white rounded-[3rem] shadow-xl border-4 border-dashed border-gray-100">
                <div className="flex flex-col items-center gap-6 opacity-40">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    <p className="text-xl font-black text-gray-400 uppercase tracking-[0.3em] italic">Nenhum registro financeiro localizado</p>
                </div>
            </div>
        )}
      </main>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
      `}</style>
    </div>
  );
};

export default FinanceDashboard;
