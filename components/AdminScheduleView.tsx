import React, { useState, useMemo } from 'react';
import type { Producer } from '../types';

interface AdminScheduleViewProps {
  producers: Producer[];
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Ensure correct timezone handling
    return date.toLocaleDateString('pt-BR');
};

const AdminScheduleView: React.FC<AdminScheduleViewProps> = ({ producers }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducers = useMemo(() => {
        return producers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [producers, searchTerm]);
    
    // Sort producers alphabetically for consistent order
    const sortedProducers = useMemo(() => {
        return [...filteredProducers].sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredProducers]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-7xl mx-auto border-t-8 border-purple-600 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <div>
                    <h2 className="text-3xl font-black text-purple-900 uppercase tracking-tighter">Agenda de Entregas</h2>
                    <p className="text-gray-400 font-medium">Visualize as semanas e os agendamentos de cada produtor.</p>
                </div>
                <input
                    type="text"
                    placeholder="Pesquisar produtor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                />
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
                {sortedProducers.length > 0 ? sortedProducers.map(producer => {
                    // FIX: Explicitly typing the Set with <string> ensures that `scheduledDates` is correctly inferred
                    // as a string array, resolving downstream type errors with `new Date()` and `formatDate`.
                    const scheduledDates = [...new Set<string>(producer.deliveries.map(d => d.date))]
                        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

                    return (
                        <div key={producer.cpf} className="p-5 border rounded-xl bg-gray-50/50 hover:bg-white transition-shadow hover:shadow-md">
                            <h3 className="font-bold text-lg text-gray-800 mb-4">{producer.name}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-4 rounded-lg border">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Semanas Disponibilizadas</h4>
                                    {producer.allowedWeeks && producer.allowedWeeks.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {producer.allowedWeeks.sort((a, b) => a - b).map(week => (
                                                <span key={week} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                                                    Semana {week}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Nenhuma restrição de semana.</p>
                                    )}
                                </div>
                                <div className="bg-white p-4 rounded-lg border">
                                    <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Agendamentos Confirmados</h4>
                                    {scheduledDates.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {scheduledDates.map(date => (
                                                <span key={date} className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full font-mono">
                                                    {formatDate(date)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Nenhum agendamento realizado.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-20">
                        <p className="text-gray-400 italic">Nenhum produtor encontrado.</p>
                    </div>
                )}
            </div>
             <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 8px; } 
                .custom-scrollbar::-webkit-scrollbar-track { background: #F9FAFB; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; border: 2px solid #F9FAFB; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a78bfa; }
             `}</style>
        </div>
    );
};

export default AdminScheduleView;