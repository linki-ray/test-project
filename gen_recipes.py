# -*- coding: utf-8 -*-
import re, json
from docx import Document

FILES = [
    ("C:/Users/Admin/Desktop/菜单/100道粤菜完整食谱.docx", "guangdong", "广东菜", False),
    ("C:/Users/Admin/Desktop/菜单/湘菜1–80道）.docx", "hunan", "湖南菜", False),
    ("C:/Users/Admin/Desktop/菜单/东北菜50道.docx", "dongbei", "东北菜", False),
    ("C:/Users/Admin/Desktop/菜单/泰餐100道.docx", "thai", "泰国菜", False),
    ("C:/Users/Admin/Desktop/菜单/西餐1-50道.docx", "western", "西式", False),
    ("C:/Users/Admin/Desktop/菜单/烘焙大全80道.docx", "baking", "烘焙", True),
    ("C:/Users/Admin/Desktop/菜单/川菜食谱.docx", "sichuan", "四川菜", False),
]

TITLE_RE = re.compile(r'^[【\[]?\s*(\d{1,3})[.、)]\s*(.+?)\s*[】\]]?$')
BRACKET_RE = re.compile(r'^【\s*(\d{1,3})[.、)]\s*(.+?)\s*】')
SECTION_RE = re.compile(r'^[一二三四五六七八九十百]+[、.．]')
HEADER_RE = re.compile(r'^(烤箱温度|注意事项|贴士|提示|小提示|详细做法|做法|预处理|【预处理】|步骤|原料说明|小编|编者)')
ING_RE = re.compile(r'(?:食材|【食材】|用料|原料)[：:\s]*')
ING_STOP = r'做法|详细做法|烤箱温度|步骤|【|碗汁|酱汁|料汁|蘸汁|高汤|汤汁|腌料'

MEAT_KW = r'肉|鸡|牛|猪|鱼|虾|蟹|羊|鸭|鹅|火腿|排骨|丸子?|香肠|培根|鳕|鲈|带鱼|鳝|鱿鱼|扇贝|海参|蛤|鸽|鹌鹑|蹄|肝|肚|腰|牛蛙|龙虾|腊肉|腊味|酱骨'
VEG_KW = r'沙拉|凉拌|拍黄瓜|黄瓜|土豆丝|地三鲜|青菜|时蔬|蔬菜|菇|菌|茄子|番茄|西兰花|菠菜|白菜|冬瓜|南瓜|藕|海带|木耳|空心菜|素|笋|胡萝卜|洋葱|尖椒|酸辣土豆|拍青瓜|凉拌菜'

def infer_type(name, is_baking):
    if is_baking:
        return 'other'
    if re.search(r'汤|羹|煲', name):
        return 'soup'
    if re.search(MEAT_KW, name):
        return 'meat'
    if re.search(VEG_KW, name):
        return 'veg'
    return 'meat'

def parse_block(block):
    ingredients = ""
    steps = []
    for line in block:
        s = line.strip()
        if not s:
            continue
        if HEADER_RE.match(s):
            continue
        m = ING_RE.search(s)
        if m:
            after = s[m.end():]
            im = re.search(r'(.*?)(?=' + ING_STOP + r'|$)', after, re.S)
            if im and im.group(1).strip():
                ingredients = ingredients or im.group(1).strip()
            continue
        steps.append(s)
    steps = [re.sub(r'^\d+[.、)]\s*', '', s).strip() for s in steps]
    steps = [s for s in steps if s]
    return ingredients, steps

def split_ing(s):
    if not s:
        return []
    s = s.replace('\n', ' ').replace('\r', ' ')
    parts = re.split(r'[、,，;；]+', s)
    return [p.strip() for p in parts if p.strip()]

def parse_doc(path, cuisine, catname, is_baking):
    d = Document(path)
    dishes = []
    cur = None
    for p in d.paragraphs:
        t = p.text.strip()
        if not t:
            continue
        bold = any(r.bold for r in p.runs)
        name = None
        title_match = None
        m = TITLE_RE.match(t)
        if bold and m and not HEADER_RE.match(t) and not re.search(r'食材|做法|贴士|注意事项|温度|详细|预处理|第', t):
            name = m.group(2).strip()
            title_match = m
        elif (not bold) and BRACKET_RE.match(t) and not HEADER_RE.match(t):
            name = BRACKET_RE.match(t).group(2).strip()
            title_match = BRACKET_RE.match(t)
        if SECTION_RE.match(t):
            continue
        if title_match and name:
            if cur:
                dishes.append(cur)
            cur = {'name': name, 'block': []}
            rem = t[title_match.end():].strip()
            if rem:
                cur['block'].append(rem)
        else:
            if cur:
                cur['block'].append(t)
    if cur:
        dishes.append(cur)
    out = []
    for d0 in dishes:
        name = d0['name']
        if len(name) < 2 or name in seen_titles:
            continue
        ing_s, steps = parse_block(d0['block'])
        ingredients = split_ing(ing_s)
        # 质量过滤：没有菜名、或完全无食材且无步骤 -> 丢弃
        if not name or (not ingredients and not steps):
            continue
        seen_titles.add(name)
        t = infer_type(name, is_baking)
        cats = [cuisine]
        if t in ('meat', 'veg', 'soup'):
            cats.append(t)
        hue = {'meat': 10, 'veg': 125, 'soup': 200, 'other': 35}[t]
        out.append({
            'id': 'doc-' + str(len(out) + 1),
            'name': name,
            'type': t,
            'cats': cats,
            'hue': hue,
            'ingredients': ingredients,
            'steps': steps,
        })
    return out

all_dishes = []
per_file = {}
seen_titles = set()
for path, cu, cn, bk in FILES:
    ds = parse_doc(path, cu, cn, bk)
    per_file[cu] = ds
    all_dishes.extend(ds)

# 输出 JS
js = "window.__EXTRA_RECIPES__ = " + json.dumps(all_dishes, ensure_ascii=False, indent=1) + ";\n"
with open("assets/js/pages/recipes-extra.js", "w", encoding="utf-8") as f:
    f.write(js)

# 打印抽样供核对
print("=== 每文件统计 ===")
for cu, ds in per_file.items():
    print(f"  {cu}: {len(ds)} 道")
print("=== 总计 ===", len(all_dishes), "道")
print()
print("=== 抽样核对（每文件前2道）===")
for cu, ds in per_file.items():
    print(f"--- {cu} ---")
    for d in ds[:2]:
        print(f"  [{d['type']}] {d['name']}  食材{len(d['ingredients'])} 步骤{len(d['steps'])}")
        print(f"     食材: {d['ingredients'][:3]}")
        print(f"     步骤1: {d['steps'][0][:50] if d['steps'] else '(无)'}")
