from pymongo import MongoClient

# MongoDB URI (adjust this to your actual connection details)
client = MongoClient("mongodb://localhost:27017/")

# Select your database
db = client['yourdb']  # Replace 'yourdb' with your database name

# Select the users collection
users_collection = db['users']

# Delete all users
users_collection.delete_many({})

print("All users have been deleted.")
