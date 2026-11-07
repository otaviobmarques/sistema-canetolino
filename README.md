# Canetolino

Diário do tratamento com canetas (tirzepatida, semaglutida, liraglutida): aplicações, proteína, água, peso, sintomas e um Radar semanal, com o mascote **Dose** acompanhando o paciente.

São quatro frentes num único projeto React + TypeScript (Vite):

| Rota | O que é |
|---|---|
| `#/` | Site institucional com animações (mascote que segue o cursor, parallax, celular que troca de tela na rolagem, cards com tilt 3D, confete) |
| `#/app` | App do paciente: as 10 telas do protótipo, mais login, onboarding completo (5 passos), peso e treino |
| `#/pro` | **Canetolino Pro**: painel do profissional (pacientes, resumo, relatório em PDF, convites) |
| `#/clinic` | **Canetolino Clinic**: painel da clínica (indicadores agregados, equipe e papéis, convites, plano) |
| `#/admin` | **Admin**: equipe Canetolino (verificação de profissionais, números gerais). Usuário `Admin`, com verificação em duas etapas |

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

### E-mail (Resend + Supabase)

Domínio `canetolino.com.br` criado no Resend (região sa-east-1), com chave só de envio restrita a ele. Passo a passo em `docs/configurar-email.md`; modelos em português em `supabase/templates/`.

## Alimentos

Base unificada do repositório `otaviobmarques/fontes-ref`: **18.245 alimentos** (TACO 592, TBCA 5.849, POF 1.936, USDA 7.024, CoFID 2.844), por 100 g, com medidas caseiras quando a fonte traz. Ficam de fora os registros marcados como incompletos ou inconsistentes na própria fonte.

- Busca sem acento (`buscar_alimentos`), com itens do dia a dia e fontes brasileiras primeiro.
- A fonte de cada valor aparece na tela (condição de uso da TACO e das demais).
- **Alimentos do rótulo:** a pessoa cadastra produtos de marca (whey, barras…) com a proteína da embalagem.
- Reimportar: `python3 scripts/importar_alimentos.py ../fontes-ref/unificado/alimentos.json > alimentos.sql`.

## Evolução

Peso, medidas corporais (cintura, abdômen, quadril, peito, braço, coxa, pescoço) e fotos de evolução por ângulo, com comparação antes e depois. As fotos ficam só no aparelho por padrão; com a opção desligada no Perfil, vão para o Storage privado `evolucao/` (só a própria pessoa lê). Fotos nunca entram no compartilhamento com profissionais. Medidas entram no módulo "peso e medidas".

## IA (Claude, da Anthropic)

A função de servidor `supabase/functions/ia` é a única que fala com a IA; o app nunca vê a chave.

- **Refeição por foto, voz ou texto:** o app reduz a foto (até 1024 px) e envia. O modelo devolve só nomes, preparo e porção, em JSON com formato fixo; o servidor busca cada item na tabela `foods` (TACO/TBCA) e calcula proteína e energia. Itens sem correspondência voltam para busca manual. Nada é salvo sem a pessoa confirmar.
- **Resumo do Radar:** só indicadores agregados vão ao modelo (sem nome, e-mail ou documento). O texto passa por um filtro que bloqueia dose, diagnóstico e causalidade; se bloquear, o app mostra o resumo por regras. Fica guardado em `weekly_reports` (um por dia).
- **Cota:** 30 refeições por IA por mês no Básico; ilimitado no Premium (`ai_usage`).
- **Modelo:** `claude-haiku-5-5`, esforço baixo. Custo medido: cerca de US$ 0,0002 por análise. Se o modelo recusar ou falhar, o app cai para a busca manual (ou para o resumo por regras).
- **Chave:** a função lê `ANTHROPIC_API_KEY` do segredo da função ou, se não houver, da tabela `segredos` (sem acesso pela API; só o servidor lê). Para trocar a chave: `update segredos set valor = '...' where nome = 'ANTHROPIC_API_KEY'` no SQL Editor do Supabase.

## Lembretes, bem-estar, ficha e PDF

- **Lembretes (Web Push):** o paciente liga em Perfil → Lembretes. A função `lembretes` roda a cada 15 minutos (pg_cron) e avisa no dia e hora da aplicação (se ainda não registrou), da água às 10h, 14h e 18h (se a meta não foi batida) e da validade das canetas 30 dias antes. Mensagens discretas por padrão. No iPhone, só com o app adicionado à Tela de Início.
- **App instalável:** `manifest.webmanifest`, ícones e `sw.js` (notificações e funcionamento básico sem internet; dados de saúde nunca passam pelo cache).
- **Bem-estar e sono:** horas e qualidade do sono, humor, energia e fome. Entra no Radar, no resumo do Dose e no módulo "bem-estar e sono".
- **Ficha completa (Pro):** `#/pro/paciente/:id`, com período de 30, 90 ou 365 dias e uma seção por módulo autorizado.
- **PDF no servidor:** função `relatorio` (pdf-lib). Lê os dados com a sessão de quem pediu, então o RLS limita o conteúdo; marca o que foi estimado pela IA e cita as fontes. Para o profissional, fica no histórico do paciente; para o paciente, faz parte do Premium.

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

- **IA:** medir a precisão com um conjunto de fotos de refeições brasileiras.
- **Assinatura:** a tela de planos está pronta; a cobrança será feita pelas lojas no app nativo.
- **App nativo** (Flutter ou React Native) para as lojas, com notificações push.
- Revisão clínica da lista de sintomas de alerta, revisão jurídica (LGPD) e avaliação do enquadramento na Anvisa.

> Os números nas ilustrações do site são exemplos.
