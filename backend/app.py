from flask import Flask, request, jsonify, Response
from flask_restful import Api, Resource
from llama_cpp import Llama
from tinydb import TinyDB, Query
from datetime import datetime
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)
api = Api(app)

llm = Llama(
    model_path="deepseek-coder-1.3b-instruct.Q6_K.gguf",
    n_ctx=512,
    n_threads=6,
    n_gpu_layers=20
)
db = TinyDB("chat_history.json")
chat_table = db.table("chats")
Chat = Query()

for chat in chat_table.all():
    title = chat.get("title", "")
    messages = chat.get("messages", [])
    if (title == "New Chat" or title.startswith("Chat ")) and messages:
        chat_table.update({"title": messages[0]["user"]}, Chat.chat_id == chat["chat_id"])
        print(f"Updated chat {chat['chat_id']} title to: {messages[0]['user']}")

class ChatSource(Resource):
    def generate_code(self, prompt, chat_id):
        current = chat_table.get(Chat.chat_id == chat_id)
        model_prompt = ""
        if current and 'messages' in current and len(current['messages']) == 0:
            model_prompt += "You are an AI assistant. Always answer ONLY in English.\n"
        if current and 'messages' in current:
            for chat_pair in current['messages'][-3:]:
                model_prompt += f"<|user|>\n{chat_pair['user']}\n<|assistant|>\n{chat_pair['assistant']}\n"
        model_prompt +=f"<|user|>\n{prompt}\n<|assistant|>\n"
        try:
            output = llm(model_prompt, max_tokens=256,stop=["<|user|>"])
            assistant_reply = output['choices'][0]['text'].strip()
        except Exception as e:
            return [{"user": prompt, "assistant":f"Error: {str(e)}"}]
        if "<|user|>" in assistant_reply:
            assistant_reply = assistant_reply.split("<|user|>")[0].strip()
        return [{"user":prompt, "assistant": assistant_reply}]

    def stream_code(self, prompt, chat_id):
        current = chat_table.get(Chat.chat_id == chat_id)
        model_prompt = ""
        if current and 'messages' in current and len(current['messages']) == 0:
            model_prompt += "You are an AI assistant. Always answer ONLY in English.\n"
        if current and 'messages' in current:
            for chat_pair in current['messages'][-3:]:
                model_prompt += f"<|user|>\n{chat_pair['user']}\n<|assistant|>\n{chat_pair['assistant']}\n"
        model_prompt += f"<|user|>\n{prompt}\n<|assistant|>\n"
        try:
            buffer = ""
            last_yield = time.time()
            for chunk in llm(
                model_prompt,
                max_tokens=256,
                stop=["<|user|>"],
                stream=True
            ):
                text = chunk['choices'][0]['text']
                text = text.replace("<|user|>","").replace("<|assistant|>","")
                buffer +=text
                if(" "in buffer or "\n" in buffer or "." in buffer or len(buffer) > 10 or time.time() - last_yield > 0.1):
                    yield buffer
                    buffer = ""
                    last_yield = time.time()
            if buffer:
                yield buffer
        except Exception as e:
            yield f"\n[Error: {str(e)}]"

    def get(self, chat_id):
        conversation = chat_table.get(Chat.chat_id == chat_id)
        if conversation and "messages" in conversation:
            return conversation["messages"]
        return {"error": f"CHAT ID '{chat_id}' not found or no messages."}, 400
    
    def post(self, chat_id):
        data = request.get_json() or {}
        prompt = data.get('prompt', '').strip() if 'prompt' in data else None
        title = data.get('title', 'New Chat')

        chat = chat_table.get(Chat.chat_id == chat_id)
        if not chat:
            chat_table.insert({
                "chat_id": chat_id,
                "title": title,
                "messages": []
            })
            if not prompt:
                return {"message": "Chat created successfully."}, 201

        if prompt:
            return Response(self.stream_code(prompt, chat_id), mimetype='text/plain')
        else:
            return {"error": "Prompt is empty"}, 400
    
    def delete(self, chat_id):
        chat_table.remove(Chat.chat_id == chat_id)
        return chat_table.all()
    
    def patch(self, chat_id):
        data = request.get_json()
        title = data.get("title")
        user = data.get("user")
        assistant = data.get("assistant")
        updated = False

        if title:
            chat_table.update({"title": title}, Chat.chat_id == chat_id)
            updated = True

        if user is not None and assistant is not None:
            chat = chat_table.get(Chat.chat_id == chat_id)
            if chat:
                messages = chat.get("messages", [])
                messages.append({"user": user, "assistant": assistant})
                if chat.get("title", "") == "New Chat" and len(messages) >= 1:
                    chat_table.update({"messages": messages, "title": messages[0]["user"]}, Chat.chat_id == chat_id)
                else:
                    chat_table.update({"messages": messages}, Chat.chat_id == chat_id)
                updated = True

        if updated:
            return {"message": "Update successful."}
        return {"error": "Nothing to update."}, 400

    
    
api.add_resource(ChatSource, "/chatsource/<int:chat_id>")


class ListAllChats(Resource):
    def get(self):
        all_chats = chat_table.all()
        if all_chats:
            return all_chats
        return {"error": "No chats found."}, 400

api.add_resource(ListAllChats, "/list-all-chats")


class GetConversationHistory(Resource):
    def get(self, chat_id):
        conversation = chat_table.get(Chat.chat_id == chat_id)
        if conversation and "messages" in conversation:
            return conversation["messages"]
        return {"error": "No history found for this chat."}, 404

api.add_resource(GetConversationHistory, "/conversation-history/<int:chat_id>")

@app.route('/autocomplete', methods=['POST'])
def autocomplete():
    data = request.get_json()
    prompt = data.get('prompt', '')
    line_prefix = data.get('linePrefix', '')
    model_prompt = f"{prompt}\n{line_prefix}"
    print("=== Autocomplete called ===")
    print("Prompt sent to model:")
    print(repr(model_prompt))
    try:
        output = llm(model_prompt, max_tokens=16) 
        print("Raw model output:", output)
        suggestion = output['choices'][0]['text'].strip()
        suggestion = suggestion.split('\n')[0]
        print("Suggestion returned:", suggestion)
        return jsonify([suggestion])
    except Exception as e:
        print("Autocomplete error:", e)
        return jsonify([]), 500

if __name__ == "__main__":
    app.run(debug=True)
