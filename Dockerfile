FROM openfga/openfga:latest

ENTRYPOINT ["sh", "-c"]
CMD ["exec openfga run --http-addr 0.0.0.0:${PORT}"]
