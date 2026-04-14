"""
Seed script — populates demo data for the Enbridge VP demo.

Run with:
    docker compose run --rm api python /scripts/seed.py

To reseed (wipe pins and recreate):
    docker compose run --rm api python /scripts/seed.py --reseed
"""

import os
import sys

# In Docker the app lives at /app; locally it's at backend/
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

RESEED = "--reseed" in sys.argv


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
    # Route runs NW from Calgary through Airdrie corridor
    route_coords = [
        (-114.0719, 51.0447),
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
    # If reseeding, wipe existing pins for this pipeline first
    if RESEED:
        deleted = db.query(ChainagePin).filter(ChainagePin.pipeline_id == pipeline.id).delete()
        db.flush()
        print(f"  Deleted {deleted} existing pins (reseed mode)")

    existing_count = db.query(ChainagePin).filter(ChainagePin.pipeline_id == pipeline.id).count()
    if existing_count > 0:
        print(f"  {existing_count} pins already exist — skipping (use --reseed to replace)")
    else:
        # Interpolate pin positions EXACTLY along the pipeline LineString
        # This guarantees every pin sits precisely on the drawn route
        route_line = LineString(route_coords)
        num_pins = 21  # KP 42+000 → KP 52+000 in 0.5 km steps
        start_kp = 42.0

        for i in range(num_pins):
            fraction = i / (num_pins - 1)
            pt = route_line.interpolate(fraction, normalized=True)
            kp = start_kp + i * 0.5
            whole = int(kp)
            decimal_m = int(round((kp - whole) * 1000))
            label = f"KP {whole:02d}+{decimal_m:03d}"

            pin = ChainagePin(
                pipeline_id=pipeline.id,
                chainage_km=kp,
                geometry=from_shape(Point(pt.x, pt.y), srid=4326),
                label=label,
            )
            db.add(pin)

        db.flush()
        print(f"  Created {num_pins} chainage pins (interpolated on route)")

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
