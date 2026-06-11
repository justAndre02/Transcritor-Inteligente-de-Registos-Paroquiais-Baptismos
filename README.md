# Transcritor Inteligente de Registos Paroquiais (Baptismos)

Este projeto é um assistente digital de paleografia e arquivística de alta precisão, desenhado para transcrever, organizar e mapear termos de registos paroquiais de batismo históricos (com especial enfoque na região de Ponta Delgada, Açores) utilizando o modelo de inteligência artificial **Gemini 3.1-flash-lite**.

O sistema permite que arquivistas de genealogia e investigadores históricos carreguem manuscritos digitalizados (imagens e PDFs), apliquem um dicionário de abreviaturas antigas e exportem todos os dados recolhidos numa tabela unificada e descarregável.

---

## ✨ Características Principais

### 1. Transcrição Consecutiva e em Lote (Batch Processing)
* **Carregamento múltiplo:** Suporta o envio simultâneo de múltiplos ficheiros (imagens e PDFs) através de uma zona de arrasto dinâmica (*Drag & Drop*).
* **Fila de processamento ativa:** Permite gerir, ordenar e transcrever ficheiros um a um ou iniciar a transcrição sequencial automática de todos os ficheiros pendentes em lote.
* **Preservação de contexto / Anexação Contínua:** Ao contrário de abordagens tradicionais, as novas transcrições são anexadas de forma incremental à base de dados existente, permitindo processar um livro inteiro página por página sem perder os dados das páginas anteriores.

### 2. Memória Inteligente (Anti-Duplicação)
* **Registo de ficheiros processados:** O servidor mantém um histórico com a assinatura digital (nome e tamanho) de cada ficheiro processado.
* **Indicadores visuais na fila:** Ficheiros já analisados anteriormente em outras sessões são identificados de forma destacada, permitindo ao utilizador decidir se deseja reprocessá-los ou mantê-los.

### 3. Dicionário Paleográfico Dinâmico
* **Tradução de abreviaturas e arcaísmos:** O motor de IA utiliza um dicionário dinâmico que traduz termos em tempo real (ex: `leg.` para `legítimo`, `f.º` para `filho`, `soltra.` para `solteira`).
* **Personalização total:** Os utilizadores podem adicionar, alterar ou remover siglas e termos diretamente a partir do painel de administração da aplicação. Todas as alterações são sincronizadas e persistidas de imediato no servidor.

### 4. Inteligência Livre de Limitação Temporal
* **Extração adaptativa de datas:** O transcritor está calibrado para não se limitar a um ano fixo (como 1861). Extrai dinamicamente o ano e o mês de nascimento/batismo diretamente do corpo do texto ou do termo de abertura.
* **Validação de campos fundamentais:** Estrutura automaticamente campos como: número de assento, data de batismo, data de nascimento, filiação, localidade, padrinhos, madrinhas, sexo do batizado, legitimidade e notas gerais.

### 5. Edição Dinâmica & Exportação
* **Formulário de correção rápida:** Permite selecionar qualquer assento recolhido e complementar ou editar manualmente os dados recolhidos através de uma interface intuitiva.
* **CRUD Completo:** Suporte total para eliminação individual de assentos inconsistentes, adição manual de novos assentos e eliminação completa da base de dados/memória para começar um novo livro do zero.
* **Exportação CSV:** Descarregamento imediato de toda a tabela compilada num formato compatível com Excel, Google Sheets ou softwares de genealogia.

---

## 🛠️ Stack Tecnológico

A aplicação foi desenhada com uma arquitetura **Full-Stack robusta e integrada**:

* **Front-end:** React (v18+) e TypeScript, estruturado sob a rapidez do Vite.
* **Estilização:** Tailwind CSS, utilizando uma paleta cromática de tons neutros, verdes e cinzas quentes que emulam o papel antigo e o ambiente clássico de arquivo e biblioteca.
* **Iconografia:** Lucide-React.
* **Back-end:** Servidor Express (Node.js) responsável pela persistência das bases de dados, histórico de ficheiros, dicionário histórico e interface de mediação da API do Gemini.
* **Motor de IA:** SDK da Google Gen AI (`@google/genai`) utilizando o modelo ultra veloz e otimizado `gemini-3.1-flash-lite`.

---

## 📂 Estrutura de Pastas e Persistência

Os dados são armazenados localmente e com garantia de persistência na pasta `/data`:

```text
├── data/
│   ├── registos.json            # Base de dados com todos os assentos de batismo gravados
│   ├── processed_files.json     # Histórico de metadados dos ficheiros já processados
│   └── dicionario.csv           # Mapeamento do dicionário paleográfico persistido
├── src/
│   ├── components/
│   │   ├── UploadPanel.tsx      # Zona de carregamento, fila de espera e processamento de ficheiros
│   │   └── DictionaryPanel.tsx  # Gestor do dicionário de termos/abreviaturas
│   ├── data/
│   │   └── sampleData.ts        # Dados demonstrativos iniciais
│   ├── App.tsx                  # Interface principal, dashboard e gestão de estado global
│   └── types.ts                 # Definições estritas de interfaces TypeScript
├── server.ts                    # Servidor Express, rotas API e integração com a API Gemini
└── package.json                 # Definição de scripts e dependências do Node
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js (v18 ou posterior)
* NPM ou Yarn

### Instruções

1. **Instalar Dependências:**
   ```bash
   npm install
   ```

2. **Configurar Chave da API Gemini:**
   Crie um ficheiro `.env` na raiz do projeto (se já não existir) e adicione a sua chave da Google AI Studio:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```

3. **Iniciar o Servidor em Modo de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Aceda à aplicação em `http://localhost:3000`.

4. **Compilar a Aplicação para Produção:**
   ```bash
   npm run build
   ```

5. **Iniciar em Produção:**
   ```bash
   npm run start
   ```

---

## 📜 Licença

Aplica-se livremente para fins académicos, de investigação pessoal ou de arquivística paroquial. Sinta-se livre para adaptar ou estender conforme as necessidades da sua diocese ou projeto de transcrição.
