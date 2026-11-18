# QuantumLabs

An interactive quantum-circuit visualizer powered by Qiskit. Add gates to a circuit, move through the timeline, and inspect the exact statevector plus every qubit's reduced Bloch vector after each operation.

## Features

- 1–5 qubits and up to 80 operations
- H, X, Y, Z, S, T, RX, RY, RZ, CNOT, and CZ gates
- Gate-by-gate timeline playback
- Statevector probability and complex-phase visualization
- Bloch-sphere visualization with mixed-state detection for entangled qubits
- FastAPI JSON API backed by Qiskit's `Statevector`
- Responsive midnight-green, silver-white, and royal-blue interface

## Run on Windows

1. Install Python 3.10 or newer. During installation, enable the Python launcher (`py`).
2. Double-click `start.bat`. Keep the console window open while using the app.
3. If `.venv` is not already present, the first launch creates it and installs Qiskit and the web server.
4. The app waits for Qiskit to start and then opens <http://127.0.0.1:8000> automatically.

You can also run `powershell -ExecutionPolicy Bypass -File .\start.ps1` from this folder.

## API

`POST /api/simulate`

```json
{
  "qubits": 2,
  "operations": [
    { "gate": "h", "targets": [0] },
    { "gate": "cx", "targets": [0, 1] }
  ]
}
```

The response contains a snapshot for the initial state and after every gate, including basis amplitudes, phases, probabilities, per-qubit Bloch vectors, and purity.
