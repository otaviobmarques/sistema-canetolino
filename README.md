# Canetolino

Diário do tratamento com canetas (tirzepatida, semaglutida, liraglutida): aplicações, proteína, água, peso, sintomas e um Radar semanal, com o mascote **Dose** acompanhando o paciente.

São quatro frentes num único projeto React + TypeScript (Vite):

| Rota | O que é |
|---|---|
| `#/` | Site institucional com animações (mascote que segue o cursor, parallax, celular que troca de tela na rolagem, cards com tilt 3D, confete) |
| `#/app` | App do paciente: as 10 telas do protótipo, mais login, onboarding completo (5 passos), peso e treino |
| `#/pro` | **Canetolino Pro**: painel do profissional (pacientes, resumo, relatório em PDF, convites) |
| `#/clinic` | **Canetolino Clinic**: painel da clínica (indicadores agregados, equipe e papéis, convites, plano) |

## Rodar

```bash
npm install
npm run dev
```

Build de produção: `npm run build` (sai em `dist/`). A cada push na `main`, o workflow `.github/workflows/pages.yml` publica no GitHub Pages.

## Como testar o fluxo completo

1. Abra `#/app` e clique em **Carregar demo (Jessica)**, ou crie uma conta do zero pelo onboarding.
2. Em outra aba, abra `#/pro` (login e 2FA de teste já vêm preenchidos). A Jessica aparece com o selo **ao vivo**.
3. No app, em **Perfil → Revogar**, a paciente some do Pro na hora. Autorize de novo em **Compartilhar** com o código `ANA-4821`.
4. Em `#/clinic`, troque o papel em **Ver painel como**: o papel Recepção não abre a ficha de paciente.

## Regras do descritivo técnico implementadas

- O app registra a dose da receita como texto e nunca calcula, sugere ou muda doses.
- Refeição por foto, voz ou texto: a "IA" (simulada) só identifica os alimentos; os nutrientes vêm da base TACO (`src/data/foods.ts`); nada é salvo antes de a pessoa confirmar; os itens ficam marcados como `ia_estimativa`.
- Rodízio do local de aplicação: sugere o local menos usado nas últimas 4 aplicações.
- Sintomas de alerta ("Dor abdominal forte", "Vômitos que não passam") mostram na hora o cartão vermelho com o atalho para ligar 192, por regra fixa e sem IA.
- O Radar só cita dados registrados; com menos de 3 dias de registro, mostra "semana com poucos dados".
- Compartilhamento por módulo e prazo, com consentimento registrado, histórico de acessos (auditoria) visível ao paciente e revogação imediata.
- Exportar dados (JSON) e excluir a conta pedem confirmação.
- Tokens de cor, Nunito/Inter, áreas de toque ≥ 44 px, `prefers-reduced-motion` respeitado.

## Estado atual e próximos passos

Este é um **protótipo funcional de front-end**: os dados ficam no `localStorage` do navegador (`src/data/store.tsx`), e as abas abertas se sincronizam entre si. Para produção:

- **Backend:** `supabase/migrations/0001_schema_inicial.sql` tem o modelo de dados da seção 5 com RLS (a função `pode_ler` libera o dono e quem tem permissão ativa por módulo). Falta trocar o store local por chamadas ao Supabase e criar as Edge Functions (`/ai/meal-from-photo`, `/reports/pdf`, `/sharing/*`...).
- **IA:** ligar o reconhecimento de refeição a um modelo com visão e o resumo semanal ao filtro de texto (sem dose, diagnóstico ou causalidade).
- **App nativo:** o descritivo recomenda Flutter ou React Native; as telas e regras daqui servem de referência direta.
- Revisão clínica da lista de sintomas de alerta, revisão jurídica (LGPD) e avaliação do enquadramento na Anvisa.

> Os números nas telas (peso, proteína, pacientes, percentuais) são exemplos.
