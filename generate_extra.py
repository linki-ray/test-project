# -*- coding: utf-8 -*-
import zipfile, re, json
from xml.etree import ElementTree as ET

DOC = r"C:\Users\Admin\Desktop\菜单.docx"
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

with zipfile.ZipFile(DOC) as z:
    xml = z.read('word/document.xml')
root = ET.fromstring(xml)
body = root.find(W + 'body')

def para_text(p_el):
    return ''.join(t.text or '' for t in p_el.iter(W + 't'))

lines = []
for el in body.iter():
    if el.tag == W + 'p':
        txt = para_text(el)
        if txt.strip():
            lines.append(txt)
    elif el.tag == W + 'tr':
        cells = [para_text(tc) for tc in el.findall(W + 'tc')]
        row = ' | '.join(cells)
        if row.strip():
            lines.append(row)

# --- track section / subgroup ---
cuisine = None
subgroup = None

# cuisine headers: 一、泰餐 100 道 ; 六、烘焙 500 道
cuisine_map = {'泰餐': 'thai', '西餐': 'western', '川菜': 'sichuan',
               '湘菜': 'hunan', '东北菜': 'dongbei', '烘焙': 'baking'}
# 烘焙 内部的「一、面包类」「二、蛋糕类」等
baking_sub = re.compile(r'^[一二三四五六七八九十]+、([\u4e00-\u9fff]+类)')

def is_cuisine_header(ln):
    m = re.match(r'^[一二三四五六七八九十]+、([\u4e00-\u9fff]{2,4})\s', ln)
    if m and m.group(1) in cuisine_map:
        return m.group(1)
    return None

def is_subgroup_header(ln):
    # 汤类（15 道） / 咖喱类（15 道） / 西式汤品（15 道） / 小炒热菜（30 道）
    if re.search(r'（\s*\d+\s*(道|款)）', ln) and not re.match(r'^\d', ln):
        return ln
    # 烘焙 内部大类
    m = baking_sub.match(ln)
    if m:
        return ln
    return None

dish_re = re.compile(r'(\d+)[.、)]\s*([\u4e00-\u9fffA-Za-z（）()\s]+?)(?=\s*\d+[.、)]|$)')

def clean_name(raw):
    s = raw.strip()
    s = re.sub(r'[（(][^）)]*[）)]', '', s)   # 去别名括号
    s = s.replace(' ', '')
    return s

def classify(cuisine, subgroup, name):
    if cuisine == 'baking':
        return 'other', ['baking']
    if re.search(r'(汤类|汤品|西式汤品)', subgroup or '') or name.endswith('汤') or re.search(r'(浓汤|羹)$', name):
        return 'soup', []
    if re.search(r'(凉菜|凉拌|沙拉|前菜|冷菜)', subgroup or '') or ('沙拉' in name) or ('凉拌' in name):
        return 'other', ['cold']
    if re.search(r'(小吃|主食|面|粉|甜品|饮品|常温|点心|网红|纸杯|玛芬|挞|派|布丁|酥点|饼干)', subgroup or '') \
       or re.search(r'(面|粉|饭|粥|火锅|糍粑|凉粉|汤圆|冰粉|圆子|饺|粑|糕|酥|饼|布丁|慕斯|蛋糕|曲奇|雪媚娘|千层|月饼|牛轧|雪花酥|糯米糍|米糕|发糕|奶冻|舒芙蕾|泡芙|马卡龙|甜品)', name):
        extra = ['baking'] if (subgroup and '烘焙' in subgroup) or cuisine == 'baking' else []
        return 'other', extra
    # 热菜：先判肉，再判素
    if re.search(r'(里脊|排骨|牛腩|肘|蹄筋|肥肠|腰花|腰|猪肝|肝|猪肚|牛肚|毛肚|牛肉|猪肉|鸡肉|鸭肉|羊肉|肉丝|肉片|肉末|肉糜|肉丸|肉圆|肉碎|肉排|狮子头|叉烧|火腿|培根|香肠|腊肉|腊肠|牛排|猪排|羊排|牛柳|烤鸭|烧鹅|牛蛙|兔|鸽|鳕鱼|龙利鱼|三文鱼|虾|蟹|鱿鱼|扇贝|贻贝|蛤|蛏|田螺|鳗|带鱼|黄鱼|鲈鱼|草鱼|鲶鱼|鲫鱼|鳊鱼|石斑|多宝|鲳|桂鱼|鳜|鲍鱼|海参|干贝|瑶柱|鸡|鸭|鹅|牛|羊|猪|排|柳|丸|腿|贝)', name) \
       or re.search(r'鱼(?!香)', name):
        return 'meat', []
    if re.search(r'(空心菜|通菜|青菜|菠菜|西兰花|菜花|花菜|茄子|土豆|番茄|西红柿|黄瓜|丝瓜|冬瓜|南瓜|胡萝卜|萝卜|豆角|四季豆|莲藕|山药|芋|蘑菇|香菇|平菇|金针菇|木耳|海带|紫菜|豆腐|腐竹|豆皮|千张|粉皮|莴笋|芹菜|洋葱|青椒|玉米|花生|莲白|包菜|甘蓝|生菜|茼蒿|韭黄|蒜薹|笋|芦笋|荷兰豆|毛豆|豌豆|蚕豆|娃娃菜|小白菜|油麦菜|秋葵|芥蓝|苋菜|菜心|银耳|豆芽|扁豆|刀豆|紫甘蓝|蕨菜|木耳菜|红薯叶|红菜苔|南瓜藤|竹荪|西洋菜|盖菜|藕带|海白菜|杂蔬|苕尖|时蔬|野菜|魔芋)', name):
        return 'veg', []
    return 'meat', []

def hue(type, cuisine):
    if type == 'meat':
        return 35 if cuisine == 'thai' else 18 if cuisine == 'western' else 10
    if type == 'veg': return 125
    if type == 'soup': return 35
    return 300

def slug(s):
    return re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9]', '', s)

def auto_cats(name, type, cuisine):
    cats = [type]
    if cuisine and cuisine != 'baking':
        cats.append(cuisine)
    if '凉拌' in name or '沙拉' in name:
        cats.append('cold')
    if '烘焙' in name or '蛋糕' in name or '饼干' in name or '面包' in name or '吐司' in name:
        cats.append('baking')
    if '粥' in name:
        cats.append('breakfast')
    if re.search(r'鸡|鸭|鸽|鹌鹑|禽', name) and not re.search(r'素|豆腐|蔬', name):
        cats.append('poultry')
    if re.search(r'虾|蟹|鱿鱼|扇贝|海参|花蛤|蛤蜊|蛏|带鱼|鳕|石斑|龙利|多宝|鲈|鲳|草鱼|鲫鱼|黄鱼|桂鱼|鳜|鲍|瑶柱|干贝', name):
        cats.append('seafood')
    # dedupe
    seen = []
    for c in cats:
        if c not in seen:
            seen.append(c)
    return seen

dishes = []
stats = {'meat': 0, 'veg': 0, 'soup': 0, 'other': 0}
cu_stats = {}
for ln in lines:
    ch = is_cuisine_header(ln)
    if ch:
        cuisine = cuisine_map[ch]
        subgroup = None
        continue
    sh = is_subgroup_header(ln)
    if sh:
        subgroup = ln
        continue
    if not re.match(r'^\s*\d', ln):
        continue
    for m in dish_re.finditer(ln):
        name = clean_name(m.group(2))
        if len(name) < 2:
            continue
        if name in ('道', '款'):
            continue
        t, extra = classify(cuisine, subgroup, name)
        cats = auto_cats(name, t, cuisine)
        for e in extra:
            if e not in cats:
                cats.append(e)
        dishes.append({
            'id': 'd-' + slug(name),
            'name': name,
            'type': t,
            'cats': cats,
            'hue': hue(t, cuisine),
        })
        stats[t] += 1
        cu_stats[cuisine] = cu_stats.get(cuisine, 0) + 1

# dedupe by id
uniq = {}
for d in dishes:
    if d['id'] not in uniq:
        uniq[d['id']] = d
dishes = list(uniq.values())

print('TOTAL', len(dishes))
print('STATS', stats)
print('BY CUISINE', cu_stats)

# write JS data file
js = '/* 由 菜单.docx 自动生成（泰餐/西餐/川菜/湘菜/东北菜/烘焙 共 %d 道）*/\n' % len(dishes)
js += 'window.__EXTRA_RECIPES__ = ' + json.dumps(dishes, ensure_ascii=False) + ';\n'
with open('assets/js/pages/recipes-extra.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('WROTE assets/js/pages/recipes-extra.js')
