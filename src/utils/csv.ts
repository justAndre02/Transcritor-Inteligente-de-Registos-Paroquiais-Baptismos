import { DictionaryEntry, Assento } from "../types";

/**
 * Robust CSV parser that correctly handles double quotes and commas within fields.
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip \n
      }
      row.push(currentField.trim());
      if (row.length > 0 && row.some(cell => cell !== "")) {
        lines.push(row);
      }
      row = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Handle last line if no trailing newline
  if (currentField !== "" || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(cell => cell !== "")) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Converts Dictionary CSV rows back into structured objects.
 */
export function csvToDictionary(csvText: string): DictionaryEntry[] {
  const parsed = parseCSV(csvText);
  if (parsed.length <= 1) return [];

  const headers = parsed[0].map(h => h.toLowerCase());
  const entries: DictionaryEntry[] = [];

  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < 2) continue;

    entries.push({
      sigla: row[0] || "",
      expansao: row[1] || "",
      categoria: row[2] || "",
      significado: row[3] || "",
      exemplo: row[4] || "",
      notas: row[5] || ""
    });
  }

  return entries;
}

/**
 * Translates dictionary entries back into CSV string.
 */
export function dictionaryToCSV(entries: DictionaryEntry[]): string {
  const headers = ["Sigla", "Expansão", "Categoria", "Significado / Uso", "Exemplo Tipo (data/arquivo)", "Notas / Transcrição"];
  const rows = [headers.join(",")];

  for (const entry of entries) {
    const fields = [
      entry.sigla,
      entry.expansao,
      entry.categoria,
      entry.significado,
      entry.exemplo,
      entry.notas
    ];
    const escapedFields = fields.map(field => {
      const escaped = field.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    rows.push(escapedFields.join(","));
  }

  return rows.join("\n");
}

/**
 * Convert Assento list to CSV
 */
export function assentosToCSV(assentos: Assento[]): string {
  const headers = [
    "Número de Assento",
    "Dia do Batismo",
    "Mês do Batismo",
    "Ano do Batismo",
    "Dia de Nascimento",
    "Mês de Nascimento",
    "Ano de Nascimento",
    "Nome do Baptizado",
    "Sexo",
    "Pai",
    "Mãe",
    "Avós Paternos",
    "Avós Maternos",
    "Padrinho",
    "Madrinha",
    "Local/Sítio",
    "Pároco/Celebrante",
    "Descrição/Transcrição Original",
    "Observações"
  ];

  const rows = [headers.join(",")];

  for (const a of assentos) {
    const fields = [
      a.numero,
      a.diaBap,
      a.mesBap,
      a.anoBap,
      a.diaNasc,
      a.mesNasc,
      a.anoNasc,
      a.nome,
      a.sexo,
      a.pai,
      a.mae,
      a.avosPaternos,
      a.avosMaternos,
      a.padrinho,
      a.madrinha,
      a.local,
      a.paroco,
      a.descricaoOriginal,
      a.observacoes
    ];

    const escapedFields = fields.map(field => {
      const val = field ? String(field) : "";
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    });

    rows.push(escapedFields.join(","));
  }

  return rows.join("\n");
}
