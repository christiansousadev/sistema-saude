from app.core.security import (
    create_access_token,
    create_short_access_token,
    decode_access_token,
    decrypt_api_key,
    encrypt_api_key,
    generate_family_id,
    generate_refresh_token,
    hash_password,
    verify_password,
)


def test_password_hashing():
    plain = "MinhaSenhaForte123!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("SenhaErrada123!", hashed) is False


def test_jwt_token_flow():
    email = "usuario@teste.com"
    token = create_short_access_token(email)
    payload = decode_access_token(token)

    assert payload is not None
    assert payload.get("sub") == email
    assert "exp" in payload


def test_jwt_invalid_token():
    assert decode_access_token("token.invalido.falso") is None


def test_refresh_token_and_family_generation():
    tok1 = generate_refresh_token()
    tok2 = generate_refresh_token()
    family1 = generate_family_id()
    family2 = generate_family_id()

    assert len(tok1) == 64  # 32 bytes hex
    assert len(family1) == 32  # 16 bytes hex
    assert tok1 != tok2
    assert family1 != family2


def test_api_key_fernet_hkdf_encryption():
    raw_key = "sk-proj-super-secret-openai-api-key-123456"
    encrypted = encrypt_api_key(raw_key)

    assert encrypted is not None
    assert encrypted != raw_key

    decrypted = decrypt_api_key(encrypted)
    assert decrypted == raw_key


def test_decrypt_invalid_key_returns_none():
    assert decrypt_api_key("chave_criptografada_invalida") is None
    assert decrypt_api_key(None) is None
