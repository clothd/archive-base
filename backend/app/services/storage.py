import uuid

import boto3

from app.config import settings


_kwargs = dict(
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key,
    region_name=settings.s3_region,
)
if settings.s3_endpoint_url:
    _kwargs["endpoint_url"] = settings.s3_endpoint_url

s3 = boto3.client("s3", **_kwargs)


def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    # Unique key so filenames never collide
    key = f"documents/{uuid.uuid4()}/{filename}"
    s3.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    # Short-lived URL — files are never publicly accessible
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )
