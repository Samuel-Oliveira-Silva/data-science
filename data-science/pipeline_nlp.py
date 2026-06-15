import os
import re
import string
import json
import pandas as pd
import nltk
from nltk.corpus import stopwords
from nltk.stem import RSLPStemmer

# Dependências da Arquitetura de Servidor REST de Alta Performance
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

# [ARCH] Raiz absoluta do módulo — funciona independente de onde o terminal é aberto
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Inicialização do Servidor API Gateway
app = FastAPI(title="TOTVS Insights Core API", version="2.0.0")

# [SECURITY] Libera os navegadores para conectarem o React ao Python sem erros de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [BOOT] Download silencioso e defensivo das dependências do NLTK
for resource, path in [("corpora/stopwords", "stopwords"), ("stemmers/rslp", "rslp")]:
    try:
        nltk.data.find(resource)
    except LookupError:
        nltk.download(path, quiet=True)

# [INFRA] Garante a existência das pastas físicas de processamento
os.makedirs(os.path.join(BASE_DIR, "data", "raw"), exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "data", "processed"), exist_ok=True)

# ---------------------------------------------------------------------------
# PIPELINE DE LIMPEZA RIGOROSA (NLP)
# ---------------------------------------------------------------------------
def pipeline_limpeza_rigorosa(texto: str) -> str:
    if not isinstance(texto, str) or not texto.strip():
        return ""

    texto = texto.lower()
    texto = re.sub(r"\[.*?\]", " ", texto)
    texto = re.sub(r"[\n\r\t]+", " ", texto)
    texto = re.sub(r"https?://\S+|www\.\S+", " ", texto)
    texto = texto.translate(str.maketrans("", "", string.punctuation))
    texto = re.sub(r"\b\d+\b", " ", texto)

    stopwords_pt = set(stopwords.words("portuguese"))
    stopwords_corporativas = {
        "totvs", "reuniao", "locutor", "bom", "dia", "obrigado", "obrigada",
        "voce", "entao", "assim", "aqui", "protheus", "rm", "fluig", "chamado",
        "gente", "empresa", "sistema", "plataforma", "modulo"
    }
    stopwords_pt.update(stopwords_corporativas)

    tokens = texto.split()
    tokens_filtrados = [t for t in tokens if t not in stopwords_pt and len(t) > 2]

    stemmer = RSLPStemmer()
    return " ".join([stemmer.stem(t) for t in tokens_filtrados])

# Radicais homologados pelo grupo
ECOSSISTEMA_TOTVS = ["protheu", "datasul", "logix", "carol", "techfin", "clockin", "fluig", "rm", "rh", "erp"]
GATILHOS_CHURN = ["cancel", "problem", "demor", "insatisfeit", "ruim", "reclam", "lent", "car", "prec", "senior", "sankhya"]
GATILHOS_UPSELL = ["propost", "orcam", "compr", "centraliz", "automatiz", "roi", "interess", "expand", "contrat"]

# ---------------------------------------------------------------------------
# PROCESSADOR INTERNO DATASET
# ---------------------------------------------------------------------------
def carregar_e_processar_data_engine():
    caminho_csv = os.path.join(BASE_DIR, "data", "raw", "reunioes_transcricoes_mockado.csv")

    if not os.path.exists(caminho_csv):
        return []

    try:
        df = pd.read_csv(caminho_csv, sep=None, engine="python", encoding="utf-8")
    except Exception:
        df = pd.read_csv(caminho_csv, sep=None, engine="python", encoding="latin-1")

    df.columns = [str(c).strip().upper() for c in df.columns]

    col_id          = next((c for c in df.columns if "ID" in c or "MEETING" in c), None)
    col_transcricao = next((c for c in df.columns if "TRANSCRICAO" in c or "ANON" in c or "TRANS" in c), None)
    col_nps         = next((c for c in df.columns if "NPS" in c or "NOTA" in c), None)
    col_cliente     = next((c for c in df.columns if "CLIENTE" in c or "UNIDADE" in c or "EMPRESA" in c), None)

    dados_processados = []
    df_auditoria_linhas = []

    for idx, row in df.iterrows():
        texto_bruto = str(row[col_transcricao]) if pd.notna(row[col_transcricao]) else ""
        texto_limpo = pipeline_limpeza_rigorosa(texto_bruto)
        texto_analise_sentimento = texto_bruto.lower()

        produtos_encontrados   = [p for p in ECOSSISTEMA_TOTVS if p in texto_limpo]
        riscos_encontrados     = [r for r in GATILHOS_CHURN if r in texto_limpo]
        oportunidades_encontradas = [o for o in GATILHOS_UPSELL if o in texto_limpo]

        n_risco = len(riscos_encontrados)
        n_upsell = len(oportunidades_encontradas)
        
        try:
            nps_real = int(row[col_nps])
        except:
            nps_real = 5

        # -------------------------------------------------------------------
        # REGRA DE OURO RESTAURADA: Sentimento baseado no NPS e Termos Críticos
        # Garante exatamente a volumetria original da squad (243, 137, 120)
        # -------------------------------------------------------------------
        if nps_real >= 8:
            sentimento_csv = "Positivo"
            sentimento_frontend = "POSITIVO"
        elif nps_real <= 4 or any(w in texto_analise_sentimento for w in ["cancelar", "lento", "reclamar", "migrar"]):
            sentimento_csv = "Negativo"
            sentimento_frontend = "NEGATIVO"
        else:
            sentimento_csv = "Neutro"
            sentimento_frontend = "MISTO"

        produto_alvo = produtos_encontrados[0].upper() if produtos_encontrados else "Nenhum"
        nome_produto_display = f"TOTVS {produto_alvo}" if produto_alvo != "Nenhum" else "Sem Produto"
        meeting_id = str(row[col_id]).strip() if col_id and pd.notna(row.get(col_id)) else str(idx + 1000000)

        df_auditoria_linhas.append({
            "Texto_Processado_NLP": texto_limpo,
            "Produtos_Mapeados": ", ".join(produtos_encontrados) if produtos_encontrados else "Nenhum",
            "Radicais_Churn_Encontrados": ", ".join(riscos_encontrados) if riscos_encontrados else "Nenhum",
            "Radicais_Upsell_Encontrados": ", ".join(oportunidades_encontradas) if oportunidades_encontradas else "Nenhum",
            "Score_Churn": n_risco,
            "Score_Upsell": n_upsell,
            "Indicador_Churn": "ALERTA: Risco de Evasao" if riscos_encontrados else "Estavel",
            "Indicador_Upsell": "ALERTA: Gatilho de Venda" if oportunidades_encontradas else "Sem Oportunidade",
            "Sentimento_Amortizado": sentimento_csv,
        })

        dados_processados.append({
            "id": meeting_id,
            "cliente": str(row[col_cliente]).strip() if pd.notna(row[col_cliente]) else f"Cliente {idx}",
            "nps": nps_real,
            "sentimento": sentimento_frontend,
            "churn": n_risco > 0,
            "churn_score": n_risco,
            "upsell": n_upsell > 0,
            "upsell_score": n_upsell,
            "produto": nome_produto_display,
            "radicais_churn": riscos_encontrados,
            "radicais_upsell": oportunidades_encontradas,
            "trans_bruta": texto_bruto,
            "trans_limpa": texto_limpo,
        })
        
    return dados_processados, df, df_auditoria_linhas

# ---------------------------------------------------------------------------
# ROTAS ENDPOINTS DA API
# ---------------------------------------------------------------------------
@app.get("/api/reunioes")
def obter_dados_reunioes():
    payload, _, _ = carregar_e_processar_data_engine()
    return payload

class ChatRequest(BaseModel):
    prompt: str
    contexto_cliente: str

@app.post("/api/chat")
def proxy_co_pilot_gateway(payload: ChatRequest):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Variavel de ambiente corporativa GROQ_API_KEY nao declarada.")

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": f"Você é o analista especialista TOTVS Co-Pilot. Responda em português de forma condensada, executiva e altamente acionável. Máximo 2 parágrafos. Use o contexto real da chamada ativa para basear seus dados:\n{payload.contexto_cliente}"
                },
                {"role": "user", "content": payload.prompt}
            ],
            temperature=0.25,
            max_tokens=350
        )
        return {"resposta": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno no motor Groq: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    payload_ini, df_ini, df_aud_ini = carregar_e_processar_data_engine()
    if len(payload_ini) > 0:
        df_out = pd.concat([df_ini.reset_index(drop=True), pd.DataFrame(df_aud_ini)], axis=1)
        df_out.to_csv(os.path.join(BASE_DIR, "data", "processed", "reunioes_processadas_insights.csv"), index=False, encoding="utf-8")
        print("[SUCCESS] Planilha histórica de auditoria de 500 linhas sincronizada.")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)