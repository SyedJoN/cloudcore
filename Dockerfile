FROM openfga/openfga:latest

ENTRYPOINT ["openfga"]

CMD ["run", "--http-addr", "0.0.0.0:10000"]
