FROM openfga/openfga:latest

EXPOSE 10000

CMD ["run", "--http-addr", "0.0.0.0:10000"]
