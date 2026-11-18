from fastapi.testclient import TestClient

from backend.app import app


client = TestClient(app)


def test_bell_state() -> None:
    response = client.post(
        "/api/simulate",
        json={
            "qubits": 2,
            "operations": [
                {"gate": "h", "targets": [0]},
                {"gate": "cx", "targets": [0, 1]},
            ],
        },
    )
    assert response.status_code == 200
    result = response.json()
    final = result["snapshots"][-1]
    probabilities = {item["basis"]: item["probability"] for item in final["amplitudes"]}
    assert probabilities["00"] == 0.5
    assert probabilities["11"] == 0.5
    assert final["bloch"][0]["purity"] == 0.5
    assert final["bloch"][1]["purity"] == 0.5


def test_invalid_control_target_pair() -> None:
    response = client.post(
        "/api/simulate",
        json={"qubits": 2, "operations": [{"gate": "cx", "targets": [0, 0]}]},
    )
    assert response.status_code == 422


def test_custom_rotation_angle() -> None:
    response = client.post(
        "/api/simulate",
        json={"qubits": 1, "operations": [{"gate": "ry", "targets": [0], "angle": 0.37}]},
    )
    assert response.status_code == 200
    final = response.json()["snapshots"][-1]
    assert abs(final["bloch"][0]["x"] - 0.361615432) < 1e-8
    assert abs(final["bloch"][0]["z"] - 0.9323273466) < 1e-8


def test_controlled_rotation_and_swap() -> None:
    response = client.post(
        "/api/simulate",
        json={
            "qubits": 2,
            "operations": [
                {"gate": "x", "targets": [0]},
                {"gate": "crx", "targets": [0, 1], "angle": 3.141592653589793},
                {"gate": "swap", "targets": [0, 1]},
            ],
        },
    )
    assert response.status_code == 200
    probabilities = {item["basis"]: item["probability"] for item in response.json()["snapshots"][-1]["amplitudes"]}
    assert probabilities["11"] == 1.0


def test_qft_phase_and_toffoli_gates() -> None:
    response = client.post(
        "/api/simulate",
        json={
            "qubits": 3,
            "operations": [
                {"gate": "x", "targets": [0]},
                {"gate": "x", "targets": [1]},
                {"gate": "cp", "targets": [0, 2], "angle": 0.25},
                {"gate": "ccx", "targets": [0, 1, 2]},
            ],
        },
    )
    assert response.status_code == 200
    probabilities = {item["basis"]: item["probability"] for item in response.json()["snapshots"][-1]["amplitudes"]}
    assert probabilities["111"] == 1.0
