const state = { qubits: 2, selectedGate: 'h', selectedAlgorithm: 'grover', operations: [], snapshots: [], step: 0, timer: null, request: null, blochViews: {}, mode: 'experiment', savedSessions: {}, baseline: { qubits: 2, operations: [] }, label: 'Custom experiment', gateDraft: null };
const clone = value => JSON.parse(JSON.stringify(value));
state.lesson = 0;
state.rounds = { count: 0, alice: 0, bob: 0, outcomes: [0, 0, 0, 0] };
const gameRewards = { '00': [3, 3], '01': [5, 0], '10': [0, 5], '11': [1, 1] };
const gameLessons = [
  { title: '1. Start with ordinary choices', quantum: false, alice: 'c', bob: 'c', step: 0,
    text: 'Alice and Bob each choose whether to cooperate or defect. Their two choices determine their rewards. In this first circuit, q0 belongs to Alice and q1 to Bob. Both start at 0, which we interpret as cooperation.',
    try: 'Set Alice to Defect · X while Bob keeps Cooperate · I. Alice’s qubit flips to 1. Read the final rewards, then set Bob to Defect too. Which outcome helps both players most?',
    watch: 'With quantum preparation switched off, a flip is an ordinary change of choice. A Z gate has no visible effect on a qubit that is simply 0 or 1.' },
  { title: '2. Build a shared quantum state', quantum: true, alice: 'c', bob: 'c', step: 2,
    text: 'H gives Alice’s qubit equal amplitudes for 0 and 1. CNOT then flips Bob’s qubit only in the part of the state where Alice is 1. Together they create a Bell pair: measuring now gives 00 or 11 with equal probability.',
    try: 'Use Previous gate to inspect the H step, then Next gate to inspect CNOT. Compare the probability bars and Bloch spheres. Continue through the final CNOT and H to see preparation reversed.',
    watch: 'After entangling, each individual Bloch vector shrinks to the center. The pair still has a pure joint state: its information lives in correlations, not in a separate direction for each qubit.' },
  { title: '3. Change something the probability bars cannot show', quantum: true, alice: 'q', bob: 'c', step: 3,
    text: 'Alice’s Z gate changes the sign of the 11 amplitude. The Bell state changes from (|00⟩ + |11⟩)/√2 to (|00⟩ − |11⟩)/√2. The probabilities stay 50% and 50%, even though the state has changed.',
    try: 'Go back one gate, then forward over Z. Compare the phase arrows above the bars. Next, continue through the decoding gates: they turn this relative phase into a different final outcome.',
    watch: 'A minus sign is a relative phase. Gates can combine amplitudes so that they reinforce or cancel each other. This is interference.' },
  { title: '4. Read the result and play rounds', quantum: true, alice: 'q', bob: 'c', step: null,
    text: 'The decoding CNOT and H convert Alice’s phase change into the final state |01⟩. Qiskit writes Bob’s bit first, then Alice’s: Bob reads 0 and Alice reads 1. In game language, Alice defects and Bob cooperates.',
    try: 'Play one round. This preset gives Alice 5 points and Bob 0 every time. Change Alice’s strategy to Cooperate and compare. With a circuit that has several nonzero final probabilities, try 100 rounds and compare the frequencies with the probability bars.',
    watch: 'Expected payoff means the average points over many rounds: multiply each outcome’s probability by its reward, then add the results. It is not necessarily the score of one round.' },
  { title: '5. Design your own quantum strategy', quantum: true, alice: 'c', bob: 'c', step: null,
    text: 'Now you control the experiment. Adding, removing, or editing gates changes the shared state, possible outcomes, and rewards. Make a prediction first, then compare it with the simulation.',
    try: 'Click RY in the palette. Choose q0, angle pi/2, and Insert after step 2, between preparation and decoding. Apply it, then show the final result. You should see both-cooperate and both-defect at about 50% each; each player’s expected reward is 2 points.',
    watch: 'Try pi/4 next, or remove the rotation. Restore starting circuit returns to the lesson preset. The matrix and editable Qiskit code below show the same circuit in other forms.' }
];

function renderLesson() {
  const lesson = gameLessons[state.lesson];
  el('lessonContent').innerHTML = `<span class="lesson-progress">Lesson ${state.lesson + 1} of ${gameLessons.length}</span><h3>${lesson.title}</h3><p>${lesson.text}</p><div class="learning-prompt"><strong>Try it yourself</strong><p>${lesson.try}</p></div><p><strong>What to notice:</strong> ${lesson.watch}</p><button id="restartLesson">Restart this lesson</button>`;
  el('restartLesson').addEventListener('click', () => loadLesson(state.lesson));
  document.querySelectorAll('[data-lesson]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.lesson) === state.lesson));
  el('previousLesson').disabled = state.lesson === 0;
  el('nextLesson').disabled = state.lesson === gameLessons.length - 1;
}

function loadLesson(index) {
  state.lesson = Math.max(0, Math.min(gameLessons.length - 1, index));
  const lesson = gameLessons[state.lesson];
  el('useEntanglement').checked = lesson.quantum;
  el('aliceStrategy').value = lesson.alice; el('bobStrategy').value = lesson.bob;
  renderLesson(); buildGame(lesson.step);
}
const el = id => document.getElementById(id);
const isRotation = gate => ['rx', 'ry', 'rz', 'crx', 'crz', 'cp'].includes(gate);
const isControlled = gate => ['cx', 'cz', 'swap', 'ch', 'crx', 'crz', 'cp', 'ccx'].includes(gate);

const algorithmInfo = {
  grover: 'Two-qubit amplitude amplification marking |11⟩.',
  simon: 'A four-qubit Simon circuit with hidden period s = 11.',
  deutsch: 'Deutsch’s algorithm with a balanced oracle f(x) = x.',
  deutschJozsa: 'Two-input Deutsch–Jozsa with a balanced parity oracle.',
  qft: 'A three-qubit QFT with controlled phases and bit-order swap.',
  qaoa: 'One-layer QAOA for MaxCut on a three-node ring; edit γ and β.'
};

function algorithmCircuit(name) {
  const one = q => ({ gate: 'h', targets: [q] });
  if (name === 'grover') return { qubits: 2, operations: [one(0), one(1), { gate: 'cz', targets: [0, 1] }, one(0), one(1), { gate: 'x', targets: [0] }, { gate: 'x', targets: [1] }, one(1), { gate: 'cx', targets: [0, 1] }, one(1), { gate: 'x', targets: [0] }, { gate: 'x', targets: [1] }, one(0), one(1)] };
  if (name === 'simon') return { qubits: 4, operations: [one(0), one(1), { gate: 'cx', targets: [0, 2] }, { gate: 'cx', targets: [1, 2] }, { gate: 'cx', targets: [0, 3] }, { gate: 'cx', targets: [1, 3] }, one(0), one(1)] };
  if (name === 'deutsch') return { qubits: 2, operations: [{ gate: 'x', targets: [1] }, one(0), one(1), { gate: 'cx', targets: [0, 1] }, one(0)] };
  if (name === 'deutschJozsa') return { qubits: 3, operations: [{ gate: 'x', targets: [2] }, one(0), one(1), one(2), { gate: 'cx', targets: [0, 2] }, { gate: 'cx', targets: [1, 2] }, one(0), one(1)] };
  if (name === 'qft') return { qubits: 3, operations: [one(0), { gate: 'cp', targets: [1, 0], angle: Math.PI / 2 }, { gate: 'cp', targets: [2, 0], angle: Math.PI / 4 }, one(1), { gate: 'cp', targets: [2, 1], angle: Math.PI / 2 }, one(2), { gate: 'swap', targets: [0, 2] }] };
  const gamma = Number(el('qaoaGamma').value), beta = Number(el('qaoaBeta').value);
  const operations = [one(0), one(1), one(2)];
  [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => operations.push({ gate: 'cx', targets: [a, b] }, { gate: 'rz', targets: [b], angle: 2 * gamma }, { gate: 'cx', targets: [a, b] }));
  [0, 1, 2].forEach(q => operations.push({ gate: 'rx', targets: [q], angle: 2 * beta }));
  return { qubits: 3, operations };
}

function loadAlgorithm() {
  const selected = state.selectedAlgorithm;
  const circuit = algorithmCircuit(selected);
  state.qubits = circuit.qubits;
  state.operations = circuit.operations;
  state.baseline = clone(circuit);
  state.label = `${selected === 'deutschJozsa' ? 'Deutsch–Jozsa' : selected.toUpperCase()} experiment`;
  updateQubitControls();
  simulate();
}

function setGate(gate) {
  state.selectedGate = gate;
  document.querySelectorAll('.gate').forEach(button => button.classList.toggle('active', button.dataset.gate === gate));
}

function updateQubitControls() {
  el('qubitCount').textContent = state.qubits;
}

function openGateDialog(gate, target = null, editIndex = null, position = state.step) {
  if (state.timer) { clearInterval(state.timer); state.timer = null; el('playSteps').textContent = '▶ Play'; }
  const op = editIndex == null ? null : state.operations[editIndex];
  state.gateDraft = { gate, editIndex };
  const options = Array.from({ length: state.qubits }, (_, q) => `<option value="${q}">q${q}</option>`).join('');
  ['dialogTarget', 'dialogControl', 'dialogSecond'].forEach(id => { el(id).innerHTML = options; });
  el('dialogTarget').value = op ? op.targets.at(-1) : (target ?? 0);
  el('dialogControl').value = op ? op.targets[0] : (Number(el('dialogTarget').value) === 0 ? Math.min(1, state.qubits - 1) : 0);
  el('dialogSecond').value = op?.targets[1] ?? Math.min(2, state.qubits - 1);
  el('dialogControlWrap').classList.toggle('hidden', !isControlled(gate));
  el('dialogSecondWrap').classList.toggle('hidden', gate !== 'ccx');
  el('dialogAngleWrap').classList.toggle('hidden', !isRotation(gate));
  el('dialogAngle').value = op?.angle ?? '';
  el('dialogPositionWrap').classList.toggle('hidden', editIndex != null);
  el('dialogPosition').max = state.operations.length;
  el('dialogPosition').value = position;
  el('dialogError').textContent = '';
  el('gateDialogTitle').textContent = `${editIndex == null ? 'Place' : 'Edit'} ${gate.toUpperCase()} gate`;
  el('gateDialog').showModal();
  if (isRotation(gate)) el('dialogAngle').focus();
}

function commitGate(event) {
  event.preventDefault();
  try {
    const { gate, editIndex } = state.gateDraft;
    const target = Number(el('dialogTarget').value), control = Number(el('dialogControl').value);
    const targets = gate === 'ccx' ? [control, Number(el('dialogSecond').value), target] : isControlled(gate) ? [control, target] : [target];
    if (new Set(targets).size !== targets.length) throw new Error('Choose distinct qubits for this gate.');
    const operation = { gate, targets };
    if (isRotation(gate)) {
      if (!el('dialogAngle').value.trim()) throw new Error('Please enter angle θ in radians.');
      operation.angle = parseAngle(el('dialogAngle').value);
    }
    if (editIndex == null) {
      const position = Number(el('dialogPosition').value);
      if (!Number.isInteger(position) || position < 0 || position > state.operations.length) throw new Error('Choose a valid insertion step.');
      if (state.operations.length >= 80) throw new Error('This circuit already has 80 gates. Remove a gate first.');
      state.operations.splice(position, 0, operation);
    } else state.operations[editIndex] = operation;
    el('gateDialog').close();
    simulate();
  } catch (error) {
    el('dialogError').textContent = error.message;
  }
}

function gateLabel(op) { return op.gate.toUpperCase(); }

function renderCircuit() {
  const rows = Array.from({ length: state.qubits }, (_, q) => {
    const slots = state.operations.map((op, index) => {
      const step = index + 1;
      let content = '';
      if (op.gate === 'ccx') {
        if (op.targets[0] === q || op.targets[1] === q) content = '<span class="control-dot"></span>';
        if (op.targets[2] === q) content = '<span class="target-plus"></span>';
      } else if (isControlled(op.gate)) {
        if (op.targets[0] === q) content = op.gate === 'swap' ? '<span class="swap-mark">×</span>' : '<span class="control-dot"></span>';
        if (op.targets[1] === q) {
          if (op.gate === 'cx') content = '<span class="target-plus"></span>';
          else if (op.gate === 'swap') content = '<span class="swap-mark">×</span>';
          else content = `<button class="circuit-gate ${step < state.step ? 'past' : ''} ${step === state.step ? 'current' : ''}" data-step="${step}">${gateLabel(op).replace('C', '')}</button>`;
        }
      } else if (op.targets[0] === q) {
        content = `<button class="circuit-gate ${step < state.step ? 'past' : ''} ${step === state.step ? 'current' : ''}" data-step="${step}">${gateLabel(op)}</button>`;
      }
      return `<div class="slot" data-op="${index}">${content}</div>`;
    }).join('');
    return `<div class="wire-row" data-qubit="${q}" title="Drop a gate on q${q}"><span class="q-label">q${q}</span><div class="gate-slots">${slots || '<div class="slot drop-prompt">DROP</div>'}</div></div>`;
  }).join('');
  el('circuit').innerHTML = rows;
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.step))));
  document.querySelectorAll('.wire-row').forEach(row => {
    row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', event => {
      event.preventDefault(); row.classList.remove('drag-over');
      const gate = event.dataTransfer.getData('text/quantum-gate');
      if (!gate) return;
      setGate(gate);
      const slot = event.target.closest('[data-op]');
      openGateDialog(gate, Number(row.dataset.qubit), null, slot ? Number(slot.dataset.op) : state.operations.length);
    });
  });
  el('experimentLabel').textContent = state.label;
  el('operationList').innerHTML = state.operations.length ? state.operations.map((op, index) => `<div class="operation-row"><button class="inspect-operation" data-inspect="${index}">${index + 1}. ${op.gate.toUpperCase()} · ${op.targets.map(q => `q${q}`).join(' → ')}${op.angle == null ? '' : ` · θ=${op.angle.toFixed(3)}`}</button><button data-edit="${index}">Edit</button><button data-remove="${index}" aria-label="Remove gate ${index + 1}">Remove</button></div>`).join('') : '<p class="interaction-hint">Empty circuit. Choose a gate to start experimenting.</p>';
  document.querySelectorAll('[data-inspect]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.inspect) + 1)));
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { const i = Number(button.dataset.edit); openGateDialog(state.operations[i].gate, null, i); }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { state.operations.splice(Number(button.dataset.remove), 1); simulate(); }));
}

function renderStatevector(snapshot) {
  const visible = snapshot.amplitudes.filter(item => item.probability > 1e-8);
  const data = visible.length ? visible : snapshot.amplitudes;
  el('statevector').innerHTML = data.map(item => {
    const height = Math.max(1, item.probability * 190);
    const degrees = item.phase * 180 / Math.PI;
    return `<div class="amplitude"><div class="bar" style="height:${height}px"><span class="phase-arrow" style="transform:rotate(${degrees}deg)">→</span><span class="probability-label">${(item.probability * 100).toFixed(1)}%</span></div><span class="basis">|${item.basis}⟩</span></div>`;
  }).join('');
}

function blochView(qubit) {
  if (!state.blochViews[qubit]) state.blochViews[qubit] = { yaw: -0.62, pitch: 0.42 };
  return state.blochViews[qubit];
}

function rotateToView(point, view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const x1 = cy * point.x + sy * point.z;
  const z1 = -sy * point.x + cy * point.z;
  return { x: x1, y: cp * point.y - sp * z1, z: sp * point.y + cp * z1 };
}

function rotateFromView(point, view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const y1 = cp * point.y + sp * point.z;
  const z1 = -sp * point.y + cp * point.z;
  return { x: cy * point.x - sy * z1, y: y1, z: sy * point.x + cy * z1 };
}

function drawBloch(canvas, vector, qubit = Number(canvas.dataset.qubit || 0)) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = 240; canvas.width = size * dpr; canvas.height = size * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cx = 120, cy = 120, radius = 82, view = blochView(qubit);
  const project = point => {
    const p = rotateToView(point, view);
    const perspective = 1 + p.z * 0.06;
    return { x: cx + p.x * radius * perspective, y: cy - p.y * radius * perspective, depth: p.z };
  };
  ctx.clearRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(100, 88, 12, cx, cy, radius + 22);
  glow.addColorStop(0, 'rgba(58,111,124,.24)'); glow.addColorStop(1, 'rgba(1,12,15,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2); ctx.fill();
  const curve = (points, alpha = .28) => {
    ctx.beginPath();
    points.forEach((point, index) => { const p = project(point); index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = `rgba(151,190,190,${alpha})`; ctx.lineWidth = 1; ctx.stroke();
  };
  for (let lat = -60; lat <= 60; lat += 30) {
    const a = lat * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    curve(Array.from({ length: 65 }, (_, i) => { const t = i * Math.PI * 2 / 64; return { x: c * Math.cos(t), y: c * Math.sin(t), z: s }; }));
  }
  for (let lon = 0; lon < 180; lon += 30) {
    const a = lon * Math.PI / 180;
    curve(Array.from({ length: 65 }, (_, i) => { const t = i * Math.PI * 2 / 64; return { x: Math.cos(t) * Math.cos(a), y: Math.cos(t) * Math.sin(a), z: Math.sin(t) }; }), .2);
  }
  const axes = [
    { positive: '|+⟩', negative: '|−⟩', p: { x: 1.18, y: 0, z: 0 } },
    { positive: '|+i⟩', negative: '|−i⟩', p: { x: 0, y: 1.18, z: 0 } },
    { positive: '|0⟩', negative: '|1⟩', p: { x: 0, y: 0, z: 1.18 } }
  ];
  ctx.font = 'italic 13px Georgia'; ctx.fillStyle = '#a8c5c5'; ctx.strokeStyle = 'rgba(205,230,228,.42)';
  axes.forEach(axis => { const positive = project(axis.p), negative = project({ x: -axis.p.x, y: -axis.p.y, z: -axis.p.z }); ctx.beginPath(); ctx.moveTo(negative.x, negative.y); ctx.lineTo(positive.x, positive.y); ctx.stroke(); ctx.fillText(axis.positive, positive.x + 4, positive.y - 3); ctx.fillText(axis.negative, negative.x + 4, negative.y - 3); });
  const end = project(vector);
  ctx.strokeStyle = '#7394ff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(end.x, end.y); ctx.stroke();
  const angle = Math.atan2(end.y - cy, end.x - cx); ctx.fillStyle = '#9bb1ff'; ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - 11 * Math.cos(angle - .45), end.y - 11 * Math.sin(angle - .45)); ctx.lineTo(end.x - 11 * Math.cos(angle + .45), end.y - 11 * Math.sin(angle + .45)); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(end.x, end.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#dce5ff'; ctx.fill();
}

function renderBloch(snapshot) {
  el('blochGrid').innerHTML = snapshot.bloch.map((v, q) => `<div class="bloch-card"><canvas id="bloch-${q}" class="editable-bloch" data-qubit="${q}" aria-label="Rotatable 3D Bloch sphere for qubit ${q}" title="Drag to rotate; click to prepare q${q}"></canvas><div class="bloch-caption"><b>q${q}</b><span>x ${v.x.toFixed(2)}</span><span>y ${v.y.toFixed(2)}</span><span>z ${v.z.toFixed(2)}</span><span class="${v.purity < .999 ? 'mixed' : ''}">${v.purity < .999 ? 'mixed' : 'pure'}</span></div><div class="bloch-states" data-qubit="${q}"><button data-state="0">|0⟩</button><button data-state="1">|1⟩</button><button data-state="+">|+⟩</button><button data-state="-">|−⟩</button><button data-state="+i">|+i⟩</button><button data-state="-i">|−i⟩</button></div></div>`).join('');
  snapshot.bloch.forEach((vector, q) => {
    const canvas = el(`bloch-${q}`); drawBloch(canvas, vector, q);
    let active = false, moved = false, startX = 0, startY = 0, startYaw = 0, startPitch = 0;
    canvas.addEventListener('pointerdown', event => { const view = blochView(q); active = true; moved = false; startX = event.clientX; startY = event.clientY; startYaw = view.yaw; startPitch = view.pitch; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!active) return;
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      if (moved) { const view = blochView(q); view.yaw = startYaw + dx * .012; view.pitch = Math.max(-1.45, Math.min(1.45, startPitch + dy * .012)); drawBloch(canvas, vector, q); }
    });
    canvas.addEventListener('pointerup', event => { active = false; canvas.releasePointerCapture(event.pointerId); if (!moved) prepareBloch(q, event, canvas); });
  });
  document.querySelectorAll('.bloch-states button').forEach(button => button.addEventListener('click', () => {
    const qubit = Number(button.parentElement.dataset.qubit);
    const directions = { '0': { x: 0, y: 0, z: 1 }, '1': { x: 0, y: 0, z: -1 }, '+': { x: 1, y: 0, z: 0 }, '-': { x: -1, y: 0, z: 0 }, '+i': { x: 0, y: 1, z: 0 }, '-i': { x: 0, y: -1, z: 0 } };
    applyBlochVector(qubit, directions[button.dataset.state]);
  }));
}

function blochVectorFromPointer(event, canvas) {
  const rect = canvas.getBoundingClientRect(), radius = rect.width * (82 / 240);
  let x = (event.clientX - rect.left - rect.width / 2) / radius;
  let y = -(event.clientY - rect.top - rect.height / 2) / radius;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  const depth = (event.shiftKey ? -1 : 1) * Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return { ...rotateFromView({ x, y, z: depth }, blochView(Number(canvas.dataset.qubit))), purity: 1 };
}

function prepareBloch(qubit, event, canvas) {
  applyBlochVector(qubit, blochVectorFromPointer(event, canvas));
}

function applyBlochVector(qubit, { x, y, z }) {
  const theta = Math.acos(Math.max(-1, Math.min(1, z)));
  const phi = Math.atan2(y, x);
  state.operations = state.operations.filter(op => !op.targets.includes(qubit));
  if (theta > 1e-8) state.operations.push({ gate: 'ry', targets: [qubit], angle: theta });
  if (Math.abs(phi) > 1e-8) state.operations.push({ gate: 'rz', targets: [qubit], angle: phi });
  simulate();
}

function complexText(real, imag) {
  const clean = value => Math.abs(value) < 1e-9 ? 0 : value;
  real = clean(real); imag = clean(imag);
  if (imag === 0) return real.toFixed(3);
  if (real === 0) return `${imag.toFixed(3)}i`;
  return `${real.toFixed(3)}${imag >= 0 ? '+' : ''}${imag.toFixed(3)}i`;
}

function renderMatrix(snapshot) {
  if (!el('matrixDetails').open) return;
  const amps = snapshot.amplitudes;
  const header = amps.map(a => `<th>|${a.basis}⟩</th>`).join('');
  const rows = amps.map((row, i) => {
    const cells = amps.map((col, j) => {
      const real = row.real * col.real + row.imag * col.imag;
      const imag = row.imag * col.real - row.real * col.imag;
      const strength = Math.min(1, Math.hypot(real, imag));
      return `<td style="--strength:${strength}" title="ρ[${i},${j}]">${complexText(real, imag)}</td>`;
    }).join('');
    return `<tr><th>|${row.basis}⟩</th>${cells}</tr>`;
  }).join('');
  el('stateMatrix').innerHTML = `<table><thead><tr><th>ρ</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function qiskitCode() {
  const calls = state.operations.map(op => {
    const args = [...(op.angle == null ? [] : [Number(op.angle.toFixed(10))]), ...op.targets].join(', ');
    return `qc.${op.gate}(${args})`;
  }).join('\n');
  return `from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(${state.qubits})\n${calls}`;
}

function parseAngle(expression) {
  const normalized = expression.trim().toLowerCase().replaceAll('pi', `(${Math.PI})`);
  if (!/^[0-9+\-*/().\s]+$/.test(normalized)) throw new Error(`Invalid angle: ${expression}`);
  const value = Function(`"use strict"; return (${normalized})`)();
  if (!Number.isFinite(value)) throw new Error(`Invalid angle: ${expression}`);
  return value;
}

function applyQiskitCode() {
  try {
    const source = el('qiskitCode').value;
    const circuitMatch = source.match(/QuantumCircuit\s*\(\s*(\d+)\s*\)/i);
    if (!circuitMatch) throw new Error('Add qc = QuantumCircuit(number_of_qubits).');
    const qubits = Number(circuitMatch[1]);
    if (qubits < 1 || qubits > 5) throw new Error('Choose between 1 and 5 qubits.');
    const supported = new Set(['h','x','y','z','s','t','rx','ry','rz','cx','cz','swap','ch','crx','crz','cp','ccx']);
    const operations = [];
    for (const match of source.matchAll(/qc\.([a-z]+)\s*\(([^)]*)\)/gi)) {
      const gate = match[1].toLowerCase();
      if (!supported.has(gate)) throw new Error(`Unsupported gate: ${gate}`);
      const parts = match[2].split(',').map(part => part.trim()).filter(Boolean);
      const rotating = isRotation(gate);
      const angle = rotating ? parseAngle(parts.shift()) : null;
      const targets = parts.map(Number);
      if (targets.some(q => !Number.isInteger(q))) throw new Error(`Invalid qubit in ${match[0]}.`);
      operations.push({ gate, targets, ...(rotating ? { angle } : {}) });
    }
    state.qubits = qubits; state.operations = operations;
    updateQubitControls(); simulate();
  } catch (error) {
    el('errorBanner').textContent = error.message;
    el('errorBanner').classList.remove('hidden');
  }
}

function showStep(step) {
  if (!state.snapshots.length) return;
  state.step = Math.max(0, Math.min(step, state.snapshots.length - 1));
  const snapshot = state.snapshots[state.step];
  el('stepSlider').value = state.step;
  el('stepNumber').textContent = `STEP ${state.step}`;
  el('stepLabel').textContent = snapshot.label;
  renderCircuit(); renderStatevector(snapshot); renderBloch(snapshot); renderMatrix(snapshot); renderGamePayoffs(snapshot);
}

function buildGame(initialStep = null) {
  if (typeof initialStep !== 'number') initialStep = null;
  state.qubits = 2;
  const quantum = el('useEntanglement').checked;
  const operations = quantum ? [{ gate: 'h', targets: [0] }, { gate: 'cx', targets: [0, 1] }] : [];
  ['aliceStrategy', 'bobStrategy'].forEach((id, q) => {
    const strategy = el(id).value;
    if (strategy !== 'c') operations.push({ gate: strategy === 'd' ? 'x' : 'z', targets: [q] });
  });
  if (quantum) operations.push({ gate: 'cx', targets: [0, 1] }, { gate: 'h', targets: [0] });
  state.operations = operations;
  state.baseline = clone({ qubits: 2, operations });
  state.label = `${quantum ? 'Quantum' : 'Classical'} game · Lesson ${state.lesson + 1}`;
  updateQubitControls(); simulate(initialStep);
}

function switchLab(mode) {
  if (state.mode === mode) return;
  if (state.timer) { clearInterval(state.timer); state.timer = null; el('playSteps').textContent = '▶ Play'; }
  state.savedSessions[state.mode] = clone({ qubits: state.qubits, operations: state.operations, baseline: state.baseline, label: state.label });
  state.mode = mode;
  el('experimentTab').setAttribute('aria-pressed', mode === 'experiment');
  el('gameTab').setAttribute('aria-pressed', mode === 'game');
  el('algorithmCard').classList.toggle('hidden', mode === 'game');
  el('gamePanel').classList.toggle('hidden', mode !== 'game');
  el('plusQubit').disabled = mode === 'game';
  el('minusQubit').disabled = mode === 'game';
  if (state.savedSessions[mode]) { Object.assign(state, clone(state.savedSessions[mode])); updateQubitControls(); simulate(); }
  else loadLesson(0);
}

function renderGamePayoffs(snapshot) {
  if (state.mode !== 'game') return;
  renderCircuitTutor(snapshot);
  if (state.qubits !== 2) { el('gamePayoffs').textContent = 'Payoffs require a two-qubit circuit. Rebuild the game to restore it.'; ['playOneRound', 'playManyRounds'].forEach(id => { el(id).disabled = true; }); return; }
  let alice = 0, bob = 0;
  const outcomes = snapshot.amplitudes.map(a => {
    const [aPayoff, bPayoff] = gameRewards[a.basis];
    alice += a.probability * aPayoff; bob += a.probability * bPayoff;
    const aliceChoice = a.basis[1] === '0' ? 'cooperates' : 'defects', bobChoice = a.basis[0] === '0' ? 'cooperates' : 'defects';
    return `<div class="game-outcome"><span>Alice ${aliceChoice}<br>Bob ${bobChoice}</span><strong>${(a.probability * 100).toFixed(1)}%</strong><small>${aPayoff} / ${bPayoff} points · |${a.basis}⟩</small></div>`;
  });
  const final = state.step === state.operations.length;
  el('gamePayoffs').innerHTML = `<h3>${final ? 'Final outcome probabilities' : 'If you measured at this step'}</h3><p>${final ? 'These are the probabilities used when you play a round.' : 'The circuit has more gates to run. These intermediate values are a preview, not the finished game score.'}</p><div class="game-outcomes">${outcomes.join('')}</div><p class="expected-payoff">${final ? 'Expected points per round' : 'Hypothetical points at this step'}: Alice <strong>${alice.toFixed(2)}</strong> · Bob <strong>${bob.toFixed(2)}</strong></p>`;
  ['playOneRound', 'playManyRounds'].forEach(id => { el(id).disabled = !final; });
}

function renderCircuitTutor(snapshot) {
  const op = state.operations[state.step - 1];
  const previous = state.snapshots[Math.max(0, state.step - 1)];
  const descriptions = {
    h: 'H (Hadamard) mixes the 0 and 1 amplitudes. On a starting 0 it makes equally likely outcomes; later it can turn phase differences into different probabilities.',
    x: 'X flips 0 and 1. For a superposition, it swaps their amplitudes. In classical mode this changes cooperate to defect or the reverse.',
    y: 'Y swaps the 0 and 1 amplitudes while also changing their phases.',
    z: 'Z reverses the sign of the 1 amplitude. Probabilities immediately before and after Z are identical, but later gates can reveal that phase change.',
    s: 'S turns the phase of the 1 amplitude by a quarter turn; this can affect later interference.',
    t: 'T turns the phase of the 1 amplitude by one eighth of a full turn.',
    cx: 'CNOT flips its target only when the control is 1. On a superposed control it can create correlations; in the decoding stage it can also undo them.',
    cz: 'CZ reverses the sign of the joint 11 amplitude. It changes phase without changing these immediate probabilities.',
    swap: 'SWAP exchanges the two qubits’ states.',
    ch: 'CH applies H to its target in the part of the joint state where the control is 1.',
    ccx: 'Toffoli flips its target only when both control qubits are 1.',
    rx: 'RX rotates a qubit’s state around its x direction by angle θ. It can change outcome probabilities and phases.',
    ry: 'RY rotates a qubit’s state around its y direction by angle θ. Vary the angle to explore different amplitudes.',
    rz: 'RZ rotates a qubit’s state around its z direction. It changes relative phases, which later gates may reveal.',
    crx: 'CRX applies an x rotation to the target when the control is 1.',
    crz: 'CRZ applies a z rotation to the target when the control is 1.',
    cp: 'CP adds a phase to the joint 11 amplitude. Immediate outcome probabilities stay the same.'
  };
  const summary = snap => snap.amplitudes.filter(a => a.probability > .00001).map(a => `|${a.basis}⟩ ${(a.probability * 100).toFixed(1)}%`).join(' · ');
  const changed = state.qubits !== state.baseline.qubits || JSON.stringify(state.operations) !== JSON.stringify(state.baseline.operations);
  const purity = snapshot.bloch.map((v, q) => `q${q}: ${v.purity < .9999 ? 'mixed individual state' : 'pure individual state'}`).join(' · ');
  const entangled = state.qubits === 2 && snapshot.bloch.some(v => v.purity < .9999);
  const correlation = state.qubits !== 2 ? 'This lesson’s game scoring needs two qubits. Restart the lesson to return to Alice and Bob’s circuit.' : entangled ? 'The pair is entangled. Its correlations belong to the joint state, even though each individual qubit has a mixed state.' : 'For this pure two-qubit simulation, pure individual states mean the pair is not entangled.';
  el('circuitTutor').innerHTML = `<span class="lesson-progress">Circuit step ${state.step} of ${state.operations.length}${changed ? ' · Your edited circuit' : ''}</span><h3>${op ? `${op.gate.toUpperCase()} on ${op.targets.map(q => q === 0 ? 'Alice (q0)' : q === 1 ? 'Bob (q1)' : `q${q}`).join(' → ')}` : 'Before any gates: the starting state'}</h3><p>${op ? descriptions[op.gate] || 'This gate changes the quantum state.' : 'All qubits start at 0. For the two-player game, measuring now means both players cooperate.'}${op?.angle == null ? '' : ` The angle is ${op.angle.toFixed(4)} radians.`}</p><div class="before-after"><p><strong>Before:</strong> ${summary(previous)}</p><p><strong>Now:</strong> ${summary(snapshot)}</p></div><p>${purity}. ${correlation}</p><p class="interaction-hint">Read |ab⟩ as Bob’s bit a, then Alice’s bit b. To experiment, use Edit / Remove in the gate list below, or click a palette gate and choose an insertion step.</p>`;
  el('gameStepBack').disabled = state.step === 0;
  el('gameStepNext').disabled = state.step === state.operations.length;
}

function renderRounds() {
  const r = state.rounds;
  el('roundResults').innerHTML = r.count ? `<strong>${r.count} rounds played</strong><p>Total points: Alice ${r.alice} · Bob ${r.bob}. Average per round: Alice ${(r.alice / r.count).toFixed(2)} · Bob ${(r.bob / r.count).toFixed(2)}.</p><p>Observed outcomes: CC ${r.outcomes[0]} · DC ${r.outcomes[1]} · CD ${r.outcomes[2]} · DD ${r.outcomes[3]}. Counts may vary between runs when outcomes are uncertain.</p>` : 'No rounds yet. Show the final result, then play a round. Scores reset whenever the circuit changes.';
}

function resetRounds() {
  state.rounds = { count: 0, alice: 0, bob: 0, outcomes: [0, 0, 0, 0] };
  renderRounds();
}

function playRounds(count) {
  if (state.mode !== 'game' || state.qubits !== 2 || state.step !== state.operations.length || !state.snapshots.length) return;
  const amplitudes = state.snapshots.at(-1).amplitudes;
  for (let i = 0; i < count; i++) {
    const random = Math.random(); let cumulative = 0, outcome = amplitudes.at(-1);
    for (const a of amplitudes) { cumulative += a.probability; if (random < cumulative) { outcome = a; break; } }
    const [alice, bob] = gameRewards[outcome.basis];
    state.rounds.count++; state.rounds.alice += alice; state.rounds.bob += bob;
    state.rounds.outcomes[parseInt(outcome.basis, 2)]++;
  }
  renderRounds();
}

async function simulate(initialStep = null) {
  el('errorBanner').classList.add('hidden');
  ['playOneRound', 'playManyRounds'].forEach(id => { el(id).disabled = true; });
  if (state.request) state.request.abort();
  const request = new AbortController();
  state.request = request;
  try {
    const response = await fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal, body: JSON.stringify({ qubits: state.qubits, operations: state.operations }) });
    const result = await response.json();
    if (request !== state.request) return;
    if (!response.ok) throw new Error(result.detail || 'Simulation failed.');
    state.snapshots = result.snapshots;
    el('stepSlider').max = Math.max(0, result.snapshots.length - 1);
    el('circuitMeta').textContent = `${result.operation_count} gate${result.operation_count === 1 ? '' : 's'} · depth ${result.depth}`;
    el('engineStatus').textContent = 'Qiskit engine online';
    el('qiskitCode').value = qiskitCode();
    if (state.mode === 'game') resetRounds();
    showStep(typeof initialStep === 'number' ? initialStep : result.snapshots.length - 1);
  } catch (error) {
    if (error.name === 'AbortError') return;
    el('engineStatus').textContent = 'Engine unavailable';
    el('errorBanner').textContent = `${error.message} Start the Python server, then refresh.`;
    el('errorBanner').classList.remove('hidden');
  }
}

document.querySelectorAll('.gate').forEach(button => {
  button.draggable = true;
  button.addEventListener('click', () => { setGate(button.dataset.gate); openGateDialog(button.dataset.gate); });
  button.addEventListener('dragstart', event => {
    setGate(button.dataset.gate);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/quantum-gate', button.dataset.gate);
    button.classList.add('dragging');
  });
  button.addEventListener('dragend', () => button.classList.remove('dragging'));
});
function updateAlgorithmControls() {
  const selected = state.selectedAlgorithm;
  el('algorithmDescription').textContent = algorithmInfo[selected];
  el('qaoaParameters').classList.toggle('hidden', selected !== 'qaoa');
  document.querySelectorAll('[data-algorithm]').forEach(button => button.classList.toggle('active', button.dataset.algorithm === selected));
}
document.querySelectorAll('[data-algorithm]').forEach(button => button.addEventListener('click', () => { state.selectedAlgorithm = button.dataset.algorithm; updateAlgorithmControls(); loadAlgorithm(); }));
el('loadAlgorithm').addEventListener('click', loadAlgorithm);
el('qaoaGamma').addEventListener('change', () => { if (state.selectedAlgorithm === 'qaoa') loadAlgorithm(); });
el('qaoaBeta').addEventListener('change', () => { if (state.selectedAlgorithm === 'qaoa') loadAlgorithm(); });
el('plusQubit').addEventListener('click', () => { if (state.qubits < 5) { state.qubits++; state.operations = state.operations.filter(op => op.targets.every(q => q < state.qubits)); updateQubitControls(); simulate(); } });
el('minusQubit').addEventListener('click', () => { if (state.qubits > 1) { state.qubits--; state.operations = state.operations.filter(op => op.targets.every(q => q < state.qubits)); updateQubitControls(); simulate(); } });
el('gateForm').addEventListener('submit', commitGate);
el('cancelGate').addEventListener('click', () => el('gateDialog').close());
el('restoreExperiment').addEventListener('click', () => { const baseline = clone(state.baseline); state.qubits = baseline.qubits; state.operations = baseline.operations; updateQubitControls(); simulate(); });
el('experimentTab').addEventListener('click', () => switchLab('experiment'));
el('gameTab').addEventListener('click', () => switchLab('game'));
el('resetGame').addEventListener('click', buildGame);
document.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click', () => loadLesson(Number(button.dataset.lesson))));
el('previousLesson').addEventListener('click', () => loadLesson(state.lesson - 1));
el('nextLesson').addEventListener('click', () => loadLesson(state.lesson + 1));
el('useEntanglement').addEventListener('change', () => buildGame());
el('gameStepBack').addEventListener('click', () => showStep(state.step - 1));
el('gameStepNext').addEventListener('click', () => showStep(state.step + 1));
el('gameGoFinal').addEventListener('click', () => showStep(state.operations.length));
el('playOneRound').addEventListener('click', () => playRounds(1));
el('playManyRounds').addEventListener('click', () => playRounds(100));
el('clearRounds').addEventListener('click', resetRounds);
el('aliceStrategy').addEventListener('change', buildGame);
el('bobStrategy').addEventListener('change', buildGame);
el('clearCircuit').addEventListener('click', () => { state.operations = []; simulate(); });
el('loadBell').addEventListener('click', () => { if (state.qubits < 2) state.qubits = 2; updateQubitControls(); state.operations = [{ gate: 'h', targets: [0] }, { gate: 'cx', targets: [0, 1] }]; state.baseline = clone({ qubits: state.qubits, operations: state.operations }); state.label = 'Bell-state experiment'; simulate(); });
el('stepSlider').addEventListener('input', event => showStep(Number(event.target.value)));
el('matrixDetails').addEventListener('toggle', () => { if (state.snapshots.length) renderMatrix(state.snapshots[state.step]); });
el('applyCode').addEventListener('click', applyQiskitCode);
el('previousStep').addEventListener('click', () => showStep(state.step - 1));
el('nextStep').addEventListener('click', () => showStep(state.step + 1));
el('playSteps').addEventListener('click', () => {
  if (state.timer) { clearInterval(state.timer); state.timer = null; el('playSteps').textContent = '▶ Play'; return; }
  if (state.step >= state.snapshots.length - 1) showStep(0);
  el('playSteps').textContent = 'Ⅱ Pause';
  state.timer = setInterval(() => { if (state.step >= state.snapshots.length - 1) { clearInterval(state.timer); state.timer = null; el('playSteps').textContent = '▶ Play'; } else showStep(state.step + 1); }, 750);
});

updateQubitControls(); updateAlgorithmControls(); setGate('h'); simulate();
