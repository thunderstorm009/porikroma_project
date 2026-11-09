import pytest
from starlette.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Synchronous test client fixture."""
    with TestClient(app) as test_client:
        yield test_client
