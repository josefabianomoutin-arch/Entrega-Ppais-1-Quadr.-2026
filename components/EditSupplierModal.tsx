import React, { useState } from 'react';
import type { Supplier } from '../types';

interface EditSupplierModalProps {
  supplier: Supplier;
  suppliers: Supplier[]; // For validation
  onClose: () => void;
  onSave: (oldCpf: string, newName: string, newCpf: string) => Promise<string | null>;
}

const EditSupplierModal: React.FC<EditSupplierModalProps> = ({ supplier, suppliers, onClose, onSave }) => {
  const [name, setName] = useState(supplier.name);
  const [cpf, setCpf] = useState(supplier.cpf);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = name !== supplier.name || cpf !== supplier.cpf;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalName = name.trim().toUpperCase();
    const finalCpf = cpf.trim().replace(/[^\d]/g, '');

    // Validação básica
    if (!finalName || !finalCpf) {
      setError('Nome e CPF/CNPJ não podem estar vazios.');
      return;
    }
    if (finalCpf.length !== 11 && finalCpf.length !== 14) {
        setError('O CPF/CNPJ deve conter 11 ou 14 dígitos.');
        return;
    }

    // Validação de duplicidade (pré-checagem no cliente)
    if (suppliers.some(s => s.cpf === finalCpf && s.cpf !== supplier.cpf)) {
      setError('Este CPF/CNPJ já está cadastrado para outro fornecedor.');
      return;
    }
    if (suppliers.some(s => s.name === finalName && s.cpf !== supplier.cpf)) {
      setError('Este nome de fornecedor já está em uso.');
      return;
    }

    setIsSaving(true);
    const saveError = await onSave(supplier.cpf, finalName, finalCpf);
    setIsSaving(false);

    if (saveError) {
      setError(saveError);
    }
    // Em caso de sucesso, o componente pai fechará o modal
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Editar Fornecedor</h2>
            <p className="text-sm text-gray-500">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl font-light">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">Nome do Fornecedor</label>
            <input 
              id="edit-name"
              type="text"
              value={name} 
              onChange={(e) => setName(e.target.value.toUpperCase())} 
              required 
              placeholder="NOME DO FORNECEDOR" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-cpf" className="block text-sm font-medium text-gray-700">CPF/CNPJ (Senha)</label>
            <input 
              id="edit-cpf"
              type="text"
              value={cpf} 
              onChange={(e) => setCpf(e.target.value.replace(/[^\d]/g, ''))}
              maxLength={14}
              required 
              placeholder="CPF/CNPJ (APENAS NÚMEROS)" 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 font-mono"
            />
          </div>

          {error && <p className="text-red-600 bg-red-50 p-3 rounded-md text-sm text-center font-semibold">{error}</p>}
          
          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={!hasChanges || isSaving}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </>
              ) : 'Salvar Alterações'}
            </button>
          </div>
        </form>
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

export default EditSupplierModal;