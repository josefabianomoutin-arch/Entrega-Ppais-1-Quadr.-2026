import React from 'react';

interface EmailConfirmationModalProps {
  data: {
    recipient: string;
    cc: string;
    subject: string;
    body: string;
    mailtoLink: string;
  };
  onClose: () => void;
}

const CopyableField: React.FC<{label: string, value: string}> = ({ label, value }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        alert(`'${label}' copiado para a área de transferência!`);
    };
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
            <div className="flex">
                <input type="text" readOnly value={value} className="w-full bg-gray-100 border border-gray-300 rounded-l-md p-2 text-sm font-mono focus:outline-none"/>
                <button onClick={handleCopy} className="bg-gray-200 hover:bg-gray-300 px-3 rounded-r-md border border-l-0 border-gray-300" title={`Copiar ${label}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
            </div>
        </div>
    );
};

const EmailConfirmationModal: React.FC<EmailConfirmationModalProps> = ({ data, onClose }) => {
  const openMailClient = () => {
    window.open(data.mailtoLink, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 md:p-8 animate-fade-in-up">
        
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-100 text-yellow-600 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Ação Manual Necessária</h2>
                <p className="text-gray-500">Confirme o envio da sua Nota Fiscal.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6 text-blue-800">
            <p className="font-bold">Instruções Importantes:</p>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>O seu programa de e-mail padrão será aberto.</li>
                <li>Você <strong>DEVE ANEXAR O ARQUIVO PDF</strong> da nota fiscal.</li>
                <li>Verifique os dados e <strong>CLIQUE EM ENVIAR</strong> no seu programa de e-mail.</li>
            </ul>
        </div>
        
        <div className="space-y-4 text-center">
            <button 
              onClick={openMailClient}
              className="w-full max-w-md bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-transform transform hover:scale-105 text-lg"
            >
              Abrir Programa de E-mail
            </button>
        </div>

        <div className="mt-8 pt-6 border-t">
            <p className="text-center text-sm text-gray-500 mb-4">
              Se o botão acima não funcionar, copie os detalhes abaixo e envie o e-mail manualmente.
            </p>
            <div className="space-y-3">
                <CopyableField label="Para" value={data.recipient} />
                <CopyableField label="CC (Cópia)" value={data.cc} />
                <CopyableField label="Assunto" value={data.subject} />
                <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Corpo do E-mail</label>
                     <textarea readOnly value={data.body} rows={6} className="w-full bg-gray-100 border border-gray-300 rounded-md p-2 text-sm font-mono focus:outline-none"></textarea>
                </div>
            </div>
        </div>
        
        <div className="pt-6 mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
              Fechar
            </button>
        </div>

      </div>
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default EmailConfirmationModal;