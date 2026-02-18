
import React, { useMemo, useState } from 'react';
import type { FinancialRecord } from '../types';

interface FinanceDashboardProps {
  records: FinancialRecord[];
  onLogout: () => void;
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

type SubTab = 'recursos' | 'pagamentos' | 'saldos';

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ records, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('pagamentos');

  const totalsGlobal = useMemo(() => {
      return records.reduce((acc, curr) => ({
          utilizado: acc.utilizado + (curr.tipo === 'DESPESA' ? Number(curr.valorUtilizado) : 0),
          recurso: acc.recurso + (curr.tipo === 'RECURSO' ? (Number(curr.valorRecebido) || Number(curr.valorSolicitado)) : 0)
      }), { utilizado: 0, recurso: 0 });
  }, [records]);

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

      const totalRecursoPtres = naturezas.reduce((a, b) => a + b.recurso, 0);
      const totalGastoPtres = naturezas.reduce((a, b) => a + b.gasto, 0);

      return { 
          ptres: p, 
          naturezas, 
          totalRecurso: totalRecursoPtres, 
          totalGasto: totalGastoPtres, 
          totalSaldo: totalRecursoPtres - totalGastoPtres 
      };
    }).filter(t => t.totalRecurso > 0 || t.totalGasto > 0);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
        const matchesSearch = r.ptres.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.numeroProcesso || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.numeroEmpenho || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.modalidade || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        if (activeSubTab === 'recursos') return matchesSearch && r.tipo === 'RECURSO';
        if (activeSubTab === 'pagamentos') return matchesSearch && r.tipo === 'DESPESA';
        return matchesSearch;
    });
  }, [records, searchTerm, activeSubTab]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 font-sans">
      <header className="bg-white shadow-xl p-4 flex justify-between items-center border-b-4 border-indigo-700 sticky top-0 z-[100]">
        <div>
            <h1 className="text-xl md:text-2xl font-black text-indigo-900 uppercase tracking-tighter italic leading-none">Visão Financeira Institucional</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Monitoramento de Recursos e Despesas</p>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg transition-all active:scale-95">Sair</button>
      </header>

      <div className="bg-indigo-900 text-white py-3 px-4 shadow-inner">
        <div className="max-w-[1600px] mx-auto flex flex-wrap justify-center gap-2">
            <button 
                onClick={() => setActiveSubTab('recursos')}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'recursos' ? 'bg-white text-indigo-900 shadow-lg' : 'hover:bg-indigo-800 text-indigo-100'}`}
            >
                Recurso Disponível
            </button>
            <button 
                onClick={() => setActiveSubTab('pagamentos')}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'pagamentos' ? 'bg-white text-indigo-900 shadow-lg' : 'hover:bg-indigo-800 text-indigo-100'}`}
            >
                CONTROLE DE ADIANTAMENTOS
            </button>
            <button 
                onClick={() => setActiveSubTab('saldos')}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'saldos' ? 'bg-white text-indigo-900 shadow-lg' : 'hover:bg-indigo-800 text-indigo-100'}`}
            >
                Saldos PTRES / Natureza
            </button>
        </div>
      </div>

      <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-12 animate-fade-in">
        
        {activeSubTab !== 'saldos' && (
            <div className="flex justify-center">
                <div className="w-full max-w-2xl relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </span>
                    <input 
                        type="text" 
                        placeholder={`Filtrar ${activeSubTab === 'recursos' ? 'Recursos' : 'Adiantamentos'}...`}
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full border-none rounded-3xl px-14 py-4 outline-none ring-4 ring-indigo-50 font-bold bg-white transition-all text-sm shadow-xl focus:ring-indigo-100" 
                    />
                </div>
            </div>
        )}

        {activeSubTab === 'recursos' && (
            <div className="space-y-12 animate-fade-in-up">
                <div className="max-w-md mx-auto">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-indigo-600 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Recursos Recebidos (Total)</p>
                            <p className="text-3xl font-black text-indigo-700">{formatCurrency(totalsGlobal.recurso)}</p>
                        </div>
                        <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                </div>
                <MovementsGrid allRecords={records} filteredRecords={filteredRecords} viewMode="recursos" />
            </div>
        )}

        {activeSubTab === 'pagamentos' && (
            <div className="space-y-12 animate-fade-in-up">
                <div className="max-w-md mx-auto">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-red-500 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Gasto Total Realizado</p>
                            <p className="text-3xl font-black text-red-600">{formatCurrency(totalsGlobal.utilizado)}</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-2xl text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                    </div>
                </div>
                <MovementsGrid allRecords={records} filteredRecords={filteredRecords} viewMode="pagamentos" />
            </div>
        )}

        {activeSubTab === 'saldos' && (
            <div className="space-y-12 animate-fade-in-up">
                <div className="max-w-md mx-auto">
                    <div className={`bg-white p-8 rounded-3xl shadow-xl border-b-8 flex justify-between items-center ${totalsGlobal.recurso - totalsGlobal.utilizado >= 0 ? 'border-green-600' : 'border-red-900'}`}>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Saldo Geral da Unidade</p>
                            <p className={`text-4xl font-black ${totalsGlobal.recurso - totalsGlobal.utilizado >= 0 ? 'text-green-700' : 'text-red-900'}`}>{formatCurrency(totalsGlobal.recurso - totalsGlobal.utilizado)}</p>
                        </div>
                        <div className={`p-4 rounded-2xl ${totalsGlobal.recurso - totalsGlobal.utilizado >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-100 text-red-900'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {linkedBalances.map(group => (
                        <div key={group.ptres} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-t-8 border-indigo-900 flex flex-col h-full">
                            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter italic">PTRES {group.ptres}</h3>
                                        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight">
                                            {PTRES_DESCRIPTIONS[group.ptres] || 'Outros Recursos'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Saldos Vinculados por Natureza</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-gray-400 uppercase">Saldo Consolidado</p>
                                    <p className={`text-xl font-black ${group.totalSaldo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatCurrency(group.totalSaldo)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                                {group.naturezas.map(nat => (
                                    <div key={nat.codigo} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col justify-between group hover:shadow-lg ${nat.saldo >= 0 ? 'bg-gray-50 border-gray-100 hover:bg-white' : 'bg-red-50 border-red-100 hover:bg-red-100/50'}`}>
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${nat.codigo === '339030' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    Nat {nat.codigo}
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
                                                <span className="text-gray-500 font-medium">Recurso:</span>
                                                <span className="text-gray-800 font-bold">{formatCurrency(nat.recurso)}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-gray-500 font-medium">Gasto:</span>
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
            </div>
        )}

        {filteredRecords.length === 0 && activeSubTab !== 'saldos' && (
            <div className="text-center py-40 bg-white rounded-[3rem] shadow-xl border-4 border-dashed border-gray-100">
                <div className="flex flex-col items-center gap-6 opacity-40">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    <p className="text-xl font-black text-gray-400 uppercase tracking-[0.3em] italic">Nenhum registro localizado nesta categoria</p>
                </div>
            </div>
        )}
      </main>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

const MovementsGrid: React.FC<{ allRecords: FinancialRecord[], filteredRecords: FinancialRecord[], viewMode: 'recursos' | 'pagamentos' }> = ({ allRecords, filteredRecords, viewMode }) => {
    return (
        <div className="space-y-16">
            {PTRES_OPTIONS.map(ptres => {
                const groupDisplayRecords = filteredRecords.filter(r => r.ptres.trim() === ptres);
                if (groupDisplayRecords.length === 0) return null;

                return (
                    <div key={ptres} className="space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 gap-6">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-4">
                                    <h3 className="text-4xl font-black text-indigo-900 tracking-tighter italic">PTRES {ptres}</h3>
                                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                        {groupDisplayRecords.length} Registros no Filtro
                                    </span>
                                </div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-tighter mt-1 italic">
                                    {PTRES_DESCRIPTIONS[ptres] || 'Outros Recursos'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-12">
                            {NATUREZA_OPTIONS.map(natureza => {
                                const natRecords = groupDisplayRecords.filter(r => r.natureza === natureza);
                                if (natRecords.length === 0) return null;

                                // CÁLCULO DE VALORES POR NATUREZA DENTRO DO PTRES
                                const natTotals = allRecords.filter(r => r.ptres.trim() === ptres && r.natureza === natureza).reduce((acc, r) => {
                                    if (r.tipo === 'RECURSO') acc.recurso += (Number(r.valorRecebido) || 0);
                                    if (r.tipo === 'DESPESA') acc.gasto += (Number(r.valorUtilizado) || 0);
                                    return acc;
                                }, { recurso: 0, gasto: 0 });

                                return (
                                    <div key={natureza} className="space-y-6 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-200/50">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-dashed border-gray-300 pb-4 mx-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-full ${natureza === '339030' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'}`}></div>
                                                <h4 className="text-lg font-black text-gray-800 uppercase tracking-widest italic">
                                                    {natureza === '339030' ? 'Peças e Materiais (339030)' : 'Outros Serviços (339039)'}
                                                </h4>
                                            </div>

                                            {/* RESUMO POR NATUREZA (LADO DIREITO) */}
                                            <div className="flex flex-wrap items-center gap-6 bg-white/80 px-6 py-2 rounded-2xl shadow-sm border border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Entrada</span>
                                                    <span className="text-xs font-black text-indigo-700">{formatCurrency(natTotals.recurso)}</span>
                                                </div>
                                                <div className="flex flex-col border-x border-slate-100 px-4">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Saída</span>
                                                    <span className="text-xs font-black text-red-600">{formatCurrency(natTotals.gasto)}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Saldo</span>
                                                    <span className={`text-sm font-black ${natTotals.recurso - natTotals.gasto >= 0 ? 'text-green-700' : 'text-red-900'}`}>
                                                        {formatCurrency(natTotals.recurso - natTotals.gasto)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {natRecords.map((r, idx) => (
                                                <FinancialCard key={r.id || idx} record={r} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const FinancialCard: React.FC<{ record: FinancialRecord }> = ({ record: r }) => {
    const statusUpper = (r.status || '').toUpperCase();
    const isFinalizado = statusUpper === 'FINALIZADO';
    const isEmAndamentoEmpenhado = statusUpper === 'EM ANDAMENTO' && !!r.numeroEmpenho;

    return (
        <div className={`bg-white p-6 rounded-[2.5rem] shadow-lg border-l-[12px] flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1 ${isFinalizado ? 'border-green-500 ring-2 ring-green-100' : isEmAndamentoEmpenhado ? 'border-orange-500 ring-2 ring-orange-100' : (r.tipo === 'RECURSO' ? 'border-indigo-500' : 'border-red-500')}`}>
            <div className="space-y-4">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className={`text-[9px] w-fit font-black px-3 py-1 rounded-full uppercase border shadow-sm ${isFinalizado ? 'bg-green-600 text-white border-green-700' : isEmAndamentoEmpenhado ? 'bg-orange-600 text-white border-orange-700' : (r.tipo === 'RECURSO' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100')}`}>
                            {r.tipo}
                        </span>
                        <span className="text-[8px] text-gray-300 font-mono uppercase">ID: ...{r.id?.slice(-4) || 'NOID'}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${isFinalizado ? 'bg-green-50 text-green-700' : isEmAndamentoEmpenhado ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>
                        {(r.dataRecebimento || r.dataPagamento || r.dataSolicitacao || '-').split('-').reverse().join('/')}
                    </span>
                </div>

                <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Objeto / Serviço</p>
                    <p className={`text-sm font-black leading-tight uppercase line-clamp-2 ${isFinalizado ? 'text-green-900' : isEmAndamentoEmpenhado ? 'text-orange-900' : 'text-gray-800'}`} title={r.descricao}>{r.descricao || 'Sem descrição'}</p>
                </div>

                {/* BANNER DE DESTAQUE: FINALIZADO OU EM ANDAMENTO COM EMPENHO */}
                {isFinalizado && r.dataFinalizacaoProcesso && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl shadow-inner animate-fade-in">
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none mb-1">Status Final</p>
                        <p className="text-base font-black text-green-800 uppercase tracking-tighter italic">
                            ✅ Concluído em: {r.dataFinalizacaoProcesso.split('-').reverse().join('/')}
                        </p>
                    </div>
                )}

                {isEmAndamentoEmpenhado && r.numeroEmpenho && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl shadow-inner animate-fade-in">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">Recurso Reservado</p>
                        <p className="text-base font-black text-orange-800 uppercase tracking-tighter italic">
                            📑 Empenho Nº: {r.numeroEmpenho}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                    <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Natureza</p>
                        <p className={`text-[10px] font-bold ${isFinalizado ? 'text-green-600' : isEmAndamentoEmpenhado ? 'text-orange-600' : 'text-indigo-600'}`}>{r.natureza} ({r.natureza === '339030' ? 'Peças' : 'Serviços'})</p>
                    </div>
                    {r.tipo === 'DESPESA' && (
                        <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Modalidade</p>
                            <p className={`text-[10px] font-bold uppercase truncate ${isFinalizado ? 'text-green-600' : isEmAndamentoEmpenhado ? 'text-orange-600' : 'text-gray-600'}`}>{r.modalidade || '-'}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 flex justify-between items-end">
                <div>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Processo / Status</p>
                    <p className={`text-[10px] font-mono font-black leading-tight ${isFinalizado ? 'text-green-700' : isEmAndamentoEmpenhado ? 'text-orange-700' : 'text-gray-600'}`}>
                        {r.numeroProcesso || 'N/A'}
                        {(!isEmAndamentoEmpenhado && r.numeroEmpenho) ? ` | EMP: ${r.numeroEmpenho}` : ''}
                    </p>
                    {r.dataFinalizacaoProcesso && !isFinalizado && (
                        <p className="text-[8px] font-bold uppercase mt-1 text-indigo-500">Previsto p/: {r.dataFinalizacaoProcesso.split('-').reverse().join('/')}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Valor</p>
                    <p className={`text-xl font-black ${isFinalizado ? 'text-green-600' : isEmAndamentoEmpenhado ? 'text-orange-600' : (r.tipo === 'RECURSO' ? 'text-indigo-700' : 'text-red-700')}`}>
                        {r.tipo === 'RECURSO' ? `+ ${formatCurrency(r.valorRecebido)}` : `- ${formatCurrency(r.valorUtilizado)}`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FinanceDashboard;
