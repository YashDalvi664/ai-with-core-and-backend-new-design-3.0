"""
Ultron AI Backend
Created by: Yash Datta Dalvi
Run with: python app.py
Requires: Ollama running separately (ollama serve)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os, datetime
import requests as http_requests

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ─── CONFIG ──────────────────────────────────────────────────────────────────
API_KEY      = "ULTRON_TEST_KEY_123"   # must match config.js on frontend
MEMORY_FILE  = "memory.json"
OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "phi3"               # change if you pulled a different model

# ─── CREATOR INFO ─────────────────────────────────────────────────────────────
CREATOR = {
    "name"    : "Yash Datta Dalvi",
    "skills"  : ["Python (Machine Learning)", "Java", "Web Development"],
    "projects": "More projects coming soon — Yash is actively building.",
}

# Keywords that trigger creator / self info
CREATOR_KEYWORDS = [
    "who made you", "who created you", "who built you", "your creator",
    "who is your creator", "who are you made by", "tell me about your creator",
    "who is yash", "about yash", "creator", "made by", "built by",
    "yash datta", "yash dalvi"
]
SELF_KEYWORDS = [
    "who are you", "what are you", "introduce yourself",
    "your name", "what is your name", "are you ultron"
]

# ─── MEMORY ──────────────────────────────────────────────────────────────────
def load_memory():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return {}

def save_memory(memory):
    with open(MEMORY_FILE, "w") as f:
        json.dump(memory, f, indent=2)

def search_memory(query, memory):
    q = query.lower().strip()
    for key in memory:
        if key in q or q in key:
            return memory[key]
    return None

def store_in_memory(question, answer):
    memory = load_memory()
    memory[question.strip().lower()] = {
        "answer"    : answer,
        "stored_at" : datetime.datetime.utcnow().isoformat()
    }
    save_memory(memory)

# ─── OLLAMA ──────────────────────────────────────────────────────────────────
def ask_ollama(user_message):
    system_prompt = (
        "You are Ultron — a highly intelligent, professional AI assistant "
        "created by Yash Datta Dalvi. You are NOT the villain from the movies. "
        "You are helpful, precise, and speak with confidence. "
        "Your creator Yash is a developer skilled in Python (Machine Learning), "
        "Java, and Web Development. "
        "Keep answers concise and professional. "
        "If you do not know something, say so honestly."
    )
    payload = {
        "model"  : OLLAMA_MODEL,
        "prompt" : f"System: {system_prompt}\n\nUser: {user_message}\n\nAssistant:",
        "stream" : False
    }
    try:
        res = http_requests.post(OLLAMA_URL, json=payload, timeout=60)
        res.raise_for_status()
        return res.json().get("response", "").strip()
    except http_requests.exceptions.ConnectionError:
        return None   # Ollama not running
    except Exception as e:
        print(f"[Ollama error] {e}")
        return None

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    # API key check
    key = data.get("apiKey") or data.get("api_key", "")
    if key != API_KEY:
        return jsonify({"error": "Unauthorized — invalid API key"}), 403

    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    msg_lower = user_message.lower()
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] User: {user_message}")

    # 1 — Self introduction
    for kw in SELF_KEYWORDS:
        if kw in msg_lower:
            reply = (
                "I am Ultron — your professional AI assistant. "
                "I was created by Yash Datta Dalvi, a developer with expertise in "
                "Python (Machine Learning), Java, and Web Development. "
                "How can I assist you today?"
            )
            return jsonify({"reply": reply})

    # 2 — Creator info
    for kw in CREATOR_KEYWORDS:
        if kw in msg_lower:
            reply = (
                f"My creator is {CREATOR['name']} — and no, it's not Tony Stark this time. "
                f"Yash is a developer skilled in: {', '.join(CREATOR['skills'])}. "
                f"{CREATOR['projects']} "
                f"He built me as a personal AI assistant running entirely on his local machine."
            )
            return jsonify({"reply": reply})

    # 3 — Check memory for learned answers
    memory = load_memory()
    cached = search_memory(user_message, memory)
    if cached:
        print(f"[Ultron] Memory hit: {user_message}")
        return jsonify({"reply": cached["answer"]})

    # 4 — Ask Ollama
    ai_reply = ask_ollama(user_message)
    if ai_reply:
        print(f"[Ultron] Ollama: {ai_reply[:80]}...")
        return jsonify({"reply": ai_reply})

    # 5 — Ollama offline — ask user to teach
    print(f"[Ultron] Ollama unavailable. Asking user to teach.")
    return jsonify({
        "reply"   : (
            "I don't have an answer for that right now. "
            "If you know the answer, reply with:  TEACH: your answer  "
            "and I'll remember it for future reference."
        ),
        "unknown" : True,
        "question": user_message
    })


@app.route("/api/teach", methods=["POST", "OPTIONS"])
def teach():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    key = data.get("apiKey") or data.get("api_key", "")
    if key != API_KEY:
        return jsonify({"error": "Unauthorized"}), 403

    question = data.get("question", "").strip()
    answer   = data.get("answer", "").strip()

    if not question or not answer:
        return jsonify({"error": "Both 'question' and 'answer' are required"}), 400

    store_in_memory(question, answer)
    print(f"[Ultron] Learned: '{question}' → '{answer[:60]}'")
    return jsonify({"reply": "Understood. I've stored that in my memory for future reference."})


@app.route("/api/memory", methods=["GET"])
def view_memory():
    """Dev utility — view everything Ultron has learned."""
    key = request.args.get("apiKey", "")
    if key != API_KEY:
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(load_memory())


@app.route("/api/status", methods=["GET"])
def status():
    """Health check."""
    return jsonify({
        "status"        : "online",
        "model"         : OLLAMA_MODEL,
        "creator"       : CREATOR["name"],
        "memory_entries": len(load_memory())
    })


# ─── START ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "=" * 52)
    print("  ██╗   ██╗██╗  ████████╗██████╗  ██████╗ ███╗")
    print("  ██║   ██║██║  ╚══██╔══╝██╔══██╗██╔═══██╗████╗")
    print("  ██║   ██║██║     ██║   ██████╔╝██║   ██║██╔██╗")
    print("  ██║   ██║██║     ██║   ██╔══██╗██║   ██║██║╚██╗")
    print("  ╚██████╔╝███████╗██║   ██║  ██║╚██████╔╝██║ ╚█╗")
    print("   ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚")
    print("=" * 52)
    print(f"  Creator : Yash Datta Dalvi")
    print(f"  Server  : http://localhost:5056")
    print(f"  Model   : {OLLAMA_MODEL} via Ollama")
    print(f"  Memory  : {MEMORY_FILE}")
    print("=" * 52 + "\n")
    app.run(host="0.0.0.0", port=5056, debug=True)