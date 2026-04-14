"""
Seed script — populates demo data for the Enbridge VP demo.

Run with:
    docker compose run --rm api python /scripts/seed.py
"""

import os
import sys

# In Docker the app lives at /app; locally it's at backend/
# Try /app first (container), then fall back to sibling backend/ dir
_app_path = "/app" if os.path.isdir("/app") else os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, _app_path)

from geoalchemy2.shape import from_shape
from shapely.geometry import LineString, Point
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import User, Pipeline, ChainagePin, PipelineAccess
from app.models.user import UserRole
from app.models.pipeline_access import AccessLevel
from app.services.auth import hash_password

engine = create_engine(settings.database_url)
Session = sessionmaker(bind=engine)
db = Session()


def run():
    print("Seeding demo data…")

    # ── Users ────────────────────────────────────────────────
    users_data = [
        ("admin@enbridge.com", "admin123", UserRole.admin),
        ("editor@enbridge.com", "editor123", UserRole.editor),
        ("viewer@enbridge.com", "viewer123", UserRole.viewer),
    ]

    users = {}
    for email, password, role in users_data:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            users[email] = existing
            print(f"  User already exists: {email}")
        else:
            user = User(email=email, hashed_password=hash_password(password), role=role)
            db.add(user)
            db.flush()
            users[email] = user
            print(f"  Created user: {email} ({role})")

    # ── Pipeline ─────────────────────────────────────────────
    # Real-ish coordinates for a pipeline route through central Alberta
    # This approximates a route from Calgary area NW toward Airdrie and beyond
    route_coords = [
        (-114.0719, 51.0447),   # Calgary NW
        (-114.1050, 51.0800),
        (-114.1300, 51.1200),
        (-114.1500, 51.1600),
        (-114.1650, 51.2000),
        (-114.1750, 51.2400),
        (-114.1850, 51.2800),
        (-114.1950, 51.3200),
        (-114.2050, 51.3600),
        (-114.2150, 51.4000),
        (-114.2200, 51.4400),
        (-114.2250, 51.4800),
        (-114.2300, 51.5200),
        (-114.2350, 51.5600),
        (-114.2400, 51.6000),
        (-114.2450, 51.6400),
        (-114.2500, 51.6800),
        (-114.2550, 51.7200),
        (-114.2600, 51.7600),
        (-114.2650, 51.8000),
    ]

    existing_pipeline = db.query(Pipeline).filter(
        Pipeline.name == "Line 3 Replacement — Segment AB-07"
    ).first()

    if existing_pipeline:
        pipeline = existing_pipeline
        print("  Pipeline already exists")
    else:
        pipeline = Pipeline(
            name="Line 3 Replacement — Segment AB-07",
            description="NPS 36 crude oil pipeline, Calgary to Red Deer corridor, Phase 2 construction",
            geometry=from_shape(LineString(route_coords), srid=4326),
        )
        db.add(pipeline)
        db.flush()
        print(f"  Created pipeline: {pipeline.name}")

    # ── Chainage pins ─────────────────────────────────────────
    # 20 pins spaced every ~3.8 km along the route (total ~75 km)
    # Coords interpolated approximately along route
    pin_data = [
        (42.0,   (-114.0719, 51.0447),  "KP 42+000"),
        (42.5,   (-114.0850, 51.0600),  "KP 42+500"),
        (43.0,   (-114.1000, 51.0720),  "KP 43+000"),
        (43.5,   (-114.1150, 51.0900),  "KP 43+500"),
        (44.0,   (-114.1300, 51.1200),  "KP 44+000"),
        (44.5,   (-114.1380, 51.1500),  "KP 44+500"),
        (45.0,   (-114.1500, 51.1750),  "KP 45+000"),
        (45.5,   (-114.1580, 51.2000),  "KP 45+500"),
        (46.0,   (-114.1680, 51.2300),  "KP 46+000"),
        (46.5,   (-114.1780, 51.2600),  "KP 46+500"),
        (47.0,   (-114.1850, 51.2900),  "KP 47+000"),
        (47.5,   (-114.1950, 51.3200),  "KP 47+500"),
        (48.0,   (-114.2000, 51.3600),  "KP 48+000"),
        (48.5,   (-114.2080, 51.3900),  "KP 48+500"),
        (49.0,   (-114.2150, 51.4200),  "KP 49+000"),
        (49.5,   (-114.2200, 51.4600),  "KP 49+500"),
        (50.0,   (-114.2250, 51.5000),  "KP 50+000"),
        (50.5,   (-114.2350, 51.5500),  "KP 50+500"),
        (51.0,   (-114.2450, 51.6000),  "KP 51+000"),
        (51.5,   (-114.2550, 51.6500),  "KP 51+500"),
        (52.0,   (-114.2650, 51.7200),  "KP 52+000"),
    ]

    for chainage_km, (lng, lat), label in pin_data:
        existing_pin = db.query(ChainagePin).filter(
            ChainagePin.pipeline_id == pipeline.id,
            ChainagePin.label == label,
        ).first()
        if not existing_pin:
            pin = ChainagePin(
                pipeline_id=pipeline.id,
                chainage_km=chainage_km,
                geometry=from_shape(Point(lng, lat), srid=4326),
                label=label,
            )
            db.add(pin)

    db.flush()
    print(f"  Created {len(pin_data)} chainage pins with KP notation")

    # ── Pipeline access ───────────────────────────────────────
    access_map = {
        "admin@enbridge.com": AccessLevel.admin,
        "editor@enbridge.com": AccessLevel.editor,
        "viewer@enbridge.com": AccessLevel.viewer,
    }

    for email, level in access_map.items():
        user = users[email]
        existing = db.query(PipelineAccess).filter(
            PipelineAccess.user_id == user.id,
            PipelineAccess.pipeline_id == pipeline.id,
        ).first()
        if not existing:
            access = PipelineAccess(
                user_id=user.id,
                pipeline_id=pipeline.id,
                access_level=level,
            )
            db.add(access)

    db.commit()
    print("  Pipeline access grants created")
    print("\nSeed complete.")
    print("\nDemo credentials:")
    print("  admin@enbridge.com  / admin123  (admin role)")
    print("  editor@enbridge.com / editor123 (editor role)")
    print("  viewer@enbridge.com / viewer123 (viewer role — upload button hidden)")


if __name__ == "__main__":
    run()
