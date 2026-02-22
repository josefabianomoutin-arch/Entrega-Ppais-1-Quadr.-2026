
import type { Supplier } from './types';

export const initialSuppliers: Supplier[] = [];

export const MONTHS_2026 = [
  { name: 'Janeiro', number: 0 },
  { name: 'Fevereiro', number: 1 },
  { name: 'Março', number: 2 },
  { name: 'Abril', number: 3 },
  { name: 'Maio', number: 4 },
  { name: 'Junho', number: 5 },
  { name: 'Julho', number: 6 },
  { name: 'Agosto', number: 7 },
  { name: 'Setembro', number: 8 },
  { name: 'Outubro', number: 9 },
  { name: 'Novembro', number: 10 },
  { name: 'Dezembro', number: 11 },
];

export const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'Confraternização Universal',
  '2026-01-25': 'Aniv. São Paulo (Regional)',
  '2026-02-16': 'Carnaval (Ponto Facultativo)',
  '2026-02-17': 'Carnaval (Terça-feira)',
  '2026-02-18': 'Quarta-feira de Cinzas',
  '2026-04-03': 'Sexta-feira Santa',
  '2026-04-05': 'Páscoa',
  '2026-04-21': 'Tiradentes',
  '2026-05-01': 'Dia do Trabalho',
  '2026-06-04': 'Corpus Christi',
  '2026-07-09': 'Rev. Constitucionalista (SP)',
  '2026-09-07': 'Independência do Brasil',
  '2026-10-12': 'Nsa. Sra. Aparecida',
  '2026-11-02': 'Finados',
  '2026-11-15': 'Proclamação da República',
  '2026-11-20': 'Consciência Negra',
  '2026-12-25': 'Natal'
};
