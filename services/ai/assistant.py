import json
import logging
import re
from datetime import date, datetime, timedelta
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
        resposta_texto, dados_widget = _fallback_local(pergunta, hoje, motivo="Chave OPENAI_API_KEY não configurada no servidor.")
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
        motivo_erro = str(e)
        if "429" in motivo_erro or "credits" in motivo_erro.lower() or "quota" in motivo_erro.lower():
            motivo_detalhado = (
                "⚠️ **Aviso de Quota da OpenAI**: Sua conta da OpenAI está sem créditos ativos "
                "(`Error 429: You have no credits remaining`).\n\n"
                "Para liberar a conversação generativa livre completa, adicione créditos em [platform.openai.com/settings/organization/billing](https://platform.openai.com/settings/organization/billing).\n\n"
                "**Enquanto isso, acionei o motor analítico local inteligente para consultar seus dados reais:**\n\n"
            )
        else:
            motivo_detalhado = (
                f"⚠️ *Nota: A API da OpenAI retornou uma indisponibilidade temporária ({type(e).__name__}). "
                "Resposta processada via motor analítico local:*\n\n"
            )

        resposta_local, dados_widget = _fallback_local(pergunta, hoje)
        resposta_final = motivo_detalhado + resposta_local
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


def _fallback_local(pergunta: str, hoje: date, motivo: Optional[str] = None) -> tuple[str, Optional[Dict[str, Any]]]:
    """Fallback quando a OpenAI não está configurada ou sem créditos."""
    p = pergunta.lower().strip()

    # Saudações simples
    if p in ("oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "e aí", "e ai"):
        txt = (
            f"Olá! Sou seu assistente financeiro. Como posso ajudar suas finanças hoje?\n\n"
            "Você pode me perguntar sobre:\n"
            "- Quanto gastou neste mês ou em meses anteriores\n"
            "- Despesas por categoria (ex: Alimentação, Transporte)\n"
            "- Maiores despesas individuais\n"
            "- Situação do teto de gastos e metas\n"
            "- Gastos recorrentes e assinaturas"
        )
        return txt, None

    # Mês e período dinâmicos
    ini_mes = date(hoje.year, hoje.month, 1).isoformat()
    # Último dia do mês
    m = hoje.month
    y = hoje.year
    u_dia = 28
    if m in (1, 3, 5, 7, 8, 10, 12):
        u_dia = 31
    elif m in (4, 6, 9, 11):
        u_dia = 30
    elif (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0):
        u_dia = 29
    fim_mes = date(y, m, u_dia).isoformat()

    # Pergunta sobre mês passado
    if "mês passado" in p or "mes passado" in p or "anterior" in p:
        m_ant = hoje.month - 1
        y_ant = hoje.year
        if m_ant <= 0:
            m_ant = 12
            y_ant -= 1
        ini_ant = date(y_ant, m_ant, 1).isoformat()
        fim_ant = date(y_ant, m_ant, 28).isoformat()
        res = TOOL_FUNCTIONS["consultar_resumo_financeiro"](inicio=ini_ant, fim=fim_ant)
        txt = (
            f"Resumo financeiro do **mês passado ({m_ant:02d}/{y_ant})**:\n\n"
            f"- **Receitas:** R$ {res.get('total_receitas', 0):,.2f}\n"
            f"- **Despesas:** R$ {res.get('total_despesas', 0):,.2f}\n"
            f"- **Saldo apurado:** R$ {res.get('saldo_liquido', 0):,.2f}\n"
            f"- **Quantidade de lançamentos:** {res.get('quantidade_transacoes', 0)}"
        )
        return txt, {"tipo": "resumo_mes_passado", "dados": res}

    # Despesas por categoria
    if "categoria" in p or "onde gastei" in p or "onde estou gastando" in p or "alimentacao" in p or "alimentação" in p:
        res = TOOL_FUNCTIONS["consultar_despesas_por_categoria"](inicio=ini_mes, fim=fim_mes)
        linhas = [f"- **{c['categoria']}**: R$ {c['total']:,.2f} ({c['percentual']}%)" for c in res.get("categorias", [])[:6]]
        txt = (
            f"Aqui estão seus gastos por categoria em **{hoje.strftime('%m/%Y')}**:\n\n"
            + "\n".join(linhas)
            + f"\n\n**Total realizado no período:** R$ {res.get('total_geral_despesas', 0):,.2f}."
        )
        return txt, {"tipo": "despesas_categoria", "dados": res}

    # Maiores despesas
    if "maiores despesas" in p or "maior gasto" in p or "mais caro" in p or "maior despesa" in p or "compras mais altas" in p:
        res = TOOL_FUNCTIONS["consultar_maiores_despesas"](inicio=ini_mes, fim=fim_mes, limite=5)
        linhas = [f"- **{it['descricao']}** ({it['categoria']}): R$ {it['valor']:,.2f} em {it['data']}" for it in res.get("maiores_despesas", [])]
        txt = (
            f"Aqui estão as 5 maiores despesas registradas em **{hoje.strftime('%m/%Y')}**:\n\n"
            + "\n".join(linhas)
        )
        return txt, {"tipo": "maiores_despesas", "dados": res}

    # Metas e orçamentos
    if "meta" in p or "orçamento" in p or "orcamento" in p or "limite" in p or "teto" in p:
        res = TOOL_FUNCTIONS["consultar_metas_orcamento"](mes=hoje.month, ano=hoje.year)
        metas = res.get("metas", [])
        if metas:
            linhas = [f"- **{m['categoria']}**: R$ {m['realizado']:,.2f} de R$ {m['planejado']:,.2f} ({m['percentual_consumido']}%) — *{m['situacao']}*" for m in metas[:6]]
            txt = (
                f"Acompanhamento do orçamento para **{hoje.strftime('%m/%Y')}**:\n\n"
                f"- **Planejado total:** R$ {res.get('orcamento_total', 0):,.2f}\n"
                f"- **Realizado total:** R$ {res.get('gasto_total_metas', 0):,.2f}\n\n"
                + "\n".join(linhas)
            )
        else:
            txt = "Você ainda não possui metas de gastos ativas cadastradas. Acesse o menu **Metas de Gastos** no menu lateral para definir seus limites."
        return txt, {"tipo": "metas", "dados": res}

    # Recorrentes e assinaturas
    if "recorrente" in p or "assinatura" in p or "fixo" in p:
        res = TOOL_FUNCTIONS["consultar_gastos_recorrentes"]()
        itens = res.get("itens", [])
        if itens:
            linhas = [f"- **{it['descricao']}** ({it['categoria']}): R$ {it['valor']:,.2f} ({it['frequencia']})" for it in itens[:8]]
            txt = (
                f"Foram identificados **{res.get('quantidade_recorrentes', 0)} gastos fixos / assinaturas** recorrentes:\n\n"
                + "\n".join(linhas)
                + f"\n\n**Total mensal estimado:** R$ {res.get('total_mensal_estimado', 0):,.2f}."
            )
        else:
            txt = "Nenhuma despesa recorrente ou assinatura configurada no momento."
        return txt, {"tipo": "recorrentes", "dados": res}

    # Se for busca por termo ou estabelecimento (ex: "uber", "supermercado", "farmacia")
    palavras = [w for w in re.split(r"\s+", p) if len(w) > 3 and w not in ("quanto", "gastei", "sobre", "qual", "quais", "como", "onde", "para")]
    if palavras:
        termo = palavras[0]
        res = TOOL_FUNCTIONS["consultar_lancamentos_recentes"](termo_busca=termo, limite=5)
        lancamentos = res.get("lancamentos", [])
        if lancamentos:
            linhas = [f"- **{it['descricao']}** ({it['tipo']}): R$ {it['valor']:,.2f} em {it['data']}" for it in lancamentos]
            txt = (
                f"Encontrei os seguintes lançamentos recentes relacionados a **'{termo}'**:\n\n"
                + "\n".join(linhas)
            )
            return txt, {"tipo": "busca", "dados": res}

    # Resumo geral padrão
    res = TOOL_FUNCTIONS["consultar_resumo_financeiro"](inicio=ini_mes, fim=fim_mes)
    txt = (
        f"Consolidação financeira para o mês atual (**{hoje.strftime('%m/%Y')}**):\n\n"
        f"- **Receitas registradas:** R$ {res.get('total_receitas', 0):,.2f}\n"
        f"- **Despesas acumuladas:** R$ {res.get('total_despesas', 0):,.2f}\n"
        f"- **Saldo líquido do período:** R$ {res.get('saldo_liquido', 0):,.2f}\n"
        f"- **Total de movimentações:** {res.get('quantidade_transacoes', 0)}\n\n"
        "*(Dica: Você pode me perguntar sobre 'maiores despesas', 'gastos por categoria', 'minhas metas' ou buscar por estabelecimentos como 'Uber' ou 'Supermercado'.)*"
    )
    return txt, {"tipo": "resumo", "dados": res}
