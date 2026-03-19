# maratonsc.github.io

Sitio público para mostrar el estado del campeonato de fútbol sala Maratón SC.

## Estructura del sitio

La web incluye 3 menús:

- Inicio
- Fase de grupos
- Fase eliminatoria

## Patrocinadores

Para actualizar patrocinadores sin tocar código:

1. Sube el logotipo a `assets/sponsors/` (por ejemplo `assets/sponsors/empresa.png`).
2. Edita `data/evento.json` y completa el array `patrocinadores` con esta estructura:

```json
{
  "organizacion": "Maratón SC",
  "lugar": "Cam. Cuenca, 4, 16600 San Clemente, Cuenca.",
  "fecha": "1 y 2 de Agosto.",
  "patrocinadores": [
    {
      "imagen": "empresa.png",
      "enlace": "https://www.empresa.com"
    }
  ]
}
```

Campos soportados:
- `imagen`: solo el nombre del fichero (ej. `empresa.png`).
- `enlace`: enlace al que se dirigirá al clicar el logo.

La ruta completa se genera automáticamente en:
- `assets/sponsors/<valor de imagen>`

Si prefieres no poner extensión, también puedes usar solo el nombre base (por ejemplo `empresa`); el sitio probará:
- `assets/sponsors/empresa.png`
- `assets/sponsors/empresa.jpg`
- `assets/sponsors/empresa.jpeg`
- `assets/sponsors/empresa.webp`
- `assets/sponsors/empresa.svg`

Si no se indica `enlace`, el patrocinador aparecerá desactivado.

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
