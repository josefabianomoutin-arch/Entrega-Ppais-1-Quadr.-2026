
import React, { useState, useMemo } from 'react';
import type { VehicleExitOrder, VehicleAsset, DriverAsset } from '../types';
import AdminVehicleExitOrder from './AdminVehicleExitOrder';

interface VehicleOrderDashboardProps {
  orders: VehicleExitOrder[];
  vehicleAssets: VehicleAsset[];
  driverAssets: DriverAsset[];
  onRegister: (order: Omit<VehicleExitOrder, 'id'>) => Promise<{ success: boolean; message: string; id?: string }>;
  onUpdate: (order: VehicleExitOrder) => Promise<{ success: boolean; message: string }>;
  onDelete: (id: string) => Promise<void>;
  onRegisterVehicleAsset: (asset: Omit<VehicleAsset, 'id'>) => Promise<{ success: boolean; message: string }>;
  onUpdateVehicleAsset: (asset: VehicleAsset) => Promise<{ success: boolean; message: string }>;
  onDeleteVehicleAsset: (id: string) => Promise<void>;
  onRegisterDriverAsset: (asset: Omit<DriverAsset, 'id'>) => Promise<{ success: boolean; message: string }>;
  onUpdateDriverAsset: (asset: DriverAsset) => Promise<{ success: boolean; message: string }>;
  onDeleteDriverAsset: (id: string) => Promise<void>;
  onLogout: () => void;
  role: 'infraestrutura' | 'ordem_saida';
}

const VehicleOrderDashboard: React.FC<VehicleOrderDashboardProps> = ({
  orders,
  vehicleAssets,
  driverAssets,
  onRegister,
  onUpdate,
  onDelete,
  onRegisterVehicleAsset,
  onUpdateVehicleAsset,
  onDeleteVehicleAsset,
  onRegisterDriverAsset,
  onUpdateDriverAsset,
  onDeleteDriverAsset,
  onLogout,
  role
}) => {
  const [sessionOrderIds, setSessionOrderIds] = useState<string[]>([]);

  const filteredOrders = useMemo(() => {
    if (role === 'ordem_saida') {
      return orders.filter(o => sessionOrderIds.includes(o.id));
    }
    return orders;
  }, [orders, sessionOrderIds, role]);

  const handleRegister = async (order: Omit<VehicleExitOrder, 'id'>) => {
    const response = await onRegister(order);
    if (response.success && response.id) {
      setSessionOrderIds(prev => [...prev, response.id!]);
    }
    return response;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-950 text-white p-4 shadow-xl flex justify-between items-center sticky top-0 z-50 border-b border-indigo-800">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">
              {role === 'infraestrutura' ? 'Infraestrutura' : 'Ordem de Saída'}
            </h1>
            <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Gestão de Veículos</p>
          </div>
        </div>
        <button onClick={onLogout} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase transition-all border border-red-900/50">Sair</button>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        <AdminVehicleExitOrder 
          orders={filteredOrders}
          vehicleAssets={vehicleAssets}
          driverAssets={driverAssets}
          onRegister={handleRegister}
          onUpdate={role === 'ordem_saida' ? async () => ({ success: false, message: 'Não permitido' }) : onUpdate}
          onDelete={onDelete}
          onRegisterVehicleAsset={role === 'ordem_saida' ? async () => ({ success: false, message: 'Não permitido' }) : onRegisterVehicleAsset}
          onUpdateVehicleAsset={role === 'ordem_saida' ? async () => ({ success: false, message: 'Não permitido' }) : onUpdateVehicleAsset}
          onDeleteVehicleAsset={role === 'ordem_saida' ? async () => Promise.resolve() : onDeleteVehicleAsset}
          onRegisterDriverAsset={role === 'ordem_saida' ? async () => ({ success: false, message: 'Não permitido' }) : onRegisterDriverAsset}
          onUpdateDriverAsset={role === 'ordem_saida' ? async () => ({ success: false, message: 'Não permitido' }) : onUpdateDriverAsset}
          onDeleteDriverAsset={role === 'ordem_saida' ? async () => Promise.resolve() : onDeleteDriverAsset}
          readOnly={false}
          hideAssets={role === 'ordem_saida'}
          hideEdit={role === 'ordem_saida'}
          showGateTab={true}
        />
      </main>
    </div>
  );
};

export default VehicleOrderDashboard;
