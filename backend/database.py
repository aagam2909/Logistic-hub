import os
import psycopg2
from dotenv import load_dotenv

# Load variables from your .env file
load_dotenv()

# Retrieve the new cloud connection string
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """
    Connects to the PostgreSQL database using the cloud URI.
    """
    try:
        # psycopg2 can parse the full URI directly
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        raise e