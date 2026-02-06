
import React, { useMemo } from 'react';
import type { Delivery } from '../types';
import { MONTHS_2026, WEEK_DAYS } from '../constants';

interface CalendarProps {
  onDayClick: (date: Date) => void;
  deliveries: Delivery[];
  simulatedToday: Date;
  allowedWeeks: number[];
}

const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const Calendar: React.FC<CalendarProps> = ({ onDayClick, deliveries, simulatedToday, allowedWeeks }) => {

  const deliveriesByDate = useMemo(() => {
    const map = new Map<string, Delivery[]>();
    deliveries.forEach(delivery => {
      const existing = map.get(delivery.date) || [];
      map.set(delivery.date, [...existing, delivery]);
    });
    return map;
  }, [deliveries]);

  const generateMonthGrid = (month: number, year: number) => {
    const date = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = date.getDay();
    
    const grid = [];
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(<div key={`blank-${i}`} className="border-r border-b border-gray-200"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dateString = currentDate.toISOString().split('T')[0];
      const deliveriesOnThisDate = deliveriesByDate.get(dateString);
      
      const weekNumber = getWeekNumber(currentDate);
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isWeekAllowed = !allowedWeeks || allowedWeeks.length === 0 || allowedWeeks.includes(weekNumber);
      const isClickable = isWeekAllowed && !isWeekend;
      
      let dayClasses = "p-2 text-center border-r border-b border-gray-200 h-20 flex flex-col justify-center items-center relative";

      if (!isClickable) {
        dayClasses += " bg-gray-100 text-gray-400 cursor-not-allowed";
      } else {
        dayClasses += " cursor-pointer transition-colors";
        const isPast = currentDate < simulatedToday;
        const hasDeliveries = deliveriesOnThisDate && deliveriesOnThisDate.length > 0;
        
        // Regra de cor priorizada:
        // 1. Se tem entregas no passado e alguma NÃO foi faturada -> VERMELHO
        // 2. Se tem entregas e TODAS foram faturadas (independente de ser passado ou futuro) -> VERDE
        // 3. Se tem entregas no futuro/presente e estão pendentes -> VERDE CLARO (Agendado)
        // 4. Se não tem nada -> PADRÃO
        
        const needsInvoice = hasDeliveries && isPast && deliveriesOnThisDate.some(d => !d.invoiceUploaded);
        const allFulfilled = hasDeliveries && deliveriesOnThisDate.every(d => d.invoiceUploaded);

        if (needsInvoice) {
          dayClasses += " bg-red-500 hover:bg-red-600 text-white font-bold";
        } else if (allFulfilled) {
          dayClasses += " bg-green-500 hover:bg-green-600 text-white font-bold";
        } else if (hasDeliveries) {
          dayClasses += " bg-green-200 hover:bg-green-300 text-green-900 font-bold";
        } else {
          dayClasses += " hover:bg-blue-100";
        }
      }

      grid.push(
        <div key={day} className={dayClasses} onClick={() => isClickable && onDayClick(currentDate)}>
          <span className="text-sm md:text-base">{day}</span>
          {isClickable && deliveriesOnThisDate && deliveriesOnThisDate.length > 0 && (
            <span className="text-xs mt-1 px-1 rounded bg-black bg-opacity-10 truncate">
              {deliveriesOnThisDate.some(d => d.invoiceUploaded) ? 'Faturado' : 'Entrega'}
            </span>
          )}
          {isClickable && deliveriesOnThisDate && deliveriesOnThisDate.length > 0 && deliveriesOnThisDate.some(d => !d.invoiceUploaded) && currentDate < simulatedToday && (
            <span className="absolute bottom-1 right-1 text-xs text-white font-semibold animate-pulse">NF!</span>
          )}
        </div>
      );
    }
    return grid;
  };

  return (
    <div className="space-y-8">
      {MONTHS_2026.map(month => (
        <div key={month.name}>
          <h3 className="text-xl font-semibold text-center mb-3 text-gray-600">{month.name} 2026</h3>
          <div className="grid grid-cols-7 border-t border-l border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm">
            {WEEK_DAYS.map(day => (
              <div key={day} className="p-2 text-center font-medium text-xs text-gray-500 bg-gray-50 border-r border-b border-gray-200">
                {day}
              </div>
            ))}
            {generateMonthGrid(month.number, 2026)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Calendar;
