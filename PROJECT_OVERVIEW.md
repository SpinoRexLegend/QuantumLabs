# QuantumLabs

### Explore quantum circuits. Understand every transformation.

QuantumLabs is an interactive learning environment for quantum computing. It connects circuit construction with visual explanations of quantum states, helping learners understand how gates change amplitudes, phases, probabilities, and entanglement.

Built with Qiskit, the application lets users create circuits, explore established quantum algorithms, and experiment with quantum game theory through a browser interface.

## Project purpose

Quantum computing involves mathematical objects that can be difficult to interpret from circuit diagrams alone. QuantumLabs makes those objects visible. Each circuit operation produces a state snapshot that users can inspect through a timeline, statevector chart, density matrix, and individual Bloch spheres.

The project supports learning through experimentation. Users can predict an outcome, change a gate or rotation angle, and compare the resulting state with their expectations.

## Core capabilities

| Capability | What users can explore |
| --- | --- |
| Interactive circuit composer | Drag gates onto qubit wires, choose targets and controls, and edit or remove operations. |
| Circuit timeline | Inspect the initial state and the state after each gate, or play through the sequence. |
| Statevector visualization | Compare basis-state probabilities and complex phases at the selected circuit step. |
| Interactive 3D Bloch spheres | Rotate the view, inspect individual qubit states, and use direction controls to change state preparation. |
| State density matrix | Inspect the joint-state matrix, including populations and coherences. |
| Custom rotation angles | Enter angles in radians, including expressions such as `pi/2`, for rotation and controlled-phase gates. |
| Editable Qiskit code | View supported Qiskit gate calls, edit them, and apply the changes to the circuit. |
| Experiment controls | Load a Bell state, clear a circuit, or restore an experiment’s starting circuit. |

The simulator currently supports **1–5 qubits and up to 80 operations per circuit**.

### Supported gates

- **Single-qubit gates** — H, X, Y, Z, S, and T.
- **Rotation gates** — RX, RY, and RZ.
- **Multi-qubit gates** — CNOT/CX, CZ, SWAP, CH, CRX, CRZ, and CP.
- **Toffoli gate** — CCX through supported Qiskit code or the simulation API.

## Quantum algorithm library

Each algorithm loads an editable example circuit. Users can step through its operations, change individual gates, and inspect how those changes affect the state.

| Algorithm | Included example | Concept illustrated |
| --- | --- | --- |
| Grover’s algorithm | Two-qubit amplitude amplification marking `\|11⟩` | Amplifying a selected outcome through interference. |
| Simon’s algorithm | Four-qubit circuit with hidden period `s = 11` | Encoding a hidden XOR relationship and inspecting the resulting state. |
| Deutsch’s algorithm | Balanced oracle `f(x) = x` | Using interference to distinguish oracle behavior. |
| Deutsch–Jozsa algorithm | Two-input balanced parity oracle | Extending oracle classification to multiple input bits. |
| Quantum Fourier Transform | Three-qubit QFT with controlled phases and a bit-order swap | Transforming quantum amplitudes and relative phases. |
| Quantum Approximate Optimization Algorithm | One-layer MaxCut circuit for a three-node ring | Exploring how the cost and mixer angles, γ and β, change the output distribution. |

These are small educational circuit examples. QAOA parameters are adjusted interactively, and the example does not include an automatic classical optimization loop.

## Quantum game theory learning session

QuantumLabs introduces quantum game theory through a two-player game involving Alice and Bob. The session uses a Bell-pair preparation and decoding circuit with Prisoner’s Dilemma rewards, connecting strategic choices to gates, measurement probabilities, and expected points.

Five lessons guide the learner through the experience.

1. **Ordinary choices** — Understand cooperation, defection, and the reward table.
2. **A shared quantum state** — Apply H and CNOT to create a Bell pair and examine correlations.
3. **Hidden phase** — Discover how a Z gate changes relative phase while immediate measurement probabilities remain the same.
4. **Reading the result** — Follow decoding gates and connect final outcomes to each player’s reward.
5. **Designing an experiment** — Add or edit gates, vary a rotation angle, and compare predictions with the simulation.

Explanations follow the selected circuit step and show probabilities before and after the current gate. Users can play one round or 100 rounds sampled from the final distribution, then compare observed scores with expected rewards.

This learning model illustrates how preparation, permitted strategies, and decoding rules define a quantum game. Its outcomes apply to the specific game implemented in QuantumLabs.

## A typical learning workflow

1. Start with an empty circuit, a Bell state, or an algorithm preset.
2. Add gates and choose their qubits, controls, and angles.
3. Move through the timeline to observe each transformation.
4. Compare the statevector, Bloch vectors, and density matrix.
5. Modify the circuit and investigate how the result changes.
6. Inspect or edit its supported Qiskit representation.

For example, applying H to `q0` followed by CNOT from `q0` to `q1` creates the Bell state `(\|00⟩ + \|11⟩)/√2`. The probability chart shows equal probabilities for `00` and `11`. Each individual qubit has a mixed reduced state, while the joint two-qubit state remains pure and entangled.

## Technology and simulation model

| Layer | Technology and responsibility |
| --- | --- |
| Frontend | HTML, CSS, JavaScript, and canvas-based visualizations provide circuit editing and state inspection. |
| Backend | Python and FastAPI validate circuit requests and expose simulation endpoints. |
| Quantum engine | Qiskit `QuantumCircuit` and `Statevector` construct and evolve the quantum state. |
| Numerical processing | NumPy supports amplitude calculations and individual Bloch-vector extraction. |
| Local server | Uvicorn serves the API and browser application. |

Each simulation begins in the all-zero state. The backend applies the requested unitary gates in order and returns a snapshot after each operation. The frontend uses those snapshots to synchronize the circuit timeline and visualizations.

The state density matrix is calculated from the joint statevector as `ρ = |ψ⟩⟨ψ|`. Bloch spheres represent individual reduced states, so entanglement can produce vectors inside the sphere. Basis labels follow Qiskit’s bit ordering, with `q0` at the rightmost position.

Simulation uses an ideal statevector model. Hardware noise, physical-device execution, and mid-circuit measurement are outside the current implementation. Game rounds sample the final probabilities locally. The code editor accepts a defined set of circuit gate calls.

## Running the project

### Windows launch

1. Install Python 3.10 or newer.
2. Open the project folder and double-click `start.bat`.
3. On first launch, the startup script creates a virtual environment and installs the required packages if needed.
4. Keep the server window open while using QuantumLabs.
5. Open [QuantumLabs locally](http://127.0.0.1:8000/). The launcher also attempts to open the browser after the server becomes ready.

### Manual launch

From the project folder, after installing the dependencies into `.venv`, run the following in PowerShell.

```powershell
& .\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

The default address is `http://127.0.0.1:8000/`. The server must remain running for the interface and simulations to work. If startup reports that port 8000 is already in use, check the existing server instance before starting another one.

## Project organization

```text
QC Project/
├── backend/
│   ├── app.py               # FastAPI application and Qiskit simulation
│   └── serve.py             # Local server and browser-opening helper
├── frontend/
│   ├── index.html           # Application interface
│   ├── styles.css           # Visual design and responsive layout
│   └── app.js               # Circuit editing, lessons, and visualizations
├── tests/
│   └── test_api.py          # Simulation API checks
├── requirements.txt        # Python dependencies
├── start.bat               # Windows launcher
├── start.ps1               # Environment setup and startup
├── README.md               # Quick-start instructions and API example
└── PROJECT_OVERVIEW.md     # Project showcase
```

## Intended audience

QuantumLabs supports students learning quantum computing, educators demonstrating circuit behavior, and developers experimenting with small Qiskit circuits. Its combination of editable algorithms, multiple state representations, and guided game-theory lessons makes it suitable for classroom demonstrations, independent study, and portfolio presentations.
