# Dependencias: las 6 PRs de Dependabot abiertas contra `main` (2026-11-17)

Dependabot ahora apunta a `desarrollo` (`.github/dependabot.yml`): una PR semanal agrupada para menores y parches y una PR aparte por cada salto mayor.
Las 6 PRs de abajo se abrieron antes, contra `main`; Dependabot no las reasigna. **No se fusionó ni se cerró ninguna.**

Cómo se probó: rama temporal desde `desarrollo` (ya borrada), `npm ci`, el cambio de la PR y `tsc -b`, `vitest run` (29 archivos) y `vite build`
(con marcadores legales de relleno). Línea base sin cambios: todo en verde. Para los mayores de vite y plugin-react se añadió
`prueba-audio` (25 comprobaciones) y `prueba-menu` contra `vite dev` con Chromium.

| PR | Salto | Riesgo | ¿Rompe algo? | Recomendación |
|---|---|---|---|---|
| react 19.3.1 | parche (el rango `^19.1.1` ya lo admite; el lock estaba en 19.3.0) | Bajo. `react` y `react-dom` deben ir a la misma versión: `react-dom@19.3.0` pide `react@^19.3.0`, y si la PR solo toca `react` quedan desparejados | No: typecheck, tests y build en verde (probado con react y react-dom a 19.3.1) | Cerrar y esperar la PR agrupada de `desarrollo`, que sube los dos juntos |
| vite 8.3.8 | mayor (7 → 8; Rolldown) | Medio: cambia el empaquetador; exige Node `^20.19 \|\| >=22.12` (CI usa 22: vale) | No en lo comprobado: typecheck, tests, build, `prueba-audio` y `prueba-menu` en verde con vite 8 + plugin-react 6. Sin probar: `verificar-csp`, `capturas`, el build nativo y Vercel | Aplicar en `desarrollo` junto con plugin-react 6 (van en pareja) y pasar entonces `capturas.mjs` y `verificar-csp.mjs`; cerrar la PR de `main` |
| @vitejs/plugin-react 6.3.0 | mayor (5 → 6) | Medio: pide `vite@^8` como peer; sola, `npm i` falla con ERESOLVE contra vite 7 | Sola: sí, no instala. Con vite 8: no (mismas comprobaciones) | Aplicar en `desarrollo` en el mismo cambio que vite 8; nunca por separado |
| @playwright/test 1.65.1 | parche | Bajo; solo prueba de navegador | No: typecheck, tests y build en verde. Los navegadores se descargan por separado (`npx playwright install` si cambia la revisión); las pruebas `.mjs` no se repitieron con esta versión | Cerrar y esperar la PR agrupada |
| @tanstack/react-virtual 3.14.26 | parche | Bajo, pero lo usa `ui/VirtualList.tsx` (listas de miles de pistas) | No en typecheck, tests ni build. Sin probar el scroll virtual de `prueba-biblioteca` con esta versión | Cerrar y esperar la PR agrupada; al llegar, pasar `prueba-biblioteca.mjs` |
| gitleaks-action 3.0.0 | mayor (acción de GitHub; el CI fija 2.3.9 por hash) | Medio: salto de versión mayor del paso de secretos; si falla, el job `gitleaks` queda en rojo (no bloquea el build) | **No probado**: solo corre en GitHub Actions y no hay `act` aquí. No se revisaron sus notas de versión | Cerrar y esperar la PR aparte de `desarrollo` (los mayores van separados); revisar entonces las notas de versión y que el hash fijado sea el del tag |

Orden sugerido en `desarrollo`: 1) PR agrupada de menores y parches, 2) vite 8 + plugin-react 6 en un solo commit, 3) gitleaks-action.
Los avisos de seguridad de Dependabot siguen yendo a la rama por defecto (`main`): `target-branch` no los afecta.
