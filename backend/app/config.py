from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    s3_access_key: str
    s3_secret_key: str
    s3_bucket_name: str
    s3_region: str = "us-east-2"
    s3_endpoint_url: str | None = None  # set for non-AWS providers (Ionos, MinIO, etc.)
    maptiler_api_key: str

    class Config:
        env_file = ".env"


settings = Settings()
