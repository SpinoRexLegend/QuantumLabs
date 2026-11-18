from __future__ import annotations

import math
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

app = FastAPI(title="QuantumLabs API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def prevent_stale_frontend(request: Request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/assets/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


class Operation(BaseModel):
    gate: Literal["h", "x", "y", "z", "s", "t", "rx", "ry", "rz", "cx", "cz", "swap", "ch", "crx", "crz", "cp", "ccx"]
    targets: list[int] = Field(min_length=1, max_length=3)
    angle: float | None = None


class CircuitRequest(BaseModel):
    qubits: int = Field(default=2, ge=1, le=5)
    operations: list[Operation] = Field(default_factory=list, max_length=80)


def _apply(qc: QuantumCircuit, op: Operation, qubits: int) -> None:
    if any(q < 0 or q >= qubits for q in op.targets):
        raise ValueError("A gate targets a qubit outside this circuit.")
    if op.gate == "ccx":
        if len(op.targets) != 3 or len(set(op.targets)) != 3:
            raise ValueError("CCX needs two controls and a distinct target qubit.")
        qc.ccx(op.targets[0], op.targets[1], op.targets[2])
        return
    if op.gate in {"cx", "cz", "swap", "ch", "crx", "crz", "cp"}:
        if len(op.targets) != 2 or op.targets[0] == op.targets[1]:
            raise ValueError(f"{op.gate.upper()} needs distinct control and target qubits.")
        if op.gate in {"crx", "crz", "cp"}:
            if op.angle is None or not math.isfinite(op.angle):
                raise ValueError(f"{op.gate.upper()} needs a finite angle.")
            getattr(qc, op.gate)(op.angle, op.targets[0], op.targets[1])
        else:
            getattr(qc, op.gate)(op.targets[0], op.targets[1])
        return
    if len(op.targets) != 1:
        raise ValueError(f"{op.gate.upper()} needs exactly one target qubit.")
    if op.gate in {"rx", "ry", "rz"}:
        if op.angle is None or not math.isfinite(op.angle):
            raise ValueError(f"{op.gate.upper()} needs a finite angle.")
        getattr(qc, op.gate)(op.angle, op.targets[0])
    else:
        getattr(qc, op.gate)(op.targets[0])


def _bloch_vectors(state: Statevector, qubits: int) -> list[dict[str, float]]:
    amplitudes = np.asarray(state.data, dtype=complex)
    result = []
    for q in range(qubits):
        mask = 1 << q
        coherence = 0j
        z = 0.0
        for index in range(len(amplitudes)):
            if index & mask:
                continue
            a0 = amplitudes[index]
            a1 = amplitudes[index | mask]
            coherence += a0 * np.conjugate(a1)
            z += float(abs(a0) ** 2 - abs(a1) ** 2)
        x = 2.0 * coherence.real
        y = -2.0 * coherence.imag
        purity = (1.0 + float(x * x + y * y + z * z)) / 2.0
        result.append({
            "x": round(float(x), 10),
            "y": round(float(y), 10),
            "z": round(float(z), 10),
            "purity": round(purity, 10),
        })
    return result


def _snapshot(state: Statevector, qubits: int, step: int, label: str) -> dict:
    amplitudes = []
    width = qubits
    for index, value in enumerate(state.data):
        probability = float(abs(value) ** 2)
        amplitudes.append({
            "basis": format(index, f"0{width}b"),
            "real": round(float(value.real), 10),
            "imag": round(float(value.imag), 10),
            "magnitude": round(float(abs(value)), 10),
            "phase": round(float(np.angle(value)), 10) if probability > 1e-14 else 0.0,
            "probability": round(probability, 10),
        })
    return {
        "step": step,
        "label": label,
        "amplitudes": amplitudes,
        "bloch": _bloch_vectors(state, qubits),
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "qiskit-statevector"}


@app.post("/api/simulate")
def simulate(request: CircuitRequest) -> dict:
    circuit = QuantumCircuit(request.qubits)
    state = Statevector.from_int(0, 2**request.qubits)
    snapshots = [_snapshot(state, request.qubits, 0, "Initial |0…0⟩")]
    try:
        for index, operation in enumerate(request.operations, start=1):
            _apply(circuit, operation, request.qubits)
            step_circuit = QuantumCircuit(request.qubits)
            _apply(step_circuit, operation, request.qubits)
            state = state.evolve(step_circuit)
            targets = ", ".join(f"q{q}" for q in operation.targets)
            snapshots.append(_snapshot(state, request.qubits, index, f"{operation.gate.upper()} · {targets}"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "qubits": request.qubits,
        "depth": circuit.depth(),
        "operation_count": len(request.operations),
        "snapshots": snapshots,
    }


app.mount("/assets", StaticFiles(directory=FRONTEND), name="assets")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")
