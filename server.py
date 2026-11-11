import logging
import os

from fastapi import FastAPI, HTTPException, Path, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

logger = logging.getLogger(__name__)

uri = "mongodb+srv://samuelbrigham333_db_user:m8oJqhCJK4DoR3Di@cluster0.23z2sn7.mongodb.net/"
if not uri:
    raise RuntimeError("Set the MONGODB_URI environment variable before starting the server")

client = MongoClient(uri, serverSelectionTimeoutMS=5000)
db = client["cs3720db2"]
collection = db["robots"]

try:
    client.admin.command("ping")
    print("MongoDB Atlas connection successful")
except PyMongoError as exc:
    print(f"MongoDB ping failed: {type(exc).__name__}: {exc}")
    raise

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Robot(BaseModel):
    name: str
    price: float
    description: str
    imageUrl: str


class RobotValidated(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1)
    price: float = Field(ge=0, allow_inf_nan=False)
    description: str = Field(min_length=1)
    imageUrl: HttpUrl


@app.get("/hello")
def read_root():
    return {"message": "Hello from FastAPI + MongoDB Atlas backend!"}


@app.get("/robots")
def get_robots():
    try:
        if "robots" not in db.list_collection_names():
            raise HTTPException(status_code=404, detail="Collection 'robots' not found")

        robots = list(collection.find())
        for robot in robots:
            robot["_id"] = str(robot["_id"])

        return robots
    except HTTPException:
        raise
    except PyMongoError:
        logger.exception("Database operation failed while retrieving robots")
        raise HTTPException(status_code=503, detail="Database not reachable")
    except Exception:
        logger.exception("Unexpected error while retrieving robots")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/robots", status_code=status.HTTP_201_CREATED)
def add_robot(robot: Robot):
    try:
        if "robots" not in db.list_collection_names():
            raise HTTPException(status_code=404, detail="Collection 'robots' not found")

        if collection.find_one({"name": robot.name}):
            raise HTTPException(status_code=409, detail="Robot already exists")

        result = collection.insert_one(robot.model_dump())
        return {"message": "Robot added successfully", "id": str(result.inserted_id)}
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Robot already exists")
    except PyMongoError:
        logger.exception("Database operation failed while adding a robot")
        raise HTTPException(status_code=503, detail="Database not reachable")
    except Exception:
        logger.exception("Unexpected error while adding a robot")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.put("/robots/{name}")
def update_robot_with_errors(
    robot: RobotValidated,
    name: str = Path(..., min_length=1),
):
    try:
        if not name.strip():
            raise HTTPException(status_code=422, detail="Robot name cannot be blank")

        if "robots" not in db.list_collection_names():
            raise HTTPException(status_code=404, detail="Collection 'robots' not found")

        existing_robot = collection.find_one({"name": name})
        if existing_robot is None:
            raise HTTPException(status_code=404, detail=f"Robot '{name}' not found")

        duplicate = collection.find_one(
            {
                "name": robot.name,
                "_id": {"$ne": existing_robot["_id"]},
            }
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=409,
                detail="Another robot already has that name",
            )

        updated_data = robot.model_dump(mode="json")
        result = collection.update_one(
            {"_id": existing_robot["_id"]},
            {"$set": updated_data},
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Robot no longer exists")

        if result.modified_count == 0:
            return {
                "message": "No changes needed; robot already has these values",
                "id": str(existing_robot["_id"]),
            }

        return {
            "message": "Robot updated successfully",
            "id": str(existing_robot["_id"]),
        }
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Another robot already has that name",
        )
    except PyMongoError:
        logger.exception("Database operation failed while updating a robot")
        raise HTTPException(status_code=503, detail="Database operation failed")
    except Exception:
        logger.exception("Unexpected error while updating a robot")
        raise HTTPException(status_code=500, detail="Internal server error")