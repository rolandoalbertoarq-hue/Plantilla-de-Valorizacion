# Plantilla de Valoración — notas para Claude

App web estática (HTML, CSS y JavaScript sin compilación) para valorar empresas. Todo en español.
Leer primero `README.md` (funciones y fórmulas) y `CHANGELOG.md` (versiones).

## Página publicada en claude.ai

- URL: https://claude.ai/artifact/QnvBTii3tZvS99kcpSWjZq — **actualizar siempre esta misma página**: los datos del usuario
  (sus empresas) viven en la base de datos de ESA página. Publicar otra URL dejaría al usuario sin datos.
- Antes de publicar desde una sesión nueva: leerla con la herramienta Artifact (`action: "read"`, `url`).
- Armar el archivo: `python3 scripts/build_artifact.py <scratchpad>/plantilla-valoracion.html` y publicarlo con `url`.
- Capabilities: `{"db": {"rules": [{"path": "", "read": "owner", "write": "owner"}]}}` (solo el dueño lee y escribe).
  Al republicar sin `capabilities` se conservan.
- Base de datos: `companies/<id>` (una empresa por documento) y `settings/main` (reglas del Filtro, precargadas vistas,
  empresas eliminadas). No escribir en ella sin que el usuario lo pida.

## Convenciones

- Porcentajes como número: 12 = 12 %.
- Recompras en negativo (−2 = recompra), positivo = dilución (campo `signConvention: 2`).
- Montos en millones; año base = LTM al cargar datos de TIKR.
- "Modelo financiero" = las pestañas 1–4 del Excel original (el método del curso).
- Fecha de actualización (`updatedAt`): solo cambia al cargar TIKR/Excel o editar EPS, P/S o FCF.
- Empresas precargadas en `js/seeds.js`; para cambiarlas en navegadores que ya las tienen, subir `seedVersion` y
  agregar una entrada en `seedUpdates` (paths / pathsIfEmpty / pathsIfEquals) sin pisar lo que el usuario llenó.
- Flujo de trabajo con el usuario: él comparte Excel de TIKR (Income Statement, Balance Sheet, Cash Flow) y Claude
  carga el Modelo financiero. Supuestos que Claude elija se marcan como "de prueba" en las notas de la empresa.

## Verificar

- `node tests/calc.test.js`
- Revisar en Chromium (Playwright) servido con `python3 -m http.server`. Chart.js viene de jsDelivr y SheetJS de cdnjs;
  si la red los bloquea, servirlos desde copias locales con `page.route`.
