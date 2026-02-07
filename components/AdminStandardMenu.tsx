


import React, { useState, useEffect, useMemo } from 'react';
import type { StandardMenu, DailyMenus, MenuRow, Supplier } from '../types';

interface AdminStandardMenuProps {
  template: StandardMenu;
  dailyMenus: DailyMenus;
  onUpdateDailyMenus: (menus: DailyMenus) => Promise<void>;
  inmateCount: number;
  suppliers: Supplier[];
}

const WEEK_DAYS_BR = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MEAL_PERIODS = ['CAFÉ DA MANHÃ', 'ALMOÇO', 'JANTA', 'LANCHE NOITE'];
const ROWS_PER_DAY = 20;

const unitBasedKeywords = [
    'OVO', 'OVOS', 'PÃO', 'PAO', 'BISCOITO', 'BOLACHA', 
    'MAÇÃ', 'MACA', 'BANANA', 'LARANJA', 'PÊRA', 'PERA', 'CAQUI', 'GOIABA', 'MANGA', 'MARACUJÁ', 'TANGERINA', 'ABACAXI', 'MELANCIA', 'MELÃO', 'UVA', 
    'DOCE DE LEITE', 'IOGURTE', 'BEBIDA LÁCTEA', 'REFRIGERANTE'
];

const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const getDatesOfWeek = (week: number, year: number): string[] => {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dow = simple.getUTCDay();
    const weekStart = simple;
    if (dow <= 4) {
        weekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    } else {
        weekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    }

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setUTCDate(weekStart.getUTCDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
};


const AdminStandardMenu: React.FC<AdminStandardMenuProps> = ({ template, dailyMenus, onUpdateDailyMenus, inmateCount, suppliers }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMenu, setCurrentMenu] = useState<MenuRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadedFromSaved, setIsLoadedFromSaved] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')));

  useEffect(() => {
    const weekForDate = getWeekNumber(new Date(selectedDate + 'T00:00:00'));
    if (weekForDate !== selectedWeek) {
        setSelectedWeek(weekForDate);
    }
  }, [selectedDate, selectedWeek]);

  const handleWeekChange = (weekNumber: number) => {
    const year = new Date(selectedDate + 'T00:00:00').getFullYear();
    const datesOfWeek = getDatesOfWeek(weekNumber, year);
    setSelectedWeek(weekNumber);
    if (datesOfWeek.length > 0) {
        const firstDayOfWeek = datesOfWeek[0];
        const currentSelectedDate = new Date(selectedDate + 'T00:00:00');
        const newDate = new Date(firstDayOfWeek + 'T00:00:00');
        if (currentSelectedDate.getTime() !== newDate.getTime()) {
            setSelectedDate(firstDayOfWeek);
        }
    }
  };

  const availableContractItems = useMemo(() => {
    const itemSet = new Set<string>();
    (suppliers || []).forEach(s => {
        (s.contractItems || []).forEach(ci => {
            itemSet.add(ci.name);
        });
    });
    return Array.from(itemSet).sort();
  }, [suppliers]);
  
  const contractItemUnitMap = useMemo(() => {
    const map = new Map<string, string>();
    (suppliers || []).forEach(s => {
        (s.contractItems || []).forEach(ci => {
            if (!map.has(ci.name)) {
                map.set(ci.name, ci.unit || 'kg-1');
            }
        });
    });
    return map;
  }, [suppliers]);

  const getUnitLabel = (unitString: string | undefined, contractedItemName: string | undefined): string => {
    const [type] = (unitString || '').split('-');
    
    if (type === 'dz') return 'Dz';
    if (type === 'un') return 'Un';

    const itemName = (contractedItemName || '').toUpperCase();
    if (unitBasedKeywords.some(keyword => itemName.includes(keyword))) {
        return 'Un';
    }

    return 'g/ml';
  };

  const calculateTotalWeight = (unitWeightStr: string, contractedItemName: string | undefined): string => {
    const unitVal = parseFloat(unitWeightStr.replace(',', '.')) || 0;
    if (unitVal <= 0 || inmateCount <= 0) {
        return '';
    }

    const unitString = contractItemUnitMap.get(contractedItemName || '');
    const [unitType] = (unitString || '').split('-');
    const calculatedTotal = unitVal * inmateCount;

    if (unitType === 'dz') {
        return `${calculatedTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} Dz`;
    }
    if (unitType === 'un') {
        return `${calculatedTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} Un`;
    }
    
    const itemName = (contractedItemName || '').toUpperCase();
    if (unitBasedKeywords.some(keyword => itemName.includes(keyword))) {
        return `${calculatedTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} Un`;
    }
    
    const suffix = (unitString || 'kg').toLowerCase().includes('litro') ? 'L' : 'Kg';
    return `${(calculatedTotal / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${suffix}`;
  }

  // Carrega o cardápio para a data selecionada
  useEffect(() => {
    const normalize = (rows: any[], baseId: string): MenuRow[] => {
      const defaultRow = { period: '', foodItem: '', preparationDetails: '', contractedItem: '', unitWeight: '', totalWeight: '' };
      return (rows || []).map((row, i) => ({
        ...defaultRow,
        ...row,
        id: row.id || `${baseId}-${i}`,
        foodItem: row.foodItem || row.description || '', // Compatibility with old data
      }));
    };

    let rowsToSet: MenuRow[];
    if (dailyMenus[selectedDate]) {
        setIsLoadedFromSaved(true);
        const baseRows = dailyMenus[selectedDate] || [];
        const paddedRows = Array.from({ length: ROWS_PER_DAY }, (_, i) => baseRows[i] || {});
        rowsToSet = normalize(paddedRows, selectedDate);
    } else {
        setIsLoadedFromSaved(false);
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayName = WEEK_DAYS_BR[dateObj.getDay()];
        const baseTemplateRows = template[dayName] || [];
        const paddedTemplateRows = Array.from({ length: ROWS_PER_DAY }, (_, i) => baseTemplateRows[i] || {});
        
        const copiesWithoutIds = (paddedTemplateRows as Partial<MenuRow>[]).map(({ id, ...rest }) => rest);

        rowsToSet = normalize(copiesWithoutIds, selectedDate);
    }
    
    rowsToSet.forEach(row => {
        row.totalWeight = calculateTotalWeight(row.unitWeight, row.contractedItem);
    });
    setCurrentMenu(rowsToSet);

  }, [selectedDate, dailyMenus, template, inmateCount]);


  const handleInputChange = (index: number, field: keyof MenuRow, value: string) => {
    const updated = [...currentMenu];
    let newRow = { ...updated[index], [field]: value };

    if (field === 'unitWeight' || field === 'contractedItem') {
        const item = field === 'contractedItem' ? value : newRow.contractedItem;
        const weight = field === 'unitWeight' ? value : newRow.unitWeight;
        newRow.totalWeight = calculateTotalWeight(weight, item);
    }

    updated[index] = newRow;
    setCurrentMenu(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateDailyMenus({ ...dailyMenus, [selectedDate]: currentMenu.filter(r => r.foodItem || r.contractedItem || r.unitWeight || r.preparationDetails) });
      alert(isLoadedFromSaved ? 'Cardápio atualizado com sucesso!' : 'Cardápio do dia salvo com sucesso!');
    } catch (e) {
      alert('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePrintReport = () => {
    const menuToPrint = currentMenu.filter(row => row.foodItem || row.contractedItem);
    if (menuToPrint.length === 0) {
      alert('Não há itens no cardápio para gerar um relatório.');
      return;
    }
  
    const groupedMenu = menuToPrint.reduce((acc, row) => {
      const period = row.period || 'Não especificado';
      if (!acc[period]) {
        acc[period] = [];
      }
      acc[period].push(row);
      return acc;
    }, {} as Record<string, MenuRow[]>);
  
    const itemSummary = new Map<string, { total: number; unit: string }>();
    menuToPrint.forEach(row => {
        if (row.contractedItem && row.totalWeight) {
            const [valueStr, unit] = row.totalWeight.split(' ');
            const value = parseFloat(valueStr.replace(/\./g, '').replace(',', '.')) || 0;
            
            const existing = itemSummary.get(row.contractedItem) || { total: 0, unit: unit || 'Kg' };
            existing.total += value;
            itemSummary.set(row.contractedItem, existing);
        }
    });
    
    const sortedSummary = Array.from(itemSummary.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    const datesOfWeek = getDatesOfWeek(selectedWeek, 2026);
    const suppliersThisWeek = new Set<string>();
    suppliers.forEach(supplier => {
        const hasDeliveryThisWeek = (supplier.deliveries || []).some(delivery => 
            datesOfWeek.includes(delivery.date) && delivery.item !== 'AGENDAMENTO PENDENTE'
        );
        if (hasDeliveryThisWeek) {
            suppliersThisWeek.add(supplier.name);
        }
    });
    const sortedSuppliersList = Array.from(suppliersThisWeek).sort();

    const printContent = `
      <html>
        <head>
          <title>Cardápio do Dia - ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header-sap { font-size: 14px; margin-bottom: 2px; }
            .header-unit { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .header-address { font-size: 11px; }
            .header-contact { font-size: 11px; }
            .report-title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; text-transform: uppercase; }
            .info-bar { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 10px; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .period-header { background-color: #e0e0e0; font-weight: bold; text-align: center; text-transform: uppercase; }
            .summary-section { margin-top: 30px; page-break-inside: avoid; }
            .summary-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; }
            .footer { margin-top: 60px; display: flex; justify-content: space-around; }
            .sig { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; font-size: 11px; font-weight: bold; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-sap">Secretaria da Administração Penitenciária</div>
            <div class="header-unit">Polícia Penal - Penitenciária de Taiúva</div>
            <div class="header-address">Rodovia Brigadeiro Faria Lima, SP 326, KM 359,6 Taiúva/SP - CEP: 14.720-000</div>
            <div class="header-contact">Fone: (16) 3247-6261 - E-mail: dg@ptaiuva.sap.gov.br</div>
          </div>
          
          <div class="report-title">Cardápio Diário e Necessidade de Gêneros</div>
  
          <div class="info-bar">
              <span>Data: ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')} (Semana ${selectedWeek})</span>
              <span>População Carcerária: ${inmateCount}</span>
          </div>
          
          <div class="menu-section">
              <div class="summary-title">Cardápio Detalhado</div>
              <table>
                  <thead>
                      <tr>
                          <th style="width: 30%;">Alimento / Preparação</th>
                          <th style="width: 25%;">Descrição Preparo</th>
                          <th style="width: 20%;">Item Contratado (p/ Análise)</th>
                          <th style="width: 12.5%; text-align: right;">Peso/Qtd. Unit.</th>
                          <th style="width: 12.5%; text-align: right;">Peso/Qtd. Total</th>
                      </tr>
                  </thead>
                  <tbody>
                    ${MEAL_PERIODS.map(period => {
                      if (!groupedMenu[period] || groupedMenu[period].length === 0) return '';
                      return `
                        <tr><td colspan="5" class="period-header">${period}</td></tr>
                        ${groupedMenu[period].map(row => `
                          <tr>
                            <td>${row.foodItem}</td>
                            <td>${row.preparationDetails || ''}</td>
                            <td>${row.contractedItem || '-'}</td>
                            <td style="text-align: right;">${row.unitWeight}</td>
                            <td style="text-align: right;">${row.totalWeight}</td>
                          </tr>
                        `).join('')}
                      `;
                    }).join('')}
                  </tbody>
              </table>
          </div>
  
          <div class="summary-section">
              <div class="summary-title">Resumo de Gêneros Necessários para o Dia</div>
              <table>
                  <thead>
                      <tr>
                          <th>Item Contratado</th>
                          <th style="text-align: right;">Quantidade Total Necessária</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${sortedSummary.length > 0 ? sortedSummary.map(([name, data]) => `
                          <tr>
                              <td>${name}</td>
                              <td style="text-align: right;">${data.total.toLocaleString('pt-BR', { minimumFractionDigits: ['Kg', 'L'].includes(data.unit) ? 3 : 0, maximumFractionDigits: ['Kg', 'L'].includes(data.unit) ? 3 : 0 })} ${data.unit}</td>
                          </tr>
                      `).join('') : '<tr><td colspan="2" style="text-align: center;">Nenhum item contratado no cardápio.</td></tr>'}
                  </tbody>
              </table>
          </div>
          
          <div class="summary-section">
            <div class="summary-title">Fornecedores com Entregas na Semana ${selectedWeek}</div>
            ${sortedSuppliersList.length > 0 ? `
                <ul style="list-style-type: disc; padding-left: 20px; font-size: 10px;">
                    ${sortedSuppliersList.map(name => `<li>${name}</li>`).join('')}
                </ul>
            ` : `
                <p style="font-size: 10px; text-align: center; font-style: italic;">Nenhum fornecedor realizou entregas nesta semana.</p>
            `}
          </div>
  
          <div class="footer">
            <div class="sig">Responsável (Almoxarifado)</div>
            <div class="sig">Nutricionista</div>
            <div class="sig">Diretor (Núcleo de Infraestrutura)</div>
          </div>
        </body>
      </html>
    `;
  
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  const sortedHistory = useMemo(() => {
    return Object.keys(dailyMenus).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [dailyMenus]);
  
  const supplierAnalysisForDay = useMemo(() => {
    const contractedItemsInMenu = [...new Set(currentMenu.map(row => row.contractedItem).filter(Boolean) as string[])];

    if (contractedItemsInMenu.length === 0 || !suppliers || suppliers.length === 0) {
        return [];
    }

    return contractedItemsInMenu.map(itemName => {
        const foundSuppliers = suppliers
            .filter(supplier => (supplier.contractItems || []).some(ci => ci.name === itemName))
            .map(supplier => {
                const contractItem = supplier.contractItems.find(ci => ci.name === itemName);
                const totalContracted = contractItem?.totalKg || 0;
                
                const totalDelivered = (supplier.deliveries || [])
                    .filter(d => d.item === itemName)
                    .reduce((sum, d) => sum + (d.kg || 0), 0);
                
                const remainingBalance = Math.max(0, totalContracted - totalDelivered);
                
                const unitString = contractItem?.unit || 'kg-1';
                const [unitType] = unitString.split('-');
                
                let displayUnit = 'Kg';
                if (unitType === 'dz') displayUnit = 'Dz';
                else if (unitType === 'un') displayUnit = 'Un';
                else if (['litro', 'l', 'embalagem', 'caixa'].includes(unitType)) displayUnit = 'L';

                return {
                    name: supplier.name,
                    remainingBalance,
                    displayUnit
                };
            });

        return {
            contractedItem: itemName,
            suppliers: foundSuppliers.sort((a, b) => b.remainingBalance - a.remainingBalance),
        };
    });
  }, [currentMenu, suppliers]);

  const weeklyAnalysisData = useMemo(() => {
    if (!selectedWeek || !dailyMenus || !suppliers) return [];

    const datesOfWeek = getDatesOfWeek(selectedWeek, 2026);
    
    const requiredItems = new Set<string>();
    datesOfWeek.forEach(date => {
        const menu = dailyMenus[date];
        if (menu) {
            menu.forEach(row => {
                if (row.contractedItem) {
                    requiredItems.add(row.contractedItem);
                }
            });
        }
    });

    if (requiredItems.size === 0) return [];

    const scheduledSuppliers = suppliers.filter(supplier => {
        return !supplier.allowedWeeks || supplier.allowedWeeks.length === 0 || supplier.allowedWeeks.includes(selectedWeek);
    });

    const result = scheduledSuppliers.map(supplier => {
        const itemsToSupply = (supplier.contractItems || [])
            .map(ci => ci.name)
            .filter(name => requiredItems.has(name));

        return {
            supplierName: supplier.name,
            items: itemsToSupply,
        };
    }).filter(s => s.items.length > 0);

    return result.sort((a,b) => a.supplierName.localeCompare(b.supplierName));
  }, [selectedWeek, dailyMenus, suppliers]);


  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl max-w-full mx-auto border-t-8 border-amber-500 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-amber-900 uppercase tracking-tighter">Cardápio Institucional</h2>
          <p className="text-gray-400 font-medium">Gestão de descrições e pesos por data.</p>
          <p className="text-xs text-gray-500 italic mt-2">
            Relação de gêneros e produtos alimentícios, de que trata o art. 1º do Decreto estadual nº 43.339, de 21 de julho de 1998, e o Anexo IV da Resolução SAMSP nº 16, de 1998<sup>3-4</sup>.
          </p>
        </div>

        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
             <span className="text-[10px] font-black text-amber-600 uppercase block mb-1">População Base</span>
             <span className="text-lg font-bold text-amber-800">{inmateCount} Carcerária</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Lançar por Data</label>
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
            
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2">Geral da Semana</label>
                <select
                    value={selectedWeek || ''}
                    onChange={e => handleWeekChange(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                        <option key={week} value={week}>Semana {week}</option>
                    ))}
                </select>
                
                <div className="mt-4 pt-4 border-t border-indigo-200 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                    {weeklyAnalysisData.length > 0 ? (
                        weeklyAnalysisData.map(data => (
                            <div key={data.supplierName} className="bg-white p-3 rounded-lg shadow-sm">
                                <h5 className="font-bold text-sm text-indigo-800">{data.supplierName}</h5>
                                <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                                    {data.items.map(item => <li key={item}>{item}</li>)}
                                </ul>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-center text-indigo-700/70 italic">
                            {selectedWeek ? "Nenhum fornecedor programado com itens para esta semana." : "Selecione uma semana."}
                        </p>
                    )}
                </div>
            </div>
            
            <div className='space-y-2'>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`w-full font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase text-sm tracking-widest text-white bg-amber-600 hover:bg-amber-700`}
                >
                    {isSaving ? 'Salvando...' : (isLoadedFromSaved ? 'Atualizar Cardápio' : 'Salvar Cardápio do Dia')}
                </button>
                 <button
                    onClick={handlePrintReport}
                    className="w-full font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 uppercase text-xs tracking-wider text-gray-700 bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Gerar PDF do Dia
                </button>
            </div>


            {sortedHistory.length > 0 && (
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

        <div className="lg:col-span-3">
            <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className={'bg-amber-50 p-4 border-b flex justify-between items-center gap-4'}>
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">
                        {`Data: ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')} (Semana ${selectedWeek})`}
                    </h3>
                     {isLoadedFromSaved && (
                        <span className="text-xs font-bold uppercase bg-green-100 text-green-700 px-3 py-1 rounded-full animate-fade-in">
                            Editando Cardápio Salvo
                        </span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="p-3 border text-left w-32">Período</th>
                                <th className="p-3 border text-left">Alimento / Preparação</th>
                                <th className="p-3 border text-left">Descrição Preparo</th>
                                <th className="p-3 border text-left">Item Contratado (p/ Análise)</th>
                                <th className="p-3 border text-center w-28">Peso/Qtd. Unit.</th>
                                <th className="p-3 border text-center w-32">Peso/Qtd. Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentMenu.map((row, idx) => {
                                const unitString = contractItemUnitMap.get(row.contractedItem || '');
                                const unitLabel = getUnitLabel(unitString, row.contractedItem);
                                return (
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
                                            placeholder="Ex: Arroz à grega"
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium"
                                        />
                                    </td>
                                    <td className="p-1 border">
                                        <input
                                            type="text"
                                            value={row.preparationDetails || ''}
                                            onChange={(e) => handleInputChange(idx, 'preparationDetails', e.target.value)}
                                            placeholder="Ex: Cozido com legumes"
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium"
                                        />
                                    </td>
                                     <td className="p-1 border">
                                        <select
                                            value={row.contractedItem || ''}
                                            onChange={(e) => handleInputChange(idx, 'contractedItem', e.target.value)}
                                            className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-medium text-xs"
                                        >
                                            <option value="">-- Selecionar Item --</option>
                                            {availableContractItems.map(item => (
                                                <option key={item} value={item}>{item}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-1 border">
                                        <input
                                            type="text"
                                            value={row.unitWeight}
                                            onChange={(e) => handleInputChange(idx, 'unitWeight', e.target.value)}
                                            placeholder={`(${unitLabel})`}
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
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
      
      <div className="mt-12 pt-8 border-t-2 border-dashed">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight text-center mb-6 uppercase">
              Análise de Fornecedores Disponíveis (para o dia selecionado)
          </h3>
          {supplierAnalysisForDay.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {supplierAnalysisForDay.map(({ contractedItem, suppliers: foundSuppliers }) => (
                      <div key={contractedItem} className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-shadow hover:shadow-md">
                          <h4 className="font-bold text-gray-800 border-b pb-2 mb-3 truncate" title={contractedItem}>{contractedItem}</h4>
                          {foundSuppliers.length > 0 ? (
                              <ul className="mt-2 text-sm space-y-3">
                                  {foundSuppliers.map(s => {
                                      const isWholeNumberUnit = s.displayUnit === 'Dz' || s.displayUnit === 'Un';
                                      const formattingOptions: Intl.NumberFormatOptions = {
                                          minimumFractionDigits: isWholeNumberUnit ? 0 : 2,
                                          maximumFractionDigits: isWholeNumberUnit ? 0 : 2,
                                      };
                                      return (
                                      <li key={s.name} className="flex flex-col gap-1 border-b border-gray-100 last:border-none pb-2">
                                          <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                              <svg className="w-4 h-4 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                              <span>{s.name}</span>
                                          </div>
                                          <div className="pl-6 flex justify-between items-center">
                                              <span className="text-[10px] text-gray-400 uppercase font-black">Saldo Restante:</span>
                                              {s.remainingBalance > 0 ? (
                                                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                      {s.remainingBalance.toLocaleString('pt-BR', formattingOptions)} {s.displayUnit}
                                                  </span>
                                              ) : (
                                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">
                                                      Saldo Esgotado
                                                  </span>
                                              )}
                                          </div>
                                      </li>
                                  )})}
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
              <p className="text-center text-gray-400 italic py-4">Selecione um 'Item Contratado' no cardápio acima para ver a disponibilidade dos fornecedores.</p>
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