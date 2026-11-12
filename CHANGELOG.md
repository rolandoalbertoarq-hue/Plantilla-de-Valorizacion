# Historial de versiones

## Versión 3 (en desarrollo)

- **Sincronización en la nube**: en la página de claude.ai las empresas se guardan en la base de datos de la página (solo el dueño lee y escribe), y se ven iguales en la computadora y el celular. La primera conexión de cada dispositivo une sus datos con los de la nube sin perder nada: gana la versión más reciente y, si había diferencias, se ofrece restaurar la de ese dispositivo. Las empresas eliminadas no reaparecen desde otro dispositivo.

## Versión 2 — commit `710ea7b`

- **Dos secciones principales** (ajuste posterior al cierre): Portafolio y Plantillas de valoración, en la barra superior. La barra de empresa, los datos básicos y las pestañas 1–5 solo aparecen en Plantillas.

- **Portafolio**: casilla "En mi portafolio" en los datos básicos y nueva sección Portafolio con el rendimiento anualizado esperado a 5 años de cada empresa y el promedio con el mismo peso para todas. La lista de empresas se agrupa en "En portafolio" y "Fuera del portafolio".

- **Pegar de TIKR**: copia el Income Statement, el Balance Sheet y el Cash Flow desde TIKR (o un Excel donde los pegaste) y la app llena los años históricos del Modelo financiero. El LTM queda como año base; los cierres fiscales de enero a mayo cuentan para el año calendario anterior (NVDA: FY2026, que cerró en ene-2026, va en 2025).
- **Múltiplos actuales**: en Valoración del Modelo financiero se muestran el PER, P/FCF, EV/EBITDA y EV/EBIT de hoy con los datos del año base. Si no hay múltiplo histórico en el Filtro, se usa el actual.
- **NVDA precargada** con los datos de TIKR del 11-nov-2026 (Income Statement, Balance Sheet y Cash Flow).
- **Fecha de actualización**: junto al nombre de la empresa (y en la lista de empresas) se ve la última vez que se actualizaron sus datos: al cargar TIKR o un Excel, o al modificar las proyecciones EPS, P/S o FCF. Cambiar el precio no la mueve. Verde hasta 30 días, ámbar hasta 90, rojo después. Al importar un Excel se usa la fecha del nombre del archivo (p. ej. `2025-06-23_GOOGL_PDV.xlsx`).
- **Recompras en negativo**: −2 % = la empresa recompra el 2 % de sus acciones; positivo = dilución. En el Filtro la regla pasa a "< 0" (Good si recompra), el Modelo financiero reduce las acciones con un valor negativo y el EGM suma la recompra al shareholder yield. Las empresas guardadas, los respaldos antiguos y los Excel importados se convierten cambiando el signo.
- **P/S y FCF parten del LTM**: el dato base es el del año base (LTM al cargar TIKR) y la proyección empieza el año siguiente. Las ventas y el FCF base vienen del Modelo financiero. Cada pestaña tiene un campo "Año del dato base" por si el dato es de otro año.
- **"Método del curso" pasa a llamarse "Modelo financiero"** (pestaña 5). Los enlaces antiguos con `#curso` siguen funcionando.
- Las empresas precargadas pueden actualizarse sin borrar lo que el usuario ya llenó (`seedVersion` / `seedUpdate`).

## Versión 1 — commit `098a82b`

- App web con Resumen, Filtro por tipo de empresa, Earnings Growth Model, proyecciones por EPS / P/S / FCF, Graham y el método del curso (pestañas 1–4).
- Importador de planillas de valoración en Excel (plantilla actual y anteriores).
- GOOGL precargada desde `2025-06-23_GOOGL_PDV.xlsx`.
- Línea de precio objetivo promedio en el gráfico por método.

Para volver a una versión: `git checkout 098a82b` (v1) o `git checkout 710ea7b` (v2), o crea una Release en GitHub sobre ese commit.
