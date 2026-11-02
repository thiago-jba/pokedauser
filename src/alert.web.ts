/// <reference lib="dom" />
// No navegador o Alert do React Native não faz nada: usa as janelas do próprio navegador.
type Btn = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export const Alert = {
  alert(title: string, message?: string, buttons?: Btn[]) {
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    if (actions.length === 0) {
      window.alert(text);
      (buttons ?? [])[0]?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      if (window.confirm(`${text}\n\n[OK = ${actions[0].text ?? 'OK'}]`)) actions[0].onPress?.();
      return;
    }
    // várias opções: pergunta uma por vez
    for (const b of actions) {
      if (window.confirm(`${text}\n\n${b.text}?`)) {
        b.onPress?.();
        return;
      }
    }
  },
};
