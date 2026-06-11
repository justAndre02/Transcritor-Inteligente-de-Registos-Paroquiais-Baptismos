import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { parseCSV, csvToDictionary, dictionaryToCSV } from "./src/utils/csv.js";

dotenv.config();

const port = 3000;
const app = express();


// Garantir que a pasta /data existe
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Caminhos dos ficheiros
const DICIONARIO_PATH = path.join(DATA_DIR, "dicionario.csv");
const REGISTOS_PATH = path.join(DATA_DIR, "registos.json");

// Inicializar dicionario se não existir
if (!fs.existsSync(DICIONARIO_PATH)) {
  // Se por alguma razão o dicionário principal não foi criado antes, nós criamos um vazio/básico
  fs.writeFileSync(DICIONARIO_PATH, "Sigla,Expansão,Categoria,Significado / Uso,Exemplo Tipo (data/arquivo),Notas / Transcrição\n", "utf8");
}

// Inicializar registos se não existir
if (!fs.existsSync(REGISTOS_PATH)) {
  fs.writeFileSync(REGISTOS_PATH, JSON.stringify([], null, 2), "utf8");
}

const PROCESSED_FILES_PATH = path.join(DATA_DIR, "processed_files.json");
if (!fs.existsSync(PROCESSED_FILES_PATH)) {
  fs.writeFileSync(PROCESSED_FILES_PATH, JSON.stringify([], null, 2), "utf8");
}

// Middleware para aumento de limites de payload (imagens base64 grandes)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Inicializar cliente Gemini se a chave de API estiver presente
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("⚠️ GEMINI_API_KEY não foi encontrada nas variáveis de ambiente! Chamadas à API do Gemini irão falhar.");
}

// ROTAS DA API

// 1. Dicionário Paleográfico (Obter)
app.get("/api/dictionary", (req, res) => {
  try {
    if (fs.existsSync(DICIONARIO_PATH)) {
      const csvContent = fs.readFileSync(DICIONARIO_PATH, "utf8");
      
      const parsedEntries = csvToDictionary(csvContent);
      res.json({ success: true, csv: csvContent, entries: parsedEntries });
    } else {
      res.status(404).json({ error: "Ficheiro de dicionário não encontrado." });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao ler dicionário: ${err.message}` });
  }
});

// 2. Dicionário Paleográfico (Atualizar)
app.post("/api/dictionary", (req, res) => {
  try {
    const { csv, entries } = req.body;
    let finalCSV = csv;

    if (entries && Array.isArray(entries)) {
      finalCSV = dictionaryToCSV(entries);
    }

    if (finalCSV) {
      fs.writeFileSync(DICIONARIO_PATH, finalCSV, "utf8");
      const parsedEntries = csvToDictionary(finalCSV);
      res.json({ success: true, csv: finalCSV, entries: parsedEntries });
    } else {
      res.status(400).json({ error: "Conteúdo inválido fornecido." });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao salvar dicionário: ${err.message}` });
  }
});

// 3. Batismos / Registos Gravados (Obter)
app.get("/api/registos", (req, res) => {
  try {
    if (fs.existsSync(REGISTOS_PATH)) {
      const content = fs.readFileSync(REGISTOS_PATH, "utf8");
      res.json({ success: true, data: JSON.parse(content) });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao ler registos: ${err.message}` });
  }
});

// 4. Batismos / Registos Gravados (Salvar)
app.post("/api/registos", (req, res) => {
  try {
    const { data } = req.body;
    if (data && Array.isArray(data)) {
      fs.writeFileSync(REGISTOS_PATH, JSON.stringify(data, null, 2), "utf8");
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Dados inválidos fornecidos." });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao salvar registos: ${err.message}` });
  }
});

// 4.1 Limpar toda a Base de Dados e Histórico de Memória
app.post("/api/clear-all", (req, res) => {
  try {
    fs.writeFileSync(REGISTOS_PATH, JSON.stringify([], null, 2), "utf8");
    fs.writeFileSync(PROCESSED_FILES_PATH, JSON.stringify([], null, 2), "utf8");
    res.json({ success: true, message: "Base de dados e histórico de ficheiros limpos com sucesso!" });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao limpar base de dados e histórico: ${err.message}` });
  }
});

// 4.5. Obter ficheiros processados memorizados
app.get("/api/processed-files", (req, res) => {
  try {
    if (fs.existsSync(PROCESSED_FILES_PATH)) {
      const content = fs.readFileSync(PROCESSED_FILES_PATH, "utf8");
      res.json({ success: true, data: JSON.parse(content) });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao obter arquivos processados: ${err.message}` });
  }
});

// Adicionar um novo ficheiro processado memorizado
app.post("/api/processed-files", (req, res) => {
  try {
    const { fileName, fileSize } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: "Nome do ficheiro é mandatório." });
    }
    let current: any[] = [];
    if (fs.existsSync(PROCESSED_FILES_PATH)) {
      current = JSON.parse(fs.readFileSync(PROCESSED_FILES_PATH, "utf8"));
    }
    
    const exists = current.some(f => f.fileName === fileName && f.fileSize === fileSize);
    if (!exists) {
      current.push({
        fileName,
        fileSize,
        processedAt: new Date().toISOString()
      });
      fs.writeFileSync(PROCESSED_FILES_PATH, JSON.stringify(current, null, 2), "utf8");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao registar ficheiro processado: ${err.message}` });
  }
});

// 5. Transcrever Manuscrito usando Gemini 3.1-flash-lite
app.post("/api/transcribe", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Falta a imagem ou documento PDF do manuscrito em formato base64." });
    }

    if (!ai) {
      return res.status(500).json({
        error: "O serviço IA do Gemini não está configurado. Verifique se a variável GEMINI_API_KEY está definida."
      });
    }

    // Carregar dicionário histórico para guiar a IA
    let dicionarioTxt = "";
    if (fs.existsSync(DICIONARIO_PATH)) {
      dicionarioTxt = fs.readFileSync(DICIONARIO_PATH, "utf8");
    }

    // Extrair apenas os dados do cabeçalho da imagem base64 ou PDF base64 (removendo "data:image/png;base64," ou "data:application/pdf;base64,")
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = "image/png";
    let base64Data = image;

    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    const documentPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    };

    const textPart = {
      text: `Analise a página do manuscrito ou documento PDF de batismo histórico fornecido (Ponta Delgada, Açores).
Os registos geralmente contêm termos corrido/em parágrafos, iniciados por anotações de margem à esquerda com nomes ou abreviaturas.
Um registo paroquial de batismo individual normalmente termina quando encontra uma linha horizontal que vai de margem a margem.

Aqui está um dicionário de paleografia e termos antigos portugueses mapeados. Use estas regras para converter as abreviaturas para as formas expandidas modernas e deduzir os nomes e categorias corretas:
=== Dicionário Paleográfico (CSV de Mapeamento) ===
${dicionarioTxt}
===================================================

Identifique TODOS os assentos de batismo visíveis na página/documento fornecido (pode haver um, mais do que um, ou nenhum, de qualquer ano do século XIX/XVIII).
Identifique o ano exato do evento a partir do texto do próprio assento, cabeçalhos ou termo de abertura de ano presente na imagem/documento.
Traduza e preencha as siglas e termos de acordo com o dicionário fornecido (ex: 'leg.' deve virar 'legítimo', 'f.ª m.' deve virar filha menor, expandir nomes próprios arcaicos ou abreviados, ex: 'Joaq.m' para 'Joaquim', 'M.a' para 'Maria', 'Nuberta' para 'Noberta').

Formate a resposta rigidamente conforme o esquema JSON solicitado.`
    };

    console.log(`Enviando solicitação ao Gemini 3.1-flash-lite (MIME: ${mimeType})...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", // Conforme requisitado: modelo rápido e leve
      contents: [documentPart, textPart],
      config: {
        systemInstruction: `Você é um paleógrafo e arquivista profissional especialista em registros paroquiais de batismo portugueses (Açores - Ponta Delgada).
Seu objetivo é analisar as imagens ou documentos PDF das páginas do manuscrito e extrair informações precisas e estruturadas em formato JSON de acordo com o esquema definido.
Atenção redobrada para identificar corretamente o ano do evento (ano de nascimento e batismo) a partir das passagens do texto (ex: 'aos vinte dias do mês de Janeiro do ano de mil oitocentos e sessenta e um' -> anoBap ou anoNasc = 1861, ou 'mil oitocentos e sessenta' -> 1860, etc.).
Use o dicionário de paleografia fornecido no prompt para expandir siglas como "padr.", "madr.", "f.º", "f.ª", "leg.", "caz.", etc.
Se houver informações arcaicas, converta-as nas formas modernas e explicite nas Observações o estado de legitimidade e outras características.
Não invente informações que não estejam na imagem ou no documento. Se um campo não puder ser lido, deixe-o em branco.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assentos: {
              type: Type.ARRAY,
              description: "Lista de todos os assentos de batismo identificados e transcritos individualmente da página",
              items: {
                type: Type.OBJECT,
                properties: {
                  numero: { type: Type.STRING, description: "Número do assento paroquial (geralmente na margem esquerda superior do evento, ex: '1')" },
                  diaBap: { type: Type.STRING, description: "Dia em que ocorreu o batismo" },
                  mesBap: { type: Type.STRING, description: "Mês em que ocorreu o batismo" },
                  anoBap: { type: Type.STRING, description: "Ano em que ocorreu o batismo (extraído do texto, cabeçalho ou termo anual do livro, ex: '1861', '1860', etc.)" },
                  diaNasc: { type: Type.STRING, description: "Dia em que o batizado nasceu" },
                  mesNasc: { type: Type.STRING, description: "Mês em que o batizado nasceu" },
                  anoNasc: { type: Type.STRING, description: "Ano em que o batizado nasceu" },
                  nome: { type: Type.STRING, description: "Nome moderno e atualizado do batizado (ex: expandir 'Maria' ou 'Manoel' etc.)" },
                  sexo: { type: Type.STRING, description: "Sexo do batizado ('Masculino' ou 'Feminino')" },
                  pai: { type: Type.STRING, description: "Nome completo do pai do batizado (usando expansões do dicionário). Se não houver pai listado ou for incógnito, registre 'Pai incógnito'" },
                  mae: { type: Type.STRING, description: "Nome completo da mãe da batizada" },
                  avosPaternos: { type: Type.STRING, description: "Nomes dos avós paternos (ex: 'Nome do avô e Nome da avó'). Se não houver, deixe em branco" },
                  avosMaternos: { type: Type.STRING, description: "Nomes dos avós maternos (ex: 'Nome do avô e Nome da avó')" },
                  padrinho: { type: Type.STRING, description: "Nome do padrinho (ex: 'Manoel Rodrigues Anjo')" },
                  madrinha: { type: Type.STRING, description: "Nome da madrinha (ex: 'Nossa Senhora do Carmo')" },
                  local: { type: Type.STRING, description: "Lugar, Sítio ou residência da família (ex: 'Teixeira Lombada', 'Pico', 'Enxurros')" },
                  paroco: { type: Type.STRING, description: "Nome do pároco, vice-vigário ou celebrante (ex: 'João Joaquim Figueira da Silva')" },
                  descricaoOriginal: { type: Type.STRING, description: "Um resumo literal de linhas iniciais relevantes ou notas do paleólogo sobre o assento" },
                  observacoes: { type: Type.STRING, description: "Notas adicionais de interesse histórico, legitimidade (legítimo/ilegítimo), profissões dos pais, estado civil dos padrinhos e padrinhos espirituais, etc." }
                },
                required: ["numero", "diaBap", "mesBap", "anoBap", "nome", "sexo", "mae", "padrinho", "madrinha", "local", "paroco"]
              }
            }
          }
        }
      }
    });

    console.log("Recebida resposta do Gemini.");
    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr.trim());
    
    res.json({ success: true, assentos: data.assentos || [] });
  } catch (err: any) {
    console.error("Erro no processamento do Gemini:", err);
    res.status(500).json({ error: `Erro no processamento da IA: ${err.message}` });
  }
});


// Configurar Servidor de Produção ou Desenvolvimento (Vite Middleware)
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor full-stack rodando em http://localhost:${port}`);
  });
}

startServer();
