
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Supplier, Delivery, ThirdPartyEntryLog, VehicleExitOrder, VehicleAsset, DriverAsset } from '../types';
import AdminVehicleExitOrder from './AdminVehicleExitOrder';
import { Camera, CheckCircle, XCircle, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';

interface SubportariaDashboardProps {
  suppliers: Supplier[];
  thirdPartyEntries: ThirdPartyEntryLog[];
  onUpdateThirdPartyEntry: (log: ThirdPartyEntryLog) => Promise<{ success: boolean; message: string }>;
  onDeleteThirdPartyEntry: (id: string) => Promise<void>;
  onLogout: () => void;
  vehicleExitOrders: VehicleExitOrder[];
  vehicleAssets: VehicleAsset[];
  driverAssets: DriverAsset[];
  onUpdateVehicleExitOrder: (order: VehicleExitOrder) => Promise<{ success: boolean; message: string }>;
}

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
};

const SubportariaDashboard: React.FC<SubportariaDashboardProps> = ({ 
    suppliers, 
    thirdPartyEntries, 
    onUpdateThirdPartyEntry, 
    onDeleteThirdPartyEntry,
    onLogout,
    vehicleExitOrders,
    vehicleAssets,
    driverAssets,
    onUpdateVehicleExitOrder
}) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'agenda' | 'vehicles'>('agenda');

    // Facial Recognition State
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyingLog, setVerifyingLog] = useState<ThirdPartyEntryLog | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
    const [verificationResult, setVerificationResult] = useState<{ match: boolean; confidence: number; reason: string } | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        setCapturedPhoto(null);
        setVerificationStatus('idle');
        setVerificationResult(null);
        setCameraError(null);
        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            } catch (e) {
                console.log("User camera failed, trying default video");
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            setCameraStream(stream);
            setIsCameraActive(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
            setIsCameraActive(false);
        }
    };

    useEffect(() => {
        if (isCameraActive && videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(err => console.error("Video play error:", err));
        }
    }, [isCameraActive, cameraStream]);

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const handleVerify = async () => {
        if (videoRef.current && canvasRef.current && verifyingLog?.photo) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                const photoData = canvasRef.current.toDataURL('image/jpeg');
                setCapturedPhoto(photoData);
                stopCamera();
                
                setVerificationStatus('verifying');
                
                try {
                    // Cache bust: 2026-03-12T08:45:10
                    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
                    const refBase64 = verifyingLog.photo.split(',')[1];
                    const capBase64 = photoData.split(',')[1];

                    const response = await ai.models.generateContent({
                        model: "gemini-3-flash-preview",
                        contents: [
                            {
                                parts: [
                                    { text: "Compare estas duas fotos. Elas são da mesma pessoa? Responda com um objeto JSON: { \"match\": boolean, \"confidence\": number (0-100), \"reason\": string }. Responda em Português." },
                                    { inlineData: { mimeType: "image/jpeg", data: refBase64 } },
                                    { inlineData: { mimeType: "image/jpeg", data: capBase64 } }
                                ]
                            }
                        ],
                        config: {
                            responseMimeType: "application/json"
                        }
                    });

                    const result = JSON.parse(response.text || '{}');
                    setVerificationResult(result);
                    setVerificationStatus(result.match ? 'success' : 'failed');
                } catch (e) {
                    console.error("Error in facial recognition:", e);
                    setVerificationStatus('failed');
                    setVerificationResult({ match: false, confidence: 0, reason: "Erro ao processar biometria facial." });
                }
            }
        }
    };

    const confirmArrival = async () => {
        if (verifyingLog) {
            await handleMarkArrival(verifyingLog, capturedPhoto || undefined);
            setIsVerifying(false);
            setVerifyingLog(null);
            setCapturedPhoto(null);
            setVerificationStatus('idle');
            setVerificationResult(null);
        }
    };

    const dailyAgenda = useMemo(() => {
        const list: { 
            id: string; 
            type: 'FORNECEDOR' | 'TERCEIROS';
            name: string; 
            identifier: string; 
            time: string; 
            arrivalTime?: string; 
            status: string; 
            originalStatus: string;
            vehicle?: string;
            plate?: string;
            rawLog?: ThirdPartyEntryLog;
        }[] = [];
        
        suppliers.forEach(s => {
            (s.deliveries || []).forEach(d => {
                if (d.date === selectedDate) {
                    const isFaturado = d.item !== 'AGENDAMENTO PENDENTE';
                    const existing = list.find(l => l.type === 'FORNECEDOR' && l.name === s.name && l.time === d.time && l.originalStatus === (isFaturado ? 'FATURADO' : 'AGENDADO'));
                    
                    if (!existing) {
                        list.push({
                            id: d.id,
                            type: 'FORNECEDOR',
                            name: s.name,
                            identifier: s.cpf,
                            time: d.time,
                            arrivalTime: d.arrivalTime,
                            status: isFaturado ? '✓ Descarregado' : d.arrivalTime ? '● No Pátio' : '○ Aguardando',
                            originalStatus: isFaturado ? 'FATURADO' : 'AGENDADO'
                        });
                    }
                }
            });
        });

        (thirdPartyEntries || []).forEach(log => {
            if (log.date === selectedDate) {
                list.push({
                    id: log.id,
                    type: 'TERCEIROS',
                    name: log.companyName,
                    identifier: log.companyCnpj,
                    time: log.time || '00:00',
                    arrivalTime: log.arrivalTime,
                    status: log.status === 'concluido' ? '✓ Concluído' : log.arrivalTime ? '● Em Serviço' : '○ Aguardando',
                    originalStatus: log.status,
                    vehicle: log.vehicle,
                    plate: log.plate,
                    rawLog: log
                });
            }
        });

        return list.sort((a, b) => a.time.localeCompare(b.time));
    }, [suppliers, thirdPartyEntries, selectedDate]);

    const handleMarkArrival = async (log: ThirdPartyEntryLog, entryPhoto?: string) => {
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        await onUpdateThirdPartyEntry({ ...log, arrivalTime: now, entryPhoto: entryPhoto || log.entryPhoto });
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-10">
            {/* Header Compacto para Mobile */}
            <header className="bg-indigo-950 text-white p-4 shadow-xl flex justify-between items-center sticky top-0 z-50 border-b border-indigo-800">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">Segurança Externa</h1>
                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Controle de Fluxo</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setActiveTab('agenda')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'agenda' ? 'bg-indigo-600 text-white' : 'text-indigo-300 hover:bg-white/5'}`}
                    >
                        Agenda
                    </button>
                    <button 
                        onClick={() => setActiveTab('vehicles')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'vehicles' ? 'bg-indigo-600 text-white' : 'text-indigo-300 hover:bg-white/5'}`}
                    >
                        Veículos
                    </button>
                    <button onClick={onLogout} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase transition-all border border-red-900/50 ml-2">Sair</button>
                </div>
            </header>

            <main className="p-4 space-y-6 max-w-4xl mx-auto">
                {activeTab === 'agenda' ? (
                    <>
                        {/* Seletor de Data Estilizado */}
                <div className="bg-white p-5 rounded-[2rem] shadow-lg border border-slate-200">
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-xl font-black text-indigo-950 uppercase tracking-tighter italic">Agenda do Dia</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{formatDate(selectedDate)}</p>
                            </div>
                            <div className="bg-indigo-50 px-3 py-1 rounded-full">
                                <span className="text-[10px] font-black text-indigo-600 uppercase">{dailyAgenda.length} Agendamentos</span>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 font-black text-indigo-900 transition-all appearance-none text-center"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista de Cards */}
                <div className="space-y-4">
                    {dailyAgenda.length > 0 ? dailyAgenda.map(item => (
                        <div 
                            key={item.id} 
                            className={`relative overflow-hidden bg-white rounded-[2rem] shadow-md border-2 transition-all active:scale-[0.98] ${
                                item.originalStatus === 'FATURADO' || item.originalStatus === 'concluido'
                                    ? 'border-indigo-100 opacity-80' 
                                    : item.arrivalTime 
                                        ? 'border-green-200 bg-green-50/30' 
                                        : 'border-red-500 bg-red-50'
                            }`}
                        >
                            {/* Faixa lateral de status */}
                            <div className={`absolute top-0 left-0 w-2 h-full ${
                                item.originalStatus === 'FATURADO' || item.originalStatus === 'concluido' ? 'bg-indigo-900' : item.arrivalTime ? 'bg-green-500' : 'bg-red-600'
                            }`} />

                            <div className="p-5 pl-7">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-4 py-2 rounded-xl text-lg font-black font-mono shadow-sm ${
                                        item.originalStatus === 'FATURADO' || item.originalStatus === 'concluido'
                                            ? 'bg-indigo-900 text-white' 
                                            : item.arrivalTime 
                                                ? 'bg-green-600 text-white' 
                                                : 'bg-red-600 text-white shadow-red-100'
                                    }`}>
                                        {item.time}
                                    </div>
                                    
                                    <div className="text-right flex flex-col items-end gap-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                            item.originalStatus === 'FATURADO' || item.originalStatus === 'concluido'
                                                ? 'bg-indigo-100 text-indigo-700' 
                                                : item.arrivalTime 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-red-100 text-red-700'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                        {item.type === 'FORNECEDOR' ? 'Fornecedor' : 'Entrada Terceiros'}
                                    </p>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight break-words leading-tight">{item.name}</h3>
                                    <p className="text-[10px] font-mono text-slate-400 mt-1">{item.identifier}</p>
                                    {item.vehicle && (
                                        <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">
                                            {item.vehicle} {item.plate ? `(${item.plate})` : ''}
                                        </p>
                                    )}
                                </div>

                                {item.arrivalTime ? (
                                    <div className="flex items-center gap-2 bg-white/60 p-3 rounded-2xl border border-green-100">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <p className="text-xs font-bold text-green-700 uppercase">
                                            Entrada registrada às <span className="text-sm font-black">{item.arrivalTime}</span>
                                        </p>
                                    </div>
                                ) : item.type === 'TERCEIROS' && item.originalStatus === 'agendado' && (
                                    <div className="flex flex-col gap-2">
                                        {item.rawLog?.photo ? (
                                            <button 
                                                onClick={() => {
                                                    setVerifyingLog(item.rawLog!);
                                                    setIsVerifying(true);
                                                    startCamera();
                                                }}
                                                className="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                                            >
                                                <Camera className="h-4 w-4" />
                                                Verificar Rosto e Entrar
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMarkArrival(item.rawLog!)}
                                                className="w-full bg-red-600 text-white font-black py-3 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                                            >
                                                Registrar Chegada
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-20 bg-white/50 rounded-[3rem] border-4 border-dashed border-slate-200">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Nenhum agendamento</p>
                            <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase">Para esta data</p>
                        </div>
                    )}
                </div>

                {/* Resumo Rápido no Rodapé */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="bg-green-600 p-5 rounded-[2rem] text-white shadow-lg flex flex-col items-center text-center">
                            <p className="text-[10px] font-black uppercase opacity-60 mb-1">Confirmados</p>
                            <p className="text-3xl font-black">{dailyAgenda.filter(d => d.arrivalTime || d.originalStatus === 'FATURADO' || d.originalStatus === 'concluido').length}</p>
                        </div>
                        <div className="bg-indigo-900 p-5 rounded-[2rem] text-white shadow-lg flex flex-col items-center text-center">
                            <p className="text-[10px] font-black uppercase opacity-60 mb-1">Pendentes</p>
                            <p className="text-3xl font-black">{dailyAgenda.filter(d => !d.arrivalTime && (d.originalStatus === 'AGENDADO' || d.originalStatus === 'agendado')).length}</p>
                        </div>
                    </div>
                    </>
                ) : (
                    <div className="animate-fade-in">
                        <AdminVehicleExitOrder 
                            orders={vehicleExitOrders}
                            vehicleAssets={vehicleAssets}
                            driverAssets={driverAssets}
                            onRegister={() => Promise.resolve({ success: false, message: 'Não permitido' })}
                            onUpdate={onUpdateVehicleExitOrder}
                            onDelete={() => Promise.resolve()}
                            onRegisterVehicleAsset={() => Promise.resolve({ success: false, message: 'Não permitido' })}
                            onUpdateVehicleAsset={() => Promise.resolve({ success: false, message: 'Não permitido' })}
                            onDeleteVehicleAsset={() => Promise.resolve()}
                            onRegisterDriverAsset={() => Promise.resolve({ success: false, message: 'Não permitido' })}
                            onUpdateDriverAsset={() => Promise.resolve({ success: false, message: 'Não permitido' })}
                            onDeleteDriverAsset={() => Promise.resolve()}
                            securityMode={true}
                        />
                    </div>
                )}
            </main>

            {/* Modal de Verificação Facial */}
            {isVerifying && verifyingLog && (
                <div className="fixed inset-0 bg-indigo-950/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-900 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter italic">Verificação Facial</h3>
                                <p className="text-indigo-300 font-bold text-[10px] uppercase tracking-widest mt-1">Comparação de Identidade Biométrica</p>
                            </div>
                            <button 
                                onClick={() => { stopCamera(); setIsVerifying(false); }}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <XCircle className="h-8 w-8" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Foto de Referência */}
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Foto de Cadastro</p>
                                    <div className="aspect-square bg-slate-100 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-inner">
                                        <img src={verifyingLog.photo} alt="Referência" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-indigo-50 p-4 rounded-2xl text-center">
                                        <p className="text-xs font-black text-indigo-900 uppercase">{verifyingLog.companyName}</p>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase mt-1">Documento: {verifyingLog.companyCnpj}</p>
                                    </div>
                                </div>

                                  {/* Câmera ao Vivo / Captura */}
                                  <div className="space-y-4">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Captura ao Vivo</p>
                                      <div className="aspect-square bg-black rounded-[2.5rem] overflow-hidden border-4 border-slate-50 shadow-2xl relative">
                                          {cameraError ? (
                                              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-red-400">
                                                  <AlertTriangle className="h-12 w-12 mb-2" />
                                                  <p className="text-xs font-bold uppercase">{cameraError}</p>
                                              </div>
                                          ) : isCameraActive ? (
                                              <video 
                                                  ref={videoRef} 
                                                  autoPlay 
                                                  playsInline 
                                                  muted
                                                  className="w-full h-full object-cover"
                                              />
                                          ) : capturedPhoto ? (
                                              <img src={capturedPhoto} alt="Capturada" className="w-full h-full object-cover" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                  <Camera className="h-12 w-12 text-slate-700 animate-pulse" />
                                              </div>
                                          )}

                                        {verificationStatus === 'verifying' && (
                                            <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                                <RefreshCw className="h-12 w-12 animate-spin mb-4" />
                                                <p className="text-sm font-black uppercase tracking-widest">Analisando Biometria...</p>
                                            </div>
                                        )}

                                        {verificationStatus === 'success' && (
                                            <div className="absolute inset-0 bg-green-500/80 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
                                                <CheckCircle className="h-20 w-20 mb-4" />
                                                <p className="text-xl font-black uppercase tracking-widest">Identidade Confirmada</p>
                                                <p className="text-[10px] font-bold uppercase mt-2">Compatibilidade: {verificationResult?.confidence}%</p>
                                            </div>
                                        )}

                                        {verificationStatus === 'failed' && (
                                            <div className="absolute inset-0 bg-red-600/80 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in p-6 text-center">
                                                <AlertTriangle className="h-20 w-20 mb-4" />
                                                <p className="text-xl font-black uppercase tracking-widest">Falha na Identificação</p>
                                                <p className="text-[10px] font-bold uppercase mt-2">{verificationResult?.reason || 'As fotos não correspondem.'}</p>
                                            </div>
                                        )}
                                    </div>

                                    {isCameraActive && (
                                        <button 
                                            onClick={handleVerify}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Camera className="h-5 w-5" />
                                            Capturar e Verificar
                                        </button>
                                    )}

                                    {!isCameraActive && verificationStatus === 'idle' && (
                                        <button 
                                            onClick={startCamera}
                                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="h-5 w-5" />
                                            Reiniciar Câmera
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button 
                                onClick={() => { stopCamera(); setIsVerifying(false); }}
                                className="flex-1 bg-white border-2 border-slate-200 text-slate-400 font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmArrival}
                                disabled={verificationStatus !== 'success'}
                                className="flex-[2] bg-indigo-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl hover:bg-indigo-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <UserCheck className="h-5 w-5" />
                                Confirmar Entrada
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas oculto para captura de foto */}
            <canvas ref={canvasRef} className="hidden" />

            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                /* Remover ícone padrão do input date para mobile cleaner look */
                input[type="date"]::-webkit-inner-spin-button,
                input[type="date"]::-webkit-calendar-picker-indicator {
                    opacity: 0;
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    left: 0;
                    top: 0;
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
};

export default SubportariaDashboard;
