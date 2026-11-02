// Endereço e chave pública do projeto Supabase do usuário (banco de dados na nuvem).
// A chave "publishable"/"anon" é feita para ficar dentro do app: quem protege os dados são as regras
// de acesso do banco (cada conta só lê e altera a própria coleção).
export const SUPABASE_URL = 'https://aavnixogdsbssehbosur.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_kWX82rbrHCtSaD1r49PfJw_Z-XiRYfP';

export const cloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

/** Endereço da versão para computador. */
export const WEB_URL = 'https://pokecolecao.expo.app';
