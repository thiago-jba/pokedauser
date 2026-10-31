export async function resolve(specifier, context, next) {
  // nos testes no computador, o acesso a arquivos do celular é substituído por um simulado
  if (specifier === 'expo-file-system') return next(new URL('./stub-expo-fs.mjs', import.meta.url).href, context);
  try {
    return await next(specifier, context);
  } catch (e) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier + '.ts', context);
    throw e;
  }
}
