from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    POSTGRES_URI_CUSTOM: str

    # Auth (JWT)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_EXPIRE_MINUTES: int = 15
    # Page that sets the new password; the reset token is added as ?token=...
    PASSWORD_RESET_URL: str = "http://localhost:3000/reset-password"
    # Local development only: write reset links to the server log (no email service yet).
    # Never enable in production: anyone reading the logs could reset that account.
    LOG_PASSWORD_RESET_LINKS: bool = False

    # Media storage (Cloudinary). Either the three values below, or CLOUDINARY_URL=cloudinary://key:secret@cloud
    CLOUDINARY_URL: str | None = None
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    # Also read from the older, misspelled CLOUDNARY_API_KEY entry, which holds the secret.
    CLOUDINARY_API_SECRET: str | None = Field(None, validation_alias=AliasChoices("CLOUDINARY_API_SECRET", "CLOUDNARY_API_KEY"))
    CLOUDINARY_FOLDER: str = "zek"
    MAX_IMAGE_UPLOAD_MB: int = 10

    # API
    APP_NAME: str = "ZEK API"
    APP_VERSION: str = "1.0.0"
    # Comma-separated list of allowed browser origins, e.g. "http://localhost:3000,https://zek.shop"
    CORS_ORIGINS: str = "http://localhost:3000"
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",       # ignore any extra keys in .env
    )

    @property
    def cloudinary_configured(self) -> bool:
        return bool(self.CLOUDINARY_URL) or all(
            [self.CLOUDINARY_CLOUD_NAME, self.CLOUDINARY_API_KEY, self.CLOUDINARY_API_SECRET]
        )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
