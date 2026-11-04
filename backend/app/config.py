from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Eventra API"
    database_url: str
    firebase_credentials_path: str = "./firebase-service-account.json"
    cors_origins: str = "http://localhost:5173"
    admin_emails: str = ""
    allowed_email_domains: str = ""

    @staticmethod
    def _split(value: str) -> list[str]:
        return [item.strip().lower() for item in value.split(",") if item.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        # origins are case-sensitive in practice, so don't lowercase them
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
