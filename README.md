# maratonsc.github.io

Sitio público para mostrar el estado del campeonato de fútbol sala Maratón SC.

## Estructura del sitio

La web incluye 3 menús:

- Inicio
- Fase de grupos
- Fase eliminatoria

## Datos editables (sin API)

Todo se alimenta desde:

- `data/maratonsc-data.json`

Cuando termina un partido, el administrador actualiza ese archivo y sube el cambio:

1. Modifica nombres o puntos de `groups`.
2. Rellena marcador y estado en `eliminatoria`.
3. `git add`, `git commit` y `git push`.

La web recarga el JSON cada 15 segundos (con `?v=<timestamp>` para saltar caché).

## Publicación en GitHub Pages

En Settings → Pages del repo configura:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

La URL para este repo será:

`https://javierjh99.github.io/maratonsc.github.io`

## Estados de partidos

Usa:

- `scheduled`
- `live`
- `finished`

## Editar evento

Cambia en `data/maratonsc-data.json`:

```json
{
  "event": {
    "organization": "Maratón SC",
    "location": "Cam. Cuenca, 4, 16600 San Clemente, Cuenca.",
    "date": "25 y 26 de Julio"
  }
}
```
