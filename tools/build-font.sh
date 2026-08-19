#!/usr/bin/env bash
# Regenerates the Archivo subset inlined in index-v6.html.
#
# The design calls for Archivo and Archivo Narrow from Google Fonts. Invariant 5
# forbids a runtime network request, so the font is subset and base64 inlined.
# One variable file covers both families: the wdth axis at 100% is Archivo and
# at 77% matches Archivo Narrow (measured against the real Narrow advance
# widths, which land within 0.1% at 77).
#
# Archivo ships no U+02BB, so the okina is remapped onto the left single quote
# outline, which is the same form. Source strings keep the correct codepoint.
#
# Output: ~48KB woff2, ~64KB base64. Needs python3.
set -euo pipefail
cd "$(dirname "$0")"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT

python3 -m venv "$work/venv"
"$work/venv/bin/pip" -q install fonttools brotli

curl -sL "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf" \
  -o "$work/Archivo.ttf"

"$work/venv/bin/python" - "$work" <<'PY'
import sys, subprocess, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

work = sys.argv[1]
f = TTFont(os.path.join(work, "Archivo.ttf"))

for t in f["cmap"].tables:
    if t.isUnicode() and 0x2018 in t.cmap and 0x02BB not in t.cmap:
        t.cmap[0x02BB] = t.cmap[0x2018]          # okina -> quoteleft

# Only the weights and widths the design uses.
instantiateVariableFont(f, {"wght": (400, 900), "wdth": (77, 100)},
                        inplace=True, updateFontNames=False)
f.save(os.path.join(work, "trimmed.ttf"))

HAWAIIAN = "U+0100-0101,U+0112-0113,U+012A-012B,U+014C-014D,U+016A-016B"
PUNCT = "U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+2192,U+2122,U+00D7,U+00B7"
subprocess.run([
    os.path.join(work, "venv/bin/pyftsubset"), os.path.join(work, "trimmed.ttf"),
    "--output-file=" + os.path.join(work, "archivo.woff2"), "--flavor=woff2",
    "--unicodes=U+0020-007E,U+00A0-00FF," + HAWAIIAN + "," + PUNCT + ",U+02BB-02BC",
    "--layout-features=kern,liga,ccmp,locl", "--name-IDs=", "--no-hinting",
], check=True)

import base64
b64 = base64.b64encode(open(os.path.join(work, "archivo.woff2"), "rb").read()).decode()
open(os.path.join(work, "archivo.b64"), "w").write(b64)
print("woff2", os.path.getsize(os.path.join(work, "archivo.woff2")), "bytes")
print("base64", len(b64), "chars")
PY

cp "$work/archivo.b64" ./archivo.b64
echo "Wrote tools/archivo.b64. Paste it in place of the base64 payload in the"
echo "@font-face src of index-v6.html."
