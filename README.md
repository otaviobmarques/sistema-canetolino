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

Build de produção: `npm run build` (sai em `dist/`).

**No ar:** https://sistema-canetolino.vercel.app (Vercel, ligada a este repositório: cada push na `main` publica sozinho).

## Backend (Supabase)

Projeto **canetolino** na organização Domma Tecnologia, região **sa-east-1 (São Paulo)**. Tudo fica na nuvem: não existe modo local nem conta de demonstração.

- **Contas:** e-mail e senha. Os painéis Pro e Clinic exigem verificação em duas etapas (app autenticador, TOTP).
- **Banco:** `supabase/migrations/` tem o esquema completo com RLS. A função `pode_ler` libera o dono e, para profissional ou clínica, só os módulos autorizados, dentro do prazo e com sessão em dois fatores.
- **Funções de servidor (RPC):** `autorizar_compartilhamento`, `revogar_compartilhamento`, `buscar_codigo`, `pacientes_do_profissional`, `registrar_acesso` (auditoria), `clinica_visao`, `clinica_pacientes`, `clinica_equipe`, `aceitar_convites_clinica`, `excluir_minha_conta`.
- **Sem internet:** o app guarda os registros no aparelho e envia a diferença assim que a conexão volta.
- **Códigos de convite:** gerados no cadastro a partir do nome (ex.: `ANA-1234` para a Dra. Ana, `VID-5678` para a Clínica Vida); o Pro também gera códigos avulsos de 7 dias.

### Configuração pendente no painel do Supabase

1. **Authentication → URL Configuration:** Site URL `https://sistema-canetolino.vercel.app` e, em Redirect URLs, `https://sistema-canetolino.vercel.app/**` (os links de confirmação e de nova senha voltam para cá).
2. **Authentication → SMTP:** o envio padrão do Supabase só manda e-mail para membros da organização. Para pacientes e profissionais receberem a confirmação, configure um SMTP próprio (Resend, por exemplo).

## IA (Claude, da Anthropic)

A função de servidor `supabase/functions/ia` é a única que fala com a IA; o app nunca vê a chave.

- **Refeição por foto, voz ou texto:** o app reduz a foto (até 1024 px) e envia. O modelo devolve só nomes, preparo e porção, em JSON com formato fixo; o servidor busca cada item na tabela `foods` (TACO/TBCA) e calcula proteína e energia. Itens sem correspondência voltam para busca manual. Nada é salvo sem a pessoa confirmar.
- **Resumo do Radar:** só indicadores agregados vão ao modelo (sem nome, e-mail ou documento). O texto passa por um filtro que bloqueia dose, diagnóstico e causalidade; se bloquear, o app mostra o resumo por regras. Fica guardado em `weekly_reports` (um por dia).
- **Cota:** 30 refeições por IA por mês no Básico; ilimitado no Premium (`ai_usage`).
- **Modelo:** `claude-opus-5-5`, esforço baixo, com recuperação automática no servidor se o modelo recusar (`fallbacks: "default"`).
- **Chave:** segredo `ANTHROPIC_API_KEY` em Supabase → Edge Functions → Secrets. Sem ele, o app avisa que a IA está indisponível e segue com a busca manual.

## Planos (paciente)

Sem plano gratuito. Valores em `src/data/planos.ts`: **Básico R$ 9,90/mês** (R$ 99/ano) e **Premium R$ 19,90/mês** (R$ 199/ano). A assinatura será feita pelas lojas no app nativo.

## Como testar o fluxo completo

1. Em `#/app`, crie a conta e faça o onboarding.
2. Em `#/pro`, crie a conta profissional, ative o app autenticador e copie seu código de convite.
3. No app, em **Perfil → Compartilhar**, use o código. O paciente aparece no Pro, e o acesso fica no **Histórico de acessos** do paciente.
4. Revogue no app: o paciente some do Pro na próxima atualização (até 20 s).
5. Em `#/clinic`, cadastre a clínica, convide profissionais pelo e-mail e envie o código da clínica aos pacientes. O papel Recepção não vê dados de paciente.

## Regras do descritivo técnico implementadas

- O app registra a dose da receita como texto e nunca calcula, sugere ou muda doses.
- Refeição por foto, voz ou texto: a "IA" (simulada) só identifica os alimentos; os nutrientes vêm da base TACO (`src/data/foods.ts`); nada é salvo antes de a pessoa confirmar; os itens ficam marcados como `ia_estimativa`.
- Rodízio do local de aplicação: sugere o local menos usado nas últimas 4 aplicações.
- Sintomas de alerta ("Dor abdominal forte", "Vômitos que não passam") mostram na hora o cartão vermelho com o atalho para ligar 192, por regra fixa e sem IA.
- O Radar só cita dados registrados; com menos de 3 dias de registro, mostra "semana com poucos dados".
- Compartilhamento por módulo e prazo, com consentimento registrado, histórico de acessos (auditoria) visível ao paciente e revogação imediata.
- Exportar dados (JSON) e excluir a conta pedem confirmação.
- Tokens de cor, Nunito/Inter, áreas de toque ≥ 44 px, `prefers-reduced-motion` respeitado.

## Próximos passos

- **IA:** ampliar a tabela `foods` com a TACO/TBCA completa e medir a precisão com um conjunto de fotos de refeições brasileiras.
- **Telas que faltam:** busca de alimentos completa, medidas e fotos de evolução, assinatura dos planos.
- **App nativo** (Flutter ou React Native) para as lojas, com notificações push.
- Revisão clínica da lista de sintomas de alerta, revisão jurídica (LGPD) e avaliação do enquadramento na Anvisa.

> Os números nas ilustrações do site são exemplos.
