# La integración continua, pendiente de un permiso de GitHub

**20 de septiembre de 2026.** Los cambios de esta madrugada añaden cuatro pasos a la
integración continua:

1. Los **tres bancos de la API** (42 comprobaciones que llevaban semanas sin correr).
2. La comprobación de que **ningún cast de la API apunta a un tipo borrado** (el fallo que
   dejaba toda donación en 500).
3. El **buscador de secretos** nuevo, que mira todo el repositorio y también por la forma.
4. **Terraform**: `validate`, `fmt -check -recursive` y `test`.

**No se pudieron empujar.** GitHub rechaza el push con este mensaje:

```
refusing to allow an OAuth App to create or update workflow
`.github/workflows/verificar.yml` without `workflow` scope
```

La cuenta activa (`gerencia40`) tiene los permisos `gist`, `read:org` y `repo`, pero **no
`workflow`**. Es una protección de GitHub: un token sin ese permiso no puede tocar lo que se
ejecuta en la integración continua, y está bien que así sea.

⛔ **La otra cuenta del equipo (`D-ANK-LC`) sí tiene `workflow`, y NO se usó a propósito:** es la
identidad de otro cliente. Mezclar identidades entre repositorios es justo lo que la regla de
trabajo prohíbe, y un push con la cuenta equivocada queda para siempre en el historial.

## Qué hay que hacer (un minuto, y lo tiene que hacer Daniel)

```bash
gh auth refresh -h github.com -s workflow
```

Abre el navegador y pide confirmar. Después:

```bash
cd ~/Desktop/CasaRoca/ecosistema-cr
cp docs/ci-pendiente/verificar.yml.nuevo .github/workflows/verificar.yml
git add .github/workflows/verificar.yml && git rm -r --cached docs/ci-pendiente >/dev/null
git commit -m "Integracion continua: los tres bancos de la API, los tipos, los secretos y Terraform"
git push origin main
```

Mientras tanto **no se pierde nada**: los cuatro pasos SÍ corren en
`backend/scripts/verificar.sh`, que es la misma compuerta. Lo que falta es que los corra también
GitHub en cada push.
