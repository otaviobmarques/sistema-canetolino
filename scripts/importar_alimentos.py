"""Gera o SQL de importação da base unificada do repositório fontes-ref para a tabela `foods`.

Uso:
    python3 scripts/importar_alimentos.py ../fontes-ref/unificado/alimentos.json > alimentos.sql
    psql "$SUPABASE_DB_URL" -f alimentos.sql

Sem acesso direto ao banco: crie a função temporária `_importar_foods` (ver migração 0014) e envie pela API:
    IMPORT_TOKEN=... python3 scripts/importar_alimentos.py ../fontes-ref/unificado/alimentos.json --enviar

Entram só os registros com `uso == "ok"` (a fonte traz energia e macros consistentes).
Números não são alterados: o que a fonte publica sem valor fica sem valor.
"""
import json
import sys

# Brasileiras primeiro na busca; depois USDA e CoFID; depois as demais estrangeiras
PRIORIDADE = {'TACO': 1, 'TBCA': 2, 'POF': 3, 'USDA': 5, 'COFID': 6, 'CNF': 7, 'AFCD': 7, 'CIQUAL': 8, 'FRIDA': 8, 'FINELI': 8}
VERSAO = {'TACO': 'TACO 4ª ed.', 'TBCA': 'TBCA (USP/FoRC)', 'POF': 'POF 2008-2009 (IBGE)', 'USDA': 'USDA FoodData Central', 'COFID': 'CoFID 2021',
          'CIQUAL': 'Ciqual 2025 (ANSES)', 'CNF': 'CNF 2026 (Health Canada)', 'AFCD': 'AFCD Release 3 (FSANZ)', 'FRIDA': 'Frida 5.5 (DTU)', 'FINELI': 'Fineli (THL)'}
POPULARES = [
    'Arroz, tipo 1, cozido', 'Arroz, integral, cozido', 'Feijão, carioca, cozido', 'Feijão, preto, cozido',
    'Frango, peito, sem pele, grelhado', 'Frango, peito, sem pele, cozido', 'Ovo, de galinha, inteiro, cozido/10minutos', 'Ovo, de galinha, inteiro, frito',
    'Carne, bovina, patinho, sem gordura, grelhado', 'Carne, bovina, acém, sem gordura, cozido', 'Pão, trigo, francês', 'Pão, trigo, forma, integral',
    'Leite, de vaca, integral', 'Leite, de vaca, desnatado, UHT', 'Iogurte, natural', 'Iogurte, natural, desnatado', 'Queijo, minas, frescal', 'Queijo, mozarela',
    'Banana, prata, crua', 'Maçã, Fuji, com casca, crua', 'Mamão, Papaia, cru', 'Batata, inglesa, cozida', 'Batata, doce, cozida', 'Mandioca, cozida',
    'Alface, crespa, crua', 'Tomate, com semente, cru', 'Cenoura, cozida', 'Brócolis, cozido', 'Aveia, flocos, crua',
    'Atum, conserva em óleo', 'Sardinha, conserva em óleo', 'Café, infusão 10%', 'Requeijão, cremoso', 'Manteiga, com sal', 'Azeite, de oliva, extra virgem',
    'Tapioca, com manteiga', 'Cuscuz, de milho, cozido com sal', 'Mandioca, farofa, temperada',
]


def q(v):
    if v is None:
        return 'null'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def main(caminho):
    dados = [x for x in json.load(open(caminho, encoding='utf-8')) if x['uso'] == 'ok']
    print('begin;')
    for i in range(0, len(dados), 500):
        linhas = []
        for x in dados[i:i + 500]:
            p = x['por100g']
            med = [m for m in x['medidas'] if m.get('gramas')]
            m0 = med[0] if med else None
            linhas.append('(' + ', '.join([
                q(x['id']), q(x['nome']), q(x['fonte']), q(VERSAO[x['fonte']]), q(x['codigo_original']), q(x.get('categoria_original')),
                q(p.get('proteina')), q(p.get('kcal')), q(p.get('fibra')), q(p.get('carboidrato')), q(p.get('gordura')), q(p.get('sodio_mg')),
                q(json.dumps(med, ensure_ascii=False)) + '::jsonb', q(json.dumps(p, ensure_ascii=False)) + '::jsonb',
                q(' '.join(x['termos']) or None), str(PRIORIDADE[x['fonte']]),
                q(m0['gramas'] if m0 else 100), q(f"1 {m0['nome']} ({m0['gramas']:g} g)" if m0 else '100 g'),
            ]) + ')')
        print('insert into foods (id, nome, fonte, versao_tabela, codigo_original, categoria, proteina_100g, energia_100g, fibras_100g, '
              'carboidrato_100g, gordura_100g, sodio_mg_100g, medidas, nutrientes, termos, prioridade, porcao_padrao_g, porcao_texto) values')
        print(',\n'.join(linhas))
        print('on conflict (id) do update set nome = excluded.nome, proteina_100g = excluded.proteina_100g, energia_100g = excluded.energia_100g, '
              'medidas = excluded.medidas, nutrientes = excluded.nutrientes, termos = excluded.termos;')
    print("update foods set busca = lower(extensions.unaccent(nome || ' ' || coalesce(termos, '')));")
    print('update foods set popular = (fonte = \'TACO\' and nome in (' + ', '.join(q(n) for n in POPULARES) + '));')
    print('commit;')


def linha_json(x):
    p = x['por100g']
    med = [m for m in x['medidas'] if m.get('gramas')]
    m0 = med[0] if med else None
    return {
        'id': x['id'], 'nome': x['nome'], 'fonte': x['fonte'], 'versao': VERSAO[x['fonte']], 'codigo': x['codigo_original'],
        'categoria': x.get('categoria_original') or None, 'proteina': p.get('proteina'), 'kcal': p.get('kcal'), 'fibra': p.get('fibra'),
        'carboidrato': p.get('carboidrato'), 'gordura': p.get('gordura'), 'sodio': p.get('sodio_mg'), 'medidas': med, 'nutrientes': p,
        'termos': ' '.join(x['termos']) or None, 'prioridade': PRIORIDADE[x['fonte']],
        'porcao_g': m0['gramas'] if m0 else 100, 'porcao_texto': f"1 {m0['nome']} ({m0['gramas']:g} g)" if m0 else '100 g',
    }


def enviar(caminho):
    import os, urllib.request
    url = os.environ.get('SUPABASE_URL', 'https://mmxoenkeuyvjvahkofik.supabase.co') + '/rest/v1/rpc/_importar_foods'
    chave = os.environ.get('SUPABASE_KEY', 'sb_publishable_LMeWDQPrdxWGNwbdMzN0pg_BYiJbZIl')
    dados = [linha_json(x) for x in json.load(open(caminho, encoding='utf-8')) if x['uso'] == 'ok']
    total = 0
    for i in range(0, len(dados), 400):
        corpo = json.dumps({'p_token': os.environ['IMPORT_TOKEN'], 'p_linhas': dados[i:i + 400]}).encode()
        req = urllib.request.Request(url, corpo, {'apikey': chave, 'Content-Type': 'application/json'})
        total += int(urllib.request.urlopen(req, timeout=120).read())
        print(f'{min(i + 400, len(dados))}/{len(dados)}', file=sys.stderr)
    print(f'{total} registros gravados', file=sys.stderr)


if __name__ == '__main__':
    if '--enviar' in sys.argv:
        enviar(sys.argv[1])
        sys.exit()
    main(sys.argv[1])
