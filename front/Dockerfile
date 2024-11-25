FROM httpd:latest
WORKDIR /usr/local/apache2/htdocs
COPY index.html .
COPY read.html .

WORKDIR /usr/local/apache2/conf/extra
COPY config/proxy-html.conf .

WORKDIR /usr/local/apache2/conf
COPY config/httpd.conf .

EXPOSE 8080