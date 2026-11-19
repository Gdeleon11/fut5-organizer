# F5 Manager Premium · 19 de noviembre de 2026

Rama de trabajo `feat/f5-premium-match`. HEAD verificado en `6671281`, commit de Claude con las dos vistas de detalle, bloques compartidos, pizarra y encuesta. El árbol estaba limpio al iniciar. Los ajustes posteriores están en el árbol de trabajo.

## Estado de Entrega 1

Pendiente de aceptación visual y commit de cierre.

- Resumen compartible con indicadores, MVP destacado, vista previa desplegable y copia del texto completo. Pronóstico organizado en temperatura, condiciones y datos de cancha. Formulario de rendimiento individual con contadores, reconocimientos y acción de guardado. Los estilos se apoyan en los tokens de apariencia existentes.
- Demo de desarrollo en `/?f5-match-demo` con 18 jugadores sintéticos, simulación mediante el algoritmo existente y encuesta con estadísticas y votos en memoria. El componente de cancha representaba solo los primeros dos equipos. La pizarra ahora muestra también el tercero en Command Center.
- Vitest pasó 67 de 67. Las nuevas comprobaciones ejercitan ambas experiencias, tres equipos, 18 jugadores únicos, color, ficha, selección de estrellas y finalización. El test del modal comprueba goles, asistencias, MVP y valla invicta en el objeto de guardado.
- Build de Vite correcto. Persiste el aviso de tamaño del bundle. Open-Meteo fue inaccesible durante Vitest.
- Playwright reconoce 48 casos en los proyectos desktop y móvil. La ejecución se detuvo al iniciar Vite con `listen EPERM 127.0.0.1:5173`. Un segundo puerto local también resultó denegado. El lanzamiento aislado de Chromium terminó con `MachPortRendezvousServer: Permission denied (1100)`.
- Capturas generadas en esta sesión: ninguna. Las pruebas de partido están preparadas para escribir estadisticas.png, encuesta.png y pizarra.png en el directorio de resultados de cada caso.

## Próxima tarea exacta

Ejecutar desde frontend `CI=1 npm run test:e2e` en una sesión que permita escuchar en localhost y lanzar Chromium. Revisar capturas, scroll, superposiciones y legibilidad en móvil y escritorio, incluidos resumen, pronóstico con datos de prueba y rendimiento individual en las cuatro paletas. Corregir incidencias y registrar las capturas aprobadas en el repositorio. Crear el commit local de cierre después de la aceptación.

Entrega 2 pendiente de ese cierre. El siguiente alcance comprende directorio, perfiles, rankings, Mi FIFA, tarjetas y habilidades. Reservas y Finanzas quedan fuera de esta etapa.

## Reintento de validación visual

Se reprodujeron dos denegaciones independientes del entorno administrado:

- Vite: `Error: listen EPERM: operation not permitted 127.0.0.1:5173`.
- Chromium: `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.24985: Permission denied (1100)`.
- Se solicitó ejecutar Playwright con permisos adicionales. El mecanismo de aprobación rechazó la solicitud antes de mostrarla al usuario porque la política de la sesión tiene `sandbox_approval: false`.

Casos ejecutados en este reintento: 0 de 48. Capturas nuevas: 0. La configuración de Playwright inicia Vite sin credenciales de Supabase y las tres suites usan una fixture que bloquea tráfico HTTP externo y responde al pronóstico con datos sintéticos. Se verificó el descubrimiento de los 48 casos con esa configuración. La validación visual completa sigue pendiente.

Desde Terminal de macOS, en frontend, ejecutar `CI=1 npm run test:e2e -- --reporter=list,html`. Para inspeccionar el informe sin abrir un servidor, ejecutar `open playwright-report/index.html`. Las capturas de las pruebas de partido estarán en test-results/. El informe de ejecución y la inspección de las cuatro paletas son pasos separados.

## Corrección del único fallo informado desde el Mac

Corrida del Mac anterior al ajuste: 46 aprobados, 1 fallido y 1 omitido. El registro identifica un checkbox de otra fila interceptando el puntero. Se ancló el input a su propio label y se amplió a toda su superficie, con 44 px de altura mínima en dispositivos táctiles. La prueba usa check() sobre los controles nativos MVP y Valla. La captura móvil previa también mostraba el marcador superior recortado al desplazar la lista. Se impidió que el marcador se comprima dentro del modal.

Validación posterior: Vitest 67/67 y build correcto. Tanto el caso móvil dirigido como la suite completa terminaron antes de ejecutar casos con listen EPERM en 127.0.0.1:5173 en esta sesión. Las 11 capturas de la corrida anterior se conservaron. Pendientes la interacción táctil y las capturas posteriores, la inspección visual y el commit de cierre.

## Validación confirmada en Mac mini

Caso dirigido 1/1, Playwright completo 47 aprobados, 1 omitido, 0 fallidos. La única omisión programada es la navegación inferior en escritorio, mediante test.skip(!isMobile). En móvil se ejecuta. Vitest 67/67 y build correctos en la revisión anterior.

Inspeccionadas las 12 imágenes existentes de frontend/test-results: modal en neon y pizarra y encuesta en gold, ambas experiencias, escritorio y móvil. El marcador y los botones de cierre y guardado son visibles en las capturas móviles. Command Center representa el tercer equipo en una segunda cancha. Editorial muestra tres listas de equipo.

La suite existente admite F5_CAPTURE_PALETTE para capturar también resumen, clima sintético y rendimiento individual después de cerrar el partido demo. Ejecutar en frontend, con salida separada para conservar los resultados previos:

```sh
for palette in neon midnight gold light; do
  CI=1 F5_CAPTURE_PALETTE="$palette" npm run test:e2e -- match-experience.spec.js --grep 'stats modal edits|simula dieciocho' --output="premium-capturas/$palette" || break
done
```

Pendientes de verificación las nuevas capturas de esta matriz (96 imágenes). Entrega 2 pendiente del cierre de la revisión.

Verificación directa del informe HTML del Mac: 48 totales, 47 aprobados, 0 fallidos, 0 intermitentes y 1 omitido. El caso omitido fue «mobile Más menu lists Apariencia (when the menu exists)» en chromium-desktop. Se agruparon las 12 capturas reales de esa corrida en frontend/test-results/F5-capturas-verificadas.zip. La matriz adicional de 96 imágenes requiere su propia ejecución. HEAD de desarrollo sigue en 6671281.

## Revisión final de Entrega 1

Rama feat/f5-premium-match, base 6671281. Mac mini: Playwright 47 aprobadas, 1 omisión deliberada de navegación móvil en escritorio, 0 fallidas. Matriz específica 32/32. Vitest 67/67 y build correcto.

Se verificaron los cuatro archivos .last-run.json y se revisaron los 96 PNG en frontend/premium-capturas (6 componentes × 2 experiencias × 2 dispositivos × 4 paletas). Ambas rutas de prueba guardan la paleta elegida antes de navegar. Las capturas muestran el cambio efectivo en los cuatro grupos. El modal, la encuesta, la distribución de 18 jugadores en tres equipos, el resumen y el rendimiento individual aparecen en cada combinación.

Incidencia de evidencia: en las ocho capturas móviles de clima, la navegación fija cubre parte o todo el pronóstico. Se ajustó la prueba para centrar el panel y comprobar que su botón recibe eventos antes de capturarlo. Se agregó la comprobación explícita de la paleta en el documento de la pizarra/encuesta. No se cambió la interfaz. La prueba modificada queda pendiente de ejecución en Mac: el intento local terminó antes de ejecutar casos con listen EPERM 127.0.0.1:5173.

Próxima tarea: ejecutar la matriz con el comando anterior, comprobar los ocho PNG móviles de clima y preparar Vercel Preview previa autorización. Entrega 2 en pausa.
