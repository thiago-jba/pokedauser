import assert from 'node:assert/strict';
import { isBoosterFile, parseBoosterFile } from '../src/boosters.ts';

const p = parseBoosterFile;
assert.deepEqual(p('SV8_Booster_Pikachu.png'), { label: 'Pikachu', lang: undefined });
assert.deepEqual(p('ME2_Booster_Mega_Charizard_X.png'), { label: 'Mega Charizard X', lang: undefined });
assert.deepEqual(p('Base_Set_Booster_Charizard_BR.jpg'), { label: 'Charizard', lang: 'português' });
assert.deepEqual(p('Base_Set_Booster_Venusaur_Shadowless.jpg'), { label: 'Venusaur Shadowless', lang: undefined });
assert.deepEqual(p('SV10.5_BLK_Booster_EN.png'), { label: 'BLK', lang: undefined });
assert.deepEqual(p('151_Booster.png'), { label: 'Estampa única', lang: undefined });
assert.deepEqual(p('SV1S_pack_Japanese.png'), { label: 'SV1S', lang: 'japonês' });
assert.deepEqual(p('S7D_Skyscraping_Perfection_pack.jpg'), { label: 'S7D Skyscraping Perfection', lang: 'japonês' });
assert.deepEqual(p('S12a_VSTAR_Universe_Booster_Chinese.png'), { label: 'VSTAR Universe', lang: 'chinês' });
assert.deepEqual(p('Prismatic_Evolutions_Booster_Eevee_Sylveon.png'), { label: 'Eevee Sylveon', lang: undefined });
assert.ok(isBoosterFile('SV1_Booster_Koraidon.png'));
assert.ok(isBoosterFile('SM1_Collection_Sun_pack.jpg'));
assert.ok(!isBoosterFile('Base_Set_Booster_Box.jpg'));
assert.ok(!isBoosterFile('Sun_and_Moon_Booster_Box.jpg'));
assert.ok(!isBoosterFile('Expansion_Pack_20th_Art_Scan.jpg'));
console.log('OK: estampas de booster (nomes da Bulbapedia)');

import { groupBoosters } from '../src/boosters.ts';
const b = (setId: string, setName: string, addedAt: string, releaseDate?: string) => ({ setId, setName, addedAt, releaseDate });
const list = [b('a', 'Fagulhas', '2026-11-01', '2024-11-08'), b('b', 'Ascensão', '2026-11-03', '2023-03-31'), b('a', 'Fagulhas', '2026-11-02', '2024-11-08'), b('c', 'Base', '2026-10-01')];
const ids = (s: any) => groupBoosters(list, s, (id) => (id === 'c' ? '1999-01-09' : undefined)).map((g) => g.setId).join('');
assert.equal(ids('recentes'), 'bac');
assert.equal(ids('lancamento_desc'), 'abc');
assert.equal(ids('lancamento_asc'), 'cba');
assert.equal(ids('nome_asc'), 'bcа'.replace('а', 'a'));
assert.equal(ids('qtd_desc')[0], 'a');
assert.equal(groupBoosters(list, 'recentes')[1].items[0].addedAt, '2026-11-02');
console.log('OK: ordenação dos boosters');

import { byArt } from '../src/boosters.ts';
const arts = byArt([
  { file: 'P', country: 'JP', addedAt: '3' },
  { file: 'L', country: 'BR', addedAt: '2' },
  { file: 'P', country: 'BR', addedAt: '1' },
  { file: 'P', country: 'DE', addedAt: '4' },
  { file: 'P', country: 'US', addedAt: '5' },
]);
assert.deepEqual(arts.map((a) => a.file), ['P', 'L']);
assert.deepEqual(arts[0].items.map((b) => b.country), ['BR', 'US', 'JP', 'DE']);
console.log('OK: boosters da mesma estampa lado a lado por país');
