# Import required modules
import dotenv
import os
import mysql.connector
from fastapi import FastAPI, HTTPException, status, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from mysql.connector import errorcode
import jwt

# Load the environment variables
dotenv.load_dotenv()

# Initialize the FastAPI app
app = FastAPI()

# Define the allowed origins for CORS
origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allow requests from frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Connect to the MySQL database
try:
    cnx = mysql.connector.connect(
        user=os.environ['MYSQL_USER'],
        password=os.environ['MYSQL_PASSWORD'],
        host=os.environ['MYSQL_HOST'],
        database=os.environ['MYSQL_DB'],
    )
    cursor = cnx.cursor()
    print("Connected to the database successfully!")  # Success message
except mysql.connector.Error as err:
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print("Something is wrong with your username or password")
    elif err.errno == errorcode.ER_BAD_DB_ERROR:
        print("Database does not exist")
    else:
        print(err)

# Define the authentication middleware
async def authenticate(request: Request):
    try:
        api_key = request.headers.get('authorization').replace("Bearer ", "")
        cursor.execute("SELECT * FROM voters WHERE voter_id = %s", (api_key,))
        if api_key not in [row[0] for row in cursor.fetchall()]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Forbidden"
            )
    except:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forbidden"
        )

# Define the POST endpoint for login
@app.get("/login")
async def login(request: Request, voter_id: str, password: str):
    role = await get_role(voter_id, password)

    # Assuming authentication is successful, generate a token
    token = jwt.encode(
        {'voter_id': voter_id, 'role': role},
        os.environ['SECRET_KEY'],
        algorithm='HS256'
    )

    return {'token': token, 'role': role}

# Function to get the role of the user
async def get_role(voter_id, password):
    try:
        cursor.execute(
            "SELECT password, role FROM voters WHERE voter_id = %s", (voter_id,)
        )
        user = cursor.fetchone()
        if user and user[0] == password:  # Compare plain-text passwords
            return user[1]  # Return the user's role
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid voter ID or password"
            )
    except mysql.connector.Error as err:
        print(err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )

# Define the POST endpoint for registration
@app.post("/register")
async def register_user(user_data: dict = Body(...)):
    # Extract user details
    voter_id = user_data.get("voter_id")
    password = user_data.get("password")
    role = user_data.get("role", "user")  # Default role is 'user'

    try:
        # Check if the user already exists
        cursor.execute("SELECT voter_id FROM voters WHERE voter_id = %s", (voter_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="User already exists.")

        # Insert the new user into the database (store plaintext password)
        cursor.execute(
            "INSERT INTO voters (voter_id, password, role) VALUES (%s, %s, %s)",
            (voter_id, password, role),
        )
        cnx.commit()

        return {"message": "User registered successfully."}
    except mysql.connector.Error as err:
        print(err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )
