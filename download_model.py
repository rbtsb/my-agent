"""
One-time setup: downloads the embedding model to ./models so the TEI container (docker-compose.yml)
can load it from a local bind mount instead of downloading it itself.

Why: the TEI container's outbound traffic goes through the Docker Desktop proxy, which breaks
partway through Hugging Face's download (fails on a redirect). Downloading from the host, where
the proxy isn't in the path, works fine — and afterward the running service makes zero outbound
calls at all, which is a better fit for an on-premises deployment anyway.

Run once:
    pip install huggingface_hub
    python download_model.py
"""

from huggingface_hub import snapshot_download

MODEL_ID = "intfloat/multilingual-e5-small"
LOCAL_DIR = "./models/multilingual-e5-small"

if __name__ == "__main__":
    path = snapshot_download(MODEL_ID, local_dir=LOCAL_DIR)
    print(f"Downloaded {MODEL_ID} to {path}")
