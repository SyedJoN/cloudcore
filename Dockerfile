FROM openfga/openfga:latest

EXPOSE 8080

CMD ["sh", "-c", "openfga run --http-addr 0.0.0.0:${PORT}"]
