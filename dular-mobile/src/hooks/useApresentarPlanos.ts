import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

import { api } from "@/lib/api";

/**
 * Abre o paywall UMA vez por sessão, logo depois do login, para quem ainda
 * não assina.
 *
 * De módulo (não de componente): zera quando o app reinicia — ou seja, no
 * próximo login — e não a cada volta para a home. Sem isso a tela reapareceria
 * toda vez que a aba fosse tocada.
 *
 * A fonte é `/api/me/subscription`. NÃO dá para usar `useRestricoes`: ele tipa
 * a resposta com um campo `plano`, mas `/api/me/restrictions` devolve só
 * `{ restrictions: [] }` (restrições administrativas) — `plano` é sempre
 * undefined em runtime.
 *
 * Vive como hook compartilhado porque vale para os dois perfis com paywall
 * (diarista e montador). Estava escrito à mão só na home da diarista, e o
 * montador ficou sem. O empregador não tem plano e não usa isto.
 */
let jaApresentouPlanos = false;

export function useApresentarPlanos() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (jaApresentouPlanos) return;
    let vivo = true;
    api
      .get<{ plan?: string }>("/api/me/subscription")
      .then((res) => {
        if (!vivo || jaApresentouPlanos) return;
        if ((res.data?.plan ?? "FREE") !== "FREE") return; // já assina
        jaApresentouPlanos = true;
        navigation.navigate("Paywall", {});
      })
      .catch(() => undefined); // sem plano conhecido, não incomoda
    return () => {
      vivo = false;
    };
  }, [navigation]);
}
