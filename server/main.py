import os
import re
import json
import logging
import shutil
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, status, Query, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from bson import ObjectId

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Client
client = MongoClient(MONGO_URI)
db = client['yourdb']  # Use your database
users_collection = db['users']  # Users collection
courses_collection = db['courses']  # Courses collection
reviews_collection = db['reviews']  # Reviews collection

# @app.on_event("startup")
# async def startup_event():
#        # Return mock courses with updated instructor format
mock_courses = [
    {
        "_id": "1",
        "title": "Introduction to Python",
        "description": "Learn Python programming from scratch",
        "instructor": {
            "username": "John Doe",
            "isVerified": True
        },
        "level": "Beginner",
        "rating": 4.5,
        "price": 49.99,
        "thumbnail": "https://example.com/python.jpg",
        "duration": "6 weeks"
    },
    {
        "_id": "2",
        "title": "Web Development with React",
        "description": "Master React.js and build modern web apps",
        "instructor": {
            "username": "Jane Smith",
            "isVerified": False
        },
        "level": "Intermediate",
        "rating": 4.8,
        "price": 79.99,
        "thumbnail": "https://example.com/react.jpg",
        "duration": "8 weeks"
    }
]

# Insert sample courses if collection is empty
if courses_collection.count_documents({}) == 0:
    courses_collection.insert_many(mock_courses)
    logger.info("Added sample courses to database")

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
    """Get current user from token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return username

def get_admin_user(token: str = Depends(oauth2_scheme)):
    """Check if user is admin"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username != "sample":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resource",
                headers=CORS_HEADERS
            )
    except JWTError:
        raise credentials_exception
    return username
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
        
        # Create user document with default values
        user_doc = {
            "username": user.username,
            "email": user.email,
            "password": hashed_password,
            "role": user.role,
            "balance": 0,  # Default balance
            "purchased_courses": []  # Default empty list
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

# Admin endpoints
@app.options("/admin/instructors")
async def admin_instructors_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

class AdminLoginRequest(BaseModel):
    username: str
    password: str

@app.post("/admin/login")
async def admin_login(request: AdminLoginRequest):
    try:
        # Check hardcoded admin credentials
        if request.username == "sample" and request.password == "123":
            # Create admin token
            token = create_access_token(data={"sub": "admin", "role": "admin"})
            return JSONResponse(
                content={"token": token},
                headers=CORS_HEADERS
            )
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    except Exception as e:
        logger.error(f"Error in admin login: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.get("/admin/instructors")
async def get_instructors(request: Request):
    try:
        # Get auth token from header
        token = request.headers.get('authorization', '')
        if not token.startswith('Bearer ') or token.split()[1] != 'admin-token-123':
            raise HTTPException(status_code=403, detail="Admin access required")

        # Get instructors from database with consistent field name
        instructors = list(users_collection.find(
            {"role": "instructor"},
            {"_id": 1, "username": 1, "email": 1, "role": 1, "isVerified": 1}
        ))
        
        # Use custom encoder to handle datetime and ObjectId
        content = json.loads(json.dumps(instructors, cls=CustomJSONEncoder))
        return JSONResponse(content=content, headers=CORS_HEADERS)
    except Exception as e:
        logger.error(f"Error getting instructors: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to get instructors"},
            headers=CORS_HEADERS
        )

@app.options("/admin/instructors/{instructor_id}/verify")
async def verify_instructor_options(instructor_id: str):
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.put("/admin/instructors/{instructor_id}/verify")
async def verify_instructor(
    request: Request,
    instructor_id: str,
    verify_data: dict
):
    try:
        # Get auth token from header
        token = request.headers.get('authorization', '')
        if not token.startswith('Bearer ') or token.split()[1] != 'admin-token-123':
            raise HTTPException(status_code=403, detail="Admin access required")

        # Update instructor verification in database
        result = users_collection.update_one(
            {"_id": ObjectId(instructor_id), "role": "instructor"},
            {"$set": {"isVerified": verify_data.get("verify", False)}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Instructor not found")

        # Get updated instructor data
        updated_instructor = users_collection.find_one({"_id": ObjectId(instructor_id)})
        if updated_instructor:
            updated_instructor["_id"] = str(updated_instructor["_id"])
            return JSONResponse(
                content=json.loads(json.dumps(updated_instructor, cls=CustomJSONEncoder)), 
                headers=CORS_HEADERS
            )

        return JSONResponse(content={"message": "Instructor verification updated"}, headers=CORS_HEADERS)
    except Exception as e:
        logger.error(f"Error verifying instructor: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to update instructor verification"},
            headers=CORS_HEADERS
        )

# User endpoints
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
        
        # Get all instructors and their verification status
        all_instructors = list(users_collection.find({"role": "instructor"}))
        logger.info(f"Found {len(all_instructors)} instructors")
        
        # Create instructor verification map
        instructors = {}
        for instructor in all_instructors:
            username = instructor["username"]
            is_verified = instructor.get("isVerified", False)
            instructors[username] = is_verified
            logger.info(f"Instructor {username} verification status: {is_verified}")
        
        # Convert ObjectId to string and add instructor verification status
        for course in courses:
            course["_id"] = str(course["_id"])
            instructor_name = course["instructor"]
            is_verified = instructors.get(instructor_name, False)
            logger.info(f"Course {course['title']} instructor {instructor_name} verification: {is_verified}")
            
            course["instructor"] = {
                "username": instructor_name,
                "isVerified": is_verified
            }
        
        # Apply filters if provided
        if difficulty:
            courses = [c for c in courses if c.get("difficulty") == difficulty]
        
        if rating:
            try:
                parsed_rating = float(rating)
                if 0 <= parsed_rating <= 5:
                    courses = [c for c in courses if c.get("ratings", 0) >= parsed_rating]
            except ValueError:
                pass
        
        logger.info(f"Returning {len(courses)} courses after filtering")
        return JSONResponse(
            content=courses,
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
async def get_courses(current_user: str = Depends(get_current_user)):
    try:
        # Get all courses
        courses = list(courses_collection.find())
        
        # Get all instructors and their verification status
        instructors = {user["username"]: user.get("isVerified", False)
                      for user in users_collection.find({"role": "instructor"})}
        
        # Convert ObjectId to string and add instructor verification status
        for course in courses:
            course["_id"] = str(course["_id"])
            # Update instructor field to include verification status
            instructor_name = course["instructor"]
            course["instructor"] = {
                "username": instructor_name,
                "isVerified": instructors.get(instructor_name, False)
            }
        
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

@app.get("/courses/{course_id}")
async def get_course(request: Request, course_id: str):
    # Get token from Authorization header
    auth_header = request.headers.get('authorization', '')
    if not auth_header or not auth_header.startswith('Bearer '):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing or invalid token"},
            headers=CORS_HEADERS
        )
    
    token = auth_header.split(' ')[1]
    try:
        # Special case for admin token
        if token == 'admin-token-123':
            current_user = 'admin'
        else:
            # Verify JWT token
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
                current_user = payload.get('sub')
                if not current_user:
                    raise HTTPException(status_code=401, detail="Invalid token")
            except jwt.InvalidTokenError:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid token"},
                    headers=CORS_HEADERS
                )
        
        logger.info(f"Getting course {course_id} for user {current_user}")
        # Get course details
        logger.info(f"Fetching course details for {course_id}")
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if course:
            # Get instructor verification status
            instructor = users_collection.find_one({"username": course["instructor"], "role": "instructor"})
            
            # Convert ObjectId to string and add instructor verification status
            course["_id"] = str(course["_id"])
            course["instructorVerified"] = instructor.get("isVerified", False) if instructor else False
            
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
async def get_current_user_info(request: Request):
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing or invalid token"},
            headers=CORS_HEADERS
        )
    
    token = auth_header.split(' ')[1]
    try:
        # Special case for admin token
        if token == 'admin-token-123':
            current_user = 'admin'
            # Return admin user data
            admin_data = {
                "_id": "admin",
                "username": "admin",
                "email": "admin@example.com",
                "role": "admin",
                "isAdmin": True
            }
            return JSONResponse(content=admin_data, headers=CORS_HEADERS)
        
        # Verify JWT token
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = payload.get('sub')
            if not current_user:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid token"},
                    headers=CORS_HEADERS
                )
        except jwt.InvalidTokenError:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"},
                headers=CORS_HEADERS
            )
        
        # Get user data
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

@app.options("/api/users/purchased-courses")
async def purchased_courses_options():
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.get("/api/users/purchased-courses")
async def get_purchased_courses(request: Request):
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing or invalid token"},
            headers=CORS_HEADERS
        )
    
    token = auth_header.split(' ')[1]
    try:
        # Verify JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = payload.get('sub')
        if not current_user:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"},
                headers=CORS_HEADERS
            )
            
        # Get user data
        user = users_collection.find_one({"username": current_user})
        if not user:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "User not found"},
                headers=CORS_HEADERS
            )
        
        # Get purchased courses from the user's purchased_courses array
        purchased_course_ids = user.get('purchased_courses', [])
        logger.info(f"Found purchased_course_ids: {purchased_course_ids}")
        
        # Convert string IDs to ObjectId
        object_ids = [ObjectId(id_str) for id_str in purchased_course_ids]
        logger.info(f"Converted to ObjectIds: {object_ids}")
        
        # Query courses
        purchased_courses = list(courses_collection.find({"_id": {"$in": object_ids}}))
        logger.info(f"Found courses: {purchased_courses}")
        
        # Serialize courses
        serialized_courses = []
        for course in purchased_courses:
            course['_id'] = str(course['_id'])
            serialized_courses.append(course)
        
        return JSONResponse(
            content={"purchasedCourses": serialized_courses},
            headers=CORS_HEADERS
        )
            
    except jwt.InvalidTokenError:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid token"},
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error fetching purchased courses: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )


# Review model
class ReviewCreate(BaseModel):
    rating: float = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=1, max_length=500)

class Review(ReviewCreate):
    course_id: str
    user_id: str
    username: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

@app.options("/api/courses/{course_id}/reviews")
async def reviews_options(course_id: str):
    return JSONResponse(content={}, headers=CORS_HEADERS)

@app.post("/api/courses/{course_id}/reviews")
async def create_review(course_id: str, review_data: ReviewCreate, request: Request):
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing or invalid token"},
                headers=CORS_HEADERS
            )
        
        token = auth_header.split(' ')[1]
        
        # Verify JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        current_user = payload.get('sub')
        if not current_user:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"},
                headers=CORS_HEADERS
            )
        
        # Get user data
        user = users_collection.find_one({"username": current_user})
        if not user:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "User not found"},
                headers=CORS_HEADERS
            )
        
        # Check if user has purchased the course
        if course_id not in user.get('purchased_courses', []):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "You must purchase this course to review it"},
                headers=CORS_HEADERS
            )
        
        # Check if user has already reviewed this course
        existing_review = reviews_collection.find_one({
            "course_id": course_id,
            "user_id": str(user['_id'])
        })
        
        if existing_review:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "You have already reviewed this course"},
                headers=CORS_HEADERS
            )
        
        # Create review
        review_dict = review_data.dict()
        review_dict["course_id"] = course_id
        review_dict["user_id"] = str(user["_id"])
        review_dict["username"] = user["username"]
        review_dict["created_at"] = datetime.utcnow()
        
        result = reviews_collection.insert_one(review_dict)
        
        # Update course average rating
        course_reviews = list(reviews_collection.find({"course_id": course_id}))
        avg_rating = sum(review["rating"] for review in course_reviews) / len(course_reviews)
        
        courses_collection.update_one(
            {"_id": ObjectId(course_id)},
            {"$set": {"rating": round(avg_rating, 1)}}
        )
        
        return JSONResponse(
            content={
                "message": "Review created successfully",
                "review_id": str(result.inserted_id)
            },
            headers=CORS_HEADERS
        )
        
    except jwt.InvalidTokenError:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid token"},
            headers=CORS_HEADERS
        )
    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.get("/api/courses/{course_id}/reviews")
async def get_course_reviews(course_id: str, token: str = Depends(oauth2_scheme)):
    try:
        logger.info(f"Fetching reviews for course: {course_id}")
        logger.info(f"Token provided: {token[:10]}...")

        # Verify token and get current user
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = payload.get("sub")
            logger.info(f"Current user from token: {current_user}")
            if not current_user:
                logger.error("No user found in token payload")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid token"},
                    headers=CORS_HEADERS
                )
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token error: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"},
                headers=CORS_HEADERS
            )

        # Get reviews for the course
        reviews = list(reviews_collection.find({"course_id": course_id}).sort("created_at", -1))
        logger.info(f"Found {len(reviews)} reviews for course {course_id}")
        
        # Serialize reviews
        serialized_reviews = []
        for review in reviews:
            review["_id"] = str(review["_id"])
            review["created_at"] = review["created_at"].isoformat()
            serialized_reviews.append(review)
        
        return JSONResponse(
            content={"reviews": serialized_reviews},
            headers=CORS_HEADERS
        )
        
    except Exception as e:
        logger.error(f"Error fetching reviews: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=CORS_HEADERS
        )

@app.get("/instructor/courses")
async def get_instructor_courses(token: str = Depends(oauth2_scheme)):
    try:
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
        role = payload.get("role")

        # Verify that the user is an instructor
        if role != "instructor":
            raise HTTPException(status_code=403, detail="Only instructors can access this endpoint")

        # Get the user from the database
        user = users_collection.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get all courses created by this instructor
        logger.info(f"Looking for courses for instructor: {username}")
        
        # First, let's see what's in the database
        sample_courses = list(courses_collection.find().limit(2))
        logger.info(f"Sample courses in DB: {json.dumps(sample_courses, default=str)}")
        
        # Now try to find instructor's courses
        courses = list(courses_collection.find({"instructor": username}))
        logger.info(f"Found {len(courses)} courses")
        
        # Get reviews for each course
        for course in courses:
            course["_id"] = str(course["_id"])
            
            # Get reviews for this course
            reviews = list(reviews_collection.find({"course_id": str(course["_id"])}))
            formatted_reviews = []
            
            for review in reviews:
                formatted_reviews.append({
                    "_id": str(review["_id"]),
                    "course_id": str(review["course_id"]),
                    "user_id": str(review["user_id"]),
                    "username": review["username"],
                    "rating": review["rating"],
                    "comment": review["comment"],
                    "created_at": review["created_at"].isoformat() if isinstance(review["created_at"], datetime) else review["created_at"]
                })
            
            course["reviews"] = formatted_reviews
        
        return JSONResponse(
            content=json.loads(json.dumps(courses, cls=CustomJSONEncoder)),
            headers=CORS_HEADERS
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
            "/login",
            "/api/users/purchased-courses",
            "/api/courses/{course_id}/reviews"
        ]
    }