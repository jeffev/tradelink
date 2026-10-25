FROM python:3.11-slim

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cache)
COPY requirements.txt .
# Up-to-date pip/setuptools (setuptools vendors jaraco.context) before the app deps.
# pip itself leaves afterwards: it is only needed to install, and its vendored
# copies (urllib3, msgpack) carry known CVEs.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
  && pip install --no-cache-dir -r requirements.txt \
  && pip uninstall -q -y pip wheel && rm -rf /usr/local/lib/python3.11/ensurepip

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
