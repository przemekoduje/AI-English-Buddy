import os
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv('backend/.env')
client = OpenAI(api_key=os.environ['GEMINI_API_KEY'], base_url='https://generativelanguage.googleapis.com/v1beta/openai/')
res = client.chat.completions.create(model='gemini-3.5-flash', max_tokens=120, messages=[{'role': 'user', 'content': 'Translate apple to Polish'}])
print(repr(res.choices[0].message.content))
