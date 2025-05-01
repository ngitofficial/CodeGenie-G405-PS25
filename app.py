from flask import Flask,request,jsonify
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from tinydb import TinyDB, Query

app = Flask(__name__)

model_path = "deepseek-coder-1.3b-instruct"

tokenizer = AutoTokenizer.from_pretrained(model_path)
bnb_config = BitsAndBytesConfig(load_in_8bit=True)
model = AutoModelForCausalLM.from_pretrained (
    model_path,
    device_map = "auto",
    quantization_config = bnb_config
)

db = TinyDB("chat_history.json")
chat_table = db.table("chats")

@app.route("/delete/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    Chat = Query()
    chat_table.remove(Chat.chat_id == chat_id)
    return jsonify({"message": f"Chat '{chat_id}' deleted."})

@app.route("/append/<chat_id>", methods=["POST"])
def append_chat(chat_id):
    new_messages = request.json.get("messages", [])
    Chat = Query()
    current = chat_table.get(Chat.chat_id == chat_id)
    if current: 
        updated_messages = current["messages"] + new_messages
        chat_table.update({"messages": updated_messages}, Chat.chat_id == chat_id)
        return jsonify({"message": f"Messages appended to '{chat_id}'."})
    return jsonify({"error": f"Chat ID '{chat_id}' not found."}), 404

