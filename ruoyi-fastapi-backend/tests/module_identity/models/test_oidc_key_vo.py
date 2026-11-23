from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from module_identity.entity.vo.oidc_key_vo import OidcKeyRotateModel, OidcKeyViewModel


def test_public_jwk_rejects_private_rsa_parameters() -> None:
    """公开 JWK 拒绝 RSA 私钥参数。"""
    with pytest.raises(ValidationError):
        OidcKeyViewModel(
            kid='key-1',
            status='active',
            publishAt='2026-01-01T00:00:00Z',
            publicJwk={
                'kty': 'RSA',
                'use': 'sig',
                'kid': 'key-1',
                'alg': 'RS256',
                'n': 'n',
                'e': 'AQAB',
                'd': 'private',
            },
        )


@pytest.mark.parametrize('value', ['2026-08-28 10:00:00', datetime(2026, 8, 28, 10, 0)])
def test_rotation_request_rejects_missing_timezone(value: object) -> None:
    """轮换请求拒绝缺少时区的时间。"""
    with pytest.raises(ValidationError):
        OidcKeyRotateModel(kid='key-1', publishAt=value)


def test_rotation_request_normalizes_offset_to_utc() -> None:
    """轮换请求将带偏移的时刻转换为 UTC。"""
    model = OidcKeyRotateModel(kid='key-1', publishAt='2026-08-28T10:00:00+08:00')
    assert model.publish_at == datetime(2026, 8, 28, 2, 0, tzinfo=UTC)
    assert model.model_dump(mode='json', by_alias=True)['publishAt'] == '2026-08-28T02:00:00.000Z'
