#!/usr/bin/env python3
"""
Deleta um job do Cloud Scheduler usando a API REST.
Autentica via service account JSON (mesma usada no CI).
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

def get_access_token(sa_json_path, scope):
    """Obtém access token via JWT bearer flow usando a SA."""
    import base64
    with open(sa_json_path) as f:
        sa = json.load(f)
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": sa["client_email"],
        "scope": scope,
        "aud": sa.get("token_uri", "https://oauth2.googleapis.com/token"),
        "iat": now,
        "exp": now + 3600,
    }
    def b64url(d):
        return base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).rstrip(b"=").decode()
    signing_input = (b64url(header) + "." + b64url(payload)).encode()
    # Importa a chave
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
    except ImportError:
        print("cryptography não disponível", file=sys.stderr)
        return None
    private_key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    jwt_token = signing_input.decode() + "." + base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    # Troca o JWT por um access token
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_token,
    }).encode()
    req = urllib.request.Request(sa.get("token_uri", "https://oauth2.googleapis.com/token"), data=data)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())["access_token"]
    except Exception as e:
        print(f"Erro ao obter token: {e}", file=sys.stderr)
        return None

def delete_scheduler_job(project, location, job_name, access_token):
    """Deleta um job do Cloud Scheduler."""
    url = f"https://cloudscheduler.googleapis.com/v1/projects/{project}/locations/{location}/jobs/{job_name}"
    req = urllib.request.Request(url, method="DELETE", headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")

if __name__ == "__main__":
    sa_path = sys.argv[1]
    project = sys.argv[2]
    location = sys.argv[3]
    job_name = sys.argv[4]
    scope = "https://www.googleapis.com/auth/cloud-platform"
    print(f"Obtendo access token da SA {sa_path}...")
    token = get_access_token(sa_path, scope)
    if not token:
        print("Falha ao obter access token", file=sys.stderr)
        sys.exit(1)
    print(f"Deletando job {job_name} em {project}/{location}...")
    status, body = delete_scheduler_job(project, location, job_name, token)
    print(f"HTTP {status}: {body[:200]}")
    sys.exit(0 if status in (200, 204, 404) else 2)
