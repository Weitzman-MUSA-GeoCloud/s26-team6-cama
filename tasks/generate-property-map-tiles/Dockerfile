FROM gcr.io/google.com/cloudsdktool/cloud-sdk:slim

RUN apt-get update && apt-get install -y gdal-bin && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY script.sh .
RUN chmod +x script.sh

ENTRYPOINT ["/app/script.sh"]
