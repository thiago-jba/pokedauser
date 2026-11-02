// Endereço e chave pública do projeto Supabase do usuário (banco de dados na nuvem).
// A chave "publishable"/"anon" é feita para ficar dentro do app: quem protege os dados são as regras
// de acesso do banco (cada conta só lê e altera a própria coleção).
export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

export const cloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;
