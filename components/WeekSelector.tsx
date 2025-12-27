import React from 'react';
import { MONTHS_2026, WEEK_DAYS } from '../constants';

interface WeekSelectorProps {
    selectedWeeks: number[];
    onWeekToggle: (weekNumber: number) => void;
}

const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const WeekSelector: React.FC<WeekSelectorProps> = ({ selectedWeeks, onWeekToggle }) => {

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
            const weekNumber = getWeekNumber(currentDate);
            const isSelected = selectedWeeks.includes(weekNumber);

            const dayClasses = `p-1 text-center border-r border-b border-gray-200 cursor-pointer transition-colors text-xs ${
                isSelected ? 'bg-blue-500 text-white font-bold' : 'hover:bg-blue-100'
            }`;

            grid.push(
                <div key={day} className={dayClasses} onClick={() => onWeekToggle(weekNumber)}>
                    {day}
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="space-y-4 p-2 border rounded-md bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MONTHS_2026.map(month => (
                    <div key={month.name}>
                        <h4 className="text-sm font-semibold text-center mb-2 text-gray-600">{month.name}</h4>
                        <div className="grid grid-cols-7 border-t border-l border-gray-200 bg-white shadow-sm">
                            {WEEK_DAYS.map(day => (
                                <div key={day} className="p-1 text-center font-medium text-[10px] text-gray-500 bg-gray-50 border-r border-b border-gray-200">
                                    {day}
                                </div>
                            ))}
                            {generateMonthGrid(month.number, 2026)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WeekSelector;
