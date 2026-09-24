from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import base64
import tempfile
import os
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str

    # Token da API do Tiny (api2), usado pelo extrator de notas fiscais.
    # Opcional para a API subir sem ele: quem precisa é o job, que reclama na hora.
    TINY_TOKEN: Optional[str] = None

    # Autenticação (usuários do DataCoreHS no schema auth)
    # diferente da do authapi — ver spec 2026-09-23. >=32 bytes: chave curta
    # facilita força bruta do HMAC (e o jwt já avisa via InsecureKeyLengthWarning).
    SECRET_KEY: str = Field(min_length=32)
    # 480 = um dia de trabalho: com 30 min, ligada a AUTH_OBRIGATORIA, o pessoal
    # seria jogado para o login várias vezes por dia (não há refresh token).
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    # false: rotas de dados aceitam anônimo e só registram WARNING (transição)
    # true: rotas de dados exigem token válido
    AUTH_OBRIGATORIA: bool = False

    # Login com Microsoft (Entra ID) — ver spec 2026-09-24. Os valores vêm do
    # registro de aplicativo "DataCore" no Entra. Qualquer um vazio = SSO
    # desligado: a API sobe normal e o front esconde o botão.
    MS_TENANT_ID: str = ""
    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""
    MS_REDIRECT_URI: str = ""
    FRONTEND_URL: str = ""

    @property
    def sso_ativo(self) -> bool:
        return all((
            self.MS_TENANT_ID, self.MS_CLIENT_ID, self.MS_CLIENT_SECRET,
            self.MS_REDIRECT_URI, self.FRONTEND_URL,
        ))

    # Configurações NFSe Recife
    # Opção 1: Caminhos para arquivos locais (desenvolvimento)
    NFSE_CERT_PATH: Optional[str] = None
    NFSE_KEY_PATH: Optional[str] = None

    # Opção 2: Conteúdo base64 (produção/Easypanel)
    NFSE_CERT_BASE64: Optional[str] = None
    NFSE_KEY_BASE64: Optional[str] = None

    NFSE_CNPJ: str = "08857492000148"
    NFSE_INSCRICAO_MUNICIPAL: str = "3694208"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def get_cert_paths(self) -> tuple[str, str]:
        """
        Retorna os caminhos dos certificados.
        Se fornecido via base64, cria arquivos temporários.
        """
        # Se já tiver paths definidos, usa eles
        if self.NFSE_CERT_PATH and self.NFSE_KEY_PATH:
            return self.NFSE_CERT_PATH, self.NFSE_KEY_PATH

        # Se tiver base64, decodifica e cria arquivos temporários
        if self.NFSE_CERT_BASE64 and self.NFSE_KEY_BASE64:
            # Decodifica os certificados
            cert_content = base64.b64decode(self.NFSE_CERT_BASE64)
            key_content = base64.b64decode(self.NFSE_KEY_BASE64)

            # Cria arquivos temporários
            cert_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.crt')
            key_file = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.key')

            cert_file.write(cert_content)
            key_file.write(key_content)

            cert_file.close()
            key_file.close()

            return cert_file.name, key_file.name

        raise ValueError(
            "Certificados NFSe não configurados. "
            "Configure NFSE_CERT_PATH/NFSE_KEY_PATH ou NFSE_CERT_BASE64/NFSE_KEY_BASE64"
        )

settings = Settings()
