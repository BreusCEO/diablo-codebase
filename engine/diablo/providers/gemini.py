import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

def create_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing")
    return genai.Client(api_key=api_key)

def ask_gemini(question):
    create_client()
    os.getenv("GEMINI_MODEL", "gemini-3.1-pro")
    client.models.generate_content()
