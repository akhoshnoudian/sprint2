import os
import re
import logging
import shutil
from fastapi import FastAPI, Depends, HTTPException, status, Query, Request, File, UploadFile, Form
from tempfile import NamedTemporaryFile
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, model_validator
from passlib.context import CryptContext
from pymongo import MongoClient
import jwt
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
# If no MONGO_URI is set, use a default one
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://shashank8can:vGmtipNL3W4jdlXJ@cluster0.kvt4m.mongodb.net/")

# Setup FastAPI
app = FastAPI()

# MongoDB Client
client = MongoClient(MONGO_URI)
db = client['yourdb']  # Use your database
users_collection = db['users']  # Users collection
courses_collection = db['courses']  # Courses collection

# @app.on_event("startup")
# async def startup_event():
#     # Add sample courses if none exist
#     sample_courses = [
#         {
#             "title": "Beginner Yoga",
#             "description": "Perfect for those new to yoga",
#             "difficulty": "beginner",
#             "rating": 5,
#             "price": 29.99
#         },
#         {
#             "title": "Advanced HIIT",
#             "description": "High-intensity interval training for experienced athletes",
#             "difficulty": "advanced",
#             "rating": 4,
#             "price": 49.99
#         }
#     ]

#     # Insert sample courses if collection is empty
#     if courses_collection.count_documents({}) == 0:
#         courses_collection.insert_many(sample_courses)
#         logger.info("Added sample courses to database")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {request.headers}")
    
    # Only try to decode the body for non-multipart requests
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        try:
            body = await request.body()
            if body:
                logger.info(f"Body: {body.decode()}")
        except Exception as e:
            logger.error(f"Error reading body: {e}")

    response = await call_next(request)
    return response

# CORS and Cache Control headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, Content-Length, Cache-Control, Pragma, Expires",
    "Access-Control-Allow-Credentials": "true",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
}

# OAuth2PasswordBearer is used to extract the token from requests
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Helper functions for password hashing and verification
def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

# Token validation
def create_access_token(data: dict, expires_delta: timedelta = timedelta(days=7)):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    logger.info(f"Creating token with expiry: {expire} UTC")
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
    role: str = Field(default='user', pattern='^(user|instructor)$')  # Default role as user

    # Custom Validators
    @model_validator(mode='before')
    def check_username_and_email(cls, values) -> dict:
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

    @model_validator(mode='before')
    def check_password_complexity(cls, values) -> dict:
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
        logger.info(f"Validating token: {token[:20]}...")
        logger.info(f"Using SECRET_KEY: {SECRET_KEY[:5]}...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        logger.info(f"Token payload: {payload}")
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return username
    except jwt.ExpiredSignatureError:
        logger.error("Token validation failed: Token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError as e:
        logger.error(f"Token validation failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Could not validate credentials: {str(e)}")


# Routes
from fastapi.logger import logger
import traceback

@app.options("/signup")
async def signup_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.post("/signup")
async def signup(user: User):
    response = JSONResponse
    try:
        # Log the incoming request
        logger.info(f"Signup request received for email: {user.email}")

        # Check if email is already registered
        if users_collection.find_one({"email": user.email}):
            logger.warning(f"Email already registered: {user.email}")
            raise HTTPException(status_code=400, detail="Email already registered")

        # Hash the password
        hashed_password = get_password_hash(user.password)
        
        # Create user document
        user_doc = {
            "username": user.username,
            "email": user.email,
            "password": hashed_password,
            "role": user.role,
            "balance": user.balance,
            "purchased_courses": user.purchased_courses  # List of purchased course IDs
        }
        
        # Insert the user
        result = users_collection.insert_one(user_doc)
        logger.info(f"User created with ID: {result.inserted_id}")
        
        # Generate token for auto-login
        access_token = create_access_token(data={"sub": user.username, "role": user.role})
        
        response = JSONResponse(
            content={"msg": "User registered successfully", "token": access_token},
            headers=CORS_HEADERS
        )
        return response
    except HTTPException as he:
        logger.error(f"HTTP Exception in signup: {str(he)}")
        return JSONResponse(
            status_code=he.status_code,
            content={"detail": he.detail},
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error in signup: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=400,
            content={"detail": f"Error during signup: {str(e)}"},
            headers=CORS_HEADERS
        )


@app.options("/login")
async def login_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.post("/login")
async def login(request: LoginRequest):
    try:
        # Verify the user exists and password is correct
        user = users_collection.find_one({"email": request.email})
        if not user or not verify_password(request.password, user["password"]):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid email or password"},
                headers=CORS_HEADERS
            )

        # Generate JWT token
        access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
        return JSONResponse(
            content={"token": access_token},
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )


# Course Model (to define the course data structure)
from urllib.parse import quote

class Course(BaseModel):
    title: str
    description: str
    difficulty: str
    rating: int
    price: float
    
    def get_avatar_url(self) -> str:
        # URL encode the title for use in the avatar URL
        encoded_title = quote(self.title)
        return f"https://avatars.dicebear.com/api/initials/{encoded_title}.svg?background=%230066ff"



@app.options("/courses")
async def courses_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.get("/courses")
async def get_courses(
    difficulty: Optional[str] = None,
    rating: Optional[str] = None
):
    try:
        # Fetch all courses first
        courses = list(courses_collection.find())
        logger.info(f"Found {len(courses)} courses in database")
        
        # Format each course
        formatted_courses = []
        for course in courses:
            # Convert ObjectId to string
            course["_id"] = str(course["_id"])
            
            # Add avatar URL
            first_letter = course["title"][0].upper()
            course["imageUrl"] = f"https://ui-avatars.com/api/?name={first_letter}&background=random&color=fff&size=128&rounded=true"
            
            # Convert datetime to string if needed
            if "created_at" in course:
                course["created_at"] = course["created_at"] if isinstance(course["created_at"], str) else course["created_at"].isoformat()
            
            formatted_courses.append(course)
            logger.info(f"Formatted course: {course}")
        
        # Apply filters if provided
        if difficulty:
            formatted_courses = [c for c in formatted_courses if c.get("difficulty") == difficulty]
        
        if rating:
            try:
                parsed_rating = float(rating)
                if 0 <= parsed_rating <= 5:
                    formatted_courses = [c for c in formatted_courses if c.get("ratings", 0) >= parsed_rating]
            except ValueError:
                pass
        
        logger.info(f"Returning {len(formatted_courses)} courses after filtering")
        return JSONResponse(
            content=formatted_courses,
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error fetching courses: {str(e)}")
        return JSONResponse(
            content=[],
            headers=CORS_HEADERS
        )

class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=10)
    difficulty: str = Field(..., pattern="^(beginner|intermediate|advanced)$")
    price: float = Field(..., ge=0)
    ratings: float = Field(..., ge=0, le=5)
    video_urls: List[str] = Field(..., min_items=1)

    @model_validator(mode='after')
    def validate_video_urls(self) -> 'CourseCreate':
        if not self.video_urls:
            raise ValueError('At least one video URL is required')
        
        # Check if URLs are from Cloudinary
        for url in self.video_urls:
            if not url.startswith('https://res.cloudinary.com/'):
                raise ValueError(f'Invalid video URL: {url}. Must be a Cloudinary URL')
        return self

# Video upload endpoint
@app.options("/upload-video")
async def upload_video_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

import cloudinary
import cloudinary.uploader

# Configure Cloudinary
cloud_name = os.getenv("CLOUDINARY_NAME")
api_key = os.getenv("CLOUDINARY_KEY")
api_secret = os.getenv("CLOUDINARY_SECRET")

logger.info(f"Cloudinary Configuration:")
logger.info(f"Cloud Name: {cloud_name}")
logger.info(f"API Key: {api_key}")
logger.info(f"API Secret: {'*' * len(api_secret) if api_secret else 'Not set'}")

cloudinary.config(
    cloud_name=cloud_name,
    api_key=api_key,
    api_secret=api_secret
)

@app.post("/upload-video")
async def upload_video(
    file: UploadFile = File(...)
):
    try:
        # Create a temporary file to store the upload
        with NamedTemporaryFile(delete=False) as temp_file:
            # Copy content from uploaded file to temp file
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        # Verify Cloudinary configuration
        current_config = cloudinary.config()
        logger.info("Current Cloudinary Configuration:")
        logger.info(f"Cloud Name: {current_config.cloud_name}")
        logger.info(f"API Key: {current_config.api_key}")
        
        if not current_config.cloud_name or not current_config.api_key or not current_config.api_secret:
            raise ValueError("Cloudinary configuration is incomplete. Please check environment variables.")

        # Upload to Cloudinary
        logger.info(f"Attempting to upload file: {file.filename} to Cloudinary")
        try:
            result = cloudinary.uploader.upload(
                temp_file_path,
                resource_type="video",
                folder="course_videos",
                public_id=f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
            )
            logger.info(f"Cloudinary upload successful. Result: {result}")
            
            if 'secure_url' not in result:
                raise ValueError(f"Upload succeeded but no secure_url in response: {result}")
                
            if 'demo' in result['secure_url']:
                raise ValueError(f"Upload returned a demo URL. Check Cloudinary configuration.")
        except Exception as upload_error:
            logger.error(f"Cloudinary upload failed: {str(upload_error)}")
            raise upload_error

        # Clean up the temporary file
        os.unlink(temp_file_path)

        # Get the secure URL from Cloudinary
        video_url = result['secure_url']
        logger.info(f"Video URL from Cloudinary: {video_url}")
        
        # Return the actual Cloudinary URL
        logger.info(f"Returning Cloudinary URL: {video_url}")
        return JSONResponse(
            content={
                "message": "Video uploaded successfully",
                "video_url": video_url,
                "title": file.filename
            },
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error uploading video: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Error uploading video: {str(e)}"},
            headers=CORS_HEADERS
        )

# Course creation endpoint
@app.options("/create-course")
async def create_course_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.post("/create-course")
async def create_course(
    course: CourseCreate,
    current_user: str = Depends(get_current_user)
):
    logger.info("Received course creation request")
    logger.info(f"Course data: {course}")
    logger.info(f"Video URLs: {course.video_urls}")
    try:
        # Get user details to check role
        user = users_collection.find_one({"username": current_user})
        if not user or user.get("role") != "instructor":
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Only instructors can create courses"},
                headers=CORS_HEADERS
            )

        course_dict = course.dict()
        course_dict["instructor"] = current_user
        course_dict["created_at"] = datetime.utcnow().isoformat()
        
        # Insert into database
        result = courses_collection.insert_one(course_dict)
        course_dict["_id"] = str(result.inserted_id)
        
        return JSONResponse(
            content={
                "message": "Course created successfully",
                "course": course_dict
            },
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error creating course: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to create course"},
            headers=CORS_HEADERS
        )

@app.get("/version-check")
async def version_check():
    return JSONResponse(
        content={
            "version": "new-version-with-timestamp",
            "time": datetime.utcnow().isoformat()
        },
        headers=CORS_HEADERS
    )

@app.options("/courses")
async def courses_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.get("/courses")
async def list_courses():
    try:
        # Get all courses from the database
        courses = list(courses_collection.find())
        # Convert ObjectId to string for JSON serialization
        for course in courses:
            course["_id"] = str(course["_id"])
        return JSONResponse(content=courses, headers=CORS_HEADERS)
    except Exception as e:
        logger.error(f"Error listing courses: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.options("/courses/{course_id}")
async def course_detail_options(course_id: str):
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.options("/courses/{course_id}")
async def course_detail_options(course_id: str):
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.get("/courses/{course_id}")
async def get_course(course_id: str):
    try:
        logger.info(f"Fetching course with ID: {course_id}")
        # Convert string ID to ObjectId
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if course:
            # Convert ObjectId to string for JSON serialization
            course["_id"] = str(course["_id"])
            logger.info(f"Found course: {course}")
            return JSONResponse(content=course, headers=CORS_HEADERS)
        logger.warning(f"Course not found with ID: {course_id}")
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Course not found"},
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error getting course: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.options("/courses/{course_id}/purchase")
async def purchase_course_options(course_id: str):
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.post("/courses/{course_id}/purchase")
async def purchase_course(course_id: str, current_user: str = Depends(get_current_user)):
    try:
        logger.info(f"Purchase request received for course {course_id} by user {current_user}")
        # Get course details
        logger.info(f"Fetching course details for {course_id}")
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if not course:
            logger.warning(f"Course {course_id} not found")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Course not found"},
                headers=CORS_HEADERS
            )

        # Get user details
        logger.info(f"Fetching user details for {current_user}")
        user = users_collection.find_one({"username": current_user})
        logger.info(f"User data: {user}")
        if not user:
            logger.warning(f"User {current_user} not found")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "User not found"},
                headers=CORS_HEADERS
            )

        # Check if course is already purchased
        purchased_courses = user.get("purchased_courses", [])
        logger.info(f"User's purchased courses: {purchased_courses}")
        if any(str(course_id) == str(pc) for pc in purchased_courses):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Course already purchased"},
                headers=CORS_HEADERS
            )

        # Get course details for the receipt
        course_price = course.get("price", 0)
        course_title = course.get("title", "Unknown Course")
        
        # Add course to user's purchased courses
        purchased_courses = user.get("purchased_courses", [])
        purchased_courses.append(str(course_id))  # Convert to string before storing

        # Add purchase record
        purchase_record = {
            "course_id": str(course_id),
            "course_title": course_title,
            "price": course_price,
            "purchase_date": datetime.utcnow()
        }
        
        purchase_history = user.get("purchase_history", [])
        purchase_history.append(purchase_record)

        try:
            users_collection.update_one(
                {"username": current_user},
                {
                    "$set": {
                        "purchased_courses": purchased_courses,
                        "purchase_history": purchase_history
                    }
                }
            )
            logger.info(f"Course {course_id} added to user {current_user}'s purchased courses")
        except Exception as e:
            logger.error(f"Error updating user: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Failed to update user"},
                headers=CORS_HEADERS
            )

        return JSONResponse(
            content={
                "message": "Course purchased successfully",
                "course_title": course_title,
                "purchase_date": purchase_record["purchase_date"].isoformat(),
                "price": course_price
            },
            headers=CORS_HEADERS
        )

    except Exception as e:
        logger.error(f"Error purchasing course: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.options("/users/me")
async def users_me_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def serialize_user(user):
    # Convert ObjectId to string
    user["_id"] = str(user["_id"])
    
    # Remove sensitive information
    user.pop("password", None)
    
    # Convert datetime objects in purchase history
    if "purchase_history" in user:
        for purchase in user["purchase_history"]:
            if "purchase_date" in purchase:
                purchase["purchase_date"] = serialize_datetime(purchase["purchase_date"])
    
    return user

@app.get("/users/me")
async def get_current_user_info(current_user: str = Depends(get_current_user)):
    try:
        user = users_collection.find_one({"username": current_user})
        if user:
            serialized_user = serialize_user(user)
            return JSONResponse(content=serialized_user, headers=CORS_HEADERS)
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "User not found"},
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error getting user info: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.get("/test-endpoints")
async def test_endpoints():
    return {
        "message": "API is working",
        "available_endpoints": [
            "/upload-video",
            "/create-course",
            "/courses",
            "/courses/{course_id}",
            "/signup",
            "/login"
        ]
    }