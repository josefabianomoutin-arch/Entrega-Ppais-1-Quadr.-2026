
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

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ records, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const totalGastoGlobal = useMemo(() => {
      return records.reduce((acc, curr) => acc + (curr.tipo === 'DESPESA' ? Number(curr.valorUtilizado) : 0), 0);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
        const matchesSearch = r.ptres.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.numeroProcesso || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.numeroEmpenho || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.modalidade || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        // Exibe apenas DESPESAS (Pagamentos)
        return matchesSearch && r.tipo === 'DESPESA';
    });
  }, [records, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 font-sans">
      <header className="bg-white shadow-xl p-4 flex justify-between items-center border-b-4 border-indigo-700 sticky top-0 z-[100]">
        <div>
            <h1 className="text-xl md:text-2xl font-black text-indigo-900 uppercase tracking-tighter italic leading-none">Visão Financeira Institucional</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Controle de Adiantamentos e Pagamentos</p>
        </div>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-black py-2 px-6 rounded-xl text-xs uppercase shadow-lg transition-all active:scale-95">Sair</button>
      </header>

      <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-12 animate-fade-in">
        
        {/* BUSCA */}
        <div className="flex justify-center">
            <div className="w-full max-w-2xl relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
                <input 
                    type="text" 
                    placeholder="Pesquisar por Processo, Empenho ou Descrição..."
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full border-none rounded-3xl px-14 py-4 outline-none ring-4 ring-indigo-50 font-bold bg-white transition-all text-sm shadow-xl focus:ring-indigo-100" 
                />
            </div>
        </div>

        {/* RESUMO DE GASTOS */}
        <div className="space-y-12 animate-fade-in-up">
            <div className="max-w-md mx-auto">
                <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-red-500 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Gasto Total Realizado (Geral)</p>
                        <p className="text-3xl font-black text-red-600">{formatCurrency(totalGastoGlobal)}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-2xl text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                </div>
            </div>
            
            <MovementsGrid filteredRecords={filteredRecords} viewMode="pagamentos" />
        </div>

        {filteredRecords.length === 0 && (
            <div className="text-center py-40 bg-white rounded-[3rem] shadow-xl border-4 border-dashed border-gray-100">
                <div className="flex flex-col items-center gap-6 opacity-40">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    <p className="text-xl font-black text-gray-400 uppercase tracking-[0.3em] italic">Nenhum pagamento localizado no filtro</p>
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

const MovementsGrid: React.FC<{ filteredRecords: FinancialRecord[], viewMode: 'recursos' | 'pagamentos' }> = ({ filteredRecords, viewMode }) => {
    return (
        <div className="space-y-16">
            {PTRES_OPTIONS.map(ptres => {
                const groupDisplayRecords = filteredRecords.filter(r => r.ptres.trim() === ptres);
                if (groupDisplayRecords.length === 0) return null;

                return (
                    <div key={ptres} className="space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 gap-4">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-4">
                                    <h3 className="text-4xl font-black text-indigo-900 tracking-tighter italic">PTRES {ptres}</h3>
                                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                                        {groupDisplayRecords.length} Registros
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

                                return (
                                    <div key={natureza} className="space-y-6 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-200/50">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-dashed border-gray-300 pb-4 mx-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-full ${natureza === '339030' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'}`}></div>
                                                <h4 className="text-lg font-black text-gray-800 uppercase tracking-widest italic">
                                                    {natureza === '339030' ? 'Peças e Materiais (339030)' : 'Outros Serviços (339039)'}
                                                </h4>
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
    return (
        <div className={`bg-white p-6 rounded-[2.5rem] shadow-lg border-l-[12px] flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1 ${r.tipo === 'RECURSO' ? 'border-indigo-500' : 'border-red-500'}`}>
            <div className="space-y-4">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className={`text-[9px] w-fit font-black px-3 py-1 rounded-full uppercase border shadow-sm ${r.tipo === 'RECURSO' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {r.tipo}
                        </span>
                        <span className="text-[8px] text-gray-300 font-mono uppercase">ID: ...{r.id?.slice(-4) || 'NOID'}</span>
                    </div>
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
                        <p className="text-[10px] font-bold text-indigo-600">{r.natureza} ({r.natureza === '339030' ? 'Peças' : 'Serviços'})</p>
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Modalidade</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase truncate">{r.modalidade || '-'}</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-between items-end">
                <div>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Processo / Empenho</p>
                    <p className="text-[10px] font-mono font-black text-gray-600 leading-tight">
                        {r.numeroProcesso || 'N/A'}
                        {r.numeroEmpenho ? ` | EMP: ${r.numeroEmpenho}` : ''}
                    </p>
                    {r.dataFinalizacaoProcesso && (
                        <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1">Concluído em: {r.dataFinalizacaoProcesso.split('-').reverse().join('/')}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Valor</p>
                    <p className={`text-xl font-black ${r.tipo === 'RECURSO' ? 'text-indigo-700' : 'text-red-700'}`}>
                        {r.tipo === 'RECURSO' ? `+ ${formatCurrency(r.valorRecebido)}` : `- ${formatCurrency(r.valorUtilizado)}`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FinanceDashboard;
