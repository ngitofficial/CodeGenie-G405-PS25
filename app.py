from flask import Flask, request, jsonify
from flask_restful import Api, Resource
from transformers import AutoModelForCausalLM, AutoTokenizer
from tinydb import TinyDB, Query
from datetime import datetime
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
api = Api(app)
model_path = "deepseek-coder-1.3b-instruct"

tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    device_map = "auto",
)
db = TinyDB("chat_history.json")
chat_table = db.table("chats")
Chat = Query()

class ChatSource(Resource):
    def generate_code(self, prompt, chat_id):
        current = chat_table.get(Chat.chat_id == chat_id)
        model_prompt = ""
        if current and 'messages' in current:
            messages = current['messages']
            for chat_pair in messages:

                prev_prompt = chat_pair['user']
                prev_response = chat_pair['assistant']
                model_prompt += f"### Instruction:\n{prev_prompt}\n### Response:\n{prev_response}\n<|EOT|>\n"
        model_prompt += f"### Instruction:\n{prompt}\n### Response\n"
        inputs = tokenizer(model_prompt, return_tensors="pt").to(model.device)
        outputs = model.generate(**inputs, max_new_tokens=250)
        assistant_reply = tokenizer.decode(outputs[0], skip_special_tokens=True)
        assistant_reply = assistant_reply.split("<|assistant|>")[-1].strip()
        if "<|user|>" in assistant_reply:
            assistant_reply = assistant_reply.split("<|user|>")[0].strip()
        if not isinstance(assistant_reply, str):
            assistant_reply = str(assistant_reply)
        chat = {"user": prompt, "assistant": assistant_reply}
        messages = [chat]
        return messages
        
        

    def get(self, chat_id):
        conversation = chat_table.get(Chat.chat_id == chat_id)
        if conversation:
            return conversation["messages"]
        return {"error": f"CHAT ID '{chat_id}' not found."}, 400
    
    def post(self, chat_id):

        data = request.get_json()
        prompt = data['prompt']
        if (not prompt):
            return {"error": f"invalid prompt"}, 400
    
        
        #create new chat session or update existing only if there is valid prompt
        new_message = self.generate_code(prompt, chat_id)
        current_date = str(datetime.now().date())

        # if chat exists append new message pair to the messages list
        status = "old"
        if chat_table.contains(Chat.chat_id == chat_id):
            current = chat_table.get(Chat.chat_id == chat_id) 
            chat_table.update({"date": current_date}, Chat.chat_id == chat_id)
            updated_messages = current["messages"]+new_message
            chat_table.update({"messages": updated_messages}, Chat.chat_id == chat_id)

        #else create a new chat object and insert
        else:
            status = "new"
            result_json = {
            "chat_id": chat_id,
            "date": current_date,
            "title": prompt,
            "messages": new_message
            }
            chat_table.insert(result_json)
        
        response = chat_table.get(Chat.chat_id == chat_id)
        response.update({"status" : status})

        return response
    
    def delete(self, chat_id):
        chat_table.remove(Chat.chat_id == chat_id)
        return chat_table.all()
    
    def patch(self, chat_id):
        data = request.get_json()
        title = data["title"]
        if title:
            chat_table.update({"title":title}, Chat.chat_id==chat_id)
            return {"message" : "Title updated successfully"}, 200
        return {"error":"Title is empty"}, 400

    
    
api.add_resource(ChatSource, "/chatsource/<int:chat_id>")


class ListAllChats(Resource):
    def get(self):
        all_chats = chat_table.all()
        if all_chats:
            return all_chats
        return {"error": "No chats found."}, 400

api.add_resource(ListAllChats, "/list-all-chats")



if __name__ == "__main__":
    app.run(debug=True)

