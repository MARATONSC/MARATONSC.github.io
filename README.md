# Maratón SC

Sitio web estático para publicar la información del campeonato de fútbol sala de Maratón SC: grupos, fase eliminatoria, programación, ubicación y patrocinadores.

## Estado actual

El proyecto está implementado como una web sin framework, compuesta por un único [`index.html`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/index.html) con JavaScript embebido y estilos en [`assets/styles.css`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/assets/styles.css).

Actualmente el repositorio ya incluye:

- Navegación por secciones: `Inicio`, `Fase de grupos`, `Fase eliminatoria`, `Programación` y `Patrocinadores`.
- Carga dinámica de datos desde archivos JSON usando `fetch`.
- Refresco automático de datos cada 15 segundos.
- Vista de próximos partidos.
- Tabla de grupos con clasificación visual.
- Vista por rondas de la fase eliminatoria.
- Buscador por equipo en la programación.
- Bloque de ubicación con mapa de Google Maps.
- Rejilla de patrocinadores con imagen y enlace.
- Diseño responsive para móvil y escritorio.

## Estado de los datos del repositorio

Con los archivos actuales en [`data/`](https://github.com/MARATONSC/MARATONSC.github.io/tree/main/data):

- Hay 3 grupos (`A`, `B` y `C`): los grupos `A` y `B` tienen 5 equipos, y el grupo `C` tiene 4 equipos.
- Hay 26 partidos de fase de grupos en [`data/grupos.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/grupos.json).
- Hay 8 partidos de eliminatoria en [`data/eliminatoria.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/eliminatoria.json): 4 cuartos, 2 semifinales, 1 tercer puesto y 1 final.
- Todos los partidos están cargados como `Programado` y sin goles registrados.
- La información del evento en [`data/evento.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/evento.json) indica actualmente:
  - Organización: `Maratón SC`
  - Lugar: `Cam. Cuenca, 4, 16600 San Clemente, Cuenca.`
  - Fecha: `1 y 2 de Agosto.`
- La sección de patrocinadores tiene varias entradas vacías o de relleno, por lo que todavía no representa un catálogo final.

## Estructura del proyecto

```text
.
├── index.html
├── README.md
├── assets/
│   ├── styles.css
│   ├── logo.jpg
│   ├── instagram.png
│   └── sponsors/
└── data/
    ├── maratonsc-data.json
    ├── evento.json
    ├── grupos.json
    └── eliminatoria.json
```

## Archivos clave

- [`index.html`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/index.html): estructura de la página y toda la lógica JavaScript de renderizado.
- [`admin.html`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/admin.html): panel estático para editar datos del campeonato desde el navegador.
- [`assets/styles.css`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/assets/styles.css): estilos globales y responsive.
- [`assets/data-store.js`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/assets/data-store.js): carga de datos compartida, guardado local del panel y cálculo automático de estados por horario.
- [`data/maratonsc-data.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/maratonsc-data.json): manifiesto de fuentes de datos.
- [`data/evento.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/evento.json): datos generales del evento y patrocinadores.
- [`data/grupos.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/grupos.json): clasificación de grupos y calendario de la fase de grupos.
- [`data/eliminatoria.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/eliminatoria.json): cruces de la fase eliminatoria.

## Cómo ejecutarlo en local

Como la página carga JSON con `fetch`, no conviene abrir [`index.html`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/index.html) directamente con `file://`. Lo correcto es servir el proyecto por HTTP.

Ejemplo con Python:

```bash
python3 -m http.server 8000
```

Después abre:

```text
http://localhost:8000
```

Para usar el panel de administración en local:

```text
http://localhost:8000/admin.html
```

El PIN inicial del panel es `2026`. Se puede cambiar actualizando el hash `PIN_HASH` en [`assets/admin.js`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/assets/admin.js).

## Cómo se actualiza el contenido

No hay backend ni base de datos. El contenido se mantiene editando los JSON dentro de [`data/`](https://github.com/MARATONSC/MARATONSC.github.io/tree/main/data).

- Cambia [`data/evento.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/evento.json) para fecha, lugar, organización y patrocinadores.
- Cambia [`data/grupos.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/grupos.json) para equipos y partidos de grupos. La clasificación se calcula desde los resultados: puntos, enfrentamiento directo si hay empate y diferencia de goles si el directo también queda empatado.
- Cambia [`data/eliminatoria.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/eliminatoria.json) para los cruces y resultados de eliminatoria.
- Si en el futuro cambian las rutas de datos, actualiza [`data/maratonsc-data.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/maratonsc-data.json).

También se puede usar [`admin.html`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/admin.html) para editar los datos sin tocar JSON a mano:

- Cada edición se guarda automáticamente en el navegador actual, útil para previsualizar al instante.
- `Publicar en GitHub` sube `data/evento.json`, `data/grupos.json` y `data/eliminatoria.json` al repositorio mediante GitHub API.
- `Restaurar` descarta los cambios locales del navegador y vuelve a cargar los JSON publicados, previa confirmación.
- Los partidos calculan el estado automáticamente con `fecha`, `hora` y la duración global `duracionPartidosMinutos`: antes del inicio son `Programado`, durante la duración son `Disputando` y después pasan a `Finalizado`.
- Los partidos ya existentes no se añaden ni eliminan desde el panel; en `Fase de grupos` se editan sus equipos, fecha, hora, goles y estado debajo de las tablas calculadas.
- En `Fase de grupos` hay un filtro para mostrar todos los grupos o solo un grupo concreto.
- Si un partido necesita estado fijo, marca `Manual` en el panel.
- El PIN de `admin.html` es una barrera ligera en cliente. En una web estática pública no sustituye a una autenticación real con backend.

Para publicar desde el panel con GitHub API:

1. Crea un fine-grained personal access token en GitHub para el repositorio `MARATONSC/MARATONSC.github.io`.
2. Dale permiso `Contents: Read and write`.
3. Entra en `admin.html`, rellena el token en `Token GitHub` y pulsa `Publicar en GitHub`.
4. El panel creará un único commit sobre la rama `main` con los tres JSON de `data/`.

El token no se guarda en los archivos del proyecto. Si marcas `Recordar token en este dispositivo`, se guarda en el almacenamiento local de ese navegador para no tener que pegarlo cada vez. Desmarca esa casilla para borrarlo del dispositivo.

## Observaciones del estado actual

- El proyecto está en formato MVP funcional: la interfaz principal ya existe y consume datos reales desde JSON.
- No hay `package.json`, dependencias de build, tests automatizados ni pipeline de despliegue definidos en este repositorio.
- El texto por defecto del encabezado en HTML indica `25 y 26 de Julio`, pero el dato cargado desde [`data/evento.json`](https://github.com/MARATONSC/MARATONSC.github.io/blob/main/data/evento.json) lo sobrescribe actualmente con `1 y 2 de Agosto.` cuando la página termina de cargar.
- Parte de los datos siguen siendo de ejemplo o provisionales, especialmente equipos y patrocinadores.
