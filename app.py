from flask import Flask, request, jsonify
from flask_restful import Api, Resource, reqparse
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from tinydb import TinyDB, Query
import json

app = Flask(__name__)
api = Api(app)
model_path = "deepseek-coder-1.3b-instruct"

tokenizer = AutoTokenizer.from_pretrained(model_path)
# bnb_config = BitsAndBytesConfig(load_in_8bit=True)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    device_map = "auto",
)
db = TinyDB("chat_history.json")
chat_table = db.table("chats")

class ChatSource(Resource):
    def generate_code(self, prompt):
        model_prompt = f"<|user|>\n{prompt}\n|assistant|>\n"
        inputs = tokenizer(model_prompt, return_tensors="pt").to(model.device)
        outputs = model.generate(**inputs, max_new_tokens=10000)
        output = tokenizer.decode(outputs[0], skip_special_tokens=True)
        chat = {"user": prompt,
                "assistant": output.replace(f"<|user|>\n{prompt}\n|assistant|>\n\n", " ")}
        message = [json.dumps(chat, sort_keys=False)]
        return message

    def put(self,chat_id):
        data = request.get_json()
        message = self.generate_code(data['prompt'])
        result_json = {"chat_id": chat_id, "messages": message}
        db.insert(result_json)
        return jsonify(db.all())

    def delete(self, chat_id):
        Chat = Query()
        chat_table.remove(Chat.chat_id == chat_id)
        return jsonify(db.all())

    def post(self, chat_id):
        data = request.get_json()
        new_message = self.generate_code(data['prompt'])
        Chat = Query()
        exists = db.contains(Chat.chat_id == chat_id)
        if exists:
            current = db.get(Chat.chat_id == chat_id)  # Ensure correct query field
            if current:  # Check if current is not None
                updated_messages = current["messages"] + [new_message]  # Use list concatenation
                db.update({"messages": updated_messages}, Chat.chat_id == chat_id)
                return jsonify(db.all())
            else:
                return jsonify({"error": f"Chat ID '{chat_id}' exists but no data found."}), 404


api.add_resource(ChatSource, "/chatsource/<int:chat_id>")

class ListAllChats(Resource):
    def get(self):
        all_chats = db.all()
        if all_chats:
            return jsonify(all_chats)
        return jsonify({"error": "No chats found."}), 404

api.add_resource(ListAllChats, "/list-all-chats")

class GetConversationHistory(Resource):
    def get(self, chat_id):
        chat = Query()
        conversation = db.get(chat.chat_id == chat_id)
        if conversation:
            return jsonify(conversation["messages"])
        return jsonify({"error": f"CHAT ID '{chat_id}' not found."}), 404

api.add_resource(GetConversationHistory, '/conversation-history/<int:chat_id>')


if __name__ == "__main__":
    app.run(debug=True)
