import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv('backend/.env')
client = OpenAI(
    api_key=os.environ['GEMINI_API_KEY'],
    base_url='https://generativelanguage.googleapis.com/v1beta/openai/'
)

res = client.chat.completions.create(
    model='gemini-3.5-flash',
    max_tokens=120,
    messages=[
        {
            'role': 'user',
            'content': "You are an English-to-Polish translator.\nTranslate the word 'apple' based on its context sentence.\nSentence: \"I ate an apple\"\n\nRules:\n1. Line 1: Provide the BASE dictionary form (infinitive, nominative, etc.) of the Polish translation of the word 'apple' in this context, followed by 2-3 other common Polish synonyms separated by commas.\n2. Line 2: Natural Polish translation of the entire sentence.\nRespond ONLY with these 2 lines, without prefixes or labels."
        }
    ]
)
print(repr(res.choices[0].message.content))
