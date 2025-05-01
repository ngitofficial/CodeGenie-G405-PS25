import requests
BASE = 'http://127.0.0.1:5000/'

response = requests.post(BASE + "chatsource/1",json={"prompt": "Write a Python code to print reverse of a string."})
print(response.json())