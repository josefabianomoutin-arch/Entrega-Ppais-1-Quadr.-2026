import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import type { Supplier, WarehouseMovement, CleaningLog, FinancialRecord, VehicleExitOrder, ThirdPartyEntryLog, DirectorPerCapitaLog, PerCapitaConfig, AcquisitionItem, Delivery } from '../types';

interface AdminGraphsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  cleaningLogs: CleaningLog[];
  financialRecords: FinancialRecord[];
  vehicleExitOrders: VehicleExitOrder[];
  thirdPartyEntries: ThirdPartyEntryLog[];
  directorWithdrawals: DirectorPerCapitaLog[];
  perCapitaConfig: PerCapitaConfig;
  acquisitionItems: AcquisitionItem[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const AdminGraphs: React.FC<AdminGraphsProps> = ({ 
  suppliers = [], 
  warehouseLog = [], 
  cleaningLogs = [], 
  financialRecords = [], 
  vehicleExitOrders = [],
  thirdPartyEntries = [],
  directorWithdrawals = [],
  perCapitaConfig,
  acquisitionItems = []
}) => {

  const perCapitaDenominator = (perCapitaConfig?.inmateCount || 0) + (perCapitaConfig?.staffCount || 0) || 1;

  // 1. Resumo Financeiro
  const financialSummary = useMemo(() => {
    const resources = financialRecords
      .filter(r => r.tipo === 'RECURSO')
      .reduce((acc, r) => acc + (Number(r.valorRecebido) || 0), 0);
    const expenses = financialRecords
      .filter(r => r.tipo === 'DESPESA')
      .reduce((acc, r) => acc + (Number(r.valorUtilizado) || 0), 0);
    
    return [
      { name: 'Recursos', value: resources, color: '#10b981' },
      { name: 'Despesas', value: expenses, color: '#ef4444' }
    ];
  }, [financialRecords]);

  // 2. Performance de Entrega
  const deliveryPerformance = useMemo(() => {
    let deliveredCount = 0;
    let notDeliveredCount = 0;

    suppliers.forEach(s => {
      const totalDelivered = (Object.values(s.deliveries || {}) as Delivery[]).reduce((acc, d) => acc + (Number(d.kg) || 0), 0);
      if (totalDelivered > 0) deliveredCount++;
      else notDeliveredCount++;
    });

    return [
      { name: 'Com Entregas', value: deliveredCount, color: '#10b981' },
      { name: 'Sem Entregas', value: notDeliveredCount, color: '#f43f5e' }
    ];
  }, [suppliers]);

  // 2.1 Fornecedores Sem Entregas (Lista)
  const suppliersWithoutDeliveries = useMemo(() => {
    return suppliers
      .filter(s => Object.values(s.deliveries || {}).length === 0)
      .map(s => ({
        name: s.name,
        value: (s.contractItems || []).reduce((acc, item) => acc + ((item.totalKg || 0) * (item.valuePerKg || 0)), 0)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [suppliers]);

  // 3. Materiais em Falta (Itens com 0% de entrega)
  const missingMaterials = useMemo(() => {
    const itemsMap = new Map<string, { contracted: number; delivered: number }>();
    
    suppliers.forEach(s => {
      (s.contractItems || []).forEach(ci => {
        const current = itemsMap.get(ci.name) || { contracted: 0, delivered: 0 };
        current.contracted += ci.totalKg || 0;
        itemsMap.set(ci.name, current);
      });
      (Object.values(s.deliveries || {}) as Delivery[]).forEach(d => {
        const current = itemsMap.get(d.item) || { contracted: 0, delivered: 0 };
        const deliveredKg = Number(d.kg) || 0;
        current.delivered += deliveredKg;
        itemsMap.set(d.item || 'Item Indefinido', current);
      });
    });

    return Array.from(itemsMap.entries())
      .map(([name, vals]) => ({
        name,
        ...vals,
        percentage: vals.contracted > 0 ? (vals.delivered / vals.contracted) * 100 : 0
      }))
      .filter(i => i.percentage === 0 && i.contracted > 0)
      .sort((a, b) => b.contracted - a.contracted)
      .slice(0, 5);
  }, [suppliers]);

  // 4. Per Capita - Custo por Pessoa
  const perCapitaStats = useMemo(() => {
    const totalContractValue = suppliers.reduce((acc, s) => {
      return acc + (s.contractItems || []).reduce((sum, item) => sum + ((item.totalKg || 0) * (item.valuePerKg || 0)), 0);
    }, 0);

    const dailyCost = totalContractValue / 365; 
    const perPersonDaily = dailyCost / perCapitaDenominator;

    return {
      totalMonthly: totalContractValue / 8,
      dailyTotal: dailyCost,
      perPersonDaily: perPersonDaily
    };
  }, [suppliers, perCapitaDenominator]);

  // 5. Movimentação de Almoxarifado
  const warehouseData = useMemo(() => {
    const last30Days = new Map<string, { entries: number; withdrawals: number }>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      last30Days.set(dateStr, { entries: 0, withdrawals: 0 });
    }

    warehouseLog.forEach(log => {
      if (!log.date) return;
      const dateStr = log.date.split('T')[0];
      if (last30Days.has(dateStr)) {
        const current = last30Days.get(dateStr)!;
        if (log.type === 'entrada') current.entries += Number(log.quantity) || 0;
        else current.withdrawals += Number(log.quantity) || 0;
      }
    });

    return Array.from(last30Days.entries()).map(([date, values]) => ({
      date: date ? date.split('-').reverse().slice(0, 2).join('/') : '',
      ...values
    }));
  }, [warehouseLog]);

  // 6. Logs de Limpeza por Categoria
  const cleaningData = useMemo(() => {
    const counts: Record<string, number> = {};
    cleaningLogs.forEach(log => {
      counts[log.type] = (counts[log.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [cleaningLogs]);

  // 7. Top 5 Veículos por Saídas
  const vehicleData = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicleExitOrders.forEach(order => {
      const v = `${order.vehicle} (${order.plate})`;
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [vehicleExitOrders]);

  // 8. Progresso de Fornecedores (Top 5 por Kg entregue)
  const supplierProgress = useMemo(() => {
    return suppliers
      .map(s => ({
        name: s.name,
        delivered: (Object.values(s.deliveries || {}) as Delivery[]).reduce((acc, d) => acc + (Number(d.kg) || 0), 0),
        contracted: (s.contractItems || []).reduce((acc, ci) => acc + (Number(ci.totalKg) || 0), 0)
      }))
      .filter(s => s.contracted > 0)
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 5);
  }, [suppliers]);

  // 9. Entradas de Terceiros por Local
  const thirdPartyData = useMemo(() => {
    const counts: Record<string, number> = {};
    thirdPartyEntries.forEach(entry => {
      const loc = entry.locations || 'Outros';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [thirdPartyEntries]);

  // 10. Retiradas do Diretor (Top 5 Itens)
  const directorData = useMemo(() => {
    const counts: Record<string, number> = {};
    directorWithdrawals.forEach(log => {
      (log.items || []).forEach(item => {
        counts[item.name] = (counts[item.name] || 0) + (Number(item.quantity) || 0);
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [directorWithdrawals]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* Header Section - Global Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 uppercase tracking-tighter italic">Painel de Controle</h2>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Monitoramento em Tempo Real • Gestão 2026</p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-zinc-900 text-white rounded-xl flex flex-col items-end">
            <span className="text-[8px] font-black uppercase opacity-50">Status do Sistema</span>
            <span className="text-xs font-bold flex items-center gap-2">
              <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
              OPERACIONAL
            </span>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Per Capita Card - The Hero */}
        <div className="md:col-span-2 bg-indigo-600 p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
             <svg className="h-32 w-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2">Custo Diário / Pessoa</p>
            <h4 className="text-6xl font-black italic tracking-tighter mb-4">{formatCurrency(perCapitaStats.perPersonDaily)}</h4>
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase">População: {perCapitaDenominator}</div>
              <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase">Meta: R$ 12,00</div>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-zinc-100 flex flex-col justify-between group hover:border-indigo-200 transition-colors">
          <div>
            <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Saldo Projetado</p>
            <h4 className="text-2xl font-black text-zinc-900 font-mono">{formatCurrency(perCapitaStats.totalMonthly)}</h4>
          </div>
          <p className="text-[9px] text-emerald-600 font-black uppercase bg-emerald-50 px-2 py-1 rounded-lg self-start mt-4">Dentro da Cota</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-zinc-100 flex flex-col justify-between group hover:border-rose-200 transition-colors">
          <div>
            <div className="h-10 w-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Alertas Críticos</p>
            <h4 className="text-2xl font-black text-rose-600 font-mono">{missingMaterials.length + (deliveryPerformance.find(d => d.name === 'Sem Entregas')?.value || 0)}</h4>
          </div>
          <p className="text-[9px] text-rose-600 font-black uppercase bg-rose-50 px-2 py-1 rounded-lg self-start mt-4">Ação Necessária</p>
        </div>
      </div>

      {/* Grid Layout for Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Operational Lists */}
        <div className="lg:col-span-1 space-y-6">
          {/* Missing Materials List */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-zinc-800 uppercase tracking-tighter">Materiais em Falta</h3>
              <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-1 rounded-lg">CRÍTICO</span>
            </div>
            <div className="space-y-3">
              {missingMaterials.length > 0 ? missingMaterials.map(item => (
                <div key={item.name} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-zinc-100 transition-colors">
                  <p className="font-black text-zinc-800 uppercase text-[10px] mb-1">{item.name}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Contratado: {item.contracted.toLocaleString()} kg</span>
                    <span className="text-[9px] font-black text-rose-500">0% ENTREGUE</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-zinc-300 text-[10px] font-black uppercase">Tudo em conformidade</p>
                </div>
              )}
            </div>
          </div>

          {/* Suppliers Without Deliveries */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
            <h3 className="text-sm font-black text-zinc-800 uppercase tracking-tighter mb-6">Atraso de Início</h3>
            <div className="space-y-3">
              {suppliersWithoutDeliveries.length > 0 ? suppliersWithoutDeliveries.map(s => (
                <div key={s.name} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="font-black text-zinc-800 uppercase text-[9px] max-w-[140px] truncate">{s.name}</p>
                  <span className="text-zinc-900 text-[9px] font-mono font-bold">{formatCurrency(s.value)}</span>
                </div>
              )) : (
                <p className="text-zinc-300 text-[10px] font-black uppercase text-center py-4">Sem pendências</p>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right Column - Visual Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Warehouse Flow */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter">Fluxo de Almoxarifado</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Volume de Movimentação • Últimos 30 Dias</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-indigo-500 rounded-full"></span>
                  <span className="text-[9px] font-black text-zinc-400 uppercase">Entradas</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-amber-500 rounded-full"></span>
                  <span className="text-[9px] font-black text-zinc-400 uppercase">Saídas</span>
                </div>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={warehouseData}>
                  <defs>
                    <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="entries" name="Entradas" stroke="#6366f1" fillOpacity={1} fill="url(#colorEntries)" strokeWidth={4} />
                  <Area type="monotone" dataKey="withdrawals" name="Saídas" stroke="#f59e0b" fillOpacity={1} fill="url(#colorWithdrawals)" strokeWidth={4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Delivery Status Pie */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
              <h3 className="text-sm font-black text-zinc-800 uppercase tracking-tighter mb-8">Status de Entregas</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deliveryPerformance} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                      {deliveryPerformance.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Financial Balance Pie */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
              <h3 className="text-sm font-black text-zinc-800 uppercase tracking-tighter mb-8">Balanço Financeiro</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={financialSummary} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                      {financialSummary.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Secondary Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest mb-6">Top Fornecedores (Kg)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierProgress} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 800, fill: '#94a3b8'}} width={100} />
                <Tooltip />
                <Bar dataKey="delivered" name="Entregue" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest mb-6">Logística de Veículos</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 7, fontWeight: 800, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} />
                <Tooltip />
                <Bar dataKey="value" name="Viagens" fill="#8b5cf6" radius={[10, 10, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest mb-6">Tipos de Limpeza</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleaningData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 800, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} />
                <Tooltip />
                <Bar dataKey="value" name="Qtd" fill="#10b981" radius={[10, 10, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@700&display=swap');
        
        .animate-fade-in { 
          animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(20px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
      `}</style>
    </div>
  );
};

export default AdminGraphs;
