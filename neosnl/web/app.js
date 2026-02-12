const $ = (id) => document.getElementById(id);

async function loadModels() {
  const res = await fetch('/api/models');
  const data = await res.json();
  const model = $('model');
  model.innerHTML = '';
  for (const m of (data.models || [])) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    model.appendChild(opt);
  }
}

async function runDuel() {
  const payload = {
    model: $('model').value,
    prompt: $('prompt').value,
    temp_a: Number($('tempA').value),
    temp_b: Number($('tempB').value),
  };
  $('outA').textContent = 'Running...';
  $('outB').textContent = 'Running...';
  const res = await fetch('/api/experiment/duel', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  $('outA').textContent = data.left?.output || JSON.stringify(data);
  $('outB').textContent = data.right?.output || JSON.stringify(data);
}

$('refresh').onclick = loadModels;
$('run').onclick = runDuel;
loadModels().catch((e) => {
  $('outA').textContent = String(e);
});
