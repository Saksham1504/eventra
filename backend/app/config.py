from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Eventra API"
    database_url: str = "sqlite:///./eventra_dev.db"
    firebase_credentials_path: str = "./firebase-service-account.json"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    admin_emails: str = "admin@eventra.local,you@example.com"
    allowed_email_domains: str = ""

    qr_secret: str = "dev-only-secret-change-me-long-random-string-12345"
    reservation_minutes: int = 10
    max_tickets_per_booking: int = 4
    cancel_before_hours: int = 24
    payment_mode: str = "mock"
    expiry_job_interval_seconds: int = 60
    dev_mock_auth: bool = True

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    @staticmethod
    def _split(value: str) -> list[str]:
        return [item.strip().lower() for item in value.split(",") if item.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_list(self) -> list[str]:
        return self._split(self.admin_emails)

    @property
    def allowed_domain_list(self) -> list[str]:
        return self._split(self.allowed_email_domains)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
