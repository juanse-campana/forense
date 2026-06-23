from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres@localhost:5432/forense"
    upload_dir: str = "uploads"
    max_file_size: int = 500 * 1024 * 1024  # 500MB

    class Config:
        env_prefix = "FORENSE_"


settings = Settings()
