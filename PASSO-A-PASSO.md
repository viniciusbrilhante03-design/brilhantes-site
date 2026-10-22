# Brilhante's Imóveis: colocando o sistema em brilhantesimoveis.com

Leva cerca de 40 minutos, uma única vez. Você vai criar 3 contas gratuitas, todas com o mesmo login do GitHub:

- **GitHub** guarda os arquivos do site.
- **Supabase** guarda o banco de dados, os logins e as fotos.
- **Vercel** coloca o site no ar e liga o seu domínio.

Para a IA, você também vai precisar de uma conta na Anthropic (passo 5).

> Até o passo 8 estar testado, continue usando o sistema atual normalmente. **Não peça nada à Emergent ainda.**

---

## 1. GitHub: guardar os arquivos

1. Entre em **github.com** com a sua conta.
2. Clique em **+ → New repository**.
   - Nome: `brilhantes-site`
   - Marque **Private**.
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Descompacte o `brilhantes-site.zip` no seu computador.
5. Arraste **todo o conteúdo da pasta** para a página: as pastas `api`, `js` e `supabase`, mais `index.html`, `logo.webp`, `vercel.json` e os outros arquivos.
6. Clique em **Commit changes**.

> O arquivo `dados-iniciais.json` **não** vai para o GitHub. Ele tem dados de clientes e é usado só no passo 7.

## 2. Supabase: criar o banco

1. Entre em **supabase.com** e clique em **Start your project**, com o login do GitHub.
2. Clique em **New project**:
   - Nome: `brilhantes`
   - Database password: crie uma senha forte e guarde-a.
   - Region: **South America (São Paulo)**
3. Espere uns 2 minutos até o projeto ficar pronto.
4. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
5. Abra o arquivo `supabase/schema.sql`, copie tudo, cole no editor e clique em **Run**. Deve aparecer "Success".
6. No menu, abra **Authentication**:
   - Em **Sign In / Providers → Email**, **desligue** a opção *Allow new users to sign up* e salve. Assim, só entra quem você cadastrar.
   - Em **Users**, clique em **Add user → Create new user**:
     - E-mail: `viniciusbrilhante03@gmail.com`
     - Senha: a que você quiser usar como gestor
     - Marque **Auto Confirm User**.
7. Em **Project Settings → API Keys** (ou **API**), deixe a página aberta. Você vai copiar 3 valores no passo 4:
   - **Project URL**, algo como `https://xxxx.supabase.co` (fica em *Project Settings → Data API*)
   - a chave **anon public** (ou *publishable*)
   - a chave **service_role** (ou *secret*). **Essa é secreta: nunca mande para ninguém.**

## 3. Chave da IA (Anthropic)

1. Entre em **console.anthropic.com** e crie a conta.
2. Em **Billing**, adicione créditos (US$ 10 dura bastante: cada pergunta custa centavos).
3. Em **API Keys**, clique em **Create Key** e copie a chave (começa com `sk-ant-`).

## 4. Vercel: colocar no ar

1. Entre em **vercel.com** e clique em **Sign up**, com o login do GitHub.
2. Clique em **Add New → Project** e importe o repositório `brilhantes-site`.
3. Antes de publicar, abra **Environment Variables** e crie estas 4 variáveis:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | o Project URL do Supabase |
| `SUPABASE_ANON_KEY` | a chave anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role / secret |
| `ANTHROPIC_API_KEY` | a chave `sk-ant-...` |

4. Clique em **Deploy**. Em 1 minuto o site fica no ar num endereço do tipo `brilhantes-site.vercel.app`.

> Se mudar alguma variável depois, abra **Deployments**, clique em **⋯** no último deploy e escolha **Redeploy**.

## 5. Primeiro acesso e importação (uma vez só)

1. Abra o endereço `.vercel.app` e entre com o seu e-mail e a senha de gestor.
2. Como o banco está vazio, aparece **"Importar dados"**. Clique em escolher arquivos e selecione **todos juntos**: `dados-iniciais.json` e `arquivos-parte-1.json` a `arquivos-parte-4.json` (os PDFs e vídeos dos loteamentos). Clique em **Importar** e espere terminar. Leva alguns minutos.
3. Quando terminar, o sistema abre com todas as vendas, clientes, corretores, loteamentos e fotos.

> Para importar mais arquivos depois, abra o site com `?importar` no final do endereço (ex.: `brilhantesimoveis.com.br/?importar`). Nada é duplicado.

> No dia em que for trocar de vez, me peça um `dados-iniciais.json` **atualizado**. Assim, entra tudo o que você lançou no sistema atual até aquele dia.

## 6. Acesso dos corretores (e-mail + CPF)

1. Abra **Equipe & metas**, clique num corretor e depois em **Liberar portal**.
2. Escolha uma das opções:
   - **Criar acesso**, só para ele.
   - **Criar acesso para todos eles**, que cria de uma vez para todos os corretores que já têm e-mail e CPF no cadastro (hoje são 23).
3. O corretor entra no site com o **e-mail** e o **CPF, só números**, como senha. Ele vê:
   - só as vendas e comissões dele;
   - o ranking;
   - os loteamentos e o mapa.
4. Se alguém esquecer a senha, abra o mesmo botão e use **Redefinir a senha para este CPF**. Para cortar o acesso, use **Remover acesso**.

> Os números do painel do corretor são atualizados sempre que você está com o sistema aberto.

## 7. Ligar o domínio brilhantesimoveis.com.br

1. Na Vercel, abra o projeto e vá em **Settings → Domains → Add**.
2. Adicione `brilhantesimoveis.com.br` e aceite a sugestão de incluir também `www.brilhantesimoveis.com.br`.
3. A Vercel mostra os registros que precisam ser criados. Normalmente são:
   - um registro **A** para a raiz, com um IP (ex.: `76.76.21.21`);
   - um **CNAME** para `www`, com um endereço terminado em `vercel-dns.com`.

   Use **exatamente os valores que a sua tela mostrar**.
4. Entre em **registro.br**, clique no domínio e abra **DNS → Configurar zona DNS** (ou **Editar zona**).
5. Clique em **Nova entrada** para criar o registro A:
   - Tipo: **A**
   - Nome: deixe em branco
   - Dados: o IP da Vercel
6. Clique em **Nova entrada** de novo para criar o CNAME:
   - Tipo: **CNAME**
   - Nome: `www`
   - Dados: o endereço da Vercel
7. Clique em **Salvar alterações**.
8. Em alguns minutos (às vezes até 2 horas), a Vercel mostra **Valid Configuration** e coloca o cadeado (https) sozinha.

> Domínio recém-comprado pode levar algumas horas para ser publicado pelo Registro.br antes de aceitar a configuração.

**O `.com` (a partir de 10/12/2026):** peça à Emergent o código de transferência e a cópia dos registros de DNS. Depois, transfira para a Vercel em **Domains → Transfer in** e deixe o `.com` redirecionando para o `.com.br`.

## Bom saber

- **Custos:**
  - Supabase e Anthropic: o plano grátis do Supabase atende bem; a Anthropic cobra só o que você usar.
  - Vercel: o plano grátis (*Hobby*) é, pelas regras dela, para uso não comercial. Para uma empresa, o certo é o plano **Pro (US$ 20/mês)**. Dá para começar no grátis para testar e passar para o Pro quando o domínio for ligado.
- **Projeto pausado:** no plano grátis, o Supabase pausa o projeto depois de 7 dias **sem nenhum uso**. Com a equipe entrando, isso não acontece. Se acontecer, basta entrar no supabase.com e clicar em **Restore**.
- **Backup:** use o botão de download (⬇) do sistema → **Backup completo** uma vez por semana e guarde o arquivo.
- **Melhorias futuras:** continue pedindo pelo chat. Eu te mando os arquivos alterados, você sobe no GitHub (**Add file → Upload files**) e a Vercel publica sozinha em 1 minuto.
