
import React, { useState, useMemo } from 'react';
import type { StandardMenu, DailyMenus, MenuRow } from '../types';
import { Calendar, Printer, Clock, Utensils, ChevronRight, ChevronLeft } from 'lucide-react';

interface MenuDashboardProps {
  standardMenu: StandardMenu;
  dailyMenus: DailyMenus;
  onLogout: () => void;
}

const WEEK_DAYS_BR = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const MEAL_PERIODS = ['CAFÉ DA MANHÃ', 'ALMOÇO', 'JANTA', 'LANCHE NOITE'];

const MenuDashboard: React.FC<MenuDashboardProps> = ({ standardMenu, dailyMenus, onLogout }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const currentMenu = useMemo(() => {
    if (dailyMenus[selectedDate]) {
      return dailyMenus[selectedDate];
    }
    const dateObj = new Date(selectedDate + 'T12:00:00');
    const dayName = WEEK_DAYS_BR[dateObj.getDay()];
    return standardMenu[dayName] || [];
  }, [selectedDate, dailyMenus, standardMenu]);

  const groupedMenu = useMemo(() => {
    return currentMenu.reduce((acc, row) => {
      const period = row.period || 'OUTROS';
      if (!acc[period]) acc[period] = [];
      acc[period].push(row);
      return acc;
    }, {} as Record<string, MenuRow[]>);
  }, [currentMenu]);

  const handlePrintLabel = (row: MenuRow, period: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    const htmlContent = `
      <html>
        <head>
          <title>Etiqueta Amostra 72h</title>
          <style>
            @page { size: 100mm 60mm; margin: 0; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 5mm; box-sizing: border-box; }
            .label-container {
              width: 90mm;
              height: 50mm;
              border: 2px solid #000;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border-radius: 2mm;
            }
            .header {
              text-align: center;
              font-weight: bold;
              font-size: 14pt;
              border-bottom: 1px solid #000;
              padding-bottom: 1mm;
              margin-bottom: 2mm;
              text-transform: uppercase;
            }
            .content {
              font-size: 10pt;
              line-height: 1.4;
            }
            .field { margin-bottom: 1mm; }
            .field strong { text-transform: uppercase; font-size: 8pt; color: #555; }
            .footer {
              font-size: 8pt;
              text-align: center;
              border-top: 1px dashed #000;
              padding-top: 1mm;
              margin-top: 2mm;
              font-weight: bold;
            }
            .signature {
              margin-top: 4mm;
              border-top: 1px solid #000;
              width: 60%;
              margin-left: auto;
              margin-right: auto;
              text-align: center;
              font-size: 7pt;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="header">AMOSTRA 72 HORAS</div>
            <div class="content">
              <div class="field"><strong>PREPARAÇÃO:</strong> ${row.foodItem || row.contractedItem || 'N/A'}</div>
              <div class="field"><strong>REFEIÇÃO:</strong> ${period}</div>
              <div class="field"><strong>DATA COLETA:</strong> ${dateFormatted}</div>
              <div class="field"><strong>HORA COLETA:</strong> ____:____</div>
              <div class="field"><strong>ARMAZENAMENTO:</strong> REFRIGERADO (0°C a 4°C)</div>
            </div>
            <div class="signature">ASSINATURA DO RESPONSÁVEL</div>
            <div class="footer">VALIDADE: 72 HORAS APÓS A COLETA</div>
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

  const handlePrintAllLabels = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (!printWindow) return;

    const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    const labelsHtml = currentMenu
      .filter(row => row.foodItem || row.contractedItem)
      .map(row => `
        <div class="label-container">
          <div class="header">AMOSTRA 72 HORAS</div>
          <div class="content">
            <div class="field"><strong>PREPARAÇÃO:</strong> ${row.foodItem || row.contractedItem || 'N/A'}</div>
            <div class="field"><strong>REFEIÇÃO:</strong> ${row.period || 'N/A'}</div>
            <div class="field"><strong>DATA COLETA:</strong> ${dateFormatted}</div>
            <div class="field"><strong>HORA COLETA:</strong> ____:____</div>
            <div class="field"><strong>ARMAZENAMENTO:</strong> REFRIGERADO (0°C a 4°C)</div>
          </div>
          <div class="signature">ASSINATURA DO RESPONSÁVEL</div>
          <div class="footer">VALIDADE: 72 HORAS APÓS A COLETA</div>
        </div>
      `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Etiquetas Amostra 72h - Dia Completo</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5mm; justify-content: center; }
            .label-container {
              width: 90mm;
              height: 55mm;
              border: 1.5px solid #000;
              padding: 3mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border-radius: 2mm;
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              font-weight: bold;
              font-size: 12pt;
              border-bottom: 1px solid #000;
              padding-bottom: 1mm;
              margin-bottom: 2mm;
              text-transform: uppercase;
            }
            .content {
              font-size: 9pt;
              line-height: 1.3;
            }
            .field { margin-bottom: 1mm; }
            .field strong { text-transform: uppercase; font-size: 7pt; color: #555; }
            .footer {
              font-size: 7pt;
              text-align: center;
              border-top: 1px dashed #000;
              padding-top: 1mm;
              margin-top: 1mm;
              font-weight: bold;
            }
            .signature {
              margin-top: 3mm;
              border-top: 1px solid #000;
              width: 60%;
              margin-left: auto;
              margin-right: auto;
              text-align: center;
              font-size: 6pt;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
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
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
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

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8">
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
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-6 py-4 bg-slate-50 border-2 border-indigo-50 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
            />
            <button 
              onClick={handlePrintAllLabels}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
              <Printer className="h-5 w-5" />
              Imprimir Todas Etiquetas
            </button>
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
                    <div key={idx} className="group bg-slate-50 hover:bg-indigo-50/50 p-4 rounded-2xl border border-slate-100 transition-all flex justify-between items-center gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 uppercase text-sm leading-tight">
                          {row.foodItem || row.contractedItem || 'Item não especificado'}
                        </p>
                        {row.preparationDetails && (
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">{row.preparationDetails}</p>
                        )}
                      </div>
                      <button 
                        onClick={() => handlePrintLabel(row, period)}
                        className="bg-white group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white p-3 rounded-xl shadow-sm border border-indigo-50 transition-all active:scale-90"
                        title="Imprimir Etiqueta de Amostra"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
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

      <footer className="p-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
        Sistema de Gestão Institucional &copy; 2026 - Penitenciária de Taiúva
      </footer>
    </div>
  );
};

export default MenuDashboard;
