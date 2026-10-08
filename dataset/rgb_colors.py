"""Deterministic RGB -> approximate color names for RtG-AI dataset generation.

The exact RGB value is never replaced by the approximation. The approximation is
only natural-language metadata used to diversify descriptions.
"""

from __future__ import annotations

from typing import Sequence

PALETTE = {
    "black": (0, 0, 0), "white": (255, 255, 255),
    "red": (255, 0, 0), "green": (0, 255, 0), "blue": (0, 0, 255),
    "yellow": (255, 255, 0), "cyan": (0, 255, 255),
    "magenta": (255, 0, 255), "orange": (255, 128, 0),
    "purple": (128, 0, 255), "pink": (255, 192, 203),
    "gray": (128, 128, 128), "dark_red": (128, 0, 0),
    "dark_green": (0, 128, 0), "dark_blue": (0, 0, 128),
    "gold": (255, 215, 0), "silver": (192, 192, 192),
}

NAMES = {
    "es": {"black":"negro","white":"blanco","red":"rojo","green":"verde","blue":"azul","yellow":"amarillo","cyan":"cyan","magenta":"magenta","orange":"naranja","purple":"violeta","pink":"rosa","gray":"gris","dark_red":"rojo oscuro","dark_green":"verde oscuro","dark_blue":"azul oscuro","gold":"dorado","silver":"plata"},
    "en": {"black":"black","white":"white","red":"red","green":"green","blue":"blue","yellow":"yellow","cyan":"cyan","magenta":"magenta","orange":"orange","purple":"purple","pink":"pink","gray":"gray","dark_red":"dark red","dark_green":"dark green","dark_blue":"dark blue","gold":"gold","silver":"silver"},
    "pt": {"black":"preto","white":"branco","red":"vermelho","green":"verde","blue":"azul","yellow":"amarelo","cyan":"ciano","magenta":"magenta","orange":"laranja","purple":"roxo","pink":"rosa","gray":"cinza","dark_red":"vermelho escuro","dark_green":"verde escuro","dark_blue":"azul escuro","gold":"dourado","silver":"prata"},
    "de": {"black":"schwarz","white":"weiß","red":"rot","green":"grün","blue":"blau","yellow":"gelb","cyan":"cyan","magenta":"magenta","orange":"orange","purple":"violett","pink":"rosa","gray":"grau","dark_red":"dunkelrot","dark_green":"dunkelgrün","dark_blue":"dunkelblau","gold":"gold","silver":"silber"},
    "fr": {"black":"noir","white":"blanc","red":"rouge","green":"vert","blue":"bleu","yellow":"jaune","cyan":"cyan","magenta":"magenta","orange":"orange","purple":"violet","pink":"rose","gray":"gris","dark_red":"rouge foncé","dark_green":"vert foncé","dark_blue":"bleu foncé","gold":"or","silver":"argent"},
    "it": {"black":"nero","white":"bianco","red":"rosso","green":"verde","blue":"blu","yellow":"giallo","cyan":"ciano","magenta":"magenta","orange":"arancione","purple":"viola","pink":"rosa","gray":"grigio","dark_red":"rosso scuro","dark_green":"verde scuro","dark_blue":"blu scuro","gold":"oro","silver":"argento"},
    "ru": {"black":"чёрный","white":"белый","red":"красный","green":"зелёный","blue":"синий","yellow":"жёлтый","cyan":"голубой","magenta":"пурпурный","orange":"оранжевый","purple":"фиолетовый","pink":"розовый","gray":"серый","dark_red":"тёмно-красный","dark_green":"тёмно-зелёный","dark_blue":"тёмно-синий","gold":"золотой","silver":"серебряный"},
    "zh": {"black":"黑色","white":"白色","red":"红色","green":"绿色","blue":"蓝色","yellow":"黄色","cyan":"青色","magenta":"洋红","orange":"橙色","purple":"紫色","pink":"粉色","gray":"灰色","dark_red":"深红色","dark_green":"深绿色","dark_blue":"深蓝色","gold":"金色","silver":"银色"},
    "ja": {"black":"黒","white":"白","red":"赤","green":"緑","blue":"青","yellow":"黄","cyan":"シアン","magenta":"マゼンタ","orange":"オレンジ","purple":"紫","pink":"ピンク","gray":"灰色","dark_red":"暗い赤","dark_green":"暗い緑","dark_blue":"暗い青","gold":"金色","silver":"銀色"},
    "ko": {"black":"검정","white":"흰색","red":"빨강","green":"초록","blue":"파랑","yellow":"노랑","cyan":"시안","magenta":"마젠타","orange":"주황","purple":"보라","pink":"분홍","gray":"회색","dark_red":"어두운 빨강","dark_green":"어두운 초록","dark_blue":"어두운 파랑","gold":"금색","silver":"은색"},
    "tr": {"black":"siyah","white":"beyaz","red":"kırmızı","green":"yeşil","blue":"mavi","yellow":"sarı","cyan":"camgöbeği","magenta":"macenta","orange":"turuncu","purple":"mor","pink":"pembe","gray":"gri","dark_red":"koyu kırmızı","dark_green":"koyu yeşil","dark_blue":"koyu mavi","gold":"altın","silver":"gümüş"},
    "pl": {"black":"czarny","white":"biały","red":"czerwony","green":"zielony","blue":"niebieski","yellow":"żółty","cyan":"cyjan","magenta":"magenta","orange":"pomarańczowy","purple":"fioletowy","pink":"różowy","gray":"szary","dark_red":"ciemnoczerwony","dark_green":"ciemnozielony","dark_blue":"ciemnoniebieski","gold":"złoty","silver":"srebrny"},
}

def _validate_rgb(value: Sequence[object]) -> tuple[int, int, int] | None:
    if not isinstance(value, (list, tuple)) or len(value) != 3:
        return None
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in value):
        return None
    if not all(0 <= x <= 255 for x in value):
        return None
    return tuple(int(round(x)) for x in value)

def nearest_color(value: Sequence[object], language: str = "es") -> str | None:
    rgb = _validate_rgb(value)
    if rgb is None:
        return None
    key = min(PALETTE, key=lambda name: sum((rgb[i] - PALETTE[name][i]) ** 2 for i in range(3)))
    return NAMES.get(language, NAMES["es"]).get(key, key)

def describe_rgb(value: Sequence[object], language: str = "es") -> str | None:
    rgb = _validate_rgb(value)
    if rgb is None:
        return None
    return f"RGB {list(rgb)} ({nearest_color(rgb, language)})"
