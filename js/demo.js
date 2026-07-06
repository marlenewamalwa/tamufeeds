// ============================================================
// Interactive "See it in action" homepage demo — pure simulation,
// no network calls, no real data touched.
// ============================================================

let demoStage = 0; // 0=posted, 1=claimed/counting down, 2=ready for pickup, 3=done
let demoCountdownInterval = null;

const DEMO_STAGES = {
  0: {
    label: 'STAGE 1 / 4 — POSTED',
    status: 'Posted 2 minutes ago. Waiting for an NGO to claim it…',
    progress: 0,
    button: 'Claim This (as NGO)'
  },
  1: {
    label: 'STAGE 2 / 4 — CLAIMED',
    status: 'Reserved by Ummoja Children\'s Home. Pickup window: 3 hours…',
    button: null
  },
  2: {
    label: 'STAGE 3 / 4 — PICKUP WINDOW CLOSING',
    status: 'Almost there! Driver is en route to collect it.',
    progress: 100,
    button: 'Mark Picked Up'
  },
  3: {
    label: 'STAGE 4 / 4 — COMPLETE',
    status: '🎉 Handoff complete! 40 meals reached Ummoja Children\'s Home.',
    progress: 100,
    button: null
  }
};

function renderDemoStage() {
  const ticket = document.getElementById('tf-demo-ticket');
  const labelEl = document.getElementById('tf-demo-stage-label');
  const statusEl = document.getElementById('tf-demo-status');
  const btn = document.getElementById('tf-demo-action-btn');
  const replayBtn = document.getElementById('tf-demo-replay');
  if (!ticket) return;

  const stage = DEMO_STAGES[demoStage];
  labelEl.textContent = stage.label;
  statusEl.textContent = stage.status;

  if (stage.button) {
    btn.textContent = stage.button;
    btn.style.display = 'inline-block';
  } else {
    btn.style.display = 'none';
  }

  replayBtn.style.display = demoStage === 3 ? 'inline-block' : 'none';
  ticket.classList.toggle('tf-demo-done', demoStage === 3);
}

function startDemoCountdown() {
  const bar = document.getElementById('tf-demo-progress-bar');
  let progress = 0;
  clearInterval(demoCountdownInterval);
  demoCountdownInterval = setInterval(() => {
    progress += 2;
    if (bar) bar.style.width = `${Math.min(progress, 100)}%`;
    if (progress >= 100) {
      clearInterval(demoCountdownInterval);
      demoStage = 2;
      renderDemoStage();
    }
  }, 100); // ~5 seconds to fill, standing in for the real 3-hour window
}

function initHomeDemo() {
  const btn = document.getElementById('tf-demo-action-btn');
  const replayBtn = document.getElementById('tf-demo-replay');
  if (!btn) return;

  renderDemoStage();

  btn.addEventListener('click', () => {
    if (demoStage === 0) {
      demoStage = 1;
      renderDemoStage();
      startDemoCountdown();
    } else if (demoStage === 2) {
      clearInterval(demoCountdownInterval);
      demoStage = 3;
      renderDemoStage();
    }
  });

  replayBtn.addEventListener('click', () => {
    clearInterval(demoCountdownInterval);
    demoStage = 0;
    const bar = document.getElementById('tf-demo-progress-bar');
    if (bar) bar.style.width = '0%';
    renderDemoStage();
  });
}

document.addEventListener('DOMContentLoaded', initHomeDemo);