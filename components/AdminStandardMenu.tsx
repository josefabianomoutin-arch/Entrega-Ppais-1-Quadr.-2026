
import React, { useState, useEffect, useMemo } from 'react';
import type { StandardMenu, DailyMenus, MenuRow, Supplier } from '../types';

interface AdminStandardMenuProps {
  template: StandardMenu;
  dailyMenus: DailyMenus;
  onUpdateTemplate: (template: StandardMenu) => Promise<void>;
  onUpdateDailyMenus: (menus: DailyMenus) => Promise<void>;
  inmateCount: number;
  suppliers: Supplier[];
}

const WEEK_DAYS_BR = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MEAL_PERIODS = ['CAFÉ DA MANHÃ', 'ALMOÇO', 'JANTA', 'LANCHE NOITE'];
const ROWS_PER_DAY = 15;

const AdminStandardMenu: React.FC<AdminStandardMenuProps> = ({ template, dailyMenus, onUpdateTemplate, onUpdateDailyMenus, inmateCount, suppliers }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMenu, setCurrentMenu] = useState<MenuRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateDay, setTemplateDay] = useState<string>('SEGUNDA-FEIRA');
  const [isLoadedFromSaved, setIsLoadedFromSaved] = useState(false);

  // Carrega o cardápio para a data selecionada
  useEffect(() => {
    const normalize = (rows: any[], baseId: string): MenuRow[] => {
      const defaultRow = { period: '', foodItem: '', unitWeight: '', totalWeight: '' };
      return (rows || []).map((row, i) => ({
        ...defaultRow,
        ...row,
        id: row.id || `${baseId}-${i}`,
        foodItem: row.foodItem || row.description || '', // Compatibility with old data
      }));
    };

    if (isEditingTemplate) {
        setIsLoadedFromSaved(false);
        const rows = template[templateDay] || Array.from({ length: ROWS_PER_DAY }, () => ({}));
        setCurrentMenu(normalize(rows, templateDay));
    } else {
        let rowsToSet: MenuRow[];
        if (dailyMenus[selectedDate]) {
            setIsLoadedFromSaved(true);
            rowsToSet = normalize(dailyMenus[selectedDate], selectedDate);
        } else {
            setIsLoadedFromSaved(false);
            const dateObj = new Date(selectedDate + 'T00:00:00');
            const dayName = WEEK_DAYS_BR[dateObj.getDay()];
            const templateRows = template[dayName] || Array.from({ length: ROWS_PER_DAY }, () => ({}));
            rowsToSet = normalize(templateRows, selectedDate);
        }
        
        // Recalculate total weights for daily menus on load
        rowsToSet.forEach(row => {
            row.totalWeight = calculateTotalWeight(row.unitWeight);
        });
        setCurrentMenu(rowsToSet);
    }
  }, [selectedDate, dailyMenus, template, isEditingTemplate, templateDay, inmateCount]);

  function calculateTotalWeight(unitWeightStr: string): string {
    const unitVal = parseFloat(unitWeightStr.replace(',', '.')) || 0;
    if (unitVal > 0 && inmateCount > 0) {
        const calculatedTotal = unitVal * inmateCount;
        return calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '';
  }

  const handleInputChange = (index: number, field: keyof MenuRow, value: string) => {
    const updated = [...currentMenu];
    let newRow = { ...updated[index], [field]: value };

    if (field === 'unitWeight') {
        newRow.totalWeight = calculateTotalWeight(value);
    }

    updated[index] = newRow;
    setCurrentMenu(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isEditingTemplate) {
        await onUpdateTemplate({ ...template, [templateDay]: currentMenu });
        alert('Template atualizado com sucesso!');
      } else {
        await onUpdateDailyMenus({ ...dailyMenus, [selectedDate]: currentMenu });
        alert(isLoadedFromSaved ? 'Cardápio atualizado com sucesso!' : 'Cardápio do dia salvo com sucesso!');
      }
    } catch (e) {
      alert('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedHistory = useMemo(() => {
    return Object.keys(dailyMenus).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [dailyMenus]);
  
  const suppliersByFoodItem = useMemo(() => {
    // FIX: Explicitly type the Set as Set<string> to ensure correct type inference for `foodItems`.
    // This prevents `foodItem` from being inferred as `unknown` in the subsequent map operation.
    const foodItems = [...new Set<string>(currentMenu.map(row => row.foodItem.trim().toUpperCase()).filter(Boolean))];

    if (foodItems.length === 0 || !suppliers || suppliers.length === 0) {
        return [];
    }

    return foodItems.map(foodItem => {
        const foundSuppliers = new Set<string>();
        const searchTerms = foodItem.toLowerCase().split(' ').filter(s => s.length > 2);

        suppliers.forEach(supplier => {
            supplier.contractItems.forEach(contractItem => {
                const contractName = contractItem.name.toLowerCase();
                if (searchTerms.some(term => contractName.includes(term))) {
                    foundSuppliers.add(supplier.name);
                }
            });
        });

        return {
            foodItem,
            suppliers: Array.from(foundSuppliers).sort(),
        };
    });
  }, [currentMenu, suppliers]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-full mx-auto border-t-8 border-amber-500 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-amber-900 uppercase tracking-tighter">Cardápio Institucional</h2>
          <p className="text-gray-400 font-medium">Gestão de descrições e pesos por data ou modelo padrão.</p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <button 
                onClick={() => setIsEditingTemplate(false)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!isEditingTemplate ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
                Lançar por Data
            </button>
            <button 
                onClick={() => setIsEditingTemplate(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isEditingTemplate ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
                Editar Templates Semanais
            </button>
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
             <span className="text-[10px] font-black text-amber-600 uppercase block mb-1">População Base</span>
             <span className="text-lg font-bold text-amber-800">{inmateCount} Carcerária</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Lado Esquerdo: Controles */}
        <div className="lg:col-span-1 space-y-6">
            {!isEditingTemplate ? (
                <div className="bg-gray-50 p-4 rounded-xl border">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Selecionar Data</label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <p className="mt-2 text-[10px] text-gray-500 italic">
                        Dia da semana: <span className="font-bold uppercase">{WEEK_DAYS_BR[new Date(selectedDate + 'T00:00:00').getDay()]}</span>
                    </p>
                </div>
            ) : (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2">Selecionar Modelo</label>
                    <select 
                        value={templateDay} 
                        onChange={(e) => setTemplateDay(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                        {WEEK_DAYS_BR.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <p className="mt-2 text-[10px] text-indigo-600 font-medium">
                        Você está editando o modelo padrão usado para novas datas.
                    </p>
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase text-sm tracking-widest text-white ${isEditingTemplate ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
                {isSaving ? 'Salvando...' : (isEditingTemplate ? 'Salvar Template' : isLoadedFromSaved ? 'Atualizar Cardápio' : 'Salvar Cardápio do Dia')}
            </button>

            {!isEditingTemplate && sortedHistory.length > 0 && (
                <div className="pt-6 border-t">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Consulta de Histórico</h4>
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        {sortedHistory.map(date => (
                            <button 
                                key={date} 
                                onClick={() => setSelectedDate(date)}
                                className={`w-full text-left p-2 rounded text-xs font-mono transition-colors ${selectedDate === date ? 'bg-amber-100 text-amber-800 font-bold' : 'hover:bg-gray-100 text-gray-600'}`}
                            >
                                {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Lado Direito: Tabela */}
        <div className="lg:col-span-3">
            <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className={`${isEditingTemplate ? 'bg-indigo-50' : 'bg-amber-50'} p-4 border-b flex justify-between items-center gap-4`}>
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">
                        {isEditingTemplate ? `Template: ${templateDay}` : `Data: ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                    </h3>
                     {isLoadedFromSaved && !isEditingTemplate && (
                        <span className="text-xs font-bold uppercase bg-green-100 text-green-700 px-3 py-1 rounded-full animate-fade-in">
                            Editando Cardápio Salvo
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="p-3 border text-left w-40">Período</th>
                                <th className="p-3 border text-left w-2/5">Alimento / Preparação</th>
                                <th className="p-3 border text-center w-28">Peso Unit. (g/ml)</th>
                                <th className="p-3 border text-center w-28">Peso Total (Calculado)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentMenu.map((row, idx) => (
                                <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-1 border">
                                        <select
                                            value={row.period || ''}
                                            onChange={(e) => handleInputChange(idx, 'period', e.target.value as MenuRow['period'])}
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium text-xs"
                                        >
                                            <option value="">-- Selecione --</option>
                                            {MEAL_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-1 border">
                                        <input
                                            type="text"
                                            value={row.foodItem}
                                            onChange={(e) => handleInputChange(idx, 'foodItem', e.target.value)}
                                            placeholder="..."
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium"
                                        />
                                    </td>
                                    <td className="p-1 border">
                                        <input
                                            type="text"
                                            value={row.unitWeight}
                                            onChange={(e) => handleInputChange(idx, 'unitWeight', e.target.value)}
                                            placeholder="0,00"
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-center font-mono text-gray-600"
                                        />
                                    </td>
                                    <td className="p-1 border bg-gray-50/50">
                                        <input
                                            type="text"
                                            value={row.totalWeight}
                                            readOnly
                                            placeholder="Calculado"
                                            className="w-full p-2 bg-transparent outline-none border-none text-center font-mono font-bold text-amber-700 cursor-default"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
      
      <div className="mt-12 pt-8 border-t-2 border-dashed">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight text-center mb-6 uppercase">
              Análise de Fornecedores para o Cardápio Selecionado
          </h3>
          {suppliersByFoodItem.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suppliersByFoodItem.map(({ foodItem, suppliers: foundSuppliers }) => (
                      <div key={foodItem} className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-shadow hover:shadow-md">
                          <h4 className="font-bold text-gray-800 truncate" title={foodItem}>{foodItem}</h4>
                          {foundSuppliers.length > 0 ? (
                              <ul className="mt-2 text-sm space-y-1">
                                  {foundSuppliers.map(name => (
                                      <li key={name} className="flex items-center gap-2 text-green-700">
                                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                          <span>{name}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p className="mt-2 text-sm text-red-600 font-semibold flex items-center gap-2">
                                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  Nenhum fornecedor contratado para este item.
                              </p>
                          )}
                      </div>
                  ))}
              </div>
          ) : (
              <p className="text-center text-gray-400 italic py-4">Preencha o cardápio acima para ver a análise de fornecedores.</p>
          )}
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default AdminStandardMenu;
