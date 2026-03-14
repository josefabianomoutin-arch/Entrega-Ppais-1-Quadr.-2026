import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import type { Supplier, WarehouseMovement, CleaningLog, FinancialRecord, VehicleExitOrder, ThirdPartyEntryLog, DirectorPerCapitaLog } from '../types';

interface AdminGraphsProps {
  suppliers: Supplier[];
  warehouseLog: WarehouseMovement[];
  cleaningLogs: CleaningLog[];
  financialRecords: FinancialRecord[];
  vehicleExitOrders: VehicleExitOrder[];
  thirdPartyEntries: ThirdPartyEntryLog[];
  directorWithdrawals: DirectorPerCapitaLog[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const AdminGraphs: React.FC<AdminGraphsProps> = ({ 
  suppliers = [], 
  warehouseLog = [], 
  cleaningLogs = [], 
  financialRecords = [], 
  vehicleExitOrders = [],
  thirdPartyEntries = [],
  directorWithdrawals = []
}) => {

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

  // 2. Movimentação de Almoxarifado (Últimos 30 dias)
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
      const dateStr = log.date.split('T')[0];
      if (last30Days.has(dateStr)) {
        const current = last30Days.get(dateStr)!;
        if (log.type === 'entrada') current.entries += Number(log.quantity) || 0;
        else current.withdrawals += Number(log.quantity) || 0;
      }
    });

    return Array.from(last30Days.entries()).map(([date, values]) => ({
      date: date.split('-').reverse().slice(0, 2).join('/'),
      ...values
    }));
  }, [warehouseLog]);

  // 3. Tipos de Higienização
  const cleaningData = useMemo(() => {
    const counts = new Map<string, number>();
    cleaningLogs.forEach(log => {
      counts.set(log.type, (counts.get(log.type) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      quantidade: count
    }));
  }, [cleaningLogs]);

  // 4. Ordens de Saída por Veículo
  const vehicleData = useMemo(() => {
    const counts = new Map<string, number>();
    vehicleExitOrders.forEach(order => {
      const label = `${order.vehiclePlate} (${order.vehicleModel})`;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, viagens: count }))
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 5);
  }, [vehicleExitOrders]);

  // 5. Progresso de Entrega por Fornecedor (Top 5)
  const supplierProgress = useMemo(() => {
    return suppliers.map(s => {
      const contracted = (s.contractItems || []).reduce((acc, item) => acc + (item.totalKg || 0), 0);
      const delivered = (s.deliveries || []).reduce((acc, d) => acc + (d.kg || 0), 0);
      const percentage = contracted > 0 ? (delivered / contracted) * 100 : 0;
      return {
        name: s.name.split(' ')[0],
        fullName: s.name,
        entregue: Number(delivered.toFixed(2)),
        contratado: Number(contracted.toFixed(2)),
        progresso: Number(percentage.toFixed(1))
      };
    })
    .sort((a, b) => b.contratado - a.contratado)
    .slice(0, 5);
  }, [suppliers]);

  // 6. Entradas de Terceiros por Local
  const thirdPartyData = useMemo(() => {
    const counts = new Map<string, number>();
    thirdPartyEntries.forEach(log => {
      const locs = log.locations.split(',').map(l => l.trim());
      locs.forEach(l => {
        if (l) counts.set(l, (counts.get(l) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [thirdPartyEntries]);

  // 7. Retiradas Diretor por Item
  const directorData = useMemo(() => {
    const counts = new Map<string, number>();
    directorWithdrawals.forEach(log => {
      log.items.forEach(item => {
        counts.set(item.name, (counts.get(item.name) || 0) + (Number(item.quantity) || 0));
      });
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [directorWithdrawals]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Fornecedores</p>
          <p className="text-3xl font-black text-indigo-600">{suppliers.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Registros Financeiros</p>
          <p className="text-3xl font-black text-emerald-600">{financialRecords.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Movimentações Almox.</p>
          <p className="text-3xl font-black text-amber-600">{warehouseLog.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Logs de Higiene</p>
          <p className="text-3xl font-black text-rose-600">{cleaningLogs.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Retiradas Diretor</p>
          <p className="text-3xl font-black text-cyan-600">{directorWithdrawals.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Finance Pie Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Visão Geral Financeira</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialSummary}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {financialSummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warehouse Area Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Movimentação de Estoque (30 dias)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={warehouseData}>
                <defs>
                  <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip />
                <Area type="monotone" dataKey="entries" name="Entradas" stroke="#6366f1" fillOpacity={1} fill="url(#colorEntries)" strokeWidth={3} />
                <Area type="monotone" dataKey="withdrawals" name="Saídas" stroke="#f59e0b" fillOpacity={1} fill="url(#colorWithdrawals)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supplier Progress Bar Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Top 5 Fornecedores (Entrega Kg)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierProgress} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} width={80} />
                <Tooltip formatter={(value: number) => `${value} Kg`} />
                <Bar dataKey="entregue" name="Entregue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="contratado" name="Contratado" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cleaning Logs Bar Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Tipos de Higienização</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleaningData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Exit Orders Bar Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Viagens por Veículo (Top 5)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} width={120} />
                <Tooltip />
                <Bar dataKey="viagens" fill="#ec4899" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Third Party Entries Pie Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Entradas de Terceiros por Local</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={thirdPartyData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {thirdPartyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Director Withdrawals Bar Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-zinc-100">
          <h3 className="text-lg font-black text-zinc-800 uppercase tracking-tighter mb-6">Retiradas Diretor (Top 5 Itens)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={directorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip />
                <Bar dataKey="value" name="Quantidade" fill="#06b6d4" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminGraphs;
