/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Search, 
  Download, 
  BookOpen, 
  Sparkles, 
  Users, 
  MapPin, 
  Calendar, 
  Check, 
  X, 
  Edit3, 
  FileDown, 
  RotateCcw, 
  Info,
  ChevronRight,
  Database,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Assento, DictionaryEntry } from "./types";
import { SAMPLE_ASSENTOS } from "./data/sampleData";
import { assentosToCSV, csvToDictionary, dictionaryToCSV } from "./utils/csv";
import UploadPanel from "./components/UploadPanel";

export default function App() {
  // State for Baptisms Database
  const [assentos, setAssentos] = useState<Assento[]>([]);
  const [selectedAssento, setSelectedAssento] = useState<Assento | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Legítimo" | "Natural/Ilegítimo">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "Masculino" | "Feminino">("all");
  const [localFilter, setLocalFilter] = useState("all");
  const [dbResetCount, setDbResetCount] = useState(0);

  // State for Dictionary
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [dictSearch, setDictSearch] = useState("");
  const [dictCategoryFilter, setDictCategoryFilter] = useState("all");
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [newDictEntry, setNewDictEntry] = useState<Omit<DictionaryEntry, "exemplo">>({
    sigla: "",
    expansao: "",
    categoria: "nomes próprios",
    significado: "",
    notas: ""
  });

  // UI state
  const [serverLoading, setServerLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"all" | "manual">("all");
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for creating/editing an Assento
  const [formState, setFormState] = useState<Omit<Assento, "id">>({
    numero: "",
    diaBap: "",
    mesBap: "Janeiro",
    anoBap: "",
    diaNasc: "",
    mesNasc: "Janeiro",
    anoNasc: "",
    nome: "",
    sexo: "Feminino",
    pai: "",
    mae: "",
    avosPaternos: "",
    avosMaternos: "",
    padrinho: "",
    madrinha: "",
    local: "",
    paroco: "João Joaquim Figueira da Silva",
    descricaoOriginal: "",
    observacoes: ""
  });

  // Load Initial Data from Server
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setServerLoading(true);
    try {
      // 1. Fetch Dictionary
      const dictRes = await fetch("/api/dictionary");
      const dictData = await dictRes.json();
      if (dictData.success && dictData.entries) {
        setDictionary(dictData.entries);
      }

      // 2. Fetch Registry Assentos
      const regRes = await fetch("/api/registos");
      const regData = await regRes.json();
      if (regData.success) {
        if (regData.data && regData.data.length > 0) {
          setAssentos(regData.data);
          setSelectedAssento(regData.data[0]);
        } else {
          setAssentos([]);
          setSelectedAssento(null);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados iniciais:", err);
      // Fallback local samples
      setAssentos(SAMPLE_ASSENTOS);
      setSelectedAssento(SAMPLE_ASSENTOS[0]);
    } finally {
      setServerLoading(false);
    }
  };

  // Sync Registry to Server
  const saveRegistosToServer = async (data: Assento[]) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/registos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data })
      });
      if (res.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  };

  // Sync Dictionary to Server
  const saveDictionaryToServer = async (entries: DictionaryEntry[]) => {
    try {
      await fetch("/api/dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries })
      });
    } catch (err) {
      console.error("Erro ao sincronizar dicionário com o servidor:", err);
    }
  };

  // Helper Auto-Translation using paleography dictionary
  const applyDictionaryRulesToText = (text: string): string => {
    if (!text || dictionary.length === 0) return text;
    let expanded = text;
    // Walk over dictionary sigla matches
    // Sort abbreviations by length descending to avoid greedy partial replacement in overlapping terms
    const sortedDict = [...dictionary].sort((a, b) => b.sigla.length - a.sigla.length);
    
    for (const entry of sortedDict) {
      // Clean target sigla for simple matching
      const target = entry.sigla.trim();
      if (!target || target.length < 2) continue;

      // Simple regex replacement for whole abbreviations or parenthetical sigla
      try {
        const escapedTarget = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTarget}\\b`, 'gi');
        expanded = expanded.replace(regex, entry.expansao);
      } catch (e) {
        // Fallback simple replace
        expanded = expanded.replace(target, entry.expansao);
      }
    }
    return expanded;
  };

  // Handle AI Transcription insertion
  const handleTranscriptionSuccess = (newImported: Omit<Assento, "id">[]) => {
    const freshAssentos: Assento[] = newImported.map((item, index) => ({
      ...item,
      id: `ai-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`
    }));

    setAssentos(prev => {
      const updated = [...freshAssentos, ...prev];
      saveRegistosToServer(updated);
      setSelectedAssento(freshAssentos[0] || null);
      return updated;
    });

    showNotification("success", `Sucesso! Transcritor identificou e registou ${freshAssentos.length} assento(s) novos.`);
  };

  // Load local mock preview samples manually
  const handleLoadSamples = async () => {
    setAssentos(SAMPLE_ASSENTOS);
    setSelectedAssento(SAMPLE_ASSENTOS[0]);
    await saveRegistosToServer(SAMPLE_ASSENTOS);
    showNotification("success", "Exemplos oficiais carregados com sucesso!");
  };

  const showNotification = (type: "success" | "error", text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  // Triggering Manual CSV Download
  const handleExportCSV = () => {
    const csvContent = assentosToCSV(assentos);
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "transcricoes_batismo_pontadelgada.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("success", "Base de dados exportada excelentemente para CSV!");
  };

  // Reset Edit Form
  const resetForm = (assentoToLoad?: Assento) => {
    if (assentoToLoad) {
      setFormState({
        numero: assentoToLoad.numero || "",
        diaBap: assentoToLoad.diaBap || "",
        mesBap: assentoToLoad.mesBap || "Janeiro",
        anoBap: assentoToLoad.anoBap || "",
        diaNasc: assentoToLoad.diaNasc || "",
        mesNasc: assentoToLoad.mesNasc || "Janeiro",
        anoNasc: assentoToLoad.anoNasc || "",
        nome: assentoToLoad.nome || "",
        sexo: assentoToLoad.sexo || "Feminino",
        pai: assentoToLoad.pai || "",
        mae: assentoToLoad.mae || "",
        avosPaternos: assentoToLoad.avosPaternos || "",
        avosMaternos: assentoToLoad.avosMaternos || "",
        padrinho: assentoToLoad.padrinho || "",
        madrinha: assentoToLoad.madrinha || "",
        local: assentoToLoad.local || "",
        paroco: assentoToLoad.paroco || "João Joaquim Figueira da Silva",
        descricaoOriginal: assentoToLoad.descricaoOriginal || "",
        observacoes: assentoToLoad.observacoes || ""
      });
    } else {
      setFormState({
        numero: String(assentos.length + 1),
        diaBap: "1",
        mesBap: "Janeiro",
        anoBap: "",
        diaNasc: "1",
        mesNasc: "Janeiro",
        anoNasc: "",
        nome: "",
        sexo: "Feminino",
        pai: "",
        mae: "",
        avosPaternos: "",
        avosMaternos: "",
        padrinho: "",
        madrinha: "",
        local: "",
        paroco: "João Joaquim Figueira da Silva",
        descricaoOriginal: "",
        observacoes: ""
      });
    }
  };

  // Save changes from Edit or Add New
  const handleSaveAssento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.nome) {
      showNotification("error", "O nome do batizado é obrigatório.");
      return;
    }

    if (isEditing && selectedAssento) {
      // Editing Mode
      const updatedList = assentos.map(item => {
        if (item.id === selectedAssento.id) {
          return { ...formState, id: selectedAssento.id };
        }
        return item;
      });
      setAssentos(updatedList);
      setSelectedAssento({ ...formState, id: selectedAssento.id });
      saveRegistosToServer(updatedList);
      setIsEditing(false);
      showNotification("success", "Assento paroquial atualizado com sucesso!");
    } else {
      // Create Mode
      const newRecord: Assento = {
        ...formState,
        id: `manual-${Date.now()}`
      };
      const updatedList = [newRecord, ...assentos];
      setAssentos(updatedList);
      setSelectedAssento(newRecord);
      saveRegistosToServer(updatedList);
      setActiveTab("all");
      showNotification("success", "Novo assento histórico inserido com sucesso!");
    }
  };

  // Delete Action
  const handleDeleteAssento = (id: string) => {
    setAssentos(prev => {
      const filtered = prev.filter(item => item.id !== id);
      saveRegistosToServer(filtered);
      
      setSelectedAssento(curr => {
        if (curr && curr.id === id) {
          return filtered[0] || null;
        }
        return curr;
      });
      
      return filtered;
    });
    showNotification("success", "Registo paroquial eliminado.");
  };

  // Clear Database Action
  const handleClearAllDatabase = async () => {
    try {
      const res = await fetch("/api/clear-all", { method: "POST" });
      if (res.ok) {
        setAssentos([]);
        setSelectedAssento(null);
        setDbResetCount(prev => prev + 1);
        showNotification("success", "Toda a Base de Dados e memória de ficheiros foram limpos com sucesso!");
      } else {
        showNotification("error", "Erro ao comunicar com o servidor.");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("error", `Erro: ${err.message}`);
    }
  };

  // Add entry to dictionary
  const handleAddDictWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDictEntry.sigla || !newDictEntry.expansao) {
      showNotification("error", "A sigla e expansão são mandatórias!");
      return;
    }

    const element: DictionaryEntry = {
      ...newDictEntry,
      exemplo: ""
    };

    const updatedDict = [element, ...dictionary];
    setDictionary(updatedDict);
    saveDictionaryToServer(updatedDict);
    
    // reset form inputs
    setNewDictEntry({
      sigla: "",
      expansao: "",
      categoria: "nomes próprios",
      significado: "",
      notes: ""
    } as any);

    showNotification("success", `Abreviatura '${element.sigla}' mapeada com sucesso para '${element.expansao}'!`);
  };

  // Remove entry from dictionary
  const handleDeleteDictWord = (sigla: string) => {
    const updated = dictionary.filter(item => item.sigla !== sigla);
    setDictionary(updated);
    saveDictionaryToServer(updated);
    showNotification("success", "Mapeamento removido do dicionário.");
  };

  // Generate categories for filter dropdown
  const uniqueLocals = Array.from(new Set(assentos.map(a => a.local).filter(Boolean)));
  const listCategories = Array.from(new Set(dictionary.map(d => d.categoria).filter(Boolean)));

  // Filter Baptisms List
  const filteredAssentos = assentos.filter(assento => {
    const query = searchTerm.toLowerCase();
    const matchSearch = 
      (assento.nome || "").toLowerCase().includes(query) ||
      (assento.pai || "").toLowerCase().includes(query) ||
      (assento.mae || "").toLowerCase().includes(query) ||
      (assento.local || "").toLowerCase().includes(query) ||
      (assento.numero || "").toLowerCase().includes(query) ||
      (assento.observacoes || "").toLowerCase().includes(query);

    const isLegitimoStr = (assento.observacoes || "").toLowerCase().includes("legítim") || (assento.descricaoOriginal || "").toLowerCase().includes("legítim");
    const isNaturalStr = (assento.observacoes || "").toLowerCase().includes("natural") || (assento.observacoes || "").toLowerCase().includes("ilegítim") || (assento.descricaoOriginal || "").toLowerCase().includes("natural") || (assento.descricaoOriginal || "").toLowerCase().includes("incognito");

    let matchStatus = true;
    if (statusFilter === "Legítimo") {
      matchStatus = isLegitimoStr && !isNaturalStr;
    } else if (statusFilter === "Natural/Ilegítimo") {
      matchStatus = isNaturalStr;
    }

    const matchGender = genderFilter === "all" || assento.sexo === genderFilter;
    const matchLocal = localFilter === "all" || assento.local === localFilter;

    return matchSearch && matchStatus && matchGender && matchLocal;
  });

  // Filter Dictionary
  const filteredDictEntries = dictionary.filter(entry => {
    const query = dictSearch.toLowerCase();
    const matchesTxt = 
      (entry.sigla || "").toLowerCase().includes(query) ||
      (entry.expansao || "").toLowerCase().includes(query) ||
      (entry.significado || "").toLowerCase().includes(query) ||
      (entry.notas || "").toLowerCase().includes(query);
    
    const matchesCat = dictCategoryFilter === "all" || entry.categoria === dictCategoryFilter;
    return matchesTxt && matchesCat;
  });

  // Basic stats calculators
  const statsTotal = assentos.length;
  const statsLegitimateCount = assentos.filter(a => {
    const text = ((a.observacoes || "") + " " + (a.descricaoOriginal || "")).toLowerCase();
    return text.includes("legítim") && !text.includes("natural") && !text.includes("incognito");
  }).length;
  const statsPercentageLegit = statsTotal > 0 ? Math.round((statsLegitimateCount / statsTotal) * 100) : 0;
  
  const statsUniqueLocals = uniqueLocals.length;

  return (
    <div className="min-h-screen bg-natural-bg text-natural-dark font-sans flex flex-col antialiased">
      
      {/* HEADER */}
      <header className="h-20 px-6 md:px-10 flex items-center justify-between border-b border-[#dcd9d4] bg-natural-header shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-natural-olive flex items-center justify-center text-white italic font-serif text-xl border border-natural-olive/20 shadow-xs">
            PD
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-natural-muted-text font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
              Arquivo Diocesano de Ponta Delgada • Açores
            </span>
            <h1 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-natural-near-black leading-tight flex items-center gap-2">
              Livro de Baptismos
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Status badge */}
          {saveStatus === "saving" && (
            <span className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              A gravar alterações...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-full flex items-center gap-1 animate-fade-in">
              <Check className="h-3 w-3" /> Gravado em servidor
            </span>
          )}

          <button
            onClick={() => setShowDictionaryModal(true)}
            id="btn-open-dict"
            className="flex items-center gap-2 px-4 py-2 border border-natural-olive text-natural-olive hover:bg-natural-olive hover:text-white rounded-full text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Dicionário Paleográfico ({dictionary.length})
          </button>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2 bg-natural-olive text-white hover:opacity-90 rounded-full text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            Exportar .CSV Estruturado
          </button>
        </div>
      </header>

      {/* GLOBAL NOTIFICATION ALERT SLOT */}
      {alertMsg && (
        <div className={`p-4 border-b text-sm transition-all text-center flex items-center justify-center gap-2 ${
          alertMsg.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-850" 
            : "bg-red-50 border-red-100 text-red-850"
        }`}>
          {alertMsg.type === "success" ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <strong>{alertMsg.text}</strong>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-[1700px] mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* LEFT COLUMN (1/3 Width) - AI Image Transcribe & Quick Reference */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          
          {/* AI Scanners and Droppers */}
          <UploadPanel 
            onTranscriptionSuccess={handleTranscriptionSuccess} 
            onLoadSamples={handleLoadSamples} 
            dbResetCount={dbResetCount}
          />

          {/* Dictionary Translation Preview helper */}
          <div className="bg-natural-paper border border-[#dcd9d4] rounded-2xl p-6 flex flex-col flex-1 min-h-[300px] shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-natural-muted-text border-b border-[#e5e2db] pb-3 mb-4 flex items-center justify-between">
              <span>Termos Paleográficos Frequentes</span>
              <BookOpen className="h-4 w-4 text-natural-olive/60" />
            </h3>
            
            <p className="text-xs text-natural-muted-text mb-4">
              Os manuscritos utilizam caligrafia paroquial do século XIX repleta de reduções e termos canónicos. O descodificador interpreta instantaneamente estes termos:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {dictionary.slice(0, 10).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-natural-bg/40 text-xs border border-slate-100">
                  <span className="font-mono font-bold text-natural-dark text-[11px] bg-[#efede8] px-2 py-0.5 rounded-sm">
                    {entry.sigla}
                  </span>
                  <ChevronRight className="h-3 w-3 text-natural-muted-text/60" />
                  <span className="font-serif italic text-natural-olive font-medium text-[13px] text-right">
                    {entry.expansao}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#e5e2db] flex justify-between items-center text-xs">
              <span className="text-natural-muted-text">Total de mapeamentos guardados:</span>
              <span className="font-bold font-mono text-natural-olive bg-[#efede8] px-2 py-0.5 rounded">{dictionary.length}</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (2/3 Width) - Database Explorer, Stats & Detailed Edits */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* Visual Statistics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] shadow-2xs">
              <div className="text-[10px] text-natural-muted-text uppercase font-semibold tracking-wider flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-natural-olive" />
                Total na BD
              </div>
              <div className="text-3xl font-serif text-natural-olive font-bold mt-1">
                {statsTotal}
              </div>
              <div className="text-[10px] text-natural-muted-text mt-1">
                assentos de batismo arquivados
              </div>
            </div>

            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] shadow-2xs">
              <div className="text-[10px] text-natural-muted-text uppercase font-semibold tracking-wider flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Estima Legitimidade
              </div>
              <div className="text-3xl font-serif text-natural-olive font-bold mt-1">
                {statsPercentageLegit}%
              </div>
              <div className="text-[10px] text-natural-muted-text mt-1">
                {statsLegitimateCount} filhos legítimos declarados
              </div>
            </div>

            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] shadow-2xs">
              <div className="text-[10px] text-natural-muted-text uppercase font-semibold tracking-wider flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-natural-rust" />
                Sítios Registados
              </div>
              <div className="text-3xl font-serif text-natural-olive font-bold mt-1">
                {statsUniqueLocals}
              </div>
              <div className="text-[10px] text-natural-muted-text mt-1">
                localidades diferentes detetadas
              </div>
            </div>

            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] shadow-2xs bg-natural-muted-bg/30">
              <div className="text-[10px] text-natural-muted-text uppercase font-semibold tracking-wider flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Motor Inteligente
              </div>
              <div className="text-sm font-semibold text-natural-near-black mt-2 bg-white/80 border border-slate-200 px-2 py-1 rounded inline-block">
                Gemini 3.1-flash-lite
              </div>
              <div className="text-[10px] text-natural-muted-text mt-1">
                Config. ativa: Normalização v2
              </div>
            </div>

          </div>

          {/* MAIN DATABASE EXPLORER */}
          <div className="bg-natural-paper border border-[#dcd9d4] rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xs">
            
            {/* TABS NAVIGATION */}
            <div className="flex border-b border-[#dcd9d4] bg-natural-header px-6 py-2 justify-between items-center flex-wrap gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => { setActiveTab("all"); setIsEditing(false); }}
                  className={`px-4 py-2.5 font-medium text-xs rounded-lg transition-all ${
                    activeTab === "all" 
                      ? "bg-natural-olive text-white shadow-xs" 
                      : "text-natural-dark hover:bg-[#efede8]"
                  }`}
                >
                  Base de Dados Paroquial ({filteredAssentos.length})
                </button>
                <button
                  onClick={() => { setActiveTab("manual"); setIsEditing(false); resetForm(); }}
                  className={`px-4 py-2.5 font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === "manual" 
                      ? "bg-natural-olive text-white shadow-xs" 
                      : "text-natural-dark hover:bg-[#efede8]"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Assento Manual
                </button>
                {assentos.length > 0 && (
                  <button
                    onClick={handleClearAllDatabase}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Eliminar todos os registos paroquiais"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpar BD
                  </button>
                )}
              </div>

              <div className="text-xs text-natural-muted-text flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-natural-olive/60" />
                Selecione uma linha para ver a genealogia detalhada ou editar.
              </div>
            </div>

            {activeTab === "all" ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* SEARCH AND FILTERS */}
                <div className="p-4 bg-natural-header/50 border-b border-[#dcd9d4] space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    
                    {/* SearchInput */}
                    <div className="relative md:col-span-5">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-natural-muted-text" />
                      <input
                        type="text"
                        placeholder="Pesquisar por batizado, pais, local ou observação..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-[#dcd9d4] rounded-lg text-xs focus:ring-1 focus:ring-natural-olive focus:border-natural-olive outline-none"
                      />
                    </div>

                    {/* Filter Status */}
                    <div className="md:col-span-3 flex items-center gap-1.5">
                      <span className="text-xs text-natural-muted-text whitespace-nowrap">Tipo:</span>
                      <select
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        className="w-full bg-white border border-[#dcd9d4] rounded-lg text-xs py-2 px-2 focus:ring-1 focus:ring-natural-olive focus:border-natural-olive outline-none"
                      >
                        <option value="all">Sempre Todos</option>
                        <option value="Legítimo">Apenas Legítimo</option>
                        <option value="Natural/Ilegítimo">Filho Natural (Ilegítimo)</option>
                      </select>
                    </div>

                    {/* Filter Gender */}
                    <div className="md:col-span-2 flex items-center gap-1.5">
                      <span className="text-xs text-natural-muted-text whitespace-nowrap">Sexo:</span>
                      <select
                        value={genderFilter}
                        onChange={(e: any) => setGenderFilter(e.target.value)}
                        className="w-full bg-white border border-[#dcd9d4] rounded-lg text-xs py-2 px-2 focus:ring-1 focus:ring-natural-olive focus:border-natural-olive outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                      </select>
                    </div>

                    {/* Filter local */}
                    <div className="md:col-span-2 flex items-center gap-1.5">
                      <span className="text-xs text-natural-muted-text whitespace-nowrap">Sítio:</span>
                      <select
                        value={localFilter}
                        onChange={(e) => setLocalFilter(e.target.value)}
                        className="w-full bg-white border border-[#dcd9d4] rounded-lg text-xs py-2 px-2 focus:ring-1 focus:ring-natural-olive focus:border-natural-olive outline-none"
                      >
                        <option value="all">Todos</option>
                        {uniqueLocals.map((loc, idx) => (
                          <option key={idx} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>

                {/* TWO LEVEL RESULTS CONTENT: TOP DETAILS AND BOTTOM SPREADSHEET TABLE */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  
                  {/* LEFT: SPREADSHEET LIST */}
                  <div className="flex-1 overflow-y-auto p-4 border-r border-[#dcd9d4] custom-scrollbar">
                    {filteredAssentos.length === 0 ? (
                      <div className="text-center py-12 text-natural-muted-text space-y-3">
                        <FileText className="h-8 w-8 text-natural-muted-text/40 mx-auto" />
                        <p className="text-sm">Nenhum registo paroquial corresponde aos filtros aplicados.</p>
                      </div>
                    ) : (
                      <div className="border border-[#e5e2db] rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse bg-white">
                          <thead>
                            <tr className="bg-natural-header border-b border-[#dcd9d4] text-natural-dark font-semibold">
                              <th className="p-3 text-center w-12">Nº</th>
                              <th className="p-3">Data</th>
                              <th className="p-3">Nome do Batizado</th>
                              <th className="p-3">Filiação e Sítio</th>
                              <th className="p-3 text-center">Sexo</th>
                              <th className="p-3 text-center w-16">Opções</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#faf9f7]">
                            {filteredAssentos.map((as) => {
                              const isSelected = selectedAssento?.id === as.id;
                              const isNatural = (as.observacoes || "").toLowerCase().includes("natural") || (as.descricaoOriginal || "").toLowerCase().includes("natural") || (as.descricaoOriginal || "").toLowerCase().includes("incognito");
                              
                              return (
                                <tr
                                  key={as.id}
                                  onClick={() => { setSelectedAssento(as); setIsEditing(false); }}
                                  className={`hover:bg-natural-bg/40 cursor-pointer transition-colors ${
                                    isSelected ? "bg-natural-bg font-medium text-natural-olive" : ""
                                  }`}
                                >
                                  <td className="p-3 text-center font-mono font-semibold text-natural-muted-text">
                                    {as.numero || "-"}
                                  </td>
                                  <td className="p-3 whitespace-nowrap text-natural-muted-text">
                                    {as.diaBap}/{as.mesBap}
                                  </td>
                                  <td className="p-3">
                                    <div className="font-serif font-bold text-sm text-natural-near-black flex items-center gap-1.5">
                                      {as.nome}
                                      {isNatural && (
                                        <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-widest px-1.5 rounded-sm" title="Filho Natural / Ilegítimo">
                                          natural
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-natural-muted-text">
                                      Nascido a {as.diaNasc} de {as.mesNasc}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="truncate max-w-[180px]">
                                      Mãe: <span className="font-medium text-slate-800">{as.mae}</span>
                                    </div>
                                    <div className="text-[10px] text-natural-muted-text flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-natural-rust flex-shrink-0" />
                                      {as.local || "Não listado"}
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                                      as.sexo === "Masculino" 
                                        ? "bg-sky-50 text-sky-850 border border-sky-100" 
                                        : "bg-pink-50 text-pink-850 border border-pink-100"
                                    }`}>
                                      {as.sexo || "-"}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleDeleteAssento(as.id)}
                                      className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded-md transition-colors cursor-pointer"
                                      title="Eliminar este assento"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: COMPREHENSIVE SELECTED ITEM SIDEBAR */}
                  <div className="w-full md:w-[320px] bg-natural-header/30 p-4 border-t md:border-t-0 border-[#dcd9d4] overflow-y-auto space-y-4 custom-scrollbar">
                    {selectedAssento ? (
                      <div>
                        {isEditing ? (
                          /* EDIT SELECTED ASSENTO FORM */
                          <form onSubmit={handleSaveAssento} className="space-y-4 bg-white p-4 rounded-xl border border-[#dcd9d4]">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-natural-olive flex items-center justify-between">
                              <span>Modificar Assento Nº {selectedAssento.numero}</span>
                              <span className="text-natural-rust">Edição paroquial</span>
                            </h4>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Número</label>
                                <input
                                  type="text"
                                  value={formState.numero}
                                  onChange={(e) => setFormState({ ...formState, numero: e.target.value })}
                                  className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Sexo</label>
                                <select
                                  value={formState.sexo}
                                  onChange={(e: any) => setFormState({ ...formState, sexo: e.target.value })}
                                  className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                                >
                                  <option value="Masculino">Masculino</option>
                                  <option value="Feminino">Feminino</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Nome do Batizado *</label>
                              <input
                                type="text"
                                value={formState.nome}
                                onChange={(e) => setFormState({ ...formState, nome: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs font-medium"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-1">
                              <div>
                                <label className="block text-[9px] uppercase text-natural-muted-text">Dia Bap</label>
                                <input
                                  type="text"
                                  value={formState.diaBap}
                                  onChange={(e) => setFormState({ ...formState, diaBap: e.target.value })}
                                  className="w-full p-1 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase text-natural-muted-text">Mês Bap</label>
                                <input
                                  type="text"
                                  value={formState.mesBap}
                                  onChange={(e) => setFormState({ ...formState, mesBap: e.target.value })}
                                  className="w-full p-1 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase text-natural-muted-text">Ano Bap</label>
                                <input
                                  type="text"
                                  value={formState.anoBap}
                                  onChange={(e) => setFormState({ ...formState, anoBap: e.target.value })}
                                  className="w-full p-1 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1">
                              <div>
                                <label className="block text-[9px] uppercase text-natural-muted-text">Dia Nasc</label>
                                <input
                                  type="text"
                                  value={formState.diaNasc}
                                  onChange={(e) => setFormState({ ...formState, diaNasc: e.target.value })}
                                  className="w-full p-1 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase text-natural-muted-text">Mês Nasc</label>
                                <input
                                  type="text"
                                  value={formState.mesNasc}
                                  onChange={(e) => setFormState({ ...formState, mesNasc: e.target.value })}
                                  className="w-full p-1 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase text-natural-muted-text">Ano Nasc</label>
                                <input
                                  type="text"
                                  value={formState.anoNasc}
                                  onChange={(e) => setFormState({ ...formState, anoNasc: e.target.value })}
                                  className="w-full p-1 border border-[#dcd9d4] rounded text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Sítio/Lugar</label>
                              <input
                                type="text"
                                value={formState.local}
                                onChange={(e) => setFormState({ ...formState, local: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Pai</label>
                              <input
                                type="text"
                                value={formState.pai}
                                onChange={(e) => setFormState({ ...formState, pai: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                                placeholder="Deixe em branco p/ pai incógnito"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Mãe</label>
                              <input
                                type="text"
                                value={formState.mae}
                                onChange={(e) => setFormState({ ...formState, mae: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Avós Paternos</label>
                              <input
                                type="text"
                                value={formState.avosPaternos}
                                onChange={(e) => setFormState({ ...formState, avosPaternos: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Avós Maternos</label>
                              <input
                                type="text"
                                value={formState.avosMaternos}
                                onChange={(e) => setFormState({ ...formState, avosMaternos: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Padrinho</label>
                              <input
                                type="text"
                                value={formState.padrinho}
                                onChange={(e) => setFormState({ ...formState, padrinho: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Madrinha</label>
                              <input
                                type="text"
                                value={formState.madrinha}
                                onChange={(e) => setFormState({ ...formState, madrinha: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Pároco/Celebrante</label>
                              <input
                                type="text"
                                value={formState.paroco}
                                onChange={(e) => setFormState({ ...formState, paroco: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-natural-muted-text">Observações Históricas</label>
                              <textarea
                                value={formState.observacoes}
                                onChange={(e) => setFormState({ ...formState, observacoes: e.target.value })}
                                className="w-full p-1.5 bg-slate-50 border border-[#dcd9d4] rounded text-xs h-16 resize-none"
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="submit"
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded transition-colors cursor-pointer"
                              >
                                Gravar
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-750 text-xs rounded transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : (
                          /* READ-ONLY METADATA VIEWER */
                          <div className="space-y-4">
                            
                            {/* Card Header information */}
                            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] shadow-2xs space-y-3 relative overflow-hidden">
                              <span className="absolute right-0 top-0 bg-natural-olive text-white text-[9px] font-mono px-2 py-0.5 rounded-bl">
                                ASSENTO {selectedAssento.numero}
                              </span>

                              <div className="space-y-1">
                                <span className="text-[10px] uppercase text-natural-muted-text font-semibold">Nome Baptizado</span>
                                <h4 className="font-serif text-xl font-bold text-natural-near-black">
                                  {selectedAssento.nome}
                                </h4>
                              </div>

                              <div className="flex justify-between border-t border-slate-100 pt-2 text-[11px]">
                                <div>
                                  <span className="text-natural-muted-text">Género</span>
                                  <p className="font-medium text-slate-800">{selectedAssento.sexo}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-natural-muted-text">Batismo</span>
                                  <p className="font-semibold text-natural-olive">
                                    {selectedAssento.diaBap} de {selectedAssento.mesBap}, {selectedAssento.anoBap}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* TREE REPRESENTATION - GENEALOGY CHART CARD */}
                            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] shadow-2xs space-y-3">
                              <h5 className="text-[10px] uppercase font-bold text-natural-muted-text border-b border-dashed pb-1">
                                Genealogia Paroquial (Século XIX)
                              </h5>
                              
                              <div className="space-y-3 text-xs">
                                
                                {/* Child level */}
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-10 bg-natural-rust rounded-full"></div>
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider text-natural-rust font-bold">Nasceu</span>
                                    <p className="font-semibold">{selectedAssento.diaNasc} de {selectedAssento.mesNasc} de {selectedAssento.anoNasc}</p>
                                  </div>
                                </div>

                                {/* Parents level */}
                                <div className="space-y-1 pl-1">
                                  <span className="text-[9px] uppercase tracking-wider text-natural-muted-text font-bold">Pais Legitímos / Naturais</span>
                                  <div className="bg-natural-bg/40 p-2 rounded border border-[#efede8] space-y-1 font-mono text-[11px]">
                                    <p>👨 <span className="font-semibold text-slate-850">Pai:</span> {selectedAssento.pai || "Incógnito / Não Declarado"}</p>
                                    <p>👩 <span className="font-semibold text-slate-850">Mãe:</span> {selectedAssento.mae}</p>
                                  </div>
                                </div>

                                {/* Grandparents level */}
                                <div className="space-y-1.5 pl-1">
                                  <span className="text-[9px] uppercase tracking-wider text-natural-muted-text font-bold">Avós Paroquiais</span>
                                  <div className="bg-natural-bg/40 p-2 rounded border border-[#efede8] space-y-1 text-[11px] font-sans">
                                    <p>👴👵 <span className="text-natural-muted-text">Paternos:</span> {selectedAssento.avosPaternos || "N/A"}</p>
                                    <p>👴👵 <span className="text-natural-muted-text">Maternos:</span> {selectedAssento.avosMaternos || "N/A"}</p>
                                  </div>
                                </div>

                                {/* Godparents level */}
                                <div className="space-y-2 pl-1">
                                  <span className="text-[9px] uppercase tracking-wider text-natural-muted-text font-bold">Padrinhos Espirituais</span>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-serif italic text-natural-olive">
                                    <div className="bg-[#fffcf5] p-2 rounded border border-natural-olive/15">
                                      <span className="text-[9px] font-sans uppercase not-italic text-natural-muted-text font-medium">Padrinho</span>
                                      <p className="font-bold">{selectedAssento.padrinho}</p>
                                    </div>
                                    <div className="bg-[#fffcf5] p-2 rounded border border-natural-olive/15">
                                      <span className="text-[9px] font-sans uppercase not-italic text-natural-muted-text font-medium">Madrinha</span>
                                      <p className="font-bold">{selectedAssento.madrinha}</p>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </div>

                            {/* Location & Reverend Celebrant */}
                            <div className="bg-natural-paper p-4 rounded-xl border border-[#dcd9d4] space-y-2 text-xs text-natural-dark">
                              <p className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-natural-rust flex-shrink-0" />
                                <span>Sítio Histórico: <strong className="text-natural-near-black">{selectedAssento.local}</strong></span>
                              </p>
                              <p className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-natural-olive flex-shrink-0" />
                                <span className="truncate">Presidente/Celeb: <strong className="text-natural-near-black">{selectedAssento.paroco}</strong></span>
                              </p>
                            </div>

                            {/* Original handwriting snippet translation description */}
                            {selectedAssento.descricaoOriginal && (
                              <div className="bg-[#faf8f6] p-4 rounded-xl border border-[#dcd9d4] space-y-2 bg-[#fffcf5]">
                                <span className="text-[9px] uppercase font-bold text-natural-muted-text block">
                                  Excerto do Registo / Paleografia
                                </span>
                                <p className="font-serif italic text-xs leading-relaxed text-slate-800">
                                  "{selectedAssento.descricaoOriginal}"
                                </p>
                              </div>
                            )}

                            {/* Observacoes */}
                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/50 text-xs">
                              <span className="font-semibold text-amber-900 block mb-1">Observações do Historiador:</span>
                              <p className="text-amber-950/80 leading-normal font-sans italic">
                                {selectedAssento.observacoes || "Nenhuma anotação adicional disponível."}
                              </p>
                            </div>

                            {/* ACTION BUTTONS */}
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => { setIsEditing(true); resetForm(selectedAssento); }}
                                className="flex-1 py-2 bg-white border border-[#dcd9d4] hover:bg-slate-50 text-natural-olive font-semibold text-xs rounded-lg flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Editar Registo
                              </button>
                              <button
                                onClick={() => handleDeleteAssento(selectedAssento.id)}
                                className="px-3 py-2 bg-red-50 hover:bg-red-105 text-red-700 rounded-lg flex items-center justify-center border border-red-200 shadow-2xs transition-colors cursor-pointer"
                                title="Eliminar este assento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-natural-muted-text">
                        <Info className="h-8 w-8 text-[#dcd9d4] mx-auto mb-2" />
                        Selecione um assento de batismo para visualizar o gráfico de parentesco.
                      </div>
                    )}
                  </div>

                </div>

              </div>
            ) : (
              /* CREATE AND ADD NEW ASSENTO SCREEN */
              <div className="p-6 md:p-8 overflow-y-auto max-w-3xl mx-auto w-full custom-scrollbar">
                
                <div className="mb-6 space-y-1">
                  <h3 className="text-lg font-serif font-bold text-natural-near-black">
                    Adicionar Registo de Batismo Manualmente
                  </h3>
                  <p className="text-xs text-natural-muted-text">
                    Use o formulário abaixo para registar manualmente documentos paroquiais que não foram fornecidos via inteligência artificial.
                  </p>
                </div>

                <form onSubmit={handleSaveAssento} className="space-y-6">
                  
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">
                        Número do Assento
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.numero}
                        onChange={(e) => setFormState({ ...formState, numero: e.target.value })}
                        className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                        placeholder="Ex: 50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">
                        Nome do Batizado *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.nome}
                        onChange={(e) => setFormState({ ...formState, nome: e.target.value })}
                        className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg font-serif text-xs font-bold"
                        placeholder="Ex: Silvério"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">
                        Sexo
                      </label>
                      <select
                        value={formState.sexo}
                        onChange={(e: any) => setFormState({ ...formState, sexo: e.target.value })}
                        className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                      >
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">
                        Sítio de Residência (Ponta Delgada)
                      </label>
                      <input
                        type="text"
                        value={formState.local}
                        onChange={(e) => setFormState({ ...formState, local: e.target.value })}
                        className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                        placeholder="Ex: Teixeira Lombada, Pico, Enxurros"
                      />
                    </div>
                  </div>

                  {/* Date fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-natural-header/30 p-4 rounded-xl border border-[#dcd9d4]">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-natural-olive mb-3">Data do Batismo</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-natural-muted-text mb-0.5">Dia</label>
                          <input
                            type="text"
                            value={formState.diaBap}
                            onChange={(e) => setFormState({ ...formState, diaBap: e.target.value })}
                            className="w-full p-2 bg-white border border-[#dcd9d4] rounded text-xs"
                            placeholder="Dia"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-natural-muted-text mb-0.5">Mês</label>
                          <input
                            type="text"
                            value={formState.mesBap}
                            onChange={(e) => setFormState({ ...formState, mesBap: e.target.value })}
                            className="w-full p-2 bg-white border border-[#dcd9d4] rounded text-xs"
                            placeholder="Mês"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-natural-muted-text mb-0.5">Ano</label>
                          <input
                            type="text"
                            value={formState.anoBap}
                            onChange={(e) => setFormState({ ...formState, anoBap: e.target.value })}
                            className="w-full p-2 bg-white border border-[#dcd9d4] rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-natural-olive mb-3">Data de Nascimento</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-natural-muted-text mb-0.5">Dia</label>
                          <input
                            type="text"
                            value={formState.diaNasc}
                            onChange={(e) => setFormState({ ...formState, diaNasc: e.target.value })}
                            className="w-full p-2 bg-white border border-[#dcd9d4] rounded text-xs"
                            placeholder="Dia"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-natural-muted-text mb-0.5">Mês</label>
                          <input
                            type="text"
                            value={formState.mesNasc}
                            onChange={(e) => setFormState({ ...formState, mesNasc: e.target.value })}
                            className="w-full p-2 bg-white border border-[#dcd9d4] rounded text-xs"
                            placeholder="Mês"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-natural-muted-text mb-0.5">Ano</label>
                          <input
                            type="text"
                            value={formState.anoNasc}
                            onChange={(e) => setFormState({ ...formState, anoNasc: e.target.value })}
                            className="w-full p-2 bg-white border border-[#dcd9d4] rounded text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parents and grandparents details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-natural-olive border-b border-[#efede8] pb-1">Filiação e Avós</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Nome do Pai</label>
                        <input
                          type="text"
                          value={formState.pai}
                          onChange={(e) => setFormState({ ...formState, pai: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                          placeholder="Ex: João Ignacio de Goveia - deixar em branco p/ pai incógnito"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Nome da Mãe</label>
                        <input
                          type="text"
                          required
                          value={formState.mae}
                          onChange={(e) => setFormState({ ...formState, mae: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                          placeholder="Ex: Silvéria de Jesus"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Avós Paternos</label>
                        <input
                          type="text"
                          value={formState.avosPaternos}
                          onChange={(e) => setFormState({ ...formState, avosPaternos: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                          placeholder="Ex: João Ignacio de Goveia e Maria Rosa"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Avós Maternos</label>
                        <input
                          type="text"
                          value={formState.avosMaternos}
                          onChange={(e) => setFormState({ ...formState, avosMaternos: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                          placeholder="Ex: Manoel Pestana de Goveia e Maria Francisca"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Godparents and celebrant */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-natural-olive border-b border-[#efede8] pb-1">Padrinhos e Oficiais</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Padrinho</label>
                        <input
                          type="text"
                          value={formState.padrinho}
                          onChange={(e) => setFormState({ ...formState, padrinho: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                          placeholder="Ex: José Pestana de Goveia"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Madrinha</label>
                        <input
                          type="text"
                          value={formState.madrinha}
                          onChange={(e) => setFormState({ ...formState, madrinha: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                          placeholder="Ex: Fortunata de Jesus"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">Pároco/Celebrante</label>
                        <input
                          type="text"
                          value={formState.paroco}
                          onChange={(e) => setFormState({ ...formState, paroco: e.target.value })}
                          className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Handwriting text or comments */}
                  <div>
                    <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">
                      Transcrição / Excerto Literal Adicional
                    </label>
                    <textarea
                      value={formState.descricaoOriginal}
                      onChange={(e) => setFormState({ ...formState, descricaoOriginal: e.target.value })}
                      className="w-full p-3 bg-white border border-[#dcd9d4] rounded-lg text-xs font-serif italic h-20 outline-none"
                      placeholder="Transcrição livre do documento em português antigo..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-natural-muted-text mb-1">
                      Observações Adicionais (Legitimidade, profissões, padrinhos representados)
                    </label>
                    <textarea
                      value={formState.observacoes}
                      onChange={(e) => setFormState({ ...formState, observacoes: e.target.value })}
                      className="w-full p-3 bg-white border border-[#dcd9d4] rounded-lg text-xs h-24 outline-none"
                      placeholder="Anotações históricas (Ex: Filha legítima. Segunda com este nome no núcleo familiar...)"
                    />
                  </div>

                  {/* Form actions */}
                  <div className="flex gap-3 justify-end pt-4 border-t border-[#dcd9d4]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("all")}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Voltar ao Arquivo
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2.5 bg-natural-olive hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      Inserir Assento
                    </button>
                  </div>

                </form>

              </div>
            )}

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="h-16 px-6 md:px-10 bg-natural-olive text-white flex items-center justify-between mt-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-[10px] md:text-[11px] uppercase tracking-widest opacity-80 font-mono">
              IA Conectada: Gemini 3.1-flash-lite
            </span>
          </div>
          <div className="h-4 w-px bg-white/20 hidden md:block"></div>
          <span className="text-[10px] md:text-[11px] uppercase tracking-widest opacity-80 hidden md:inline-block font-mono">
            Dicionário Paleográfico: Ativo ({dictionary.length} termos)
          </span>
        </div>
        <div className="text-[10px] italic opacity-60">
          © 2026 Projeto de Transcrição Histórica • Ponta Delgada, Açores
        </div>
      </footer>

      {/* DICTIONARY MANAGEMENT MODAL / DRAWER */}
      {showDictionaryModal && (
        <div id="dict-modal" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#dcd9d4] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in">
            
            {/* Modal Header */}
            <div className="bg-natural-header px-6 py-4 border-b border-[#dcd9d4] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-natural-olive/10 flex items-center justify-center text-natural-olive font-bold">
                  📖
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-natural-near-black">
                    Dicionário Paleográfico & Mapeamento de Ficheiro
                  </h3>
                  <p className="text-[11px] text-natural-muted-text">
                    Lista de termos arcaicos e abreviaturas históricas consultadas pelo Gemini 3.1-flash-lite.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDictionaryModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split Modal Body */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              
              {/* LEFT: ADD NEW RULE (5/12) */}
              <div className="lg:col-span-5 p-6 border-r border-[#dcd9d4] bg-natural-header/30 overflow-y-auto">
                <h4 className="text-xs font-bold uppercase tracking-wider text-natural-olive mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Mapear Novo Termo / Sigla
                </h4>

                <form onSubmit={handleAddDictWord} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-natural-dark mb-1">
                      Sigla / Abreviatura Original *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDictEntry.sigla}
                      onChange={(e) => setNewDictEntry({ ...newDictEntry, sigla: e.target.value })}
                      className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg font-mono"
                      placeholder="Ex: leg. / f.ª / soltra. / M.a"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-natural-dark mb-1">
                      Expansão Moderna *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDictEntry.expansao}
                      onChange={(e) => setNewDictEntry({ ...newDictEntry, expansao: e.target.value })}
                      className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg"
                      placeholder="Ex: legítimo / filha / solteira / Maria"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-natural-dark mb-1">
                      Categoria do Termo
                    </label>
                    <select
                      value={newDictEntry.categoria}
                      onChange={(e) => setNewDictEntry({ ...newDictEntry, categoria: e.target.value })}
                      className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg text-xs"
                    >
                      <option value="nomes próprios">Nomes Próprios</option>
                      <option value="apelidos">Apelidos / Sobrenomes</option>
                      <option value="parentesco">Grau de Parentesco</option>
                      <option value="estado civil/filiação">Estado Civil & Filiação</option>
                      <option value="termos religiosos">Termos Religiosos / Sacramentais</option>
                      <option value="topónimos">Topónimos / Divisão Territorial</option>
                      <option value="tratamentos/títulos">Tratamentos & Títulos</option>
                      <option value="termos administrativos">Termos Administrativos / Ofícios</option>
                      <option value="observações">Observações & Geral</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-natural-dark mb-1">
                      Significado / Uso Antigo
                    </label>
                    <input
                      type="text"
                      value={newDictEntry.significado}
                      onChange={(e) => setNewDictEntry({ ...newDictEntry, significado: e.target.value })}
                      className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg"
                      placeholder="Ex: indica legitimidade do filho"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-natural-dark mb-1">
                      Notas Históricas / Transcrição
                    </label>
                    <textarea
                      value={newDictEntry.notas}
                      onChange={(e) => setNewDictEntry({ ...newDictEntry, notas: e.target.value })}
                      className="w-full p-2 bg-white border border-[#dcd9d4] rounded-lg h-16 resize-none"
                      placeholder="Ex: Muito comum no final do século XVIII e XIX."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-natural-olive hover:opacity-95 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Adicionar ao Dicionário
                  </button>

                  <div className="p-3 bg-amber-50 rounded-lg text-amber-900 border border-amber-200/40 text-[10px]">
                    ⚠️ <strong>Dica de Paleografia:</strong> O modelo Gemini consulta este dicionário para garantir que nomes como 'Joaq.m' sejam traduzidos como 'Joaquim' e termos canónicos como 'leg.' sejam interpretados como 'legítimo'.
                  </div>
                </form>
              </div>

              {/* RIGHT: LIST OF ALL MAPPINGS (7/12) */}
              <div className="lg:col-span-7 p-6 flex flex-col h-full overflow-hidden">
                
                {/* Search Term and Category filter */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-natural-muted-text" />
                    <input
                      type="text"
                      placeholder="Pesquisar sigla..."
                      value={dictSearch}
                      onChange={(e) => setDictSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-[#dcd9d4] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <select
                      value={dictCategoryFilter}
                      onChange={(e) => setDictCategoryFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-[#dcd9d4] rounded-lg text-xs py-1.5 px-2"
                    >
                      <option value="all">Todas as Categorias</option>
                      {listCategories.map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Terms list table */}
                <div className="flex-1 overflow-y-auto border border-[#e5e2db] rounded-lg bg-slate-50 custom-scrollbar">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-natural-header border-b border-[#dcd9d4] text-natural-dark py-1">
                        <th className="p-2 font-mono">Original (Sigla)</th>
                        <th className="p-2 font-serif font-bold text-natural-olive">Expansão</th>
                        <th className="p-2">Categoria</th>
                        <th className="p-2 text-center w-10">Opções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#faf9f7] bg-white">
                      {filteredDictEntries.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-natural-muted-text">
                            Nenhum mapeamento paleográfico detetado.
                          </td>
                        </tr>
                      ) : (
                        filteredDictEntries.map((item, idx) => (
                          <tr key={idx} className="hover:bg-natural-bg/10">
                            <td className="p-2 font-mono font-bold text-natural-dark">
                              {item.sigla}
                            </td>
                            <td className="p-2 font-serif font-medium italic text-natural-rust">
                              {item.expansao}
                            </td>
                            <td className="p-2 text-natural-muted-text capitalize text-[10px]">
                              {item.categoria}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleDeleteDictWord(item.sigla)}
                                className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                                title="Remover termo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer dictionary instructions */}
                <div className="mt-4 text-[10px] text-natural-muted-text flex items-center justify-between border-t pt-3">
                  <span>As modificações efetuadas serão guardadas localmente no servidor.</span>
                  <span className="font-semibold text-natural-olive">Dicionário Ponta Delgada</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

