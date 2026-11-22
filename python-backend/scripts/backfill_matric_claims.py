"""
One-off: create matricNumbers/{id} claim docs for students registered before
matric-number uniqueness moved to claim docs (see registerUser() in auth.service.ts).

Run from python-backend/ with Firebase credentials configured (same env as the API):
    venv/Scripts/python.exe -m scripts.backfill_matric_claims            # dry run
    venv/Scripts/python.exe -m scripts.backfill_matric_claims --apply
"""
import sys
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

from google.cloud.firestore_v1 import SERVER_TIMESTAMP, FieldFilter  # noqa: E402

from services.firebase import get_db  # noqa: E402


def claim_id(matric: str) -> str:
    # Must match matricClaimId() in lib/firebase/auth.service.ts (encodeURIComponent).
    return quote(matric.strip().upper(), safe="-_.!~*'()")


def main(apply: bool) -> None:
    db = get_db()
    students = db.collection("users").where(filter=FieldFilter("role", "==", "student")).stream()
    created, skipped, duplicates = 0, 0, []
    for snap in students:
        matric = (snap.to_dict() or {}).get("matricNumber", "")
        if not matric:
            continue
        ref = db.collection("matricNumbers").document(claim_id(matric))
        existing = ref.get()
        if existing.exists:
            if existing.to_dict().get("uid") != snap.id:
                duplicates.append((matric, snap.id, existing.to_dict().get("uid")))
            skipped += 1
            continue
        if apply:
            ref.set({"uid": snap.id, "createdAt": SERVER_TIMESTAMP, "backfilled": True})
        created += 1
    mode = "created" if apply else "would create"
    print(f"{mode}: {created}, already claimed: {skipped}")
    for matric, uid, owner in duplicates:
        print(f"  DUPLICATE matric {matric!r}: user {uid} vs existing claim by {owner}")


if __name__ == "__main__":
    main(apply="--apply" in sys.argv)
