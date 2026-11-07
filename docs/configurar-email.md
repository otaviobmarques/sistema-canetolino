# Configurar o e-mail do Canetolino

Os e-mails de confirmação de conta e de nova senha saem pelo Resend, com o domínio `canetolino.com.br`.

## 1. DNS na HostGator (cPanel → Zone Editor → canetolino.com.br)

| Tipo | Nome | Valor | Prioridade |
|---|---|---|---|
| TXT | `resend._domainkey` | chave DKIM mostrada no painel do Resend (Domains → canetolino.com.br) | |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| CNAME | `rsend` | `send.forge.rmta.net` | |

Depois de salvar, clique em **Verify** no Resend (a propagação pode levar de minutos a algumas horas).

## 2. Supabase → Authentication → Emails → SMTP Settings

| Campo | Valor |
|---|---|
| Enable custom SMTP | ligado |
| Sender email | `nao-responda@canetolino.com.br` |
| Sender name | `Canetolino` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a chave de API do Resend `canetolino-supabase-smtp` (não fica no repositório) |
| Minimum interval | 60 segundos |

## 3. Supabase → Authentication → URL Configuration

- Site URL: `https://sistema-canetolino.vercel.app`
- Redirect URLs: `https://sistema-canetolino.vercel.app/**`

## 4. Supabase → Authentication → Emails → Templates

Cole os arquivos de `supabase/templates/`:

| Modelo | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu e-mail no Canetolino | `confirmacao.html` |
| Reset password | Crie uma nova senha no Canetolino | `recuperar-senha.html` |
| Change email address | Confirme seu novo e-mail no Canetolino | `troca-de-email.html` |
