import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  Trash2, 
  Play, 
  X, 
  AlertTriangle, 
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { Assento } from "../types";

interface UploadPanelProps {
  onTranscriptionSuccess: (importedAssentos: Omit<Assento, "id">[]) => void;
  onLoadSamples: () => void;
  dbResetCount: number;
}

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "idle" | "processing" | "success" | "error";
  error?: string;
  alreadyProcessed: boolean;
  processedAt?: string;
}

export default function UploadPanel({ onTranscriptionSuccess, onLoadSamples, dbResetCount }: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processedMetadataList, setProcessedMetadataList] = useState<
    Array<{ fileName: string; fileSize: number; processedAt: string }>
  >([]);
  
  const [loading, setLoading] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mensagens para o ecrã de carregamento para guiar e manter o utilizador otimista
  const loadingMessages = [
    "Carregando o manuscrito para paleografia...",
    "Limpando ruído visual e ajustando níveis de contraste...",
    "Analisando caligrafia paroquial com o modelo Gemini 3.1-flash-lite...",
    "Consultando o dicionário paleográfico de Ponta Delgada para decifrar abreviaturas...",
    "A decifrar termos antigos: 'leg.', 'padr.', 'f.º' e 'soltra.'...",
    "Pesquisando nomes próprios de pessoas, locais (como Teixeira Lombada) e datas...",
    "Detetando linhas horizontais entre assentos de batismo...",
    "Estruturando os dados de batismo em colunas normalizadas...",
    "Quase pronto! Organizando a transcrição estruturada final..."
  ];

  // Carregar histórico de ficheiros já processados do backend
  useEffect(() => {
    fetchProcessedFiles();
    if (dbResetCount > 0) {
      setQueue([]);
    }
  }, [dbResetCount]);

  const fetchProcessedFiles = async () => {
    try {
      const res = await fetch("/api/processed-files");
      const result = await res.json();
      if (result.success && result.data) {
        setProcessedMetadataList(result.data);
      }
    } catch (err) {
      console.error("Erro ao carregar ficheiros processados memorizados:", err);
    }
  };

  const triggerProgressMessages = () => {
    let index = 0;
    setProgressMessage(loadingMessages[0]);
    const interval = setInterval(() => {
      index++;
      if (index < loadingMessages.length) {
        setProgressMessage(loadingMessages[index]);
      } else {
        clearInterval(interval);
      }
    }, 2800); // muda a cada 2.8 segundos
    return interval;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (filesList: FileList) => {
    const newItems: QueueItem[] = [];
    setErrorHeader(null);

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      
      // Permitir PDFs e imagens
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        setErrorHeader("Formatos suportados: Apenas imagens (PNG, JPG, WEBP) ou documentos PDF.");
        continue;
      }

      // Validar se já existe na queue para evitar duplicados locais imediatos
      const isDuplicateInQueue = queue.some(
        q => q.file.name === file.name && q.file.size === file.size
      );
      if (isDuplicateInQueue) continue;

      // Verificar com a lista históricos se já foi processado no servidor
      const serverMatch = processedMetadataList.find(
        p => p.fileName === file.name && p.fileSize === file.size
      );

      const isAlreadySaved = !!serverMatch;
      const itemId = `file-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;

      const item: QueueItem = {
        id: itemId,
        file: file,
        previewUrl: "",
        status: "idle",
        alreadyProcessed: isAlreadySaved,
        processedAt: serverMatch?.processedAt
      };

      newItems.push(item);

      // Leitura assíncrona do Base64 do ficheiro
      const reader = new FileReader();
      reader.onload = () => {
        setQueue(prev => 
          prev.map(q => q.id === itemId ? { ...q, previewUrl: reader.result as string } : q)
        );
      };
      reader.readAsDataURL(file);
    }

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Transcrever um ficheiro em específico
  const transcribeSingleItem = async (item: QueueItem): Promise<boolean> => {
    if (item.status === "processing") return false;

    // Se o previewUrl ainda não carregou no reader, esperar um instante
    let base64Data = item.previewUrl;
    if (!base64Data) {
      try {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Falha ao ler dados do ficheiro."));
          reader.readAsDataURL(item.file);
        });
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, previewUrl: base64Data } : q));
      } catch (err: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "error", error: err.message } : q));
        return false;
      }
    }

    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "processing", error: undefined } : q));
    
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ image: base64Data })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ocorreu um erro ao transcrever.");
      }

      if (result.success && result.assentos) {
        onTranscriptionSuccess(result.assentos);

        // Registar o ficheiro como processado no histórico do servidor
        await fetch("/api/processed-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: item.file.name, fileSize: item.file.size })
        });

        // Adicionar localmente à lista de processados
        setProcessedMetadataList(prev => [
          ...prev,
          { fileName: item.file.name, fileSize: item.file.size, processedAt: new Date().toISOString() }
        ]);

        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: "success", 
          alreadyProcessed: true, 
          processedAt: new Date().toISOString() 
        } : q));

        return true;
      } else {
        throw new Error("Nenhum assento de batismo estruturado foi identificado.");
      }
    } catch (err: any) {
      console.error(err);
      setQueue(prev => prev.map(q => q.id === item.id ? { 
        ...q, 
        status: "error", 
        error: err.message || "Erro desconhecido." 
      } : q));
      return false;
    }
  };

  // Transcrever todos os itens pendentes da queue consecutivamente (Lote)
  const handleTranscribeBatch = async () => {
    const idleList = queue.filter(q => q.status === "idle" || q.status === "error");
    if (idleList.length === 0) return;

    setLoading(true);
    setIsBatchProcessing(true);
    const progressInterval = triggerProgressMessages();

    try {
      for (const item of idleList) {
        // Se já foi processado e o utilizador quiser forçar, ele processa. Como está na queue, deixamos processar.
        await transcribeSingleItem(item);
      }
    } catch (err) {
      console.error("Erro no processamento do lote:", err);
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setIsBatchProcessing(false);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearQueue = () => {
    if (window.confirm("Tem a certeza que deseja remover todos os ficheiros da listagem?")) {
      setQueue([]);
    }
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  const hasPendents = queue.some(q => q.status === "idle" || q.status === "error");

  return (
    <div id="upload-panel-container" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Transcrição de Manuscritos
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">Lote & Memória Ativos</span>
          </div>
        </div>
        <button
          onClick={onLoadSamples}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium py-1 px-2.5 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          Carregar Demonstrações
        </button>
      </div>

      {errorHeader && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-600 flex items-start gap-1.5 animate-fade-in">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{errorHeader}</span>
        </div>
      )}

      {/* DROPZONE */}
      <div
        id="drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={handleButtonClick}
        className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-indigo-500 bg-indigo-50/55 scale-[0.99]"
            : "border-slate-250 hover:border-indigo-400 hover:bg-slate-50/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          multiple
          onChange={handleChange}
        />

        <div className="text-center space-y-2 pointer-events-none">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <Upload className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-700">
              Arraste registos paroquiais (Páginas ou PDFs)
            </p>
            <p className="text-[10px] text-slate-400">
              Pressione para procurar no computador • Seleção múltipla permitida
            </p>
          </div>
        </div>
      </div>

      {/* QUEUE LIST */}
      {queue.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-1.5 border-slate-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">
              Fila de Processamento ({queue.length})
            </span>
            <button
              onClick={clearQueue}
              className="text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer bg-red-50/10 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Limpar Lista
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {queue.map((item) => {
              const fileType = item.file.type;
              const isPdf = fileType === "application/pdf";
              
              return (
                <div 
                  key={item.id} 
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
                    item.status === "processing" 
                      ? "bg-indigo-50/40 border-indigo-200 animate-pulse" 
                      : item.status === "success"
                        ? "bg-emerald-50/20 border-emerald-150"
                        : item.status === "error"
                          ? "bg-red-50/20 border-red-150"
                          : item.alreadyProcessed
                            ? "bg-amber-50/20 border-amber-150"
                            : "bg-slate-50/50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {isPdf ? (
                      <div className="bg-rose-55 hover:bg-rose-100 p-1.5 rounded text-rose-600 flex-shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="bg-sky-55 hover:bg-sky-100 p-1.5 rounded text-sky-600 flex-shrink-0">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                    
                    <div className="overflow-hidden flex-1">
                      <p className="font-medium text-slate-800 text-[11px] truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex gap-2 items-center text-[9px] text-slate-500 font-mono flex-wrap">
                        <span>{formatSize(item.file.size)}</span>
                        
                        {/* Memory Check Badge */}
                        {item.alreadyProcessed && (
                          <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.1 rounded font-sans font-medium flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 inline" /> Já processado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CONTROLS POR ITEM */}
                  <div className="flex items-center gap-1.5">
                    {item.status === "idle" && (
                      <button
                        onClick={() => transcribeSingleItem(item)}
                        disabled={loading}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg cursor-pointer transition-colors"
                        title={item.alreadyProcessed ? "Este ficheiro já foi processado. Deseja reprocessar?" : "Transcrever este ficheiro"}
                      >
                        <Play className="h-3 w-3 fill-indigo-600" />
                      </button>
                    )}

                    {item.status === "processing" && (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0 m-1" />
                    )}

                    {item.status === "success" && (
                      <span className="p-1 bg-emerald-50 text-emerald-600 border border-emerald-250 rounded-lg flex items-center justify-center m-0.5" title="Transcriturado com sucesso">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                    )}

                    {item.status === "error" && (
                      <button
                        onClick={() => transcribeSingleItem(item)}
                        className="p-1 bg-red-50 text-red-600 border border-red-200 rounded-lg flex items-center justify-center m-0.5"
                        title={item.error || "Erro ao processar. Tentar novamente?"}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}

                    <button
                      onClick={() => removeFromQueue(item.id)}
                      disabled={item.status === "processing"}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50/50 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remover da lista de espera"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOTAL BATCH ACTIONS */}
          {hasPendents && (
            <div className="pt-2 animate-fade-in">
              <button
                onClick={handleTranscribeBatch}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs hover:shadow-md transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isBatchProcessing ? "A transcrever lote sequencial..." : "A processar..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Transcrever Ficheiros Pendentes ({queue.filter(q => q.status === "idle" || q.status === "error").length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* BATCH PROGRESS STATUS TEXT */}
      {loading && (
        <div id="loading-overlay" className="mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex gap-2.5 items-start animate-fade-in">
          <Loader2 className="h-4.5 w-4.5 text-indigo-500 animate-spin flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-[11px] font-bold text-indigo-800">
              Transcrição Ativa Através do Gemini
            </h4>
            <p className="text-[10px] text-indigo-600 leading-normal italic font-mono transition-all duration-300">
              {progressMessage || "Descodificando registos paroquiais..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Pequeno ícone auxiliar para o badge já processado
function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
