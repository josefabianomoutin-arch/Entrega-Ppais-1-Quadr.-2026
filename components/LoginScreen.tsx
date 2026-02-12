
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
    return ['ITESP', 'ALMOXARIFADO', 'ALMOX', 'FINANCEIRO'].includes(nameTrimmed);
  }, [loginName]);

  const passwordPlaceholder = useMemo(() => {
    if (isStringLogin) return "Senha de Acesso";
    const name = loginName.trim().toUpperCase();
    if (['ADMINISTRADOR', 'ADM', 'DOUGLAS', 'GALDINO'].some(n => name.includes(n))) return "Senha (CPF)";
    return "CPF/CNPJ (Apenas números)";
  }, [loginName, isStringLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-indigo-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100">
        <div className="text-center">
          <div className="w-20 h-20 bg-indigo-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl rotate-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tighter italic">CONTROLE DE DADOS<br/>FINANÇAS 2026</h1>
          <p className="mt-2 text-indigo-400 font-bold uppercase text-[9px] tracking-[0.3em]">
            Monitoramento Institucional • Taiúva/SP
          </p>
        </div>
        
        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
            <p className="text-[10px] text-indigo-700 font-bold uppercase text-center leading-tight">
                {isStringLogin 
                    ? "Acesso por SETOR administrativo. Utilize a chave alfanumérica." 
                    : "Acesso para PRODUTORES e ADMINS através do CPF/CNPJ."}
            </p>
        </div>

        <form className="space-y-5" onSubmit={handleLoginSubmit}>
          <div className="space-y-4">
            <div className="relative group">
                <label className="absolute -top-2 left-4 bg-white px-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest z-10">Nome ou Setor</label>
                <input 
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  required 
                  value={loginName} 
                  onChange={(e) => setLoginName(e.target.value.toUpperCase())} 
                  placeholder="EX: ALMOXARIFADO" 
                  className="appearance-none relative block w-full px-5 py-4 border-2 border-gray-100 placeholder-gray-300 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-black transition-all"
                />
            </div>
            <div className="relative group">
                <label className="absolute -top-2 left-4 bg-white px-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest z-10">Senha de Segurança</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  inputMode={isStringLogin ? "text" : "numeric"}
                  autoComplete="current-password"
                  autoCorrect="off"
                  spellCheck="false"
                  required 
                  value={loginCpf} 
                  onChange={(e) => setLoginCpf(e.target.value)}
                  placeholder={passwordPlaceholder} 
                  className="appearance-none relative block w-full px-5 py-4 border-2 border-gray-100 placeholder-gray-300 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold transition-all pr-12"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.274 5.943 5.065 3 9.542 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.274 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                    )}
                </button>
            </div>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 text-[10px] font-black text-center animate-shake uppercase">
                {loginError}
            </div>
          )}

          <button type="submit" className="w-full py-5 px-4 text-sm font-black rounded-3xl text-white bg-indigo-900 hover:bg-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">
              Acessar Painel 2026
          </button>
        </form>

        <div className="pt-6 text-center border-t border-gray-50">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                CONTROLE DE DADOS &copy; 2026 • TAIÚVA
            </p>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default LoginScreen;