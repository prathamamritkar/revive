import os
import razorpay
from dotenv import load_dotenv

load_dotenv()

rzp_client = razorpay.Client(
    auth=(
        os.getenv("RAZORPAY_KEY_ID", "rzp_test_dummy"),
        os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret"),
    )
)
