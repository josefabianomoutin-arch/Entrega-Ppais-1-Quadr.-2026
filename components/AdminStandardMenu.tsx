
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
  const [activeSubTab, setActiveSubTab] = useState<'cardapio' | 'pesos'>('cardapio');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMenu, setCurrentMenu] = useState<MenuRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadedFromSaved, setIsLoadedFromSaved] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')));
  const [weightSearch, setWeightSearch] = useState('');
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [availableLots, setAvailableLots] = useState<{
      supplierName: string;
      invoiceNumber: string;
      lotNumber: string;
      expirationDate: string;
      date: string;
      quantity: number;
      remainingQuantity: number;
      barcode?: string;
      receiptTermNumber?: string;
      itemName: string;
  }[]>([]);

  const handlePrintLabel = (lot: typeof availableLots[0]) => {
      const printWindow = window.open('', '_blank', 'width=800,height=800');
      if (!printWindow) return;

      const htmlContent = `
          <html>
          <head>
              <title>Etiqueta - ${lot.itemName}</title>
              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
              <style>
                  @page { 
                      size: A4; 
                      margin: 0; 
                  }
                  @media print {
                      header, footer { display: none !important; }
                  }
                  body { 
                      font-family: Arial, sans-serif; 
                      margin: 10mm; 
                      padding: 0; 
                      background: white; 
                  }
                  .page-container { width: 190mm; margin: 0 auto; background: white; display: flex; justify-content: center; padding-top: 10mm; }
                  .label-card {
                      width: 90mm; height: 60mm; border: 1px solid #000; padding: 5mm;
                      box-sizing: border-box; display: inline-block; vertical-align: top;
                      text-align: center; position: relative; overflow: hidden; border-radius: 4mm;
                  }
                  h1 { font-size: 14pt; font-weight: bold; margin: 0 0 2mm 0; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  h2 { font-size: 10pt; margin: 0 0 3mm 0; color: #444; border-bottom: 1px solid #eee; padding-bottom: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  .info { text-align: left; font-size: 9pt; }
                  .info p { margin: 1mm 0; display: flex; justify-content: space-between; border-bottom: 0.5px dashed #ddd; }
                  .info strong { font-size: 7pt; color: #666; }
                  .barcode-container { margin-top: 3mm; display: flex; flex-direction: column; align-items: center; }
                  .barcode-svg { max-width: 100%; height: 15mm !important; }
                  .footer { position: absolute; bottom: 2mm; left: 0; right: 0; font-size: 6pt; color: #999; }
                  @media print {
                      body { background: white; }
                      .page-container { width: 100%; margin: 0; display: block; }
                      .label-card { border: 1px solid #000; margin: 0 auto; page-break-inside: avoid; }
                  }
              </style>
          </head>
          <body>
              <div class="page-container">
                  <div class="label-card">
                      <h1>${lot.itemName}</h1>
                      <h2>${lot.supplierName}</h2>
                      <div class="info">
                          <p><strong>LOTE:</strong> <span>${lot.lotNumber}</span></p>
                          <p><strong>VAL:</strong> <span>${lot.expirationDate ? lot.expirationDate.split('-').reverse().join('/') : 'N/A'}</span></p>
                          <p><strong>ENT:</strong> <span>${lot.date ? lot.date.split('-').reverse().join('/') : 'N/A'}</span></p>
                          <p><strong>QTD:</strong> <span>${lot.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span></p>
                          <p><strong>NF:</strong> <span>${lot.invoiceNumber}</span></p>
                          ${lot.receiptTermNumber ? `<p><strong>TERMO:</strong> <span>${lot.receiptTermNumber}</span></p>` : ''}
                      </div>
                      <div class="barcode-container">
                          ${lot.barcode ? `<svg id="barcode" class="barcode-svg"></svg>` : '<p style="font-size: 8pt; color: #ccc; margin-top: 5mm;">SEM CÓDIGO</p>'}
                      </div>
                      <div class="footer">${new Date().toLocaleString('pt-BR')}</div>
                  </div>
              </div>
              <script>
                  window.onload = function() {
                      ${lot.barcode ? `
                          try {
                              JsBarcode("#barcode", "${lot.barcode}", {
                                  format: "CODE128", width: 2, height: 40, displayValue: true, fontSize: 10, margin: 0
                              });
                          } catch (e) { console.error(e); }
                      ` : ''}
                      setTimeout(() => { window.print(); window.close(); }, 1000);
                  }
              </script>
          </body>
          </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  const openLabelModal = (itemName: string) => {
      if (!itemName) return;
      
      const lots: typeof availableLots = [];
      
      suppliers.forEach(supplier => {
          (supplier.deliveries || []).forEach(delivery => {
              if (delivery.item === itemName && delivery.lots) {
                  delivery.lots.forEach(lot => {
                      if ((lot.remainingQuantity || 0) > 0) {
                          lots.push({
                              supplierName: supplier.name,
                              invoiceNumber: delivery.invoiceNumber || 'N/A',
                              lotNumber: lot.lotNumber,
                              expirationDate: lot.expirationDate || delivery.lots?.[0]?.expirationDate || 'N/A',
                              date: delivery.date,
                              quantity: delivery.kg || 0, // Original quantity of the delivery/item
                              remainingQuantity: lot.remainingQuantity,
                              barcode: delivery.barcode,
                              receiptTermNumber: delivery.receiptTermNumber,
                              itemName: itemName
                          });
                      }
                  });
              }
          });
      });

      if (lots.length === 0) {
          alert('Nenhum lote com saldo encontrado para este item.');
          return;
      }

      // Sort by expiration date (earliest first) to encourage FIFO
      lots.sort((a, b) => {
          if (a.expirationDate === 'N/A') return 1;
          if (b.expirationDate === 'N/A') return -1;
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      });

      setAvailableLots(lots);
      setLabelModalOpen(true);
  };

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

  // Agrega todos os pesos unitários cadastrados nos cardápios para a nova aba
  const aggregatedWeights = useMemo(() => {
    const weightsMap = new Map<string, string>();

    // 1. Pega do template padrão
    (Object.values(template).flat() as MenuRow[]).forEach(row => {
      if (row.contractedItem && row.unitWeight) {
        weightsMap.set(row.contractedItem, row.unitWeight);
      }
    });

    // 2. Pega de todos os cardápios diários (sobrescrevendo o template se houver alteração)
    (Object.values(dailyMenus).flat() as MenuRow[]).forEach(row => {
      if (row.contractedItem && row.unitWeight) {
        weightsMap.set(row.contractedItem, row.unitWeight);
      }
    });

    return Array.from(weightsMap.entries())
      .map(([name, weight]) => ({ name, weight }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [template, dailyMenus]);

  // Mapa otimizado para lookup rápido durante o preenchimento automático
  const weightsLookupMap = useMemo(() => {
      const map = new Map<string, string>();
      aggregatedWeights.forEach(w => map.set(w.name, w.weight));
      return map;
  }, [aggregatedWeights]);

  const filteredWeights = useMemo(() => {
    return aggregatedWeights.filter(w => 
      w.name.toLowerCase().includes(weightSearch.toLowerCase())
    );
  }, [aggregatedWeights, weightSearch]);

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

    // LÓGICA DE AUTO-PREENCHIMENTO DO PESO UNITÁRIO
    if (field === 'contractedItem') {
        const suggestedWeight = weightsLookupMap.get(value);
        if (suggestedWeight) {
            newRow.unitWeight = suggestedWeight;
        }
    }

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
            @page { 
                size: A4; 
                margin: 0; 
            }
            @media print {
                header, footer { display: none !important; }
            }
            body { 
                font-family: Arial, sans-serif; 
                padding: 20mm; 
                color: #333; 
                line-height: 1.4; 
                margin: 0;
            }
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
                          <th style="width: 50%;">Item Contratado (p/ Análise)</th>
                          <th style="width: 25%; text-align: right;">Peso/Qtd. Unit.</th>
                          <th style="width: 25%; text-align: right;">Peso/Qtd. Total</th>
                      </tr>
                  </thead>
                  <tbody>
                    ${MEAL_PERIODS.map(period => {
                      if (!groupedMenu[period] || groupedMenu[period].length === 0) return '';
                      return `
                        <tr><td colspan="3" class="period-header">${period}</td></tr>
                        ${groupedMenu[period].map(row => `
                          <tr>
                            <td>${row.contractedItem || row.foodItem || '-'}</td>
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
      
      {/* SELETOR DE ABAS INTERNAS */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-8 w-full md:w-fit">
          <button 
              onClick={() => setActiveSubTab('cardapio')}
              className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'cardapio' ? 'bg-white text-amber-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
          >
              Montagem do Cardápio
          </button>
          <button 
              onClick={() => setActiveSubTab('pesos')}
              className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'pesos' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
          >
              Tabela de Pesos Unitários
          </button>
      </div>

      {activeSubTab === 'cardapio' ? (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 border-b pb-6">
                <div className="flex-1">
                <h2 className="text-3xl font-black text-amber-900 uppercase tracking-tighter leading-tight italic">Cardápio Institucional</h2>
                <p className="text-gray-400 font-medium">Gestão de pesos e itens contratados por data.</p>
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
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-bold"
                        >
                            {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                                <option key={week} value={week}>Semana {week}</option>
                            ))}
                        </select>
                        
                        <div className="mt-4 pt-4 border-t border-indigo-200 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                            {weeklyAnalysisData.length > 0 ? (
                                weeklyAnalysisData.map(data => (
                                    <div key={data.supplierName} className="bg-white p-3 rounded-lg shadow-sm">
                                        <h5 className="font-bold text-sm text-indigo-800 uppercase leading-none mb-1">{data.supplierName}</h5>
                                        <ul className="text-[10px] text-gray-500 mt-1 list-disc list-inside">
                                            {data.items.map(item => <li key={item}>{item}</li>)}
                                        </ul>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-center text-indigo-700/70 italic">
                                    {selectedWeek ? "Nenhum fornecedor programado para esta semana." : "Selecione uma semana."}
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
                                    ✓ Cardápio Salvo
                                </span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-gray-100 text-gray-500 font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="p-3 border text-left w-32">Período</th>
                                        <th className="p-3 border text-left">Item Contratado (p/ Análise)</th>
                                        <th className="p-3 border text-center w-28">Peso/Qtd. Unit.</th>
                                        <th className="p-3 border text-center w-32">Peso/Qtd. Total</th>
                                        <th className="p-3 border text-center w-16">Ações</th>
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
                                                <select
                                                    value={row.contractedItem || ''}
                                                    onChange={(e) => handleInputChange(idx, 'contractedItem', e.target.value)}
                                                    className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-gray-700 font-bold text-xs uppercase"
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
                                                    className="w-full p-2 bg-transparent outline-none focus:bg-white border-none rounded text-center font-mono text-gray-600 font-bold"
                                                />
                                            </td>
                                            <td className="p-1 border bg-gray-50/50">
                                                <input
                                                    type="text"
                                                    value={row.totalWeight}
                                                    readOnly
                                                    placeholder="Calculado"
                                                    className="w-full p-2 bg-transparent outline-none border-none text-center font-mono font-black text-amber-700 cursor-default"
                                                />
                                            </td>
                                            <td className="p-1 border text-center">
                                                <button
                                                    onClick={() => openLabelModal(row.contractedItem || '')}
                                                    disabled={!row.contractedItem}
                                                    className="text-gray-400 hover:text-amber-600 transition-colors p-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Imprimir Etiqueta de Amostra"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            {labelModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[200] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Selecione o Lote</h3>
                                <p className="text-xs text-gray-500">Item: <span className="font-bold text-amber-600">{availableLots[0]?.itemName}</span></p>
                            </div>
                            <button onClick={() => setLabelModalOpen(false)} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
                        </div>
                        
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            {availableLots.map((lot, idx) => (
                                <div key={idx} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:border-amber-400 transition-colors flex justify-between items-center group">
                                    <div>
                                        <p className="font-bold text-gray-800 uppercase text-xs">{lot.supplierName}</p>
                                        <div className="flex gap-4 mt-1 text-[10px] text-gray-500 font-mono">
                                            <span>NF: {lot.invoiceNumber}</span>
                                            <span>Lote: {lot.lotNumber}</span>
                                            <span>Val: {lot.expirationDate.split('-').reverse().join('/')}</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">Saldo: {lot.remainingQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handlePrintLabel(lot)}
                                        className="bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-xl shadow-md active:scale-95 transition-all"
                                        title="Imprimir"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t flex justify-end">
                            <button onClick={() => setLabelModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase hover:bg-gray-300 transition-colors">Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12 pt-8 border-t-2 border-dashed">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight text-center mb-6 uppercase">
                    Análise de Fornecedores Disponíveis (para o dia selecionado)
                </h3>
                {supplierAnalysisForDay.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {supplierAnalysisForDay.map(({ contractedItem, suppliers: foundSuppliers }) => (
                            <div key={contractedItem} className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-shadow hover:shadow-md">
                                <h4 className="font-bold text-gray-800 border-b pb-2 mb-3 truncate uppercase tracking-tighter" title={contractedItem}>{contractedItem}</h4>
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
                                                <div className="flex items-center gap-2 text-gray-800 font-bold uppercase text-xs">
                                                    <svg className="w-3 h-3 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    <span>{s.name}</span>
                                                </div>
                                                <div className="pl-5 flex justify-between items-center">
                                                    <span className="text-[10px] text-gray-400 uppercase font-black">Saldo:</span>
                                                    {s.remainingBalance > 0 ? (
                                                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                                                            {s.remainingBalance.toLocaleString('pt-BR', formattingOptions)} {s.displayUnit}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">
                                                            Saldo Esgotado
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        )})}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-xs text-red-600 font-bold flex items-center gap-2 uppercase">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Sem fornecedor contratado.
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-400 italic py-4">Vincule 'Itens Contratados' nas linhas do cardápio para ver a disponibilidade automática.</p>
                )}
            </div>
        </>
      ) : (
        /* ABA DE PESOS UNITÁRIOS */
        <div className="animate-fade-in-up space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-indigo-900 uppercase tracking-tighter italic">Tabela de Pesos Unitários</h2>
                    <p className="text-gray-400 font-medium">Histórico acumulado de pesos definidos no cardápio padrão e diário.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <input 
                        type="text" 
                        placeholder="Pesquisar item ou peso..." 
                        value={weightSearch}
                        onChange={(e) => setWeightSearch(e.target.value)}
                        className="w-full h-14 border-2 border-indigo-50 bg-gray-50 rounded-2xl px-6 outline-none focus:border-indigo-400 font-black text-indigo-900 transition-all shadow-sm"
                    />
                    <svg className="h-5 w-5 absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWeights.length > 0 ? filteredWeights.map((w, idx) => {
                    const unitString = contractItemUnitMap.get(w.name);
                    const label = getUnitLabel(unitString, w.name);
                    return (
                        <div key={`${w.name}-${idx}`} className="bg-white p-5 rounded-[2rem] border-2 border-gray-100 shadow-sm hover:shadow-md transition-all group flex justify-between items-center">
                            <div className="flex-1 pr-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Item Contratado</p>
                                <h4 className="font-black text-indigo-950 uppercase text-xs leading-tight">{w.name}</h4>
                            </div>
                            <div className="bg-indigo-900 text-white p-4 rounded-2xl flex flex-col items-center justify-center min-w-[80px] shadow-lg group-hover:scale-105 transition-transform">
                                <span className="text-lg font-black leading-none">{w.weight}</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">{label}</span>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-200">
                        <p className="text-gray-400 font-black uppercase tracking-widest italic">Nenhum peso cadastrado no histórico dos cardápios.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default AdminStandardMenu;
