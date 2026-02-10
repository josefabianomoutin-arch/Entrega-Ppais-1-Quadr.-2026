
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
    const name = loginName.toLowerCase();
    
    // LIBERAR LETRAS: Para ITESP, Almoxarifado e Financeiro (senhas alfanuméricas)
    if (['itesp', 'almoxarifado', 'financeiro'].includes(name)) {
      setLoginCpf(value);
    } else {
      // MANTÉM RESTRIÇÃO: Apenas números para Fornecedores, Administrador e Douglas (que usa CPF numérico)
      setLoginCpf(value.replace(/[^\d]/g, ''));
    }
  };
  
  const isStringLogin = useMemo(() => {
    const name = loginName.toLowerCase();
    return ['itesp', 'almoxarifado', 'financeiro'].includes(name);
  }, [loginName]);

  const passwordPlaceholder = useMemo(() => {
    if (isStringLogin) {
        return "Senha de acesso (letras e números)";
    }
    const name = loginName.toLowerCase();
    if (name === 'administrador') {
        return "Senha (CPF do administrador)";
    }
    if (name.includes('douglas')) {
        return "Senha (Seu CPF)";
    }
    return "Senha (CPF/CNPJ do fornecedor)";
  }, [loginName, isStringLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-800">Gestão de Fornecedores 1º Quadr. 2026</h1>
          <p className="mt-2 text-gray-600">
            Acesso ao Sistema de Monitoramento
          </p>
        </div>
        
        <div className="mt-4 text-center text-sm text-yellow-800 bg-yellow-100 p-3 rounded-lg border border-yellow-300">
            <p><strong>Atenção:</strong> Fornecedores e Diretores utilizam o <strong>CPF/CNPJ</strong> (apenas números). ITESP e FINANCEIRO utilizam senhas alfanuméricas.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="relative">
                <input 
                  type="text"
                  autoComplete="username"
                  required 
                  value={loginName} 
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setLoginName(val);
                    // Se não for um dos logins de string, limpa a senha de caracteres não numéricos
                    if (!['ITESP', 'ALMOXARIFADO', 'FINANCEIRO'].includes(val)) {
                        setLoginCpf(prev => prev.replace(/[^\d]/g, ''));
                    }
                  }} 
                  placeholder="Seu Nome Completo ou Usuário" 
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
            </div>
            <div className="relative">
                <input 
                  type={isStringLogin ? "text" : "password"} 
                  autoComplete="current-password" 
                  required 
                  value={loginCpf} 
                  onChange={handlePasswordChange}
                  maxLength={isStringLogin ? undefined : 14}
                  placeholder={passwordPlaceholder} 
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
            </div>
          </div>
          {loginError && <p className="text-red-500 text-sm text-center font-bold animate-pulse">{loginError}</p>}
          <div>
            <button type="submit" className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">Entrar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
