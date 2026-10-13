"""Builds the language wall's font files (anek-<script>-wall.woff2, next to this script).

Each file is Ek Type's Anek for one script, cut down to the letters of that script's word on the wall
(components/landing/language-wall.tsx): weight fixed at 600, width axis 75-125 kept for the wall's breathing.
About 43 KB for all nine, where the full width-and-weight files are 3.1 MB.

Every subset is checked against the full font with HarfBuzz (same glyphs, advances and mark offsets at three
widths), because a subsetter's closure can miss what a script's shaping needs: Kannada's "ಲಿ" only forms when
"ಜ" is kept too, and Google Fonts' own `text=` subsets get it wrong.

Change a word on the wall -> change it in WORDS below and re-run:
    python -m pip install fonttools brotli uharfbuzz
    python apps/web/components/landing/wall-fonts/subset.py

Anek is under the SIL Open Font License 1.1, which allows subsetting and self-hosting.
"""

import io
import os
import re
import urllib.request

import uharfbuzz as hb
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

# file key: (Google family, Google subset, [(word, lang)], extra letters the shaping needs)
WORDS = {
    'tamil': ('Anek Tamil', 'tamil', [('கற்றல்', 'ta')], ''),
    'devanagari': ('Anek Devanagari', 'devanagari', [('सीखना', 'hi'), ('शिकणे', 'mr')], ''),
    'kannada': ('Anek Kannada', 'kannada', [('ಕಲಿಕೆ', 'kn')], 'ಜ'),
    'telugu': ('Anek Telugu', 'telugu', [('నేర్చుకోవడం', 'te')], ''),
    'gurmukhi': ('Anek Gurmukhi', 'gurmukhi', [('ਸਿੱਖਣਾ', 'pa')], ''),
    'bangla': ('Anek Bangla', 'bengali', [('শেখা', 'bn')], ''),
    'malayalam': ('Anek Malayalam', 'malayalam', [('പഠനം', 'ml')], ''),
    'odia': ('Anek Odia', 'oriya', [('ଶିଖିବା', 'or')], ''),
    'gujarati': ('Anek Gujarati', 'gujarati', [('શીખવું', 'gu')], ''),
}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA})) as r:
        return r.read()


def full_font(family, google_subset):
    """The variable font for one script, as Google Fonts serves it (wdth 75-125, wght 100-800)."""
    css = fetch(f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}:wdth,wght@75..125,100..800").decode()
    block = next(b for b in css.split('/*') if b.strip().startswith(google_subset + ' '))
    return TTFont(io.BytesIO(fetch(re.search(r'url\((https:[^)]+)\)', block).group(1))))


def to_bytes(font):
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def shape(data, words, wdth):
    font = hb.Font(hb.Face(data))
    font.set_variations({'wdth': wdth})
    runs = []
    for word, lang in words:
        buf = hb.Buffer()
        buf.add_str(word)
        buf.guess_segment_properties()
        buf.language = lang
        hb.shape(font, buf, {})
        runs.append([(p.x_advance, p.x_offset, p.y_offset) for p in buf.glyph_positions])
    return runs


def main():
    total = 0
    for key, (family, google_subset, words, extra) in WORDS.items():
        instanced = instancer.instantiateVariableFont(full_font(family, google_subset), {'wght': 600, 'wdth': (75, 125)})
        reference = to_bytes(instanced)

        font = TTFont(io.BytesIO(reference))
        options = subset.Options()
        options.layout_features = ['*']
        options.notdef_outline = True
        options.hinting = False
        options.name_IDs = ['*']
        options.name_languages = ['*']
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=''.join(w for w, _ in words) + extra)
        subsetter.subset(font)
        data = to_bytes(font)

        for wdth in (75, 100, 125):
            if shape(reference, words, wdth) != shape(data, words, wdth):
                raise SystemExit(f'{key}: the subset shapes differently from the full font at wdth {wdth}')

        out = TTFont(io.BytesIO(data))
        out.flavor = 'woff2'
        path = os.path.join(HERE, f'anek-{key}-wall.woff2')
        out.save(path)
        size = os.path.getsize(path)
        total += size
        print(f'{key:<11} {size:>6} bytes, shaping matches the full font')
    print(f'total       {total:>6} bytes')


if __name__ == '__main__':
    main()
