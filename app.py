from flask import Flask, jsonify
from tinydb import TinyDB, Query

app = Flask(__name__)
db = TinyDB('chat_history.json')

@app.route('/list-all-chats', methods = ['GET'])
def list_all_chats():
    all_chats = db.all()
    if all_chats:
        return jsonify(all_chats) 
    return jsonify({"error": "No chats found."}), 404
    


@app.route('/get_conversation_history/<chat_id>', methods = ['GET'])
def get_conversation_history(chat_id):
    chat = Query()
    conversation = db.get(chat.chat_id == chat_id) 
    if conversation:
        return jsonify(conversation["messages"])
    return jsonify({"error": f"Chat ID '{chat_id}' not found."}), 404
    
