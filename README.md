# Plantilla de Valoración

App web para valorar empresas antes de que entren al portafolio. Es la versión interactiva de la planilla `2026_Plantilla_De_Valoración.xlsx`: mismos cálculos, con gráficos, varias empresas guardadas y pestañas vinculadas entre sí.

No necesita servidor ni instalación: son archivos estáticos (HTML, CSS y JavaScript).

## Cómo abrirla

- **En tu computadora:** abre `index.html` con el navegador.
- **En línea (GitHub Pages):** en el repositorio, Settings → Pages → Source: *Deploy from a branch*, elige la rama y la carpeta `/ (root)`. La app quedará en `https://<usuario>.github.io/<repositorio>/`.

Los datos se guardan en el navegador (localStorage). Usa **Exportar / Importar** para respaldar tus empresas o pasarlas a otro equipo.

## Flujo de valoración

| Pestaña | Viene del Excel | Qué hace |
|---|---|---|
| **Datos básicos** (arriba, siempre visibles) | Filtro 1 | Ticker, precio actual, n° de acciones (millones) y año base. |
| **Resumen** | — (nuevo) | Precio objetivo de todos los métodos para el año elegido, frente al precio actual. Mediana, potencial y CAGR. |
| **1 · Filtro** | Filtro 1 | Plantillas General, REITs, Tecnológicas, Servicios y Financieras. Calificación Good/Not, reglas editables y múltiplo máximo según crecimiento. |
| **2 · Earnings Growth** | F2-EGM, inst-EGM | Modelo de Compound Quality: EPS growth + shareholder yield ± cambio de valoración. Margen de seguridad, regla del 72 y retorno mínimo exigido. |
| **3 · EPS · P/S · FCF** | EPS Proyectado, PS Proyectado, FCF Proyectado | Las tres proyecciones por múltiplo en una sola pestaña, con gráfico comparativo. |
| **4 · Graham** | EPS Proyectado (Fórmula de Graham) | Crecimiento implícito `(PER NTM − 8,5) / 2`, PER justo, valor justo y versión revisada con el bono AAA. Incluye guía de dónde sacar cada variable. |
| **5 · Método del curso** | 1. Income statement, 2. Flujos de caja, 3. Retornos capital, 4. Valoración | Las cuatro pestañas numeradas como un solo método, con sub-pestañas. |

### Datos vinculados

Las celdas con fondo azul toman su valor de otra pestaña (por ejemplo, el PER histórico del Filtro alimenta EPS Proyectado, el EGM y la Valoración del curso). Si escribes un valor propio, se usa el tuyo; si lo borras, vuelve al vínculo.

### Convención de porcentajes

Todos los porcentajes se escriben como número: `12` = 12 %.

## Diferencias con el Excel

- **CAGR real.** El Excel calculaba "CAGR" como retorno total ÷ 5. La app muestra el CAGR compuesto `(precio objetivo / precio)^(1/años) − 1` y, al lado, el valor del Excel para comparar.
- **Fórmula de Graham.** La celda `D21` multiplicaba `EPS × (8,5 × 2g)`. La fórmula de Graham es `EPS × (8,5 + 2g)`; la app usa esta.
- **Porcentajes consistentes.** En el Excel, el Filtro compara porcentajes como números (ROIC > 15) pero el Income statement usa el mismo dato como fracción. La app usa una sola convención.
- **EV/EBITDA máximo.** En el Excel se calculaba sobre el propio EV/EBITDA; la app lo calcula sobre el EPS CAGR, igual que el PER máximo.
- **Deuda neta futura.** Si no estimas la deuda neta de un año proyectado, se mantiene la del año anterior (en el Excel quedaba en cero).
- **Book to Bill (Servicios).** Se respetó la regla del Excel (`< 1` = Good). Normalmente un book-to-bill mayor a 1 es lo positivo; puedes cambiar la regla en la pestaña Filtro.

## Estructura

```
index.html        Página y navegación
css/styles.css    Estilos (claro y oscuro)
js/calc.js        Motor de cálculo (funciones puras)
js/app.js         Interfaz, gráficos (Chart.js) y guardado
tests/            Pruebas del motor de cálculo
```

Pruebas: `node tests/calc.test.js`
