import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from app import db
from app.models import IAConversa, IAMensagem
from services.ai.client import get_openai_client, registrar_consumo
from services.ai.tools import OPENAI_TOOLS, TOOL_FUNCTIONS

logger = logging.getLogger(__name__)


def _gerar_titulo_conversa(pergunta: str) -> str:
    limpa = pergunta.strip().replace("\n", " ")
    if len(limpa) > 40:
        return limpa[:37] + "..."
    return limpa.capitalize() or "Conversa financeira"


def processar_pergunta_assistente(conversa_id: int, usuario_id: int, pergunta: str) -> Dict[str, Any]:
    """Processa a mensagem do usuário na conversa, executa ferramentas necessárias e persiste as mensagens."""
    conversa = IAConversa.query.filter_by(id=conversa_id, usuario_id=usuario_id).first_or_404()

    # 1. Salva a mensagem do usuário
    msg_user = IAMensagem(
        conversa_id=conversa.id,
        role="user",
        conteudo=pergunta
    )
    db.session.add(msg_user)

    # Atualiza título da conversa se for a primeira mensagem
    if conversa.titulo in ("Nova conversa", "Conversa financeira", ""):
        conversa.titulo = _gerar_titulo_conversa(pergunta)

    db.session.commit()

    # 2. Carrega histórico recente da conversa (últimas 8 mensagens)
    historico_db = IAMensagem.query.filter_by(conversa_id=conversa.id).order_by(IAMensagem.id.asc()).all()
    # Pega as últimas mensagens antes da resposta
    historico_mensagens = []
    for m in historico_db[-8:]:
        historico_mensagens.append({
            "role": m.role,
            "content": m.conteudo
        })

    hoje = date.today()
    system_prompt = (
        f"Você é o Assistente Financeiro Inteligente do SaaS Financeiro 'Maluki Organiza'. "
        f"Hoje é dia {hoje.strftime('%d/%m/%Y')} (Ano: {hoje.year}, Mês: {hoje.month}). "
        "Você tem acesso a ferramentas para consultar os dados financeiros REAIS do usuário no banco de dados. "
        "INSTRUÇÕES OBRIGATÓRIAS:\n"
        "1. NUNCA invente valores, saldos ou transações. SEMPRE chame as ferramentas fornecidas para consultar os dados reais.\n"
        "2. Responda em português do Brasil de maneira concisa, empática, profissional e objetiva.\n"
        "3. Sempre formate valores monetários no padrão brasileiro (ex: R$ 1.450,80).\n"
        "4. Destaque claramente o período das informações analisadas.\n"
        "5. Quando fizer sugestões ou recomendações de economia, diferencie claramente o que são dados observados de sugestões práticas.\n"
        "6. Quando apropriado, apresente listas limpas com marcadores ou pequenas tabelas markdown para facilitar a leitura."
    )

    client = get_openai_client()

    if not client:
        # Fallback local determinístico inteligente caso não haja API Key
        resposta_texto, dados_widget = _fallback_local(pergunta, hoje)
        msg_assistant = IAMensagem(
            conversa_id=conversa.id,
            role="assistant",
            conteudo=resposta_texto,
            metadados_json=json.dumps(dados_widget, ensure_ascii=False) if dados_widget else None,
            tokens_prompt=0,
            tokens_completion=0
        )
        db.session.add(msg_assistant)
        db.session.commit()

        return {
            "id": msg_assistant.id,
            "role": "assistant",
            "conteudo": resposta_texto,
            "metadados": dados_widget,
            "created_at": msg_assistant.created_at.isoformat()
        }

    # Execução com OpenAI e Function Calling
    mensagens_openai = [{"role": "system", "content": system_prompt}] + historico_mensagens
    modelo = "gpt-4o-mini"
    total_prompt_tokens = 0
    total_completion_tokens = 0
    widgets_acumulados = []

    try:
        # Primeira chamada à OpenAI
        response = client.chat.completions.create(
            model=modelo,
            messages=mensagens_openai,
            tools=OPENAI_TOOLS,
            tool_choice="auto",
            temperature=0.2,
            max_tokens=600
        )

        if response.usage:
            total_prompt_tokens += response.usage.prompt_tokens
            total_completion_tokens += response.usage.completion_tokens

        msg_escolha = response.choices[0].message

        # Se o modelo decidiu chamar ferramentas:
        if msg_escolha.tool_calls:
            mensagens_openai.append(msg_escolha)

            for tool_call in msg_escolha.tool_calls:
                func_name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments or "{}")
                except Exception:
                    args = {}

                func_impl = TOOL_FUNCTIONS.get(func_name)
                if func_impl:
                    resultado_tool = func_impl(**args)
                else:
                    resultado_tool = {"erro": f"Ferramenta {func_name} não encontrada."}

                widgets_acumulados.append({
                    "ferramenta": func_name,
                    "parametros": args,
                    "resultado": resultado_tool
                })

                mensagens_openai.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(resultado_tool, ensure_ascii=False)
                })

            # Segunda chamada à OpenAI para sintetizar a resposta com os dados retornados
            segunda_resposta = client.chat.completions.create(
                model=modelo,
                messages=mensagens_openai,
                temperature=0.3,
                max_tokens=700
            )

            if segunda_resposta.usage:
                total_prompt_tokens += segunda_resposta.usage.prompt_tokens
                total_completion_tokens += segunda_resposta.usage.completion_tokens

            resposta_final = segunda_resposta.choices[0].message.content or "Consulta realizada com sucesso."
        else:
            resposta_final = msg_escolha.content or "Não foi possível obter uma resposta para esta solicitação."

        # Registrar consumo
        registrar_consumo(
            usuario_id=usuario_id,
            funcionalidade="assistente_chat",
            modelo=modelo,
            prompt_tokens=total_prompt_tokens,
            completion_tokens=total_completion_tokens
        )

    except Exception as e:
        logger.error(f"Erro na chamada OpenAI: {e}", exc_info=True)
        resposta_final, dados_widget = _fallback_local(pergunta, hoje)
        if dados_widget:
            widgets_acumulados.append(dados_widget)

    # Persistir resposta do assistente
    msg_assistant = IAMensagem(
        conversa_id=conversa.id,
        role="assistant",
        conteudo=resposta_final,
        metadados_json=json.dumps(widgets_acumulados, ensure_ascii=False) if widgets_acumulados else None,
        tokens_prompt=total_prompt_tokens,
        tokens_completion=total_completion_tokens
    )
    db.session.add(msg_assistant)
    db.session.commit()

    return {
        "id": msg_assistant.id,
        "role": "assistant",
        "conteudo": resposta_final,
        "metadados": widgets_acumulados,
        "created_at": msg_assistant.created_at.isoformat()
    }


def _fallback_local(pergunta: str, hoje: date) -> tuple[str, Optional[Dict[str, Any]]]:
    """Fallback quando a OpenAI não está configurada ou indisponível."""
    p = pergunta.lower()
    ini_mes = date(hoje.year, hoje.month, 1).isoformat()
    fim_mes = date(hoje.year, hoje.month, 28).isoformat()

    if "categoria" in p or "onde gastei" in p or "onde estou gastando" in p:
        res = TOOL_FUNCTIONS["consultar_despesas_por_categoria"](inicio=ini_mes, fim=fim_mes)
        linhas = [f"- **{c['categoria']}**: R$ {c['total']:,.2f} ({c['percentual']}%)" for c in res.get("categorias", [])[:5]]
        txt = (
            f"Aqui estão suas principais despesas por categoria no mês atual ({hoje.strftime('%m/%Y')}):\n\n"
            + "\n".join(linhas)
            + f"\n\n**Total apurado no período:** R$ {res.get('total_geral_despesas', 0):,.2f}."
        )
        return txt, {"tipo": "despesas_categoria", "dados": res}

    if "maiores despesas" in p or "maior gasto" in p or "mais caro" in p:
        res = TOOL_FUNCTIONS["consultar_maiores_despesas"](inicio=ini_mes, fim=fim_mes, limite=5)
        linhas = [f"- **{it['descricao']}** ({it['categoria']}): R$ {it['valor']:,.2f} em {it['data']}" for it in res.get("maiores_despesas", [])]
        txt = (
            f"Aqui estão as maiores despesas registradas no mês atual ({hoje.strftime('%m/%Y')}):\n\n"
            + "\n".join(linhas)
        )
        return txt, {"tipo": "maiores_despesas", "dados": res}

    if "meta" in p or "orçamento" in p:
        res = TOOL_FUNCTIONS["consultar_metas_orcamento"](mes=hoje.month, ano=hoje.year)
        linhas = [f"- **{m['categoria']}**: R$ {m['realizado']:,.2f} de R$ {m['planejado']:,.2f} ({m['percentual_consumido']}%) — *{m['situacao']}*" for m in res.get("metas", [])[:5]]
        txt = (
            f"Situação do orçamento em {hoje.strftime('%m/%Y')}:\n"
            f"- **Planejado total:** R$ {res.get('orcamento_total', 0):,.2f}\n"
            f"- **Realizado:** R$ {res.get('gasto_total_metas', 0):,.2f}\n\n"
            + "\n".join(linhas)
        )
        return txt, {"tipo": "metas", "dados": res}

    # Resumo padrão
    res = TOOL_FUNCTIONS["consultar_resumo_financeiro"](inicio=ini_mes, fim=fim_mes)
    txt = (
        f"Resumo financeiro de **{hoje.strftime('%m/%Y')}**:\n\n"
        f"- **Receitas:** R$ {res.get('total_receitas', 0):,.2f}\n"
        f"- **Despesas:** R$ {res.get('total_despesas', 0):,.2f}\n"
        f"- **Saldo do período:** R$ {res.get('saldo_liquido', 0):,.2f}\n"
        f"- **Lançamentos registrados:** {res.get('quantidade_transacoes', 0)}\n\n"
        "*(Modo analítico local ativo. Para conversas livres e análises avançadas, verifique sua chave OpenAI no ambiente.)*"
    )
    return txt, {"tipo": "resumo", "dados": res}

