# Plantilla de Valoración

App web para valorar empresas antes de que entren al portafolio. Es la versión interactiva de la planilla `2026_Plantilla_De_Valoración.xlsx`: mismos cálculos, con gráficos, varias empresas guardadas y pestañas vinculadas entre sí.

No necesita servidor ni instalación: son archivos estáticos (HTML, CSS y JavaScript).

## Cómo abrirla

- **En tu computadora:** abre `index.html` con el navegador.
- **En línea (GitHub Pages):** en el repositorio, Settings → Pages → Source: *Deploy from a branch*, elige la rama y la carpeta `/ (root)`. La app quedará en `https://<usuario>.github.io/<repositorio>/`.

Los datos se guardan en el navegador (localStorage). Usa **Respaldo** para copiar o descargar tus empresas en JSON y pasarlas a otro equipo.

## Importar tus Excel

El botón **Importar Excel** lee una planilla de valoración `.xlsx` y crea la empresa en la app. Busca los datos por las etiquetas de cada pestaña, así que funciona con la plantilla actual y con versiones anteriores (por ejemplo, las que solo tienen la tabla de Tecnológicas o 4 años de EPS). Importa:

- Filtro 1: el tipo de empresa (la tabla que tenga datos), ticker y ratios.
- 1–4 (Modelo financiero): años históricos, supuestos (crecimiento, margen EBIT, tasa impositiva), acciones y deuda neta proyectadas escritas a mano, múltiplos y dividend yield.
- EPS Proyectado (analistas y crecimiento propio), Fórmula de Graham, PS y FCF Proyectado.

Los métodos que el Excel no usaba quedan desmarcados en el Resumen. Siempre revisa los datos después de importar.

## Pegar de TIKR

El botón **Pegar de TIKR** carga los estados financieros de TIKR en el Modelo financiero:

1. En TIKR, abre Financials y copia la tabla completa (incluida la fila del título, con las fechas y LTM) del **Income Statement**, el **Balance Sheet** y el **Cash Flow**.
2. Pégalas una debajo de otra en el cuadro, o pégalas en un Excel y usa **Importar Excel**.
3. Elige si van a una empresa nueva o a la actual.

Cómo se traduce cada dato:

| Modelo financiero | TIKR |
|---|---|
| Ventas | Total Revenues |
| EBIT | Operating Income |
| D&A | Depreciation & Amort., Total (Cash Flow). Sin Cash Flow: EBITDA − Operating Income |
| Intereses | −(Interest Expense + Interest And Investment Income): positivo si es gasto neto, negativo si es ingreso |
| Impuestos | Income Tax Expense |
| Minoritarios | Net Income to Company − Net Income |
| Acciones diluidas | Weighted Average Diluted Shares Outstanding |
| Capex | Capital Expenditure + Sale (Purchase) of Intangible Assets |
| Caja | Total Cash And Short Term Investments |
| Deuda financiera | Short-term Borrowings + Current Portion of LTD + Long-Term Debt |
| Deuda por leases | Current Portion of Capital Lease Obligations + Capital Leases |
| Goodwill / Equity | Goodwill / Total Common Equity |

Además, P/S y FCF proyectado parten del LTM: el revenue base y el FCF base son los del Modelo financiero en el año base. La proyección empieza el año siguiente al LTM.

Con esto la deuda neta coincide con la "Net Debt" de TIKR. El LTM queda como año base (año en curso); los cierres fiscales de enero a mayo cuentan para el año calendario anterior.

## Empresas precargadas

- **DEMO**: ejemplo con datos ficticios (solo aparece si no tienes empresas guardadas).
- **NVDA**: datos de TIKR al 11-nov-2026 (los tres estados) para probar el Modelo financiero. Los supuestos de proyección son de prueba; están explicados en las notas de la empresa.
- **GOOGL**: importada de `2025-06-23_GOOGL_PDV.xlsx`, con precio y datos a junio de 2025. Reproduce los mismos precios objetivo que ese Excel (hay una prueba que lo comprueba).

Las empresas precargadas se agregan una sola vez por navegador; si las eliminas, no vuelven. Están en `js/seeds.js`.

## Flujo de valoración

| Pestaña | Viene del Excel | Qué hace |
|---|---|---|
| **Datos básicos** (arriba, siempre visibles) | Filtro 1 | Ticker, precio actual, n° de acciones (millones) y año base. |
| **Resumen** | — (nuevo) | Precio objetivo de todos los métodos para el año elegido, frente al precio actual. Mediana, potencial y CAGR. Puedes desmarcar métodos que no apliquen y escribir notas de la tesis. |
| **1 · Filtro** | Filtro 1 | Plantillas General, REITs, Tecnológicas, Servicios y Financieras. Calificación Good/Not, reglas editables y múltiplo máximo según crecimiento. |
| **2 · Earnings Growth** | F2-EGM, inst-EGM | Modelo de Compound Quality: EPS growth + shareholder yield ± cambio de valoración. Margen de seguridad, regla del 72 y retorno mínimo exigido. |
| **3 · EPS · P/S · FCF** | EPS Proyectado, PS Proyectado, FCF Proyectado | Las tres proyecciones por múltiplo en una sola pestaña, con gráfico comparativo. |
| **4 · Graham** | EPS Proyectado (Fórmula de Graham) | Crecimiento implícito `(PER NTM − 8,5) / 2`, PER justo, valor justo y versión revisada con el bono AAA. Incluye guía de dónde sacar cada variable. |
| **5 · Modelo financiero** | 1. Income statement, 2. Flujos de caja, 3. Retornos capital, 4. Valoración | El método del curso: las cuatro pestañas numeradas como un solo modelo, con sub-pestañas. Proyecta los estados financieros 5 años y los valora con PER, P/FCF, EV/EBITDA y EV/EBIT. |

### Datos vinculados

Las celdas con fondo azul toman su valor de otra pestaña (por ejemplo, el PER histórico del Filtro alimenta EPS Proyectado, el EGM y la Valoración del Modelo financiero). Si escribes un valor propio, se usa el tuyo; si lo borras, vuelve al vínculo.

### Fecha de actualización

Junto al nombre de cada empresa aparece la última fecha en que se actualizaron sus datos y hace cuánto fue: en verde hasta 30 días, en ámbar hasta 90 y en rojo después. La lista de empresas también muestra la fecha. Cambia al cargar datos de TIKR, al importar un Excel (se toma la fecha del nombre del archivo si la tiene, como `2025-06-23_GOOGL_PDV.xlsx`) y al modificar las proyecciones EPS, P/S o FCF. Ajustar el precio actual u otros datos no la cambia.

### Portafolio

La app tiene dos secciones principales, arriba: **Portafolio** (todas las empresas juntas) y **Plantillas de valoración** (una empresa a la vez, con el Resumen y las pestañas 1 a 5).

Marca "En mi portafolio" en los datos básicos de cada empresa que tengas en cartera. La pestaña **Portafolio** muestra:

- El rendimiento anualizado esperado a 5 años de cada empresa: la mediana del CAGR de sus métodos marcados en el Resumen (precio objetivo a 5 años del año base, o el último año disponible) más su dividend yield.
- El **promedio con el mismo peso** para todas las empresas del portafolio, sin importar su peso real en la cartera.
- Las empresas fuera del portafolio, con el mismo cálculo, para comparar.

### Convención de porcentajes

Todos los porcentajes se escriben como número: `12` = 12 %.

**Recompras:** se escriben en negativo, porque reducen las acciones en circulación (`-2` = recompra el 2 % al año). Un valor positivo es dilución. Así, en el Filtro una recompra es "Good" (< 0), en el Modelo financiero las acciones bajan y en el EGM la recompra suma al shareholder yield. Al importar un Excel antiguo (donde la recompra iba en positivo) la app cambia el signo.

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
js/importer.js    Lectura de planillas .xlsx (SheetJS)
js/tikr.js        Lectura de tablas copiadas de TIKR
js/seeds.js       Empresas precargadas (GOOGL, NVDA)
tests/            Pruebas del motor de cálculo
```

Pruebas: `node tests/calc.test.js`
