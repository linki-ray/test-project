import re, sys

p = r"C:\Users\Admin\Desktop\新建 DOC 文档.doc"
try:
    data = open(p, 'rb').read()
except Exception as e:
    print("OPEN_ERROR", e)
    sys.exit(0)

print("BYTES", len(data), "HEAD", data[:8].hex())

text = data.decode('utf-16-le', errors='ignore')
# 去掉控制字符
text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)

# 抓中文连续片段（菜名/分类常是2+汉字）
runs = re.findall(r'[一-鿿A-Za-z0-9（）()·\-/]{2,}', text)
seen = []
for r in runs:
    r = r.strip()
    if r and r not in seen:
        seen.append(r)

print("RUN_COUNT", len(seen))
# 打印前 400 段，便于人工判断
for r in seen[:400]:
    print(r)
