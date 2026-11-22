"""
Report how well the current face model separates people, to choose MATCH_THRESHOLD.

    venv/Scripts/python.exe -m scripts.face_calibration

Genuine scores  = similarity between photos of the SAME person (their enrollment samples).
Impostor scores = similarity between photos of DIFFERENT people.
A good threshold sits above (almost) every impostor score and below most genuine scores.
Read-only: nothing is written.
"""
import itertools

import numpy as np
from dotenv import load_dotenv

load_dotenv()

from services.face_service import MATCH_THRESHOLD, PIPELINE_VERSION, cosine_similarity  # noqa: E402
from services.firebase import get_db  # noqa: E402


def describe(name: str, scores: list[float]) -> None:
    if not scores:
        print(f"{name}: no data")
        return
    s = np.asarray(scores)
    print(f"{name}: n={len(s)}  min={s.min():.3f}  p5={np.percentile(s, 5):.3f}  "
          f"median={np.median(s):.3f}  p95={np.percentile(s, 95):.3f}  max={s.max():.3f}")


def main() -> None:
    people = {}
    for snap in get_db().collection("face_embeddings").stream():
        d = snap.to_dict() or {}
        if d.get("pipeline") == PIPELINE_VERSION:
            people[snap.id] = [s["v"] for s in d.get("samples", [])]
    print(f"{len(people)} people enrolled with pipeline v{PIPELINE_VERSION}")

    genuine = [cosine_similarity(a, b) for samples in people.values() for a, b in itertools.combinations(samples, 2)]
    impostor = [cosine_similarity(a, b)
                for (_, sa), (_, sb) in itertools.combinations(people.items(), 2)
                for a in sa for b in sb]
    describe("genuine ", genuine)
    describe("impostor", impostor)

    t = MATCH_THRESHOLD
    if genuine:
        print(f"at threshold {t:.2f}: genuine pairs rejected = {np.mean(np.asarray(genuine) < t):.1%}")
    if impostor:
        print(f"at threshold {t:.2f}: impostor pairs accepted = {np.mean(np.asarray(impostor) >= t):.1%}")
        print(f"suggested threshold (just above highest impostor score + 0.03): {max(impostor) + 0.03:.2f}")
    if len(people) < 5:
        print("Note: enroll at least 5 different people for a meaningful estimate.")


if __name__ == "__main__":
    main()
