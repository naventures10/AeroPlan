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
        email = "admin@aeroplan.com"
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if user:
            print(f"Admin user {email} already exists!")
            return

        password = "adminpassword123"
        print("Creating admin user:")
        print(f"  Email: {email}")
        print(f"  Password: {password}")

        admin_user = User(email=email, hashed_password=get_password_hash(password), is_active=True)

        session.add(admin_user)
        await session.commit()
        print("Admin user created successfully!")


if __name__ == "__main__":
    asyncio.run(seed_admin())
