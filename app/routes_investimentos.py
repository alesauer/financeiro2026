from datetime import datetime, timedelta
from decimal import Decimal
from threading import Lock
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.models import (
    InvestmentAsset,
    InvestmentProviderConfig,
    InvestmentQuote,
    InvestmentTransaction,
    InvestmentWallet,
)
from app.schemas import (
    InvestmentAssetSchema,
    InvestmentProviderConfigSchema,
    InvestmentQuoteSchema,
    InvestmentTransactionSchema,
    InvestmentWalletSchema,
)
from app.services.investments.providers import get_default_provider, get_fallback_provider

bp_investimentos = Blueprint("investimentos", __name__)

wallet_schema = InvestmentWalletSchema()
wallets_schema = InvestmentWalletSchema(many=True)
asset_schema = InvestmentAssetSchema()
assets_schema = InvestmentAssetSchema(many=True)
transaction_schema = InvestmentTransactionSchema()
transactions_schema = InvestmentTransactionSchema(many=True)
quote_schema = InvestmentQuoteSchema()
quotes_schema = InvestmentQuoteSchema(many=True)
provider_schema = InvestmentProviderConfigSchema()
providers_schema = InvestmentProviderConfigSchema(many=True)

_MERCADO_CACHE_LOCK = Lock()
_MERCADO_CACHE = {
    "expires_at": None,
    "payload": None,
}
_MERCADO_CACHE_TTL_SECONDS = 45


from app.services.investments.fixed_income import (
    obter_indicadores_bcb,
    obter_titulos_tesouro_direto,
    simular_comparativo_renda_fixa,
)

def _montar_payload_mercado() -> dict:
    provider = get_default_provider()
    try:
        data = provider.get_market_snapshot() or {}
    except Exception:
        fallback = get_fallback_provider()
        data = fallback.get_market_snapshot() or {}

    return data


def _to_decimal(value, fallback="0"):
    if value is None:
        return Decimal(str(fallback))
    return Decimal(str(value))


@bp_investimentos.route("/wallets", methods=["GET"])
@jwt_required()
def listar_wallets():
    items = InvestmentWallet.query.order_by(InvestmentWallet.nome.asc()).all()
    return jsonify(wallets_schema.dump(items)), 200


@bp_investimentos.route("/wallets", methods=["POST"])
@jwt_required()
def criar_wallet():
    data = request.get_json() or {}
    try:
        payload = wallet_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    wallet = InvestmentWallet(**payload)
    db.session.add(wallet)
    db.session.commit()
    return jsonify(wallet_schema.dump(wallet)), 201


@bp_investimentos.route("/wallets/<int:wallet_id>", methods=["PUT"])
@jwt_required()
def atualizar_wallet(wallet_id):
    wallet = InvestmentWallet.query.get_or_404(wallet_id)
    data = request.get_json() or {}
    try:
        payload = wallet_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for key, value in payload.items():
        setattr(wallet, key, value)

    db.session.commit()
    return jsonify(wallet_schema.dump(wallet)), 200


@bp_investimentos.route("/wallets/<int:wallet_id>", methods=["DELETE"])
@jwt_required()
def excluir_wallet(wallet_id):
    wallet = InvestmentWallet.query.get_or_404(wallet_id)
    db.session.delete(wallet)
    db.session.commit()
    return jsonify({"message": "Carteira excluída"}), 200


@bp_investimentos.route("/assets", methods=["GET"])
@jwt_required()
def listar_assets():
    wallet_id = request.args.get("wallet_id", type=int)
    query = InvestmentAsset.query
    if wallet_id:
        query = query.filter(InvestmentAsset.wallet_id == wallet_id)
    items = query.order_by(InvestmentAsset.codigo.asc()).all()
    return jsonify(assets_schema.dump(items)), 200


@bp_investimentos.route("/assets", methods=["POST"])
@jwt_required()
def criar_asset():
    data = request.get_json() or {}
    try:
        payload = asset_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    wallet = db.session.get(InvestmentWallet, payload["wallet_id"])
    if not wallet:
        return jsonify({"error": "Carteira não encontrada"}), 404

    existente = (
        InvestmentAsset.query
        .filter_by(wallet_id=payload["wallet_id"], codigo=payload["codigo"].upper().strip())
        .first()
    )
    if existente:
        return jsonify({"error": "Já existe ativo com esse código na carteira"}), 409

    payload["codigo"] = payload["codigo"].upper().strip()
    asset = InvestmentAsset(**payload)
    db.session.add(asset)
    db.session.commit()
    return jsonify(asset_schema.dump(asset)), 201


@bp_investimentos.route("/assets/<int:asset_id>", methods=["PUT"])
@jwt_required()
def atualizar_asset(asset_id):
    asset = InvestmentAsset.query.get_or_404(asset_id)
    data = request.get_json() or {}
    try:
        payload = asset_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    if "codigo" in payload and payload["codigo"]:
        payload["codigo"] = payload["codigo"].upper().strip()

    for key, value in payload.items():
        setattr(asset, key, value)

    db.session.commit()
    return jsonify(asset_schema.dump(asset)), 200


@bp_investimentos.route("/assets/<int:asset_id>", methods=["DELETE"])
@jwt_required()
def excluir_asset(asset_id):
    asset = InvestmentAsset.query.get_or_404(asset_id)
    db.session.delete(asset)
    db.session.commit()
    return jsonify({"message": "Ativo excluído"}), 200


@bp_investimentos.route("/transactions", methods=["GET"])
@jwt_required()
def listar_transactions():
    wallet_id = request.args.get("wallet_id", type=int)
    asset_id = request.args.get("asset_id", type=int)

    query = InvestmentTransaction.query
    if wallet_id:
        query = query.filter(InvestmentTransaction.wallet_id == wallet_id)
    if asset_id:
        query = query.filter(InvestmentTransaction.asset_id == asset_id)

    items = query.order_by(InvestmentTransaction.data_movimentacao.desc(), InvestmentTransaction.id.desc()).all()
    return jsonify(transactions_schema.dump(items)), 200


@bp_investimentos.route("/transactions", methods=["POST"])
@jwt_required()
def criar_transaction():
    data = request.get_json() or {}
    try:
        payload = transaction_schema.load(data)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    wallet = db.session.get(InvestmentWallet, payload["wallet_id"])
    if not wallet:
        return jsonify({"error": "Carteira não encontrada"}), 404

    asset_id = payload.get("asset_id")
    if asset_id:
        asset = db.session.get(InvestmentAsset, asset_id)
        if not asset:
            return jsonify({"error": "Ativo não encontrado"}), 404

    quantidade = _to_decimal(payload.get("quantidade"), "0")
    preco = _to_decimal(payload.get("preco"), "0")
    taxas = _to_decimal(payload.get("taxas"), "0")
    valor_total = _to_decimal(payload.get("valor_total"), "0")

    if valor_total <= 0 and quantidade > 0 and preco > 0:
        valor_total = (quantidade * preco) + taxas

    tx = InvestmentTransaction(
        wallet_id=payload["wallet_id"],
        asset_id=payload.get("asset_id"),
        tipo=payload["tipo"],
        data_movimentacao=payload.get("data_movimentacao"),
        quantidade=quantidade if quantidade > 0 else None,
        preco=preco if preco > 0 else None,
        taxas=taxas,
        valor_total=valor_total,
        corretora=payload.get("corretora"),
        observacoes=payload.get("observacoes"),
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify(transaction_schema.dump(tx)), 201


@bp_investimentos.route("/transactions/<int:tx_id>", methods=["PUT"])
@jwt_required()
def atualizar_transaction(tx_id):
    tx = InvestmentTransaction.query.get_or_404(tx_id)
    data = request.get_json() or {}
    try:
        payload = transaction_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for key, value in payload.items():
        setattr(tx, key, value)

    quantidade = _to_decimal(tx.quantidade, "0")
    preco = _to_decimal(tx.preco, "0")
    taxas = _to_decimal(tx.taxas, "0")
    valor_total = _to_decimal(tx.valor_total, "0")
    if valor_total <= 0 and quantidade > 0 and preco > 0:
        tx.valor_total = (quantidade * preco) + taxas

    db.session.commit()
    return jsonify(transaction_schema.dump(tx)), 200


@bp_investimentos.route("/transactions/<int:tx_id>", methods=["DELETE"])
@jwt_required()
def excluir_transaction(tx_id):
    tx = InvestmentTransaction.query.get_or_404(tx_id)
    db.session.delete(tx)
    db.session.commit()
    return jsonify({"message": "Movimentação excluída"}), 200


@bp_investimentos.route("/quotes", methods=["GET"])
@jwt_required()
def listar_quotes():
    wallet_id = request.args.get("wallet_id", type=int)
    query = InvestmentQuote.query.join(InvestmentAsset, InvestmentQuote.asset_id == InvestmentAsset.id)
    if wallet_id:
        query = query.filter(InvestmentAsset.wallet_id == wallet_id)
    items = query.order_by(InvestmentAsset.codigo.asc()).all()
    return jsonify(quotes_schema.dump(items)), 200


@bp_investimentos.route("/quotes/refresh", methods=["POST"])
@jwt_required()
def atualizar_quotes():
    data = request.get_json() or {}
    wallet_id = data.get("wallet_id")
    ttl_min = int(data.get("ttl_min", 15))

    query = InvestmentAsset.query.filter_by(ativo=True)
    if wallet_id:
        query = query.filter(InvestmentAsset.wallet_id == wallet_id)
    assets = query.all()

    if not assets:
        return jsonify({"updated": 0, "skipped": 0, "items": []}), 200

    provider = get_default_provider()
    fallback = get_fallback_provider()
    now = datetime.utcnow()
    limite_cache = now - timedelta(minutes=ttl_min)

    atualizados = []
    skipped = 0

    for asset in assets:
        quote = InvestmentQuote.query.filter_by(asset_id=asset.id, provider=provider.nome).first()
        if quote and quote.cotado_em and quote.cotado_em >= limite_cache:
            skipped += 1
            atualizados.append(quote)
            continue

        dados = provider.get_quote(asset.codigo)
        prov_usado = provider.nome
        if not dados:
            dados = fallback.get_quote(asset.codigo)
            prov_usado = fallback.nome

        if not dados:
            continue

        quote = InvestmentQuote.query.filter_by(asset_id=asset.id, provider=prov_usado).first()
        if not quote:
            quote = InvestmentQuote(asset_id=asset.id, provider=prov_usado)
            db.session.add(quote)

        quote.preco = dados["preco"]
        quote.variacao_percentual = dados.get("variacao_percentual")
        quote.moeda = dados.get("moeda") or asset.moeda or "BRL"
        quote.cotado_em = dados.get("cotado_em") or now
        atualizados.append(quote)

    db.session.commit()
    return jsonify({
        "updated": len(atualizados) - skipped,
        "skipped": skipped,
        "items": quotes_schema.dump(atualizados),
    }), 200


@bp_investimentos.route("/providers", methods=["GET"])
@jwt_required()
def listar_providers():
    items = InvestmentProviderConfig.query.order_by(InvestmentProviderConfig.prioridade.asc()).all()
    if not items:
        defaults = [
            InvestmentProviderConfig(nome="brapi", ativo=True, prioridade=1),
            InvestmentProviderConfig(nome="yahoo", ativo=True, prioridade=2),
        ]
        db.session.add_all(defaults)
        db.session.commit()
        items = defaults
    return jsonify(providers_schema.dump(items)), 200


@bp_investimentos.route("/providers/<int:provider_id>", methods=["PUT"])
@jwt_required()
def atualizar_provider(provider_id):
    item = InvestmentProviderConfig.query.get_or_404(provider_id)
    data = request.get_json() or {}
    try:
        payload = provider_schema.load(data, partial=True)
    except Exception as err:
        return jsonify(getattr(err, "messages", {"error": "Dados inválidos"})), 400

    for key, value in payload.items():
        setattr(item, key, value)

    db.session.commit()
    return jsonify(provider_schema.dump(item)), 200


@bp_investimentos.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard_investimentos():
    wallet_id = request.args.get("wallet_id", type=int)

    assets_query = InvestmentAsset.query.filter_by(ativo=True)
    if wallet_id:
        assets_query = assets_query.filter(InvestmentAsset.wallet_id == wallet_id)
    assets = assets_query.all()
    if not assets:
        return jsonify({
            "patrimonio_total": 0,
            "valor_investido": 0,
            "lucro_prejuizo": 0,
            "rentabilidade_percentual": 0,
            "dividendos_mes": 0,
            "aporte_mes": 0,
            "alocacao_por_tipo": [],
            "ativos": [],
        }), 200

    asset_ids = [asset.id for asset in assets]

    tx_query = InvestmentTransaction.query.filter(InvestmentTransaction.wallet_id.in_([a.wallet_id for a in assets]))
    txs = tx_query.all()

    hoje = datetime.utcnow().date()
    mes_atual = hoje.month
    ano_atual = hoje.year

    saldo_por_ativo = {}
    custo_por_ativo = {}
    dividendos_mes = Decimal("0")
    aporte_mes = Decimal("0")

    for tx in txs:
        if tx.asset_id not in asset_ids and tx.asset_id is not None:
            continue

        qty = _to_decimal(tx.quantidade, "0")
        total = _to_decimal(tx.valor_total, "0")

        if tx.asset_id:
            saldo_por_ativo.setdefault(tx.asset_id, Decimal("0"))
            custo_por_ativo.setdefault(tx.asset_id, Decimal("0"))

        if tx.tipo == "Compra" and tx.asset_id:
            saldo_por_ativo[tx.asset_id] += qty
            custo_por_ativo[tx.asset_id] += total
        elif tx.tipo == "Venda" and tx.asset_id:
            saldo_por_ativo[tx.asset_id] -= qty
            custo_por_ativo[tx.asset_id] -= total
            if custo_por_ativo[tx.asset_id] < 0:
                custo_por_ativo[tx.asset_id] = Decimal("0")
        elif tx.tipo in {"Dividendos", "JCP"}:
            if tx.data_movimentacao and tx.data_movimentacao.month == mes_atual and tx.data_movimentacao.year == ano_atual:
                dividendos_mes += total
        elif tx.tipo == "Aporte":
            if tx.data_movimentacao and tx.data_movimentacao.month == mes_atual and tx.data_movimentacao.year == ano_atual:
                aporte_mes += total

    patrimonio_total = Decimal("0")
    valor_investido = Decimal("0")
    alocacao_map = {}
    detalhes = []

    for asset in assets:
        qty = saldo_por_ativo.get(asset.id, Decimal("0"))
        if qty <= 0:
            continue

        quote = (
            InvestmentQuote.query.filter_by(asset_id=asset.id)
            .order_by(InvestmentQuote.cotado_em.desc())
            .first()
        )
        preco = _to_decimal(quote.preco if quote else None, "0")
        atual = qty * preco
        custo = custo_por_ativo.get(asset.id, Decimal("0"))

        patrimonio_total += atual
        valor_investido += custo
        alocacao_map.setdefault(asset.tipo, Decimal("0"))
        alocacao_map[asset.tipo] += atual

        detalhes.append({
            "asset_id": asset.id,
            "codigo": asset.codigo,
            "nome": asset.nome,
            "tipo": asset.tipo,
            "quantidade": float(qty),
            "preco_atual": float(preco),
            "valor_atual": float(atual),
            "valor_investido": float(custo),
            "p_l": float(atual - custo),
        })

    lucro_prejuizo = patrimonio_total - valor_investido
    rentabilidade = (lucro_prejuizo / valor_investido * 100) if valor_investido > 0 else Decimal("0")

    alocacao = [
        {
            "tipo": tipo,
            "valor": float(valor),
            "percentual": float((valor / patrimonio_total * 100) if patrimonio_total > 0 else 0),
        }
        for tipo, valor in sorted(alocacao_map.items(), key=lambda item: item[1], reverse=True)
    ]

    return jsonify({
        "patrimonio_total": float(patrimonio_total),
        "valor_investido": float(valor_investido),
        "lucro_prejuizo": float(lucro_prejuizo),
        "rentabilidade_percentual": float(rentabilidade),
        "dividendos_mes": float(dividendos_mes),
        "aporte_mes": float(aporte_mes),
        "alocacao_por_tipo": alocacao,
        "ativos": detalhes,
    }), 200


@bp_investimentos.route("/mercado/snapshot", methods=["GET"])
@jwt_required()
def mercado_snapshot():
    now = datetime.utcnow()
    stale_payload = None
    with _MERCADO_CACHE_LOCK:
        expires_at = _MERCADO_CACHE.get("expires_at")
        payload = _MERCADO_CACHE.get("payload")
        stale_payload = payload
        if payload and expires_at and expires_at > now:
            return jsonify(payload), 200

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_montar_payload_mercado)
            payload = future.result(timeout=8)
    except (FutureTimeoutError, Exception):
        if stale_payload:
            return jsonify(stale_payload), 200
        payload = {
            "source": "offline",
            "indices": [],
            "movers": [],
            "fx": [],
            "updated_at": None,
        }

    with _MERCADO_CACHE_LOCK:
        _MERCADO_CACHE["payload"] = payload
        _MERCADO_CACHE["expires_at"] = datetime.utcnow() + timedelta(seconds=_MERCADO_CACHE_TTL_SECONDS)

    return jsonify(payload), 200


@bp_investimentos.route("/mercado/quote/<string:codigo>", methods=["GET"])
@jwt_required()
def mercado_quote(codigo):
    provider = get_default_provider()
    quote = provider.get_quote(codigo)
    if not quote:
        return jsonify({"error": f"Ativo {codigo} não encontrado"}), 404

    # Convert Decimal to float for JSON serialization
    serialized = {}
    for k, v in quote.items():
        if isinstance(v, Decimal):
            serialized[k] = float(v)
        elif isinstance(v, datetime):
            serialized[k] = v.isoformat() + "Z"
        else:
            serialized[k] = v

    return jsonify(serialized), 200


@bp_investimentos.route("/mercado/renda-fixa/simular", methods=["GET"])
@jwt_required()
def simular_renda_fixa():
    valor_inicial = request.args.get("valor_inicial", 10000.0, type=float)
    prazo_meses = request.args.get("prazo_meses", 24, type=int)
    aporte_mensal = request.args.get("aporte_mensal", 0.0, type=float)

    resultado = simular_comparativo_renda_fixa(
        valor_inicial=max(100.0, valor_inicial),
        prazo_meses=max(1, min(prazo_meses, 360)),
        aporte_mensal=max(0.0, aporte_mensal),
    )
    return jsonify(resultado), 200


@bp_investimentos.route("/mercado/search", methods=["GET"])
@jwt_required()
def mercado_search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([]), 200

    provider = get_default_provider()
    try:
        results = provider.search_assets(q)
        return jsonify(results), 200
    except Exception:
        return jsonify([]), 200

