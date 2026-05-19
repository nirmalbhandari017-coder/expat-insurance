import re, glob, os

# Build full reverse map for cp1252 PLUS pass-through for undefined positions (0x81, 0x8D, 0x8F, 0x90, 0x9D)
CP1252_TO_BYTE = {}
for b in range(0, 0x100):
    try:
        ch = bytes([b]).decode('cp1252')
        CP1252_TO_BYTE[ch] = b
    except UnicodeDecodeError:
        # undefined position - pass through using U+00XX
        CP1252_TO_BYTE[chr(b)] = b

def enc_cp1252(s: str) -> bytes | None:
    out = bytearray()
    for ch in s:
        if ch in CP1252_TO_BYTE:
            out.append(CP1252_TO_BYTE[ch])
        else:
            return None
    return bytes(out)

def try_fix(seq: str) -> str | None:
    b = enc_cp1252(seq)
    if b is None:
        return None
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return None

def fix_chunk(seq: str) -> str:
    if len(seq) < 2:
        return seq
    for end in range(len(seq), 1, -1):
        sub = seq[:end]
        fixed = try_fix(sub)
        if fixed is not None and len(fixed) < len(sub):
            return fixed + fix_chunk(seq[end:])
    return seq[0] + fix_chunk(seq[1:])

# Regex: match runs of 2+ chars from the cp1252 high range OR control-char range
HIGH = ''.join(sorted(set(CP1252_TO_BYTE.keys()) - set(chr(i) for i in range(0x20, 0x7F))))
pattern = re.compile('[' + re.escape(HIGH) + ']{2,12}')

total = 0
for fp in glob.glob(r'C:\Users\user\expat-insurance\*.html'):
    with open(fp, 'rb') as f:
        data = f.read()
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        continue
    new_text = pattern.sub(lambda m: fix_chunk(m.group(0)), text)
    if new_text != text:
        with open(fp, 'wb') as f:
            f.write(new_text.encode('utf-8'))
        total += 1
        print(f'{os.path.basename(fp)}: fixed')
print('Files changed:', total)
