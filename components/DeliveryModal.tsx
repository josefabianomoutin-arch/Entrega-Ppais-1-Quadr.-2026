import React, { useState } from 'react';

interface MonthlyQuota {
  name: string;
  monthlyQuotaKg: number;
  deliveredThisMonthKg: number;
  remainingThisMonthKg: number;
}

interface DeliveryModalProps {
  date: Date;
  onClose: () => void;
  onSave: (time: string) => void;
  monthlyQuotas: MonthlyQuota[];
}

const DeliveryModal: React.FC<DeliveryModalProps> = ({ date, onClose, onSave, monthlyQuotas }) => {
  const [time, setTime] = useState('08:00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (time < '08:00' || time > '16:00') {
      alert('O horário da entrega deve ser entre 08:00 e 16:00.');
      return;
    }
    
    onSave(time);
  };
  
  const formattedDate = date.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Agendar Horário</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        <p className="mb-6 text-gray-600">Data selecionada: <span className="font-semibold text-green-700">{formattedDate}</span></p>
        
        <div className="mb-6 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Meta de Entrega para {date.toLocaleString('pt-BR', { month: 'long' })}</h3>
            <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {monthlyQuotas.length > 0 ? monthlyQuotas.map(quota => {
                    const progress = quota.monthlyQuotaKg > 0 ? (quota.deliveredThisMonthKg / quota.monthlyQuotaKg) * 100 : 0;
                    return (
                        <div key={quota.name} className="text-sm">
                            <p className="font-bold text-gray-800">{quota.name}</p>
                            <div className="w-full bg-gray-200 rounded-full h-4 my-1 relative shadow-inner">
                                <div 
                                    className="bg-green-500 h-4 rounded-full transition-all duration-300" 
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                />
                                 <span className="absolute inset-0 text-white text-[10px] font-bold flex items-center justify-center mix-blend-lighten">{progress.toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Entregue: {quota.deliveredThisMonthKg.toFixed(2).replace('.', ',')} Kg</span>
                                <span>Meta: {quota.monthlyQuotaKg.toFixed(2).replace('.', ',')} Kg</span>
                            </div>
                        </div>
                    )
                }) : (
                    <p className="text-sm text-gray-400 italic text-center">Nenhum item contratado para este fornecedor.</p>
                )}
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700">Horário da Entrega (08:00 às 16:00)</label>
            <input 
              type="time" 
              id="time" 
              value={time} 
              onChange={e => setTime(e.target.value)} 
              required 
              min="08:00"
              max="16:00"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Salvar Agendamento</button>
          </div>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default DeliveryModal;