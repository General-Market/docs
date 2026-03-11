FROM python:3.11-slim
RUN useradd -r -s /bin/false app
WORKDIR /app
COPY scripts/sonic-rpc-proxy.py /app/sonic-rpc-proxy.py
USER app
ENTRYPOINT ["python3", "/app/sonic-rpc-proxy.py"]
CMD ["8547", "https://rpc.testnet.soniclabs.com"]
