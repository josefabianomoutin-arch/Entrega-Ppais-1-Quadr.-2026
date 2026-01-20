import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (name: string, cpf: string) => boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [loginName, setLoginName] = useState('');
  const [loginCpf, setLoginCpf] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogin(loginName, loginCpf)) {
      setLoginError('Usuário ou senha inválido.');
    } else {
      setLoginError('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-800">Entrega Ppais 1º Quadr. 2026</h1>
          <p className="mt-2 text-gray-600">
            Gestão de Entregas dos Fornecedores
          </p>
        </div>
        
        <div className="mt-4 text-center text-sm text-yellow-800 bg-yellow-100 p-3 rounded-lg border border-yellow-300">
            <p><strong>Atenção:</strong> O nome do fornecedor deve ser em <strong>MAIÚSCULA</strong> e a senha (CPF/CNPJ) apenas com <strong>números</strong>.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <input 
              type="text"
              autoComplete="username"
              required 
              value={loginName} 
              onChange={(e) => setLoginName(e.target.value.toUpperCase())} 
              placeholder="Usuário (Fornecedor ou Administrador)" 
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
            <input 
              type="password" 
              autoComplete="current-password" 
              required 
              value={loginCpf} 
              onChange={(e) => setLoginCpf(e.target.value.replace(/[^\d]/g, ''))}
              maxLength={14}
              placeholder="Senha (CPF/CNPJ do fornecedor)" 
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
          </div>
          {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
          <div>
            <button type="submit" className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">Entrar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
