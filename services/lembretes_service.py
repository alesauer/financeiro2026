from datetime import date, timedelta
from typing import Dict, Optional

from sqlalchemy import or_, case

from app import db
from app.models import Lembrete


def _apply_filters(query, filtros: Dict):
    status = filtros.get("status")
    if status in {"Pendente", "Concluído"}:
        query = query.filter(Lembrete.status == status)

    prioridade = filtros.get("prioridade")
    if prioridade in {"Baixa", "Média", "Alta"}:
        query = query.filter(Lembrete.prioridade == prioridade)

    data_inicio = filtros.get("data_inicio")
    if data_inicio:
        query = query.filter(Lembrete.data_lembrete >= data_inicio)

    data_fim = filtros.get("data_fim")
    if data_fim:
        query = query.filter(Lembrete.data_lembrete <= data_fim)

    busca = (filtros.get("busca") or "").strip()
    if busca:
        like = f"%{busca}%"
        query = query.filter(or_(
            Lembrete.titulo.ilike(like),
            Lembrete.descricao.ilike(like),
            Lembrete.categoria.ilike(like)
        ))

    return query


def listar_lembretes(usuario_id: int, filtros: Dict, page: int, per_page: int):
    query = Lembrete.query.filter_by(usuario_id=usuario_id)
    query = _apply_filters(query, filtros)

    status_case = case((Lembrete.status == "Pendente", 0), else_=1)
    prioridade_case = case(
        (Lembrete.prioridade == "Alta", 0),
        (Lembrete.prioridade == "Média", 1),
        else_=2
    )

    query = query.order_by(
        status_case,
        Lembrete.data_lembrete.is_(None),
        Lembrete.data_lembrete.asc(),
        Lembrete.hora_lembrete.asc(),
        prioridade_case,
        Lembrete.created_at.desc(),
    )

    per_page = max(1, min(per_page or 10, 100))
    page = max(1, page or 1)
    return query.paginate(page=page, per_page=per_page, error_out=False)


def contar(usuario_id: int, status: Optional[str] = None):
    query = db.session.query(db.func.count(Lembrete.id)).filter(Lembrete.usuario_id == usuario_id)
    if status in {"Pendente", "Concluído"}:
        query = query.filter(Lembrete.status == status)
    return query.scalar() or 0


def resumo_dashboard(usuario_id: int):
    hoje = date.today()
    sete_dias = hoje + timedelta(days=7)

    total = contar(usuario_id)
    pendentes = contar(usuario_id, "Pendente")
    concluidos = contar(usuario_id, "Concluído")

    hoje_qtd = db.session.query(db.func.count(Lembrete.id)).filter(
        Lembrete.usuario_id == usuario_id,
        Lembrete.status == "Pendente",
        Lembrete.data_lembrete == hoje
    ).scalar() or 0

    proximos = (
        Lembrete.query
        .filter(Lembrete.usuario_id == usuario_id)
        .filter(Lembrete.status == "Pendente")
        .filter(Lembrete.data_lembrete.isnot(None))
        .filter(Lembrete.data_lembrete >= hoje)
        .filter(Lembrete.data_lembrete <= sete_dias)
        .order_by(Lembrete.data_lembrete.asc(), Lembrete.hora_lembrete.asc())
        .limit(5)
        .all()
    )

    return {
        "total": total,
        "pendentes": pendentes,
        "concluidos": concluidos,
        "hoje": hoje_qtd,
        "proximos": proximos,
    }
