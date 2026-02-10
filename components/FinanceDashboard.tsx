
import React, { useMemo, useState } from 'react';
import type { FinancialRecord } from '../types';

interface FinanceDashboardProps {
  records: FinancialRecord[];
  onLogout: () => void;
}

const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ records, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
        r.ptres.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.numeroProcesso.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime());
  }, [records, searchTerm]);

  const totals = useMemo(() => {
      return records.reduce((acc, curr) => ({
          utilizado: acc.utilizado + Number(curr.valorUtilizado),
          solicitado: acc.solicitado + Number(curr.valorSolicitado)
      }), { utilizado: 0, solicitado: 0 });
  }, [records]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
      <header className="bg-white shadow-xl p-4 flex justify-between items-center border-b-4 border-indigo-700 sticky top-0 z-[100]">
        <div>
            <h1 className="text-xl md:text-2xl font-black text-indigo-900 uppercase tracking-tighter italic leading-none">Visão Financeira Institucional</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Acompanhamento de Processos e Saldos PTRES</p>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg transition-all">Sair</button>
      </header>

      <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-indigo-500 flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Solicitado Geral</p>
                    <p className="text-3xl font-black text-indigo-700">{formatCurrency(totals.solicitado)}</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-emerald-600 flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Utilizado Geral</p>
                    <p className="text-3xl font-black text-emerald-700">{formatCurrency(totals.utilizado)}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-2xl">
            <div className="mb-8">
                <input type="text" placeholder="Filtrar por PTRES, Descrição ou Nº Processo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border-2 border-gray-50 rounded-2xl px-6 py-4 outline-none focus:border-indigo-400 font-bold bg-gray-50 transition-all text-sm" />
            </div>

            <div className="overflow-x-auto rounded-3xl border-2 border-gray-50">
                <table className="w-full text-sm">
                    <thead className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th className="p-5 text-left">PTRES / NATUREZA</th>
                            <th className="p-5 text-left">DATA SOL.</th>
                            <th className="p-5 text-right">VALORES (SOL/UTIL)</th>
                            <th className="p-5 text-left">DESCRIÇÃO / JUSTIFICATIVA</th>
                            <th className="p-5 text-left">PROCESSO / PAGAMENTO</th>
                            <th className="p-5 text-center">STATUS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredRecords.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-5">
                                    <p className="font-black text-indigo-700">{r.ptres}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{r.natureza}</p>
                                </td>
                                <td className="p-5 font-mono text-xs text-gray-500">
                                    {r.dataSolicitacao?.split('-').reverse().join('/')}
                                </td>
                                <td className="p-5 text-right font-mono">
                                    <p className="text-gray-400 text-[10px]">S: {formatCurrency(r.valorSolicitado)}</p>
                                    <p className="font-black text-emerald-700">U: {formatCurrency(r.valorUtilizado)}</p>
                                </td>
                                <td className="p-5">
                                    <p className="font-bold text-gray-800 uppercase text-xs">{r.descricao}</p>
                                    <p className="text-[10px] text-gray-400 italic line-clamp-1">{r.justificativa}</p>
                                </td>
                                <td className="p-5">
                                    <p className="font-black text-gray-600">{r.numeroProcesso || '-'}</p>
                                    <p className="text-[10px] text-indigo-400 font-bold uppercase">Pag: {r.dataPagamento?.split('-').reverse().join('/') || 'PENDENTE'}</p>
                                </td>
                                <td className="p-5 text-center">
                                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-indigo-100">{r.status}</span>
                                </td>
                            </tr>
                        ))}
                        {filteredRecords.length === 0 && (
                            <tr><td colSpan={6} className="p-20 text-center text-gray-400 italic font-black uppercase tracking-widest">Nenhum registro encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </main>
    </div>
  );
};

export default FinanceDashboard;
