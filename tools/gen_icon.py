# 纯标准库生成 PWA 图标（宠物爪印 + 圆角渐变底），无第三方依赖
import struct, zlib, math, os

def lerp(a, b, t):
    return int(a + (b - a) * t)

def make_icon(size):
    pad = int(size * 0.06)
    R = int(size * 0.24)
    cx = cy = size / 2.0
    half = size / 2.0 - pad
    top = (110, 139, 255)
    bot = (74, 99, 232)
    px = bytearray()
    for y in range(size):
        for x in range(size):
            # 圆角矩形判定
            dx = abs(x - cx) - (half - R)
            dy = abs(y - cy) - (half - R)
            inside = (dx <= 0 and dy <= 0) or (dx > 0 and dy > 0 and dx * dx + dy * dy <= R * R)
            if not inside:
                px += bytes((0, 0, 0, 0))
                continue
            t = y / max(1, size - 1)
            r = lerp(top[0], bot[0], t); g = lerp(top[1], bot[1], t); b = lerp(top[2], bot[2], t)
            # 爪印（白色）：中央大掌 + 4 个脚趾
            white = False
            # 大掌（椭圆）
            ex, ey, erx, ery = cx, cy + size * 0.06, size * 0.18, size * 0.15
            if ((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2 <= 1:
                white = True
            # 4 个脚趾（圆）
            toes = [(cx - size*0.20, cy - size*0.18, size*0.085),
                    (cx - size*0.08, cy - size*0.26, size*0.085),
                    (cx + size*0.08, cy - size*0.26, size*0.085),
                    (cx + size*0.20, cy - size*0.18, size*0.085)]
            for (tx, ty, tr) in toes:
                if (x - tx) ** 2 + (y - ty) ** 2 <= tr * tr:
                    white = True
            if white:
                px += bytes((255, 255, 255, 255))
            else:
                px += bytes((r, g, b, 255))
    return px

def write_png(path, size):
    raw = bytearray()
    data = make_icon(size)
    for y in range(size):
        raw.append(0)  # filter type 0
        base = y * size * 4
        raw += data[base:base + size * 4]
    def chunk(typ, body):
        c = struct.pack(">I", len(body)) + typ + body
        crc = zlib.crc32(typ + body) & 0xffffffff
        return c + struct.pack(">I", crc)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

out = os.path.join(os.path.dirname(__file__), "..")
for s in (192, 512):
    p = os.path.join(out, f"icon-{s}.png")
    write_png(p, s)
    print("wrote", p, os.path.getsize(p), "bytes")
