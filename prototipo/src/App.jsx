import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// DESIGN TOKENS — LIGHT CORPORATE BLUE THEME
// ---------------------------------------------------------------------------
const C = {
  positive: "#059669", 
  negative: "#DC2626", 
  mixed:    "#D97706", 
  churn:    "#DC2626",
  upsell:   "#059669",
  accent:   "#2563EB", 
};

const PIE_COLORS = [C.positive, C.negative, C.mixed];

// CONFIGURAÇÃO ENDPOINT API (Altere para a URL pública do seu serviço Render após o deploy)
const BACKEND_URL = "http://localhost:8000";

// ---------------------------------------------------------------------------
// SQUAD MEMBERS (REQUISITO OBRIGATÓRIO - NÃO REMOVER)[cite: 2]
// ---------------------------------------------------------------------------
const SQUAD = [
  { nome: "Cristian Belasco Arancibia", rm: "RM: 565710" },
  { nome: "Samuel de Oliveira da Silva",  rm: "RM: 566244" },
  { nome: "João Lucas Ferreira dos Santos", rm: "RM: 562608" },
  { nome: "Lucas Oliveira de Mendonça Almeida", rm: "RM: 562613" },
  { nome: "Victor Antonio Teixeira da Silva", rm: "RM: 562573" },
];

const QUICK_PROMPTS = [
  "Esta conta tem risco de churn?",
  "Existe oportunidade de upsell?",
  "Qual módulo devo ofertar?",
  "Resumo executivo desta reunião",
];

const chipSentimento = (sentimento) => {
  const map = {
    POSITIVO: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    NEGATIVO: "bg-red-50 text-red-700 border border-red-200",
    MISTO:    "bg-amber-50 text-amber-700 border border-amber-200",
  };
  return map[sentimento] || map.MISTO;
};

const npsColor = (nps) => {
  if (nps >= 8) return "text-emerald-600 font-bold";
  if (nps >= 6) return "text-amber-600 font-bold";
  return "text-red-600 font-bold";
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono shadow-md">
      <p className="text-slate-800 font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || C.accent }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const KpiCard = ({ title, value, desc, colorClass, icon }) => (
  <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col gap-1.5 hover:border-blue-300 hover:shadow-md transition-all duration-200 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      <span className="text-slate-300 text-lg font-mono">{icon}</span>
    </div>
    <p className={`text-3xl font-extrabold tracking-tight font-mono ${colorClass}`}>{value}</p>
    <p className="text-xs text-slate-500 font-medium leading-tight">{desc}</p>
  </div>
);

const LoadingScreen = () => (
  <div className="w-full h-screen bg-slate-50 flex flex-col justify-center items-center gap-4">
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
      <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
    </div>
    <p className="text-blue-600 text-xs tracking-widest uppercase font-mono font-bold animate-pulse">
      Sincronizando com a esteira NLP de Data Science...
    </p>
  </div>
);

const ErrorScreen = ({ mensagem }) => (
  <div className="w-full h-screen bg-slate-50 flex flex-col justify-center items-center p-8 text-center gap-6">
    <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
    <div className="max-w-lg space-y-2">
      <h2 className="text-slate-900 font-bold text-xl">A esteira HTTP do Backend encontra-se offline.</h2>
      <p className="text-slate-500 text-xs font-mono bg-white p-3 rounded-xl border border-slate-200 shadow-sm">{mensagem}</p>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left max-w-md w-full shadow-sm">
      <p className="text-slate-800 text-xs font-black uppercase tracking-widest mb-2">Como inicializar o ecossistema:</p>
      <ol className="text-slate-600 text-xs space-y-1.5 font-mono list-decimal list-inside">
        <li>Abra o terminal na pasta <span className="text-blue-600 font-bold">data-science/</span></li>
        <li>Rode: <span className="text-blue-600 font-bold">export GROQ_API_KEY="sua_chave"</span></li>
        <li>Rode: <span className="text-blue-600 font-bold">python pipeline_nlp.py</span></li>
        <li>Recarregue a aplicação do React.</li>
      </ol>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// COMPONENTE: VISÃO OPERACIONAL (ZENDESK)[cite: 2]
// ---------------------------------------------------------------------------
const VisaoOperacional = ({ dataset, chamadaAtiva, setChamadaAtiva }) => {
  const [inputChat, setInputChat] = useState("");
  const [historico, setHistorico] = useState([]);
  const [carregandoIA, setCarregandoIA] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!chamadaAtiva) return;
    setHistorico([
      {
        remetente: "bot",
        texto: `Olá! Sou o TOTVS Co-Pilot. Analisei a transcrição de ${chamadaAtiva.cliente} conectada via FastAPI. Como posso te auxiliar nas decisões estratégicas deste cliente?`,
      },
    ]);
    setInputChat("");
  }, [chamadaAtiva?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historico]);

  const enviarMensagem = useCallback(async (texto) => {
    if (!texto.trim() || carregandoIA || !chamadaAtiva) return;
    const mensagemUsuario = texto.trim();
    setInputChat("");

    setHistorico((prev) => [...prev, { remetente: "user", texto: mensagemUsuario }]);
    setCarregandoIA(true);

    const contextoCliente = `Cliente: ${chamadaAtiva.cliente} | NPS: ${chamadaAtiva.nps} | Sentimento: ${chamadaAtiva.sentimento} | Churn: ${chamadaAtiva.churn} (Score: ${chamadaAtiva.churn_score}) | Upsell: ${chamadaAtiva.upsell} (Score: ${chamadaAtiva.upsell_score}) | Produto: ${chamadaAtiva.produto} | Transcrição: ${chamadaAtiva.trans_bruta}`;

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: messagingUser => mensagemUsuario, prompt: mensagemUsuario, contexto_cliente: contextoCliente }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro de Gateway.");
      
      setHistorico((prev) => [...prev, { remetente: "bot", texto: data.resposta }]);
    } catch (err) {
      setHistorico((prev) => [...prev, { remetente: "bot", texto: `❌ Falha na conexão de Incorrência Proxy: ${err.message}` }]);
    } finally {
      setCarregandoIA(false);
    }
  }, [chamadaAtiva, carregandoIA]);

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-7.5rem)]">
      {/* FILA DE CHAMADAS */}
      <div className="col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fila de Atendimento (Zendesk)</h2>
          <p className="text-[9px] text-slate-400 font-mono mt-0.5">Priorização automática por NLP · {dataset.length} sessões</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
          {dataset.map((item) => (
            <button
              key={item.id}
              onClick={() => setChamadaAtiva(item)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-150 ${
                chamadaAtiva?.id === item.id ? "bg-blue-50/70 border-blue-500 shadow-sm" : "bg-slate-50/50 border-slate-200/60 hover:bg-slate-50"
              }`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-mono font-bold text-slate-400">#{item.id}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black tracking-wider uppercase ${chipSentimento(item.sentimento)}`}>
                  {item.sentimento}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 truncate mb-2">{item.cliente}</p>
              <div className="flex flex-wrap gap-1">
                {item.churn && <span className="text-[8px] font-black bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">CHURN</span>}
                {item.upsell && <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">UPSELL</span>}
                <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">NPS {item.nps}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MONITOR DE TRANSCRIÇÃO */}
      <div className="col-span-5 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex-shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análise de Diálogo</h3>
            <h2 className="text-base font-bold text-slate-800 truncate mt-0.5">{chamadaAtiva?.cliente || "—"}</h2>
          </div>
          {chamadaAtiva && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-wider ${chipSentimento(chamadaAtiva.sentimento)}`}>
                {chamadaAtiva.sentimento}
              </span>
              <span className="bg-white border border-slate-200 text-[9px] font-mono font-bold px-2 py-1 rounded-lg text-slate-600">
                NPS <span className={npsColor(chamadaAtiva.nps)}>{chamadaAtiva.nps}</span>
              </span>
            </div>
          )}
        </div>

        {chamadaAtiva ? (
          <div className="flex-1 flex flex-col gap-0 overflow-hidden bg-white">
            <div className="flex-1 flex flex-col overflow-hidden border-b border-slate-100">
              <div className="px-4 pt-3 pb-1.5 flex items-center gap-2 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Transcrição Bruta — Speech-to-Text RAW</span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-3">
                <p className="text-xs text-slate-600 leading-relaxed italic font-sans">"{chamadaAtiva.trans_bruta}"</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
              <div className="px-4 pt-3 pb-1.5 flex items-center gap-2 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Radicais NLP — Stemming RSLP Processado</span>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-3">
                <p className="text-xs text-blue-800 font-mono leading-relaxed tracking-tight">{chamadaAtiva.trans_limpa}</p>
              </div>
            </div>

            {/* MITIGAÇÃO DEFINITIVA DO ReferenceError: de llamadaAtiva para chamadaAtiva */}
            {(chamadaAtiva.radicais_churn?.length > 0 || chamadaAtiva.radicais_upsell?.length > 0) && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Sinais Mapeados na Esteira</p>
                <div className="flex flex-wrap gap-1.5">
                  {chamadaAtiva.radicais_churn?.map((r) => <span key={r} className="text-[9px] font-mono bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-medium">-{r}</span>)}
                  {chamadaAtiva.radicais_upsell?.map((r) => <span key={r} className="text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">+{r}</span>)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white"><p className="text-slate-400 text-xs font-mono">Selecione uma conta na fila.</p></div>
        )}
      </div>

      {/* CO-PILOT PROXY CHAT */}
      <div className="col-span-4 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex-shrink-0 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm"><span className="text-white text-[10px] font-black">AI</span></div>
          <div>
            <h2 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">TOTVS Co-Pilot</h2>
            <p className="text-[9px] text-slate-400 font-mono">Powered by Llama 3 via Groq API</p>
          </div>
          <div className="ml-auto flex-shrink-0">
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${carregandoIA ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{carregandoIA ? "Mapeando" : "Online"}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30 custom-scrollbar">
          {historico.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.remetente === "user" ? "items-end" : "items-start"}`}>
              <span className="text-[8px] font-bold font-mono text-slate-400 mb-0.5 px-1">{msg.remetente.toUpperCase()}</span>
              <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed max-w-[90%] border shadow-sm ${msg.remetente === "user" ? "bg-blue-600 border-blue-600 text-white rounded-tr-none" : "bg-white border-slate-200 text-slate-700 rounded-tl-none"}`}>{msg.texto}</div>
            </div>
          ))}
          {carregandoIA && <div className="text-[10px] font-mono text-blue-600 animate-pulse pl-1">Processando prompt na nuvem...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className="px-3 pb-2 flex flex-wrap gap-1 bg-white">
          {QUICK_PROMPTS.map((p) => <button key={p} onClick={() => enviarMensagem(p)} disabled={carregandoIA} className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40">{p}</button>)}
        </div>

        <div className="p-3 pt-0 bg-white">
          <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-blue-500/50 focus-within:bg-white">
            <input type="text" value={inputChat} onChange={(e) => setInputChat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagem(inputChat)} placeholder="Pergunte ao Co-Pilot..." disabled={carregandoIA} className="flex-1 bg-transparent px-2 py-1.5 text-[11px] text-slate-800 outline-none" />
            <button onClick={() => enviarMensagem(inputChat)} disabled={carregandoIA || !inputChat.trim()} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex-shrink-0 shadow-sm">Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// COMPONENTE: VISÃO GERENCIAL (ESTILO HARMO ANALYTICS)[cite: 2]
// ---------------------------------------------------------------------------
const VisaoGerencial = ({ dataset }) => {
  const totalGeral   = dataset.length;
  const totalPos     = dataset.filter((d) => d.sentimento === "POSITIVO").length;
  const totalNeg     = dataset.filter((d) => d.sentimento === "NEGATIVO").length;
  const totalMisto   = dataset.filter((d) => d.sentimento === "MISTO").length;
  const totalChurn   = dataset.filter((d) => d.churn).length;
  const totalUpsell  = dataset.filter((d) => d.upsell).length;
  const npsMedia     = totalGeral > 0 ? (dataset.reduce((acc, d) => acc + (d.nps || 0), 0) / totalGeral).toFixed(1) : "—";

  const dadosSentimento = [{ name: "Positivo", value: totalPos }, { name: "Negativo", value: totalNeg }, { name: "Neutro/Misto", value: totalMisto }].filter((d) => d.value > 0);
  const contagemProdutos = dataset.reduce((acc, curr) => {
    const prod = curr.produto && curr.produto !== "Sem Produto" ? curr.produto : null;
    if (prod) acc[prod] = (acc[prod] || 0) + 1;
    return acc;
  }, {});
  const dadosProdutos = Object.entries(contagemProdutos).map(([name, qtd]) => ({ name, qtd })).sort((a, b) => b.qtd - a.qtd);

  const clientesChurn = [...dataset].filter((d) => d.churn).sort((a, b) => (b.churn_score || 0) - (a.churn_score || 0)).slice(0, 5);
  const clientesUpsell = [...dataset].filter((d) => d.upsell).sort((a, b) => (b.upsell_score || 0) - (a.upsell_score || 0)).slice(0, 5);

  const kpis = [
    { title: "Volumetria Total",     value: totalGeral,  desc: "Sessões sincronizadas por HTTP", colorClass: "text-blue-600", icon: "📊" },
    { title: "NPS Médio Geral",      value: npsMedia,    desc: "Métrica agregada Harmo", colorClass: npsColor(parseFloat(npsMedia)), icon: "★" },
    { title: "Alertas de Churn",     value: totalChurn,  desc: `${totalGeral > 0 ? ((totalChurn/totalGeral)*100).toFixed(0) : 0}% sob risco de evasão`, colorClass: "text-red-600", icon: "⚠️" },
    { title: "Gatilhos de Upsell",   value: totalUpsell, desc: `${totalGeral > 0 ? ((totalUpsell/totalGeral)*100).toFixed(0) : 0}% oportunidades identificadas`, colorClass: "text-emerald-600", icon: "🚀" },
  ];

  return (
    <div className="space-y-5 h-[calc(100vh-7.5rem)] overflow-y-auto pr-1 custom-scrollbar">
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Saúde do Portfólio (Harmo Metrics)</h3>
          </div>
          <div className="h-52 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosSentimento} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" stroke="#fff" strokeWidth={2}>
                    {dadosSentimento.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-3 pl-4 border-l border-slate-100">
              {dadosSentimento.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx] }}></span>
                    <span className="text-xs font-medium text-slate-600">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 font-mono">{item.value}</span>
                    <span className="text-[10px] font-medium text-slate-400 font-mono">({totalGeral > 0 ? ((item.value / totalGeral) * 100).toFixed(0) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <div className="mb-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Demandas de Mercado por Produto</h3>
          </div>
          <div className="h-52">
            {dadosProdutos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosProdutos} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="qtd" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center"><p className="text-xs text-slate-400 font-mono">Nenhum produto associado.</p></div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Matriz Crítica de Retenção (Foco Churn)</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {clientesChurn.map((c, i) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3 bg-white">
                <span className="text-xs font-black text-slate-300 w-4 font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{c.cliente}</p>
                  <p className="text-[9px] text-slate-400 font-mono">{c.produto}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[9px] font-mono bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md font-bold">score {c.churn_score || 0}</span>
                  <span className={`text-[10px] font-mono ${npsColor(c.nps)}`}>NPS {c.nps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Esteira Comercial Ativa (Gatilhos Upsell)</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {clientesUpsell.map((c, i) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3 bg-white">
                <span className="text-xs font-black text-slate-300 w-4 font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{c.cliente}</p>
                  <p className="text-[9px] text-slate-400 font-mono">{c.produto}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md font-bold">score {c.upsell_score || 0}</span>
                  <span className={`text-[10px] font-mono ${npsColor(c.nps)}`}>NPS {c.nps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// NAVBAR COM CRÉDITOS DA SQUAD (PRESERVADO INTEGRALMENTE)[cite: 2]
// ---------------------------------------------------------------------------
const Navbar = ({ visao, setVisao, totalGeral }) => {
  const [showSquad, setShowSquad] = useState(false);

  return (
    <nav className="w-full bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-4 flex-shrink-0 z-20 shadow-sm">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)]"></span>
          <h1 className="text-sm font-black tracking-widest text-slate-900 uppercase">TOTVS Insights</h1>
        </div>
        <div className="hidden sm:block h-4 w-px bg-slate-200"></div>
        <span className="hidden sm:block text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
          Data Engine Gateway · <span className="text-blue-600 font-bold">{totalGeral}</span> Sessões
        </span>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 flex-shrink-0">
        <button onClick={() => setVisao("zendesk")} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 ${visao === "zendesk" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Operacional</button>
        <button onClick={() => setVisao("harmo")} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 ${visao === "harmo" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Analítico</button>
      </div>

      <div className="relative flex-shrink-0">
        <button onClick={() => setShowSquad((s) => !s)} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 transition-all">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono">Squad · FIAP 2026 {showSquad ? "▲" : "▼"}</span>
        </button>

        {showSquad && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Challenge FIAP & TOTVS</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">Integrantes do Grupo</p>
            </div>
            <div className="p-2 space-y-0.5 bg-white">
              {SQUAD.map((m) => (
                <div key={m.rm} className="px-2.5 py-1.5 text-xs font-bold text-slate-800">{m.nome} <span className="text-slate-400 font-mono text-[10px]">({m.rm})</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// ---------------------------------------------------------------------------
// COMPONENTE RAIZ[cite: 2]
// ---------------------------------------------------------------------------
export default function App() {
  const [visao, setVisao]               = useState("zendesk");
  const [dataset, setDataset]           = useState([]);
  const [chamadaAtiva, setChamadaAtiva] = useState(null);
  const [carregando, setCarregando]     = useState(true);
  const [erroSistema, setErroSistema]   = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/reunioes`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro HTTP ${res.status} — Servidor API indisponível.`);
        return res.json();
      })
      .then((data) => {
        setDataset(data);
        if (data.length > 0) setChamadaAtiva(data[0]);
      })
      .catch((err) => {
        setErroSistema(err.message);
      })
      .finally(() => {
        setCarregando(false);
      });
  }, []);

  if (carregando) return <LoadingScreen />;
  if (erroSistema) return <ErrorScreen mensagem={erroSistema} />;

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-700 flex flex-col overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      <Navbar visao={visao} setVisao={setVisao} totalGeral={dataset.length} />
      <main className="flex-1 p-4 overflow-hidden">
        {visao === "zendesk" ? <VisaoOperacional dataset={dataset} chamadaAtiva={chamadaAtiva} setChamadaAtiva={setChamadaAtiva} /> : <VisaoGerencial dataset={dataset} />}
      </main>
    </div>
  );
}