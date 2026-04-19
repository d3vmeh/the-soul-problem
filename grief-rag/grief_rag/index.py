from pathlib import Path
from typing import List, Optional, Tuple, Union
import numpy as np
from sentence_transformers import SentenceTransformer

_MODEL_NAME = "all-MiniLM-L6-v2"
_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def build_index(documents: List[str], ids: List[str]) -> Tuple[np.ndarray, List[str]]:
    model = _get_model()
    embeddings = model.encode(documents, normalize_embeddings=True)
    return embeddings, ids


def save_index(matrix: np.ndarray, ids: List[str], path: Union[str, Path]) -> None:
    np.savez(str(path), matrix=matrix, ids=np.array(ids))


def load_index(path: Union[str, Path]) -> Tuple[np.ndarray, List[str]]:
    data = np.load(str(path), allow_pickle=False)
    return data["matrix"], list(data["ids"])


def search(query: str, matrix: np.ndarray, ids: List[str], top_k: int = 3) -> List[str]:
    model = _get_model()
    query_vec = model.encode([query], normalize_embeddings=True)[0]
    scores = matrix @ query_vec
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [ids[i] for i in top_indices]
