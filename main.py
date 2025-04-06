import os
import re
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, Field, root_validator
from passlib.context import CryptContext
from pymongo import MongoClient
import jwt
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import List, Optional

# Load environment variables
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
MONGO_URI = os.getenv("MONGO_URI")

# Setup FastAPI
app = FastAPI()

# OAuth2PasswordBearer is used to extract the token from requests
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# MongoDB Client
client = MongoClient(MONGO_URI)
db = client['yourdb']  # Use your database
users_collection = db['users']  # Users collection
courses_collection = db['courses']  # Courses collection

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Helper functions for password hashing and verification
def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

# Token validation
def create_access_token(data: dict, expires_delta: timedelta = timedelta(hours=1)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt


# Password complexity check function
def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")
    return True


# Models
class User(BaseModel):
    username: str = Field(..., min_length=4, max_length=50)  # Non-empty username
    email: str  # Valid email format
    password: str = Field(..., min_length=8)  # Password must be at least 8 characters long
    role: str = 'user'  # Default role as user

    # Custom Validators
    @root_validator(pre=True)
    def check_username_and_email(cls, values):
        username = values.get('username')
        email = values.get('email')

        # Handle empty username
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty.")

        # Handle empty email
        if not email:
            raise HTTPException(status_code=400, detail="Email cannot be empty.")

        # Manually check for @ in email
        if '@' not in email:
            raise HTTPException(status_code=400, detail="Email must contain '@' symbol.")

        return values

    @root_validator(pre=True)
    def check_password_complexity(cls, values):
        password = values.get('password')
        
        # Check password length manually
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
        
        try:
            validate_password(password)
        except HTTPException as e:
            raise e  # Raise the HTTPException with the custom message
        
        return values


# LoginRequest model
class LoginRequest(BaseModel):
    email: str
    password: str


# Token validation middleware
def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


# Routes
@app.post("/signup")
async def signup(user: User):
    # Check if email is already registered
    if users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash the password
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict['password'] = hashed_password
    users_collection.insert_one(user_dict)

    return {"msg": "User registered successfully"}


@app.post("/login")
async def login(request: LoginRequest):
    db_user = users_collection.find_one({"email": request.email})
    if not db_user or not verify_password(request.password, db_user['password']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": db_user['username']})
    return {"access_token": access_token, "token_type": "bearer"}


# Course Model (to define the course data structure)
class Course(BaseModel):
    title: str
    description: str
    difficulty: str
    rating: int
    price: float




@app.get("/courses", response_model=List[Course])
async def get_courses(
    difficulty: Optional[str] = None,
    rating: Optional[str] = None
):
   

    valid_difficulties = ["beginner", "busy professional", "gym enthusiast"]

    
    if difficulty:
        if difficulty not in valid_difficulties:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid difficulty value"
            )

 
    parsed_rating = None
    if rating is not None:  # user provided ?rating=...
        try:
            parsed_rating = int(rating)
        except ValueError:
            # If user passed a non-numeric for rating
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rating must be a number"
            )
        
        # Ensure rating is between 1 and 5
        if parsed_rating < 1 or parsed_rating > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rating must be between 1 and 5"
            )

    
    query = {}

    if difficulty:
        query["difficulty"] = difficulty

    if parsed_rating is not None:
        query["rating"] = parsed_rating

    
    courses = list(courses_collection.find(query))

    if not courses:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No courses found for the given filter"
        )

    return courses
