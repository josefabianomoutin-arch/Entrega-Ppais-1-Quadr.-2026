import React, { useState, useRef } from 'react';
import type { Delivery } from '../types';
import { speechService } from '../src/services/speechService';
import { Volume2, Upload, FileText, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { storage } from '../firebaseConfig';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface SendInvoiceModalProps {
  invoiceInfo: { date: string; deliveries: Delivery[] };
  onClose: () => void;
  onSave: (invoiceNumber: string, invoiceUrl: string) => Promise<void>;
}

const SendInvoiceModal: React.FC<SendInvoiceModalProps> = ({ invoiceInfo, onClose, onSave }) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlayGuide = async () => {
    const text = "Bem-vindo ao envio da nota fiscal. Digite o número da nota fiscal, selecione o arquivo PDF e clique em Enviar PDF.";
    await speechService.speak(text);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const formattedDate = new Date(invoiceInfo.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const isFormValid = invoiceNumber.trim().length > 0 && selectedFile !== null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid || !selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const sanitizedDate = invoiceInfo.date.replace(/-/g, '');
      const newFileName = `NF_${invoiceNumber}_${sanitizedDate}_${Date.now()}.pdf`;
      const storageRef = ref(storage, `invoices/${newFileName}`);

      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error("Upload error:", error);
          setUploadError("Erro ao enviar o arquivo. Tente novamente.");
          setIsUploading(false);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await onSave(invoiceNumber, downloadURL);
          setIsUploading(false);
          setIsSaved(true);
        }
      );
    } catch (error) {
      console.error("Error starting upload:", error);
      setUploadError("Erro ao iniciar o envio.");
      setIsUploading(false);
    }
  };

  if (isSaved) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] p-2 md:p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col animate-fade-in-up border border-gray-100 overflow-hidden p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Enviado com Sucesso!</h2>
            <p className="text-sm text-gray-500 mt-2">
              A nota fiscal foi enviada e salva no sistema para o administrador.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl uppercase tracking-widest text-sm active:scale-95 flex items-center justify-center gap-2"
          >
            Concluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[100] p-2 md:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col animate-fade-in-up border border-gray-100 overflow-hidden">
        
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter italic leading-none">Enviar NF</h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Fornecedor</p>
            </div>
            <button 
              type="button" 
              onClick={handlePlayGuide}
              className="bg-indigo-100 text-indigo-600 p-1.5 rounded-full hover:bg-indigo-200 transition-colors"
              title="Ouvir Guia"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
          <button onClick={onClose} disabled={isUploading} className="text-gray-400 hover:text-gray-900 transition-colors p-1.5 bg-gray-50 rounded-full disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form className="flex flex-col overflow-hidden" onSubmit={handleSave}>
            <div className="p-4 md:p-6 space-y-4">
                <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-start gap-2">
                    <div className="bg-orange-500 text-white p-1.5 rounded-lg flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <p className="text-[9px] text-orange-800 font-black uppercase tracking-tight">Data da Entrega</p>
                        <p className="text-sm font-bold text-orange-950">{formattedDate}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="invoice-number" className="text-[10px] font-black text-gray-400 uppercase ml-1">Nº da Nota Fiscal (NF)</label>
                        <input type="text" id="invoice-number" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required placeholder="Ex: 001234" disabled={isUploading} className="w-full h-14 px-4 border-2 border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-800 disabled:opacity-50"/>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Arquivo da Nota (PDF) - OBRIGATÓRIO</label>
                        <div 
                          onClick={() => !isUploading && fileInputRef.current?.click()}
                          className={`w-full h-14 px-4 border-2 border-dashed rounded-2xl flex items-center justify-between gap-2 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${selectedFile ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-indigo-300 hover:bg-indigo-50'}`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            {selectedFile ? (
                              <>
                                <FileText className="h-5 w-5 flex-shrink-0" />
                                <span className="text-xs font-bold truncate">{selectedFile.name}</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-5 w-5 flex-shrink-0" />
                                <span className="text-xs font-bold">Selecionar PDF</span>
                              </>
                            )}
                          </div>
                          {selectedFile && !isUploading && (
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                              className="p-2 hover:bg-green-100 rounded-full transition-colors text-green-600"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          accept="application/pdf" 
                          className="hidden" 
                          disabled={isUploading}
                          required
                        />
                    </div>
                </div>
                
                {uploadError && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-medium">
                    {uploadError}
                  </div>
                )}
                
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span>Enviando...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
            </div>

            <div className="p-6 md:p-8 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 flex-shrink-0 pb-[max(24px,env(safe-area-inset-bottom))]">
                <button type="button" onClick={onClose} disabled={isUploading} className="flex-1 bg-gray-50 text-gray-400 font-black h-16 rounded-2xl uppercase text-[10px] tracking-widest hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50">Cancelar</button>
                <button 
                    type="submit" 
                    disabled={!isFormValid || isUploading}
                    className={`flex-[2] flex items-center justify-center gap-2 font-black h-16 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs text-white ${isFormValid && !isUploading ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-200 cursor-not-allowed text-gray-400'}`}
                >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Enviar PDF
                      </>
                    )}
                </button>
            </div>
        </form>
      </div>
       <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default SendInvoiceModal;
