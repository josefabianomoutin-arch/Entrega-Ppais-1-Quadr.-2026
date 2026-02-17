
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
      setLoginError('Dados de acesso incorretos. Verifique o nome e a senha.');
    } else {
      setLoginError('');
    }
  };

  const isStringLogin = useMemo(() => {
    const nameTrimmed = loginName.trim().toUpperCase();
    return ['ITESP', 'ALMOXARIFADO', 'ALMOX', 'FINANCEIRO', 'SUBPORTARIA'].includes(nameTrimmed);
  }, [loginName]);

  const passwordPlaceholder = useMemo(() => {
    if (isStringLogin) return "Senha do Setor";
    const name = loginName.trim().toUpperCase();
    if (['ADMINISTRADOR', 'ADM', 'DOUGLAS', 'GALDINO'].some(n => name.includes(n))) return "Senha do Admin";
    return "Senha (CPF ou CNPJ)";
  }, [loginName, isStringLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-indigo-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-[3rem] shadow-2xl border border-gray-50 overflow-hidden">
        <div className="text-center">
          <div className="w-20 h-20 bg-indigo-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-2xl rotate-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tighter italic">SISTEMA FINANCEIRO<br/>TAIÚVA 2026</h1>
          <p className="mt-2 text-indigo-400 font-bold uppercase text-[8px] tracking-[0.4em]">
            Monitoramento de Dados • Gestão 1.Q
          </p>
        </div>
        
        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
            <p className="text-[10px] text-indigo-700 font-black uppercase text-center leading-none">
                {isStringLogin 
                    ? "ACESSO RESTRITO POR SETOR" 
                    : "ACESSO PARA PRODUTORES E ADMINS"}
            </p>
        </div>

        <form className="space-y-5" onSubmit={handleLoginSubmit}>
          <div className="space-y-6">
            <div className="relative group">
                <label className="absolute -top-2.5 left-5 bg-white px-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest z-10">Nome ou Setor</label>
                <input 
                  type="text"
                  autoComplete="username"
                  required 
                  value={loginName} 
                  onChange={(e) => setLoginName(e.target.value.toUpperCase())} 
                  placeholder="EX: ALMOXARIFADO" 
                  className="appearance-none block w-full h-16 px-6 border-2 border-gray-100 placeholder-gray-300 text-gray-900 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 font-black transition-all"
                />
            </div>
            <div className="relative group">
                <label className="absolute -top-2.5 left-5 bg-white px-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest z-10">Chave de Acesso</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  inputMode={isStringLogin ? "text" : "numeric"}
                  autoComplete="current-password"
                  required 
                  value={loginCpf} 
                  onChange={(e) => setLoginCpf(e.target.value)}
                  placeholder={passwordPlaceholder} 
                  className="appearance-none block w-full h-16 px-6 border-2 border-gray-100 placeholder-gray-300 text-gray-900 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 font-bold transition-all pr-14"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors p-2"
                >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                </button>
            </div>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 text-[10px] font-black text-center animate-shake uppercase leading-tight">
                {loginError}
            </div>
          )}

          <button type="submit" className="w-full h-16 text-sm font-black rounded-[1.5rem] text-white bg-indigo-900 hover:bg-black shadow-xl active:scale-95 transition-all uppercase tracking-widest mt-4">
              Entrar no Painel
          </button>
        </form>

        <div className="pt-6 text-center border-t border-gray-50">
            <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">
                TAIÚVA/SP &copy; 2026 • FINANÇAS
            </p>
        </div>
      </div>
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default LoginScreen;
