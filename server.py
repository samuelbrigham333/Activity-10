from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient

# --- MongoDB connection ---
uri = "mongodb+srv://samuelbrigham333_db_user:<m8oJqhCJK4DoR3Di>@cluster0.23z2sn7.mongodb.net/"

client = MongoClient(uri)
db = client["cs3720db"]
collection = db["robots"]

# --- FastAPI app setup ---
app = FastAPI()

# --- CORS setup ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic model ---
class Robot(BaseModel):
    name: str
    price: float
    description: str
    imageUrl: str

# --- Root endpoint ---
@app.get("/hello")
def read_root():
    return {
        "message": "Hello from FastAPI + MongoDB Atlas backend!"
    }

# --- Get all robots ---
@app.get("/robots")
def get_robots():
    robots = list(collection.find())

    for r in robots:
        r["_id"] = str(r["_id"])

    return robots