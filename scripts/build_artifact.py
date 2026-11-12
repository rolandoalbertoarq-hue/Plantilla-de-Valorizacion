#!/usr/bin/env python3
"""Arma la versión de un solo archivo para publicar como página en claude.ai.

Une index.html, css/styles.css y los js/*.js en un único HTML sin las etiquetas
<!doctype>, <html>, <head> ni <body> (claude.ai las agrega al publicar).

Uso: python3 scripts/build_artifact.py <salida.html>
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ['calc', 'importer', 'tikr', 'seeds', 'app']


def main(out):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    head = re.search(r'<head>(.*)</head>', html, re.S).group(1)
    body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
    css = (ROOT / 'css' / 'styles.css').read_text(encoding='utf-8')
    head = head.replace('<link rel="stylesheet" href="css/styles.css">', '<style>\n' + css + '\n</style>')
    for name in SCRIPTS:
        js = (ROOT / 'js' / (name + '.js')).read_text(encoding='utf-8')
        body = body.replace('<script src="js/%s.js"></script>' % name, '<script>\n' + js + '\n</script>')
    if 'src="js/' in body:
        sys.exit('Falta incluir algún script de js/ en SCRIPTS')
    Path(out).write_text(head.strip() + '\n' + body, encoding='utf-8')
    print('Escrito', out)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
