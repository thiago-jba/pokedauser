// Permite que os testes (Node) importem os arquivos do app sem a extensão .ts, como o app faz.
import { register } from 'node:module';
register('./resolve-ts.mjs', import.meta.url);
