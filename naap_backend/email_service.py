import os
import smtplib

from dotenv import load_dotenv

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# =========================
# LOAD ENVIRONMENT VARIABLES
# =========================
load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))

SENDER_EMAIL = os.getenv("SMTP_USERNAME")
SENDER_PASSWORD = os.getenv("SMTP_PASSWORD")


# =========================
# SINGLE EMAIL DISPATCH
# =========================
def send_system_email(
    to_email: str,
    subject: str,
    body: str
):
    try:

        # Create email container
        msg = MIMEMultipart()

        msg["From"] = f"NAAP AMT System <{SENDER_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # Attach body
        msg.attach(MIMEText(body, "plain"))

        # Connect to SMTP
        server = smtplib.SMTP(
            SMTP_SERVER,
            SMTP_PORT
        )

        # Secure connection
        server.starttls()

        # Login
        server.login(
            SENDER_EMAIL,
            SENDER_PASSWORD
        )

        # Send email
        server.send_message(msg)

        # Close connection
        server.quit()

        print(
            f"[SMTP SUCCESS] "
            f"Email successfully dispatched to {to_email}"
        )

        return True

    except Exception as e:

        print(
            f"[SMTP ERROR] "
            f"Failed to send email to {to_email}"
        )

        print(
            f"[SMTP ERROR DETAILS] "
            f"{str(e)}"
        )

        return False


# =========================
# GLOBAL ANNOUNCEMENT WRAPPER
# =========================
def dispatch_global_announcement(
    header: str,
    message: str,
    severity: str,
    recipient_emails: list
):
    """
    Compatibility wrapper for
    existing notification system.
    """

    success_count = 0

    for email in recipient_emails:

        result = send_system_email(
            to_email=email,
            subject=header,
            body=message
        )

        if result:
            success_count += 1

    print(
        f"[SMTP LOG] "
        f"Announcement dispatch complete "
        f"({success_count}/{len(recipient_emails)} successful)"
    )

    return True