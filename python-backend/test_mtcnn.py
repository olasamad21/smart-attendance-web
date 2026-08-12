import numpy as np
from deepface import DeepFace

# create a dummy image (100x100x3)
img = np.zeros((100, 100, 3), dtype=np.uint8)
try:
    DeepFace.represent(img_path=img, model_name="ArcFace", enforce_detection=True, detector_backend="mtcnn")
except Exception as e:
    print(f"Exception: {str(e)}")
