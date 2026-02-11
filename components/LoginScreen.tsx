
import React, { useState, useMemo } from 'react';

interface LoginScreenProps {
  onLogin: (name: string, cpf: string) => boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [loginName, setLoginName] = useState('');
  const [loginCpf, setLoginCpf] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogin(loginName, loginCpf)) {
      setLoginError('Usuário ou senha inválido.');
    } else {
      setLoginError('');
    }
  };

  const isStringLogin = useMemo(() => {
    const nameTrimmed = loginName.trim().toUpperCase();
    return ['ITESP', 'ALMOXARIFADO', 'FINANCEIRO'].includes(nameTrimmed);
  }, [loginName]);

  const passwordPlaceholder = useMemo(() => {
    if (isStringLogin) {
        return "Sua Senha de Acesso";
    }
    const name = loginName.trim().toLowerCase();
    if (name.includes('douglas') || name === 'administrador' || name === 'adm') {
        return "Sua Senha (CPF)";
    }
    return "CPF/CNPJ do Fornecedor";
  }, [loginName, isStringLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-3xl shadow-2xl border border-gray-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-700 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
          </div>
          <h1 className="text-3xl font-black text-green-800 leading-tight uppercase tracking-tighter">Sistema PPAIS</h1>
          <p className="mt-2 text-gray-500 font-medium">
            Monitoramento de Fornecedores 2026
          </p>
        </div>
        
        <div className="mt-4 text-center text-[10px] text-yellow-800 bg-yellow-50 p-4 rounded-2xl border border-yellow-100 font-bold uppercase tracking-tight">
            <p>Dica: Fornecedores e Douglas utilizam o CPF (apenas números). Setores administrativos usam senhas específicas.</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
          <div className="space-y-4">
            <div className="relative group">
                <label className="absolute -top-2 left-4 bg-white px-2 text-[10px] font-black text-green-700 uppercase tracking-widest z-10">Nome ou Usuário</label>
                <input 
                  type="text"
                  autoComplete="username"
                  required 
                  value={loginName} 
                  onChange={(e) => setLoginName(e.target.value.toUpperCase())} 
                  placeholder="Seu Nome ou Setor" 
                  className="appearance-none relative block w-full px-4 py-4 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-2xl focus:outline-none focus:ring-green-500 focus:border-green-500 font-bold transition-all"
                />
            </div>
            <div className="relative group">
                <label className="absolute -top-2 left-4 bg-white px-2 text-[10px] font-black text-green-700 uppercase tracking-widest z-10">Senha / CPF</label>
                <input 
                  type={showPassword ? "text" : (isStringLogin ? "text" : "password")} 
                  autoComplete="current-password" 
                  required 
                  value={loginCpf} 
                  onChange={(e) => setLoginCpf(e.target.value)}
                  placeholder={passwordPlaceholder} 
                  className="appearance-none relative block w-full px-4 py-4 border-2 border-gray-200 placeholder-gray-400 text-gray-900 rounded-2xl focus:outline-none focus:ring-green-500 focus:border-green-500 font-bold transition-all pr-12"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    )}
                </button>
            </div>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs font-black text-center animate-bounce uppercase tracking-tighter">
                {loginError}
            </div>
          )}

          <div>
            <button type="submit" className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-black rounded-2xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all active:scale-95 shadow-xl uppercase tracking-widest">
                Entrar no Sistema
            </button>
          </div>
        </form>

        <div className="pt-6 text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-100">
            PPAIS - Penitenciária de Taiúva &copy; 2026
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
