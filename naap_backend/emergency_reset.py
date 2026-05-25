from database import SessionLocal
import models
import security

def create_or_reset_head_admin():
    db = SessionLocal()
    try:
        # Check if any HEAD_ADMIN exists
        admin = db.query(models.User).filter(models.User.role == "HEAD_ADMIN").first()
        
        new_password = "AdminRecovery123!"
        hashed_password = security.get_password_hash(new_password)
        
        if not admin:
            print("⚠️ No HEAD_ADMIN found. Forging a brand new Master Account...")
            # Create a brand new admin account
            admin = models.User(
                id="h20041811",  # Your master thesis ID
                first_name="System",
                last_name="Administrator",
                email="admin@naap.edu.ph",
                role="HEAD_ADMIN",
                hashed_password=hashed_password,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✅ SUCCESS: New Head Admin Account Forged in Database.")
        else:
            # If they do exist, just reset the password
            admin.hashed_password = hashed_password
            db.commit()
            print("✅ SUCCESS: Existing Head Admin Password Overridden.")
            
        print("====================================")
        print(f"ID (Use this to login): {admin.id}")
        print(f"Email: {admin.email}")
        print(f"Password: {new_password}")
        print("====================================")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    create_or_reset_head_admin()