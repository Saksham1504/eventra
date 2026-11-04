import hmac
import hashlib
import logging
from app.config import settings

logger = logging.getLogger(__name__)


def create_order(booking_id: str, amount_in_rupees: float) -> dict:
    """Creates a Razorpay order or returns simulated order if keys are not set."""
    amount_in_paise = int(amount_in_rupees * 100)
    key_id = settings.razorpay_key_id
    key_secret = settings.razorpay_key_secret

    if key_id and key_secret:
        try:
            import razorpay
            client = razorpay.Client(auth=(key_id, key_secret))
            order = client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": booking_id,
                "notes": {"booking_id": booking_id}
            })
            return {"order_id": order["id"], "amount": amount_in_paise, "currency": "INR", "key_id": key_id}
        except Exception as exc:
            logger.exception("Failed to create Razorpay order")
            raise

    # Simulated order when Razorpay keys are not provided
    return {
        "order_id": f"order_sim_{booking_id[:8]}",
        "amount": amount_in_paise,
        "currency": "INR",
        "key_id": key_id or "rzp_test_simulated",
    }


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verifies HMAC SHA256 signature returned by Razorpay Checkout."""
    key_secret = settings.razorpay_key_secret
    if not key_secret:
        # In test/dev mode without secret, permit simulated signatures
        return signature.startswith("sig_") or signature == "test_signature"
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    expected = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
