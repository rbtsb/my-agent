"""
One-time (re-run whenever knowledge_base.md changes) embedding job.

Chunks knowledge_base.md by section and embeds each chunk via the Text Embeddings Inference
(TEI) service — a Rust-based, always-on, horizontally scalable embedding server (see
docker-compose.yml) — instead of loading a model in-process. Upserts the vectors into Milvus.

Run:
    pip install -r requirements.txt
    docker compose up -d          # starts Milvus + etcd + minio + Attu + TEI
    python embed_knowledge.py
"""

import json
import re
import urllib.request
from pathlib import Path

from pymilvus import CollectionSchema, DataType, FieldSchema, MilvusClient

KNOWLEDGE_BASE_FILE = Path(__file__).parent / "knowledge_base.md"
COLLECTION_NAME = "knowledge_base"
TEI_URL = "http://localhost:8080/embed"
MILVUS_URI = "http://localhost:19530"


MAX_CHUNK_CHARS = 1500  # keeps each chunk comfortably under the model's 512-token limit


def chunk_markdown(text: str) -> list[str]:
    """Split on ## / ### headers, then further split any section that's still too long for the
    embedding model's 512-token limit (auto_truncate is off, so an oversized input is a hard
    error, not silent truncation) — sub-splitting by blank-line paragraphs, with the section
    heading repeated on each piece so it stays retrievable on its own."""
    sections = re.split(r"\n(?=#{2,3} )", text)
    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        if len(section) <= MAX_CHUNK_CHARS:
            chunks.append(section)
            continue

        heading, _, body = section.partition("\n")
        piece = ""
        for para in body.split("\n\n"):
            candidate = (piece + "\n\n" + para).strip() if piece else para
            if len(candidate) > MAX_CHUNK_CHARS and piece:
                chunks.append(heading + "\n" + piece)
                piece = para
            else:
                piece = candidate
        if piece:
            chunks.append(heading + "\n" + piece)
    return chunks


def embed(texts: list[str], batch_size: int = 8) -> list[list[float]]:
    # TEI (see docker-compose.yml logs) caps internal batch size at 8 for this backend.
    vectors = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        body = json.dumps({"inputs": batch}).encode("utf-8")
        req = urllib.request.Request(TEI_URL, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            vectors.extend(json.load(resp))
    return vectors


def main():
    chunks = chunk_markdown(KNOWLEDGE_BASE_FILE.read_text(encoding="utf-8"))
    print(f"Split knowledge base into {len(chunks)} chunks.")

    embeddings = embed(chunks)
    dim = len(embeddings[0])

    client = MilvusClient(uri=MILVUS_URI)

    if client.has_collection(COLLECTION_NAME):
        client.drop_collection(COLLECTION_NAME)  # full re-embed each run — dataset is small

    schema = CollectionSchema(
        fields=[
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=20000),
            FieldSchema(name="vector", dtype=DataType.FLOAT_VECTOR, dim=dim),
        ]
    )
    client.create_collection(collection_name=COLLECTION_NAME, schema=schema)
    index_params = client.prepare_index_params()
    index_params.add_index(field_name="vector", index_type="AUTOINDEX", metric_type="COSINE")
    client.create_index(collection_name=COLLECTION_NAME, index_params=index_params)

    rows = [{"text": chunk, "vector": emb} for chunk, emb in zip(chunks, embeddings)]
    client.insert(collection_name=COLLECTION_NAME, data=rows)
    client.load_collection(COLLECTION_NAME)

    print(f"Inserted {len(rows)} chunks into Milvus collection '{COLLECTION_NAME}'.")
    print("Open Attu at http://localhost:8000 (connect to milvus:19530) to inspect the collection.")


if __name__ == "__main__":
    main()
