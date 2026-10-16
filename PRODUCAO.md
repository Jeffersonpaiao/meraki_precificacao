# Meraki Precificação — ativação de produção

## Estado

Aplicação Next.js com portal autenticado (`/`), administração geral (`/admin`) e demonstração isolada (`/demo`). O projeto Supabase dedicado `ukwrbaldzovbiukkqshv` foi criado na região de São Paulo e as duas migrações foram aplicadas. A aplicação está publicada na Vercel em `https://meraki-precificacao.vercel.app`.

## Banco de dados

1. As migrações de `supabase/migrations` já foram aplicadas, na ordem, ao projeto dedicado. Não executar novamente `database/schema.sql`: ele corresponde à primeira migração.
2. No Supabase Auth → URL Configuration, definir **Site URL** como `https://meraki-precificacao.vercel.app` e incluir esse endereço em **Redirect URLs**. Incluir origens locais ou de preview somente quando forem usadas.
3. Configurar confirmação de e-mail e um provedor SMTP próprio antes de abrir cadastro para outras pessoas; o envio padrão do Supabase não é apropriado para produção.
4. As duas variáveis de `.env.example` estão configuradas na Vercel para produção, preview e desenvolvimento. Usar somente a chave pública/publishable, nunca `service_role` no navegador.
5. Criar e confirmar a conta **jeffersondpaiao@gmail.com** pelo portal. A senha é definida pelo próprio titular, fora do chat.
6. Executar `database/bootstrap-admin.sql` pelo console SQL confiável. O script só concede administração ao e-mail indicado após confirmação.

## Administração

O administrador geral abre `/admin`, cria clínicas e vincula contas confirmadas por e-mail. Criar uma conta, por si só, não dá acesso a nenhuma clínica. O criador recebe acesso administrativo à clínica nova. Os cadastros começam vazios; não são copiados dados da demonstração.

- **Administrador geral:** cadastra e suspende clínicas; gerencia vínculos.
- **Administrador da clínica:** edita cadastros e premissas financeiras.
- **Gestor:** edita cadastros; não altera configurações da clínica.
- **Consulta (operador):** visualiza; não salva alterações.

Uma pessoa pode ter vínculos com várias clínicas e deve escolher explicitamente qual abrir. A suspensão bloqueia novas leituras e gravações no banco; não apaga cópias já visualizadas ou exportadas. A remoção de vínculo bloqueia os próximos acessos. Não há exclusão destrutiva de clínicas.

## Publicação

Usar a raiz deste repositório como raiz do projeto de hospedagem Next.js. Com Node.js 22 ou superior:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm start
```

`PORT` controla a porta do servidor de produção. A plataforma deve fornecer HTTPS. As credenciais, as sessões e os dados reais não devem entrar no controle de versão. O repositório inclui `.env.example` vazio.

## Verificação

Os testes em `tests/tenancy.test.ts` executam as migrações em PostgreSQL embarcado (PGlite) e verificam isolamento entre clínicas, proibição de autoelevação, perfis, suspensão, revogação, revisão concorrente e auditoria. Isso não substitui o teste no projeto Supabase real.

Após ativar: entrar como administrador principal; criar duas clínicas; vincular uma segunda conta somente à primeira; verificar que essa conta não acessa a segunda, inclusive por requisição direta; testar salvamento, nova sessão, suspensão e revogação. Validar também envio de confirmação de e-mail e backup/recuperação no plano contratado.

## Limitações atuais

O cadastro público de contas depende das configurações Auth; para convites fechados, criar as contas pelo painel Supabase e desabilitar novos cadastros. O gerenciamento de vínculos não envia convites automaticamente. O primeiro administrador só recebe acesso após criar e confirmar a conta e executar `database/bootstrap-admin.sql`.

## Validação local em 15/10/2026
18 testes aprovados, TypeScript aprovado e build de produção aprovado com um processo de geração. O servidor local executa o build em .next-production na porta 3000. A confirmação de custos/criação automática do Supabase ficou indisponível no conector; aguarda-se o ID do projeto criado pelo titular. Nenhuma aplicação foi publicada nem administrador provisionado em nuvem nesta etapa.
