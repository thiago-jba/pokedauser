import { useEffect, useMemo, useState } from 'react';
import type { Basket } from './evolution';
import { cachedRates, cardListValue, getRates, loadSetPrices, refreshCardListPrices, SPECIALS_PRICES_ID } from './prices';
import type { Rates } from './prices';
import type { SpecialCard } from './storage';
import { useStore } from './store';

/**
 * Preços das Coleções Especiais: atualiza ao abrir a tela (1x por dia, ou quando há carta nova)
 * e devolve o valor e a "cesta" de cartas usada no gráfico de evolução.
 */
export function useSpecialPrices(cards: SpecialCard[]) {
  const { data } = useStore();
  const [version, setVersion] = useState(0);
  const [rates, setRates] = useState<Rates | null>(() => cachedRates());
  const allIds = useMemo(() => (data.specials ?? []).flatMap((c) => c.cards.map((x) => x.cardId)), [data.specials]);

  useEffect(() => {
    let alive = true;
    getRates().then((r) => alive && r && setRates(r));
    refreshCardListPrices(SPECIALS_PRICES_ID, allIds)
      .then((changed) => alive && changed && setVersion((v) => v + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [allIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    const v = cardListValue(loadSetPrices(SPECIALS_PRICES_ID), cards);
    const baskets: Basket[] = [{ setId: SPECIALS_PRICES_ID, items: cards.map((c) => ({ cardId: c.cardId, variantKey: c.variantKey ?? 'normal' })) }];
    return { ...v, baskets, rates, version };
  }, [cards, rates, version]);
}
