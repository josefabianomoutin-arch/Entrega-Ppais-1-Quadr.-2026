import React, { useState, useMemo } from 'react';

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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permite senha alfanumérica para o usuário 'almoxarifado'
    if (loginName.toLowerCase() === 'almoxarifado') {
      setLoginCpf(value);
    } else {
      // Mantém a restrição de apenas números para fornecedores e admin
      setLoginCpf(value.replace(/[^\d]/g, ''));
    }
  };
  
  const passwordPlaceholder = useMemo(() => {
    const name = loginName.toLowerCase();
    if (name === 'almoxarifado') {
        return "Senha";
    }
    if (name === 'administrador') {
        return "Senha (CPF do administrador)";
    }
    return "Senha (CPF/CNPJ do fornecedor)";
  }, [loginName]);
  
  const isAlmoxarifadoLogin = loginName.toLowerCase() === 'almoxarifado';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-800">Gestão de Fornecedores 1º Quadr. 2026</h1>
          <p className="mt-2 text-gray-600">
            Gestão de Entregas dos Fornecedores
          </p>
        </div>
        
        <div className="mt-4 text-center text-sm text-yellow-800 bg-yellow-100 p-3 rounded-lg border border-yellow-300">
            <p><strong>Atenção:</strong> Nome de fornecedor em <strong>MAIÚSCULA</strong> e senha (CPF/CNPJ) com <strong>apenas números</strong>. O usuário 'Almoxarifado' possui senha específica.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <input 
              type="text"
              autoComplete="username"
              required 
              value={loginName} 
              onChange={(e) => setLoginName(e.target.value.toUpperCase())} 
              placeholder="Usuário (Fornecedor, Admin, Almoxarifado)" 
              className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
            />
            <input 
              type={isAlmoxarifadoLogin ? "text" : "password"} 
              autoComplete="current-password" 
              required 
              value={loginCpf} 
              onChange={handlePasswordChange}
              maxLength={isAlmoxarifadoLogin ? undefined : 14}
              placeholder={passwordPlaceholder} 
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