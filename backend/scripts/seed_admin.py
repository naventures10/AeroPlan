import asyncio
import os
import sys

# Add the backend directory to the Python path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User


async def seed_admin():
    async with AsyncSessionLocal() as session:
        email = os.environ.get("ADMIN_EMAIL")
        password = os.environ.get("ADMIN_PASSWORD")

        if not email or not password:
            print("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.")
            sys.exit(1)

        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if user:
            print(f"Admin user {email} already exists!")
            return

        print("Creating admin user:")
        print(f"  Email: {email}")
        print("  Password: [REDACTED]")

        admin_user = User(email=email, hashed_password=get_password_hash(password), is_active=True)

        session.add(admin_user)
        await session.commit()
        print("Admin user created successfully!")


if __name__ == "__main__":
    asyncio.run(seed_admin())
