from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres@localhost:5432/forense"
    upload_dir: str = "uploads"
    max_file_size: int = 100 * 1024 * 1024  # 100MB (límite de request de Cloudflare)

    # Enriquecimiento de CVEs contra el NVD (ver services/cve_details.py).
    # Sin API key el NVD limita a 5 req/30s; con key (gratis, se pide por
    # mail en https://nvd.nist.gov/developers/request-an-api-key) sube a
    # 50 req/30s. El tope por analisis evita que un APK con cientos de
    # CVEs nuevos demore el pipeline entero - el resto se enriquece en
    # analisis posteriores (calentamiento progresivo del cache).
    nvd_api_key: str = ""
    nvd_max_per_analysis: int = 40

    class Config:
        env_prefix = "FORENSE_"


settings = Settings()
