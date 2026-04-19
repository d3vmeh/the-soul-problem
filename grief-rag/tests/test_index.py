import numpy as np
import pytest
from pathlib import Path
from grief_rag.index import build_index, save_index, load_index, search


DOCS = ["close friend suicide loss specific commitment", "colleague layoff performance neutral"]
IDS = ["gl_001", "gl_002"]


def test_build_index_shape():
    matrix, ids = build_index(DOCS, IDS)
    assert matrix.shape[0] == 2
    assert ids == IDS


def test_save_and_load_roundtrip(tmp_path):
    matrix, ids = build_index(DOCS, IDS)
    path = tmp_path / "index.npz"
    save_index(matrix, ids, path)
    loaded_matrix, loaded_ids = load_index(path)
    assert loaded_ids == IDS
    assert np.allclose(matrix, loaded_matrix)


def test_search_returns_top_k(tmp_path):
    matrix, ids = build_index(DOCS, IDS)
    results = search("friend dealing with suicide loss", matrix, ids, top_k=1)
    assert len(results) == 1
    assert results[0] == "gl_001"
