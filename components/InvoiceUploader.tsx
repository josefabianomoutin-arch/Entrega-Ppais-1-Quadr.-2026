import React, { useRef, useMemo, useState } from 'react';
import type { Delivery } from '../types';

interface InvoiceUploaderProps {
  producerName: string;
  pendingInvoices: Delivery[];
  onUpload: (deliveryIds: string[], invoiceNumber: string) => void;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ producerName, pendingInvoices, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Group pending invoices by date for a clearer presentation
  const groupedInvoices = useMemo(() => {
    const groups = new Map<string, Delivery[]>();
    pendingInvoices.forEach(delivery => {
      const group = groups.get(delivery.date) || [];
      group.push(delivery);
      groups.set(delivery.date, group);
    });
    // Sort groups by date for chronological order
    return new Map([...groups.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()));
  }, [pendingInvoices]);

  const handleSelectFileClick = () => {
    if (!invoiceNumber.trim()) {
      alert('Por favor, insira o número da nota fiscal antes de selecionar o arquivo.');
      return;
    }
    fileInputRef.current?.click();
  };
  
  const formatDate = (dateString: string) => {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('pt-BR');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!invoiceNumber.trim()) {
      alert('O número da nota fiscal é obrigatório.');
      return;
    }

    if (file && pendingInvoices.length > 0) {
        const pendingListText = pendingInvoices
            .map(d => `- Item: ${d.item} (Data: ${formatDate(d.date)})`)
            .join('\n');
        
        const subject = `Notas Fiscais Pendentes - ${producerName} (NF: ${invoiceNumber})`;
        const body = `Prezado(a),

Segue em anexo o arquivo PDF com as notas fiscais (Número: ${invoiceNumber}) referentes a todas as entregas pendentes listadas abaixo:

${pendingListText}

Por favor, anexe o arquivo "${file.name}" a este e-mail antes de enviar.

Atenciosamente,
${producerName}`;

        // NOTA: Substitua o e-mail abaixo pelo endereço do destinatário real.
        const mailtoLink = `mailto:destinatario@exemplo.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        window.open(mailtoLink, '_blank');

        const pendingIds = pendingInvoices.map(d => d.id);
        onUpload(pendingIds, invoiceNumber);
        
        setInvoiceNumber('');
    }
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-red-600">Notas Fiscais Pendentes</h2>
      
      <div className="space-y-4 max-h-48 overflow-y-auto mb-4 border-t border-b py-2 pr-2">
        {Array.from(groupedInvoices.entries()).map(([date, deliveries]) => (
          <div key={date}>
            <p className="font-bold text-gray-700 text-sm bg-gray-100 p-2 rounded-t-md">{`Entregas de ${formatDate(date)}`}</p>
            <div className="border-l border-r border-b rounded-b-md p-2 space-y-1">
              {deliveries.map(delivery => (
                <div key={delivery.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{`  - ${delivery.item}`}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="my-4">
        <label htmlFor="invoice-number" className="block text-sm font-medium text-gray-700 mb-1">
          Número da Nota Fiscal
        </label>
        <input 
          type="text"
          id="invoice-number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder="Digite o número da NF"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
        />
      </div>

      <button
        onClick={handleSelectFileClick}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        Enviar PDF Único com NFs
      </button>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="application/pdf" 
      />
    </div>
  );
};

export default InvoiceUploader;