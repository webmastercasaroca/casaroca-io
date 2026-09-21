# Frontend de CasaRoca System.
#
# Sin paso de construccion a proposito: la aplicacion es HTML, CSS y
# modulos de JavaScript que el navegador entiende tal cual. Lo unico que
# hace esta imagen es servirlos bien: cabeceras de seguridad, compresion
# y una politica de cache que no deje a nadie con la version de ayer.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY src        /usr/share/nginx/html/src

# Cloud Run manda el puerto por $PORT, y por omision es 8080.
EXPOSE 8080

# ⛔ No corre como root.
USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/salud || exit 1
