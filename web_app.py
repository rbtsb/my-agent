"""
Web UI for the unified agent (agent_openrouter.py) — chat, RAG, tools, and every structured
interrupt (date / day-of-week choice / yes-no confirm), all in one place.

Run:
    pip install -r requirements.txt
    docker compose up -d
    python web_app.py
    open http://localhost:5000
"""

from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

load_dotenv(Path(__file__).parent / ".env")

import agent_openrouter as agent

app = Flask(__name__, static_folder="static")

THREAD_ID = "web-main"  # single-user local app — one conversation
pending_interrupt = False

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {".txt", ".md", ".csv", ".json", ".pdf", ".docx", ".xlsx", ".pptx", ".jpg", ".jpeg", ".png"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


@app.route("/")
def index():
    # no-store: this is actively being edited during dev — a stale cached copy in the browser
    # otherwise looks identical to "the update didn't apply."
    response = send_from_directory("static", "index.html")
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/api/send", methods=["POST"])
def send():
    global pending_interrupt
    if pending_interrupt:
        return jsonify({"type": "error", "message": "Resolve the pending question first."}), 409

    result = agent.run(THREAD_ID, user_message=request.json["message"])
    pending_interrupt = result["type"] == "interrupt"
    return jsonify(result)


@app.route("/api/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"type": "error", "message": "No file provided."}), 400

    filename = secure_filename(file.filename)
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({"type": "error", "message": f"Unsupported file type: {suffix or '(none)'}"}), 400

    saved_path = UPLOAD_DIR / filename
    file.save(saved_path)

    try:
        text = agent.extract_text(saved_path)
    except Exception as exc:
        return jsonify({"type": "error", "message": f"Could not read {filename}: {exc}"}), 400

    if not text.strip():
        return jsonify({"type": "error", "message": f"No readable text found in {filename}."}), 400

    agent.ingest_file(THREAD_ID, filename, text)
    return jsonify({"type": "text", "message": f'📎 Uploaded "{filename}" — ask me anything about it.'})


@app.route("/api/resume", methods=["POST"])
def resume():
    global pending_interrupt
    if not pending_interrupt:
        return jsonify({"type": "error", "message": "Nothing pending."}), 409

    # request.json is exactly the interrupt_protocol.py response shape.
    result = agent.run(THREAD_ID, resume_value=request.json)
    pending_interrupt = result["type"] == "interrupt"
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
