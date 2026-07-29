"""Configuração via variáveis de ambiente (12-factor)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco. Em produção (Coolify) use o Postgres:
    #   postgresql+psycopg://usuario:senha@postgres:5432/convenio
    # O default sqlite permite subir/testar sem banco externo.
    DATABASE_URL: str = "sqlite:///./dev.db"

    # CORS: domínios do frontend, separados por vírgula.
    CORS_ORIGINS: str = "*"

    # Autenticação (JWT). DEFINA SECRET_KEY em produção!
    SECRET_KEY: str = "dev-inseguro-troque-em-producao"
    JWT_EXPIRE_MIN: int = 60 * 12  # 12h
    # Admin inicial criado no startup (se ainda não existir).
    ADMIN_EMAIL: str = "admin@alchemypet.local"
    ADMIN_SENHA: str = "alchemypet"
    ADMIN_NOME: str = "Administrador"

    # Metadados
    ENV: str = "production"
    APP_NAME: str = "Painel Convênio API"

    @property
    def cors_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
