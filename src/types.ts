export interface Assento {
  id: string;
  numero: string;
  diaBap: string;
  mesBap: string;
  anoBap: string;
  diaNasc: string;
  mesNasc: string;
  anoNasc: string;
  nome: string;
  sexo: "Masculino" | "Feminino" | "";
  pai: string;
  mae: string;
  avosPaternos: string;
  avosMaternos: string;
  padrinho: string;
  madrinha: string;
  local: string;
  paroco: string;
  descricaoOriginal: string;
  observacoes: string;
}

export interface DictionaryEntry {
  sigla: string;
  expansao: string;
  categoria: string;
  significado: string;
  exemplo: string;
  notas: string;
}

export interface TranscriptionRequest {
  image: string; // Base64 image
}

export interface TranscriptionResponse {
  assentos: Omit<Assento, "id">[];
  confidence: number;
}
