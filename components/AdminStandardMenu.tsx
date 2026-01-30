
import React, { useState, useEffect } from 'react';
import type { StandardMenu, MenuRow } from '../types';

interface AdminStandardMenuProps {
  menu: StandardMenu;
  onUpdateMenu: (menu: StandardMenu) => Promise<void>;
  inmateCount: number;
}

const DAYS = ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO', 'DOMINGO'];
const ROWS_PER_DAY = 15;

const AdminStandardMenu: React.FC<AdminStandardMenuProps> = ({ menu, onUpdateMenu, inmateCount }) => {
  const [localMenu, setLocalMenu] = useState<StandardMenu>(menu);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Inicializa o menu se estiver vazio para garantir que a estrutura exista
    const initialized: StandardMenu = { ...menu };
    DAYS.forEach(day => {
      if (!initialized[day]) {
        initialized[day] = Array.from({ length: ROWS_PER_DAY }, (_, i) => ({
          id: `${day}-${i}`,
          description: '',
          unitWeight: '',
          totalWeight: ''
        }));
      }
    });
    setLocalMenu(initialized);
  }, [menu]);

  const handleInputChange = (day: string, index: number, field: keyof MenuRow, value: string) => {
    const updated = { ...localMenu };
    const dayRows = [...updated[day]];
    
    let newRow = { ...dayRows[index], [field]: value };

    // Lógica de Cálculo Automático: se o Peso Unit. mudou, calcula o Peso Total
    if (field === 'unitWeight') {
        const unitVal = parseFloat(value.replace(',', '.')) || 0;
        if (unitVal > 0 && inmateCount > 0) {
            const calculatedTotal = unitVal * inmateCount;
            newRow.totalWeight = calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    dayRows[index] = newRow;
    updated[day] = dayRows;
    setLocalMenu(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateMenu(localMenu);
      setHasChanges(false);
      alert('Cardápio salvo com sucesso!');
    } catch (e) {
      alert('Erro ao salvar cardápio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-full mx-auto border-t-8 border-amber-500 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-amber-900 uppercase tracking-tighter">Cardápio Padrão</h2>
          <p className="text-gray-400 font-medium">Gerencie as descrições e pesos do cardápio semanal institucional.</p>
          <div className="mt-2 inline-flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
             <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Cálculo Base:</span>
             <span className="text-sm font-bold text-amber-800">{inmateCount} Ingressos (População Carcerária)</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black py-3 px-8 rounded-xl transition-all shadow-md active:scale-95 disabled:bg-gray-300 uppercase text-sm tracking-widest"
          >
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="space-y-12">
        {DAYS.map(day => (
          <div key={day} className="border rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-amber-50 p-4 border-b">
              <h3 className="text-xl font-black text-amber-800 tracking-tight">{day}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="p-3 border text-left w-1/2">Descrição do Item / Preparação</th>
                    <th className="p-3 border text-center w-40">Peso Unit. (g/ml)</th>
                    <th className="p-3 border text-center w-40">Peso Total (Calculado)</th>
                  </tr>
                </thead>
                <tbody>
                  {(localMenu[day] || []).map((row, idx) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-1 border">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleInputChange(day, idx, 'description', e.target.value)}
                          placeholder="..."
                          className="w-full p-2 bg-transparent outline-none focus:bg-amber-50 border-none rounded text-gray-700 font-medium"
                        />
                      </td>
                      <td className="p-1 border">
                        <input
                          type="text"
                          value={row.unitWeight}
                          onChange={(e) => handleInputChange(day, idx, 'unitWeight', e.target.value)}
                          placeholder="0,00"
                          className="w-full p-2 bg-transparent outline-none focus:bg-amber-50 border-none rounded text-center font-mono text-gray-600"
                        />
                      </td>
                      <td className="p-1 border">
                        <input
                          type="text"
                          value={row.totalWeight}
                          onChange={(e) => handleInputChange(day, idx, 'totalWeight', e.target.value)}
                          placeholder="Calculado"
                          className="w-full p-2 bg-transparent outline-none focus:bg-amber-50 border-none rounded text-center font-mono font-bold text-amber-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center">
          <p className="text-gray-400 font-medium italic">Fim da tabela do Cardápio Padrão.</p>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminStandardMenu;
