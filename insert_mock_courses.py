from pymongo import MongoClient

# MongoDB URI (adjust this to your actual connection details)
client = MongoClient("mongodb://localhost:27017/")

# Select your database (replace 'yourdb' with your actual database name)
db = client['yourdb']  # Replace 'yourdb' with your database name

# Select the courses collection
courses_collection = db['courses']

# Delete all existing courses (optional, clean up old data)
courses_collection.delete_many({})

# Insert mock courses data into the collection
mock_courses = [
    {
        "title": "Intro to Python",
        "description": "A beginner's guide to Python programming.",
        "difficulty": "beginner",
        "rating": 4,
        "price": 50.00
    },
    {
        "title": "Advanced Python",
        "description": "An advanced course for Python developers.",
        "difficulty": "busy professional",
        "rating": 3,
        "price": 100.00
    },
    {
        "title": "Python for Data Science",
        "description": "Learn Python and its applications in Data Science.",
        "difficulty": "gym enthusiast",
        "rating": 5,
        "price": 75.00
    },
    {
        "title": "JavaScript Basics",
        "description": "An introduction to JavaScript programming.",
        "difficulty": "beginner",
        "rating": 1,
        "price": 40.00
    }
]

# Insert mock courses into the courses collection
courses_collection.insert_many(mock_courses)

# Print a success message
print("Mock courses have been inserted into the database.")
