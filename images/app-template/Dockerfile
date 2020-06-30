FROM alpine:latest

WORKDIR /jk
ADD https://github.com/jkcfg/jk/releases/download/0.4.0/jk-linux-amd64 ./jk
RUN chmod a+x /jk/jk
COPY *.yaml index.js ./
ENTRYPOINT ["/jk/jk", "run"]
CMD ["./index.js"]
