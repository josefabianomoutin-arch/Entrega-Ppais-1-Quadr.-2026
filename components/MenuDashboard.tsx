
import React, { useState, useMemo } from 'react';
import type { StandardMenu, DailyMenus, MenuRow, Supplier } from '../types';
import { Calendar, Printer, Clock, Utensils, ChevronRight, ChevronLeft, CheckSquare, Square } from 'lucide-react';

interface MenuDashboardProps {
  standardMenu: StandardMenu;
  dailyMenus: DailyMenus;
  suppliers: Supplier[];
  onLogout: () => void;
  embedded?: boolean;
}

const WEEK_DAYS_BR = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MEAL_PERIODS = ['CAFÉ DA MANHÃ', 'ALMOÇO', 'JANTA', 'LANCHE NOITE'];

const MenuDashboard: React.FC<MenuDashboardProps> = ({ standardMenu, dailyMenus, suppliers, onLogout, embedded }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const currentMenu = useMemo(() => {
    let rows: MenuRow[] = [];
    if (dailyMenus[selectedDate]) {
      rows = dailyMenus[selectedDate];
    } else {
      const dateObj = new Date(selectedDate + 'T12:00:00');
      const dayName = WEEK_DAYS_BR[dateObj.getDay()];
      rows = standardMenu[dayName] || [];
    }
    return rows.map((r, idx) => ({ ...r, id: r.id || `${selectedDate}-${idx}` }));
  }, [selectedDate, dailyMenus, standardMenu]);

  const groupedMenu = useMemo(() => {
    return currentMenu.reduce((acc, row) => {
      const period = row.period || 'OUTROS';
      if (!acc[period]) acc[period] = [];
      acc[period].push(row);
      return acc;
    }, {} as Record<string, MenuRow[]>);
  }, [currentMenu]);

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === currentMenu.filter(r => r.foodItem || r.contractedItem).length) {
      setSelectedRows(new Set());
    } else {
      const allIds = currentMenu
        .filter(r => r.foodItem || r.contractedItem)
        .map(r => r.id);
      setSelectedRows(new Set(allIds));
    }
  };

  const findLotInfo = (contractedItemName: string) => {
    if (!contractedItemName) return { lot: 'N/A', invoice: 'N/A' };
    
    // Find the most recent delivery for this item
    let latestDelivery = null;
    let latestDate = 0;

    suppliers.forEach(s => {
      (s.deliveries || []).forEach(d => {
        if (d.item === contractedItemName && d.invoiceNumber) {
          const dDate = new Date(d.date).getTime();
          if (dDate > latestDate) {
            latestDate = dDate;
            latestDelivery = d;
          }
        }
      });
    });

    if (latestDelivery) {
      const lotNum = (latestDelivery as any).lots?.[0]?.lotNumber || 'N/A';
      return { lot: lotNum, invoice: (latestDelivery as any).invoiceNumber || 'N/A' };
    }

    return { lot: 'N/A', invoice: 'N/A' };
  };

  const handlePrintSelected = () => {
    const rowsToPrint = currentMenu.filter(r => selectedRows.has(r.id));
    if (rowsToPrint.length === 0) {
      alert('Selecione ao menos um item para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (!printWindow) return;

    const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    const labelsHtml = rowsToPrint.map(row => {
      const { lot, invoice } = findLotInfo(row.contractedItem || '');
      return `
        <div class="label-card">
          <div class="label-header">AMOSTRA 72 HORAS</div>
          <div class="label-content">
            <div class="label-field"><strong>PREPARAÇÃO:</strong> <span>${row.foodItem || row.contractedItem || 'N/A'}</span></div>
            <div class="label-field"><strong>REFEIÇÃO:</strong> <span>${row.period || 'N/A'}</span></div>
            <div class="label-field"><strong>LOTE:</strong> <span>${lot}</span></div>
            <div class="label-field"><strong>NF:</strong> <span>${invoice}</span></div>
            <div class="label-field"><strong>DATA COLETA:</strong> <span>${dateFormatted}</span></div>
            <div class="label-field"><strong>HORA COLETA:</strong> <span>____:____</span></div>
            <div class="label-field"><strong>ARMAZENAMENTO:</strong> <span>REFRIGERADO (0°C a 4°C)</span></div>
          </div>
          <div class="label-signature">ASSINATURA DO RESPONSÁVEL</div>
          <div class="label-footer">VALIDADE: 72 HORAS APÓS A COLETA</div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Etiquetas Amostra 72h - Selecionadas</title>
          <style>
            @page { 
              size: A4; 
              margin: 0; 
            }
            body { 
              margin: 0; 
              padding: 0; 
              background: white;
            }
            .sheet {
              width: 210mm;
              height: 297mm;
              padding: 20mm 17mm;
              box-sizing: border-box;
              display: grid;
              grid-template-columns: 85.73mm 85.73mm;
              grid-auto-rows: 59.27mm;
              column-gap: 10mm;
              row-gap: 0;
              justify-content: center;
              page-break-after: always;
            }
            .label-card {
              width: 85.73mm;
              height: 59.27mm;
              border: 1px solid #000;
              padding: 3mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border-radius: 1mm;
              overflow: hidden;
            }
            .label-header {
              text-align: center;
              font-weight: bold;
              font-size: 11pt;
              border-bottom: 1px solid #000;
              padding-bottom: 1mm;
              margin-bottom: 1.5mm;
              text-transform: uppercase;
            }
            .label-content {
              font-size: 8pt;
              line-height: 1.2;
              flex: 1;
            }
            .label-field { 
              margin-bottom: 0.5mm; 
              display: flex;
              gap: 1mm;
            }
            .label-field strong { 
              text-transform: uppercase; 
              font-size: 7pt; 
              color: #333; 
              white-space: nowrap;
            }
            .label-field span {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .label-footer {
              font-size: 7pt;
              text-align: center;
              border-top: 1px dashed #000;
              padding-top: 1mm;
              margin-top: 1mm;
              font-weight: bold;
            }
            .label-signature {
              margin-top: 1.5mm;
              border-top: 0.5px solid #000;
              width: 70%;
              margin-left: auto;
              margin-right: auto;
              text-align: center;
              font-size: 6pt;
            }
            @media print {
              .sheet { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${labelsHtml}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const changeDate = (days: number) => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
    setSelectedRows(new Set());
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-slate-50 flex flex-col`}>
      {/* Header */}
      {!embedded && (
        <header className="bg-indigo-900 text-white p-6 shadow-xl flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <Utensils className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter italic">Painel Cardápio</h1>
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Gestão de Amostras e Alinhamento</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all border border-red-500/20"
          >
            Sair
          </button>
        </header>
      )}

      <main className={`flex-1 p-4 md:p-8 ${embedded ? 'max-w-full' : 'max-w-6xl'} mx-auto w-full space-y-8`}>
        {/* Date Selector */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-indigo-50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => changeDate(-1)}
              className="p-3 hover:bg-indigo-50 rounded-2xl text-indigo-600 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Data de Referência</span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
            </div>
            <button 
              onClick={() => changeDate(1)}
              className="p-3 hover:bg-indigo-50 rounded-2xl text-indigo-600 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedRows(new Set());
              }}
              className="px-6 py-4 bg-slate-50 border-2 border-indigo-50 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
            <div className="flex gap-2">
              <button 
                onClick={toggleAllSelection}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all active:scale-95 uppercase text-[10px] tracking-widest"
              >
                {selectedRows.size === currentMenu.filter(r => r.foodItem || r.contractedItem).length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selectedRows.size === currentMenu.filter(r => r.foodItem || r.contractedItem).length ? 'Desmarcar Todos' : 'Marcar Todos'}
              </button>
              <button 
                onClick={handlePrintSelected}
                disabled={selectedRows.size === 0}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 uppercase text-xs tracking-widest disabled:bg-slate-300 disabled:shadow-none"
              >
                <Printer className="h-5 w-5" />
                Imprimir Selecionadas ({selectedRows.size})
              </button>
            </div>
          </div>
        </div>

        {/* Menu Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {MEAL_PERIODS.map(period => (
            <div key={period} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col">
              <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-xl">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">{period}</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-3 py-1 rounded-full uppercase">
                  {groupedMenu[period]?.length || 0} Itens
                </span>
              </div>
              
              <div className="p-6 flex-1 space-y-4">
                {groupedMenu[period] && groupedMenu[period].length > 0 ? (
                  groupedMenu[period].map((row, idx) => (
                    <div 
                      key={row.id} 
                      onClick={() => toggleRowSelection(row.id)}
                      className={`group cursor-pointer p-4 rounded-2xl border-2 transition-all flex justify-between items-center gap-4 ${selectedRows.has(row.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:bg-indigo-50/50'}`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`transition-colors ${selectedRows.has(row.id) ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {selectedRows.has(row.id) ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold uppercase text-sm leading-tight transition-colors ${selectedRows.has(row.id) ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {row.foodItem || row.contractedItem || 'Item não especificado'}
                          </p>
                          {row.preparationDetails && (
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">{row.preparationDetails}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-[9px] font-mono text-slate-400">
                        <span>LOT: {findLotInfo(row.contractedItem || '').lot}</span>
                        <span>NF: {findLotInfo(row.contractedItem || '').invoice}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl">
                    <Utensils className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">Sem itens lançados</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 text-amber-900 space-y-4">
          <h4 className="font-black uppercase tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Instruções para Coleta de Amostras
          </h4>
          <ul className="text-sm space-y-2 font-medium opacity-80 list-disc list-inside">
            <li>Coletar amostras de todos os itens servidos em cada refeição.</li>
            <li>Utilizar sacos plásticos estéreis ou recipientes higienizados.</li>
            <li>Identificar cada amostra com a etiqueta correspondente.</li>
            <li>Armazenar sob refrigeração (0°C a 4°C) por um período de 72 horas.</li>
            <li>O descarte deve ser realizado após o prazo de segurança.</li>
          </ul>
        </div>
      </main>

      {!embedded && (
        <footer className="p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          Sistema de Gestão Institucional &copy; 2026 - Penitenciária de Taiúva
        </footer>
      )}
    </div>
  );
};

export default MenuDashboard;
