
/* =========================================================
   TACTCL BOARD — JAVASCRIPT

   Features:
   - Creating both teams
   - Applying formations
   - Moving players and the ball
   - Drawing arrows and lines
   - Creating tactical player groups and polygons
   - Editing player information
   - Undoing changes
   - Saving and loading tactics
   - Exporting the board as a PNG
   - Creating and playing two-frame animations
   ========================================================= */

// Rebuild the grass stripes as real elements so html2canvas can draw them.
const STRIPE_ALPHA = 0.03;   // matches your CSS (#ffffff08). Try 0.05 for bolder stripes.

function fixGrassStripes(clonedDocument) {

  const pitchElement = clonedDocument.querySelector('.pitch');

  if (!pitchElement) return;

  let stripes = clonedDocument.querySelector('.pitch-stripes');

  if (!stripes) {
    stripes = clonedDocument.createElement('div');
    stripes.className = 'pitch-stripes';
    pitchElement.insertBefore(stripes, pitchElement.firstChild);
  }

  stripes.style.background = 'none';
  stripes.style.position = 'absolute';
  stripes.style.inset = '0';
  stripes.innerHTML = '';

  // 10 alternating columns: lighter, normal, lighter, normal...
  for (let i = 0; i < 5; i++) {

    const band = clonedDocument.createElement('div');

    band.style.position = 'absolute';
    band.style.top = '0';
    band.style.bottom = '0';
    band.style.left = `${i * 20}%`;
    band.style.width = '10%';
    band.style.background = `rgba(255,255,255,${STRIPE_ALPHA})`;

    stripes.appendChild(band);

  }

}

// html2canvas ignores clip-path, so rebuild each penalty arc as a
// half-width wrapper with overflow:hidden (which it does support).
function fixPenaltyArcs(clonedDocument) {

  clonedDocument.querySelectorAll('.penalty-arc').forEach(arc => {

    const isLeft = arc.classList.contains('left-arc');

    const wrapper = clonedDocument.createElement('div');

    wrapper.style.position = 'absolute';
    wrapper.style.top = '40%';
    wrapper.style.width = '4%';          // half of the arc's 8% width
    wrapper.style.height = '20%';
    wrapper.style.overflow = 'hidden';
    wrapper.style.zIndex = '1';
    wrapper.style.pointerEvents = 'none';

    // Left arc keeps its right half (x: 16%–20%).
    // Right arc keeps its left half (x: 80%–84%).
    if (isLeft) {
      wrapper.style.left = '16%';
    } else {
      wrapper.style.left = '80%';
    }

    arc.parentNode.insertBefore(wrapper, arc);
    wrapper.appendChild(arc);

    // Full ellipse inside the wrapper, shifted so only the outer half shows.
    arc.style.clipPath = 'none';
    arc.style.position = 'absolute';
    arc.style.top = '0';
    arc.style.right = 'auto';
    arc.style.width = '200%';
    arc.style.height = '100%';
    arc.style.left = isLeft ? '-100%' : '0';

  });

}

function fixVerticalClipping(clonedDocument) {
  const stage = clonedDocument.querySelector('.pitch-stage');
  if (!stage || !stage.classList.contains('vertical')) return;
  const pitchEl = clonedDocument.querySelector('.pitch');
  if (pitchEl) pitchEl.style.overflow = 'visible';
}

// One function for every export-only fix.
function prepareCloneForExport(clonedDocument) {
  fixGrassStripes(clonedDocument);
  fixPenaltyArcs(clonedDocument);
  fixVerticalClipping(clonedDocument);
}


/* =========================================================
   1. CONNECT JAVASCRIPT TO THE HTML
   ========================================================= */

const pitch = document.getElementById('pitch');
const pitchStage = document.querySelector('.pitch-stage');

const fieldOrientationSelect =
  document.getElementById('fieldOrientationToggle');

const playersLayer = document.getElementById('playersLayer');
const drawingLayer = document.getElementById('drawingLayer');
const toastEl = document.getElementById('toast');

// Animation timeline controls.
const animationToolbar = document.getElementById('animationToolbar');
const frameList = document.getElementById('frameList');
const addFrameBtn = document.getElementById('addFrameBtn');
const deleteFrameBtn = document.getElementById('deleteFrameBtn');
const playNextFrameBtn = document.getElementById('playNextFrameBtn');
const playFullAnimationBtn = document.getElementById('playFullAnimationBtn');

const MAX_ANIMATION_FRAMES = 10;
const FRAME_ANIMATION_DURATION = 1000;


/* =========================================================
   FIELD ORIENTATION
   ========================================================= */

function applyFieldOrientation() {

  pitchStage.classList.toggle(
    'vertical',
    state.fieldOrientation === 'vertical'
  );

  fieldOrientationToggle.checked =
    state.fieldOrientation === 'vertical';

  document.getElementById('fieldOrientationLabel').textContent =
    state.fieldOrientation === 'vertical'
      ? 'Vertical field'
      : 'Horizontal field';

}

/* =========================================================
   2. FORMATION COORDINATES
   ========================================================= */

const formations = {

  '4-3-3': [
    [8,50],
    [20,18],[20,39],[20,61],[20,82],
    [32,30],[32,50],[32,70],
    [42,22],[45,50],[42,78]
  ],

  '4-4-2': [
    [8,50],
    [20,18],[20,39],[20,61],[20,82],
    [32,18],[32,39],[32,61],[32,82],
    [45,38],[45,62]
  ],

  '4-2-3-1': [
    [8,50],
    [20,18],[20,39],[20,61],[20,82],
    [30,39],[30,61],
    [38,25],[38,50],[38,75],
    [45,50]
  ],

  '3-5-2': [
    [8,50],
    [22,25],[20,50],[22,75],
    [34,12],[34,33],[34,50],[34,67],[34,88],
    [45,38],[45,62]
  ],

  '3-4-3': [
    [8,50],
    [22,25],[20,50],[22,75],
    [32,15],[32,38],[32,62],[32,85],
    [42,25],[45,50],[42,75]
  ],

  '5-3-2': [
    [8,50],
    [24,12],[22,30],[20,50],[22,70],[24,88],
    [32,32],[32,50],[32,68],
    [45,38],[45,62]
  ]

};


/* =========================================================
   3. MAIN BOARD STATE
   ========================================================= */

let state = {

  players: [],

  teamColors: {
    home: '#265ebd',
    away: '#ef0808'
  },

  goalkeeperColors: {
    home: '#e9c840',
    away: 'rgb(120, 32, 168)'
  },

  ball: {
    x: 50,
    y: 50
  },

  drawings: [],

  groups: [],

  zones: [],

  groupSelection: [],

  selectedId: null,

  activeTeam: 'home',

  tool: 'select',

  flipped: false,

  fieldOrientation: 'horizontal',

  standardsMode: false,
  
  arrowStyle: 'pass',

  boardName: 'Untitled tactic',

  // Stores the two animation frames.
  animation: null

};

let undoStack = [];

let redoStack = [];

let drag = null;

let dribblePath = [];

let drawStart = null;

let zoneStart = null;

let pendingZone = null;

let currentPath = null;

let toastTimer;

let isAnimating = false;

// Apply the selected team colors to the board.
function applyTeamColors() {

  const homeColor = state.teamColors.home;
  const awayColor = state.teamColors.away;

  // Update the jersey colors.
  document.documentElement.style.setProperty(
    '--home',
    homeColor
  );

  document.documentElement.style.setProperty(
    '--away',
    awayColor
  );

  // Keep the color pickers synchronized.
  document.getElementById('homeTeamColor').value = homeColor;
  document.getElementById('awayTeamColor').value = awayColor;
  

}

// Show only the active team's jersey color setting.
function updateTeamColorVisibility() {

  document.getElementById('homeColorRow').hidden =
    state.activeTeam !== 'home';

  document.getElementById('awayColorRow').hidden =
    state.activeTeam !== 'away';

}

// Show only the active team's formation setting.
function updateFormationVisibility() {

  document.getElementById('homeFormationSetting').hidden =
    state.activeTeam !== 'home';

  document.getElementById('awayFormationSetting').hidden =
    state.activeTeam !== 'away';

}

// Change the Home team's jersey color.
document.getElementById('homeTeamColor').addEventListener('change', event => {

  if (isAnimating) return;

  snapshot();

  state.teamColors.home = event.target.value;

  applyTeamColors();

});

// Change the Away team's jersey color.
document.getElementById('awayTeamColor').addEventListener('change', event => {

  if (isAnimating) return;

  snapshot();

  state.teamColors.away = event.target.value;

  applyTeamColors();

});

document.getElementById('homeGoalkeeperColor').addEventListener('change', event => {
  if (isAnimating) return;
  snapshot();
  state.goalkeeperColors.home = event.target.value;
  applyGoalkeeperColors();
});

document.getElementById('awayGoalkeeperColor').addEventListener('change', event => {
  if (isAnimating) return;
  snapshot();
  state.goalkeeperColors.away = event.target.value;
  applyGoalkeeperColors();
});

fieldOrientationToggle.addEventListener('change', event => {

  if (isAnimating) {
    applyFieldOrientation();
    return;
  }

  snapshot();

  state.fieldOrientation = event.target.checked
    ? 'vertical'
    : 'horizontal';

  applyFieldOrientation();

});

function applyGoalkeeperColors() {
  const homeColor = state.goalkeeperColors.home;
  const awayColor = state.goalkeeperColors.away;

  document.documentElement.style.setProperty('--home-gk', homeColor);
  document.documentElement.style.setProperty('--away-gk', awayColor);

  document.getElementById('homeGoalkeeperColor').value = homeColor;
  document.getElementById('awayGoalkeeperColor').value = awayColor;
}

function updateGoalkeeperColorVisibility() {
  document.getElementById('homeGoalkeeperColorSetting').hidden =
    state.activeTeam !== 'home';

  document.getElementById('awayGoalkeeperColorSetting').hidden =
    state.activeTeam !== 'away';
}


/* =========================================================
   4. ANIMATION FRAME SYSTEM
   Supports up to five frames, frame deletion,
   individual playback, and full animation playback.
   ========================================================= */


/*
   Each frame stores the position of every player using
   their permanent ID, along with the ball's position.

   Frame structure:

   {
     positions: [
       { id: "home-player-id", x: 20, y: 50 }
     ],
     ball: { x: 50, y: 50 }
   }
*/


// Make a deep copy of an object.

function deepCopy(value) {

  return JSON.parse(JSON.stringify(value));

}


// Capture the current board positions.
/*
   Each frame stores:
   - Player positions
   - Ball position
   - Drawings (arrows, lines, freehand)
   - Player groups
   - Tactical zones

   Frame structure:

   {
      positions: [],
      ball: {},
      drawings: [],
      groups: [],
      zones: []
   }
*/

function captureFrame() {

  return {

    positions: state.players.map(player => ({
      id: player.id,
      x: player.x,
      y: player.y
    })),

    ball: deepCopy(state.ball),

    drawings: deepCopy(state.drawings),

    groups: deepCopy(state.groups),

    zones: deepCopy(state.zones)

  };

}


// Save the current board into its selected frame.

function saveActiveFrame() {

  if (!state.animation || isAnimating) return;

  const frame = state.animation.frames[
    state.animation.activeFrame
  ];

  if (!frame) return;

  frame.positions = state.players.map(player => ({
    id: player.id,
    x: player.x,
    y: player.y
  }));

  frame.ball = deepCopy(state.ball);

  frame.drawings = deepCopy(state.drawings);

  frame.groups = deepCopy(state.groups);

  frame.zones = deepCopy(state.zones);

}


// Apply a frame to the board.

function applyAnimationFrame(frameIndex) {

  if (!state.animation) return;

  const frame = state.animation.frames[frameIndex];

  if (!frame) return;

  const positionMap = new Map(
    frame.positions.map(position => [
      position.id,
      position
    ])
  );

  state.players.forEach(player => {

    const savedPosition = positionMap.get(player.id);

    if (savedPosition) {

      player.x = savedPosition.x;

      player.y = savedPosition.y;

    }

  });

  if (frame.ball) {

    state.ball = deepCopy(frame.ball);

  }

  // Load only the drawings belonging to this frame.
  state.drawings = deepCopy(frame.drawings || []);

  // Load only the groups belonging to this frame.
  state.groups = deepCopy(frame.groups || []);

  // Load only the zones belonging to this frame.
  state.zones = deepCopy(frame.zones || []);

  state.animation.activeFrame = frameIndex;

}


// Add a newly created player to every frame.

function addPlayerToAnimationFrames(player) {

  if (!state.animation) return;

  state.animation.frames.forEach(frame => {

    frame.positions.push({

      id: player.id,

      x: player.x,

      y: player.y

    });

  });

}


// Remove a deleted player from every frame.

function removePlayerFromAnimationFrames(playerId) {

  if (!state.animation) return;

  state.animation.frames.forEach(frame => {

    frame.positions = frame.positions.filter(
      position => position.id !== playerId
    );

  });

}


// Update the animation timeline and buttons.

function updateAnimationControls() {

  if (!animationToolbar || !frameList) return;

  // Keep the timeline visible so users can create Frame 1.
  animationToolbar.hidden = false;

  const hasAnimation = !!state.animation;

  const frames = hasAnimation
    ? state.animation.frames
    : [];

  const activeFrame = hasAnimation
    ? state.animation.activeFrame
    : -1;


  // Rebuild the frame selection buttons.

  frameList.innerHTML = '';

  if (frames.length === 0) {

    const message = document.createElement('span');

    message.textContent = 'No frames created yet.';

    message.style.fontSize = '12px';

    message.style.color = '#8994a2';

    frameList.appendChild(message);

  }


  frames.forEach((frame, index) => {

    const button = document.createElement('button');

    button.type = 'button';

    button.className = 'frame-button';

    button.textContent = `Frame ${index + 1}`;

    button.classList.toggle(
      'active',
      index === activeFrame
    );

    button.disabled = isAnimating;

    button.addEventListener('click', () => {

      if (isAnimating) return;

      saveActiveFrame();

      applyAnimationFrame(index);

      render();

      showToast(`Frame ${index + 1} loaded`);

    });

    frameList.appendChild(button);

  });


  // Add Frame button.

  if (addFrameBtn) {

    addFrameBtn.disabled =
      isAnimating || frames.length >= MAX_ANIMATION_FRAMES;

    addFrameBtn.textContent =
      frames.length >= MAX_ANIMATION_FRAMES
        ? 'Maximum Frames Reached'
        : '+ Add Frame';

  }


  // Delete Frame button.

  if (deleteFrameBtn) {

    deleteFrameBtn.disabled =
      isAnimating || frames.length === 0;

  }


  // Play Next Frame button.

  if (playNextFrameBtn) {

    playNextFrameBtn.disabled =
      isAnimating ||
      frames.length < 2 ||
      activeFrame >= frames.length - 1;

  }


  // Play Full Animation button.

  if (playFullAnimationBtn) {

    playFullAnimationBtn.disabled =
      isAnimating || frames.length < 2;

  }

}


// Create a new frame based on the currently selected frame.

if (addFrameBtn) {

  addFrameBtn.addEventListener('click', () => {

    if (isAnimating) return;

    if (state.animation) {

      saveActiveFrame();

      if (
        state.animation.frames.length >= MAX_ANIMATION_FRAMES
      ) {

        showToast('You can only have five frames');

        return;

      }

      snapshot();

      const currentFrame = state.animation.frames[
        state.animation.activeFrame
      ];

      const newFrame = deepCopy(currentFrame);

      state.animation.frames.push(newFrame);

      state.animation.activeFrame =
        state.animation.frames.length - 1;

    } else {

      snapshot();

      const firstFrame = captureFrame();

      const secondFrame = deepCopy(firstFrame);

      state.animation = {

        frames: [
          firstFrame,
          secondFrame
        ],

        activeFrame: 1

      };

    }

    render();

    showToast(
      `Frame ${state.animation.activeFrame + 1} created`
    );

  });

}


// Delete the currently selected frame.

if (deleteFrameBtn) {

  deleteFrameBtn.addEventListener('click', () => {

    if (!state.animation || isAnimating) return;

    if (state.animation.frames.length === 0) return;

    snapshot();

    const deletedIndex = state.animation.activeFrame;

    state.animation.frames.splice(deletedIndex, 1);

    // If no frames remain, remove the animation entirely.
    if (state.animation.frames.length === 0) {

      state.animation = null;

      render();

      showToast('Animation deleted');

      return;

    }

    // Select the frame that moved into the deleted frame's place.
    state.animation.activeFrame = Math.min(
      deletedIndex,
      state.animation.frames.length - 1
    );

    applyAnimationFrame(state.animation.activeFrame);

    render();

    showToast('Frame deleted');

  });

}


// Smoothly move the board from its current position to a target frame.

function animateToFrame(targetIndex) {

  return new Promise(resolve => {

    if (!state.animation) {

      resolve();

      return;

    }

    const targetFrame = state.animation.frames[targetIndex];

    if (!targetFrame) {

      resolve();

      return;

    }


    // Capture the current positions.

    const startPositions = state.players.map(player => ({

      id: player.id,

      x: player.x,

      y: player.y

    }));

    const startPositionMap = new Map(
      startPositions.map(position => [
        position.id,
        position
      ])
    );


    // Look up the target positions.

    const targetPositionMap = new Map(
      targetFrame.positions.map(position => [
        position.id,
        position
      ])
    );

    startAnimationTrail();

    animationTargetIndex = targetIndex;

    const startBall = deepCopy(state.ball);

    const endBall = deepCopy(targetFrame.ball);

    let startTime = performance.now();


    function easeInOutCubic(t) {

      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

    }


    function animate(currentTime) {

      const elapsed = currentTime - startTime;

      const progress = Math.min(
        elapsed / FRAME_ANIMATION_DURATION,
        1
      );

      const easedProgress = easeInOutCubic(progress);


      // Animate every player.

      state.players.forEach(player => {

        const start = startPositionMap.get(player.id);

        const end = targetPositionMap.get(player.id);

        if (!start || !end) return;

        player.x = start.x + (
          end.x - start.x
        ) * easedProgress;

        player.y = start.y + (
          end.y - start.y
        ) * easedProgress;


        const element = playersLayer.querySelector(
          `[data-id="${CSS.escape(player.id)}"]`
        );

        if (element) {

          element.style.left = `${player.x}%`;

          element.style.top = `${player.y}%`;

        }

      });


      // Animate the ball.

      state.ball = {

        x: startBall.x + (
          endBall.x - startBall.x
        ) * easedProgress,

        y: startBall.y + (
          endBall.y - startBall.y
        ) * easedProgress

      };

      const ballElement = playersLayer.querySelector('.ball');

      if (ballElement) {

        ballElement.style.left = `${state.ball.x}%`;

        ballElement.style.top = `${state.ball.y}%`;

      }


      // Keep tactical polygons attached to their players.

      renderDrawings();


      if (progress < 1) {

        requestAnimationFrame(animate);

      } else {

        // Apply exact final positions.

        applyAnimationFrame(targetIndex);

        resolve();

      }

    }


    // Does anyone actually move in this step?
    const hasMovement =
      state.players.some(player => {

        const end = targetPositionMap.get(player.id);

        return end && Math.hypot(
          end.x - player.x,
          end.y - player.y
        ) >= MOVEMENT_THRESHOLD;

      }) ||
      Math.hypot(
        endBall.x - state.ball.x,
        endBall.y - state.ball.y
      ) >= MOVEMENT_THRESHOLD;

    if (SHOW_MOVEMENT_LINES && PREVIEW_HOLD_MS > 0 && hasMovement) {

      // Show the planned paths first, then start moving.
      renderDrawings();

      setTimeout(() => {

        startTime = performance.now();

        requestAnimationFrame(animate);

      }, PREVIEW_HOLD_MS);

    } else {

      requestAnimationFrame(animate);

    }

  });

}


// Play only the next frame.

if (playNextFrameBtn) {

  playNextFrameBtn.addEventListener('click', async () => {

    if (!state.animation || isAnimating) return;

    saveActiveFrame();

    const nextIndex = state.animation.activeFrame + 1;

    if (nextIndex >= state.animation.frames.length) {

      showToast('You are already on the last frame');

      return;

    }

    isAnimating = true;

    updateAnimationControls();

    await animateToFrame(nextIndex);

    isAnimating = false;

    render();

    showToast(`Frame ${nextIndex + 1} reached`);

  });

}


// Play the complete animation from Frame 1 to the final frame.

if (playFullAnimationBtn) {

  playFullAnimationBtn.addEventListener('click', async () => {

    if (!state.animation || isAnimating) return;

    saveActiveFrame();

    if (state.animation.frames.length < 2) {

      showToast('Create at least two frames first');

      return;

    }

    isAnimating = true;

    updateAnimationControls();


    // Start at Frame 1.

    applyAnimationFrame(0);

    render();


    // Play each frame in order.

    for (
      let index = 1;
      index < state.animation.frames.length;
      index++
    ) {

      await animateToFrame(index);

    }


    isAnimating = false;

    render();

    showToast('Full animation finished');

  });

}
/* =========================================================
   5. UNDO SYSTEM
   ========================================================= */


function captureBoardState() {

  // Save the current frame before recording the board state.
  saveActiveFrame();

  return JSON.stringify({

    players: state.players,

    teamColors: state.teamColors,

    fieldOrientation: state.fieldOrientation,

    ball: state.ball,

    drawings: state.drawings,

    groups: state.groups,

    zones: deepCopy(state.zones),

    animation: state.animation

  });

}


function snapshot() {

  undoStack.push(captureBoardState());

  if (undoStack.length > 40) {
    undoStack.shift();
  }

  // A new edit makes the previous redo history invalid.
  redoStack.length = 0;

}



/* =========================================================
   6. NOTIFICATION MESSAGES
   ========================================================= */

function showToast(message) {

  toastEl.textContent = message;

  toastEl.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    toastEl.classList.remove('show');

  }, 1800);

}


/* =========================================================
   7. CREATE TEAMS
   ========================================================= */

function makeTeam(team, formation = '4-3-3') {

  const coords = formations[formation];

  return coords.map(([x, y], i) => ({

    id: `${team}-${Date.now()}-${i}-${Math.random().toString(16).slice(2,6)}`,

    team: team,

    number: i + 1,

    name: team === 'home'
      ? `Home ${i + 1}`
      : `Away ${i + 1}`,

    role: i === 0 ? 'goalkeeper' : 'outfield',

    x: team === 'home' ? x : 100 - x,

    y: y

  }));

}


/* =========================================================
   8. INITIALIZE THE BOARD
   ========================================================= */

function initialize() {

  state.players = [

    ...makeTeam('home', '4-3-3'),

    ...makeTeam('away', '4-3-3')

  ];

  state.ball = {

    x: 50,

    y: 50

  };

  render();

}


/* =========================================================
   9. RENDER THE BOARD
   ========================================================= */

function render() {

  applyTeamColors();
  applyGoalkeeperColors();

  // Trails only exist while an animation is playing.
  if (!isAnimating) {
    animationTrail = null;
    animationTargetIndex = null;
    animationBallStart = null;
  }

  // Keep the active frame synchronized with the board.
  saveActiveFrame();

  playersLayer.innerHTML = '';

  state.players.forEach(player => {

    const el = document.createElement('div');

    el.className = `player ${player.team}
      ${player.role === 'goalkeeper' ? 'goalkeeper' : ''}
      ${state.selectedId === player.id ? 'selected' : ''}
      ${state.groupSelection.includes(player.id) ? 'group-selected' : ''}`;

    el.style.left = `${player.x}%`;

    el.style.top = `${player.y}%`;

    el.dataset.id = player.id;

    el.innerHTML = `
      <span>${escapeHtml(player.number)}</span>
    `;

    el.addEventListener('pointerdown', onPlayerPointerDown);

    playersLayer.appendChild(el);

  });

  renderPlayerLabels();

  // Create the soccer ball.
  const ball = document.createElement('div');

  ball.className = 'ball';

  ball.style.left = `${state.ball.x}%`;

  ball.style.top = `${state.ball.y}%`;

  ball.textContent = '⚽';

  ball.addEventListener('pointerdown', onBallPointerDown);

  playersLayer.appendChild(ball);


  // Update board drawings and sidebar.
  renderDrawings();

  updateEditor();

  updateGroupsPanel();
  updateZonesPanel();
  updateGroupInstructions();


  // Highlight the selected team.
  document.querySelectorAll('.team-tab').forEach(button => {

    button.classList.toggle(
      'active',
      button.dataset.team === state.activeTeam
    );

  });

  //Update the team nd goalkeeper color option visibility.
  updateTeamColorVisibility();
  updateGoalkeeperColorVisibility();
  updateFormationVisibility

  // Update the animation buttons.
  updateAnimationControls();

}


/* =========================================================
   10. HTML SAFETY
   ========================================================= */

function escapeHtml(value) {

  return String(value).replace(/[&<>"']/g, character => ({

    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'

  }[character]));

}


/* =========================================================
   11. PLAYER EDITOR
   ========================================================= */

function updateEditor() {

  const player = state.players.find(
    p => p.id === state.selectedId
  );

  document.getElementById('emptySelection').hidden = !!player;

  document.getElementById('playerFields').hidden = !player;

  if (!player) return;

  document.getElementById('playerName').value = player.name;

  document.getElementById('playerNumber').value = player.number;

  document.getElementById('playerTeam').value = player.team;

  document.getElementById('playerRole').value = player.role || 'outfield';

}


/* =========================================================
   12. COORDINATE CALCULATIONS
   ========================================================= */


function coordsFromEvent(event) {
  const rect = pitch.getBoundingClientRect();

  let x = (event.clientX - rect.left) / rect.width * 100;
  let y = (event.clientY - rect.top) / rect.height * 100;

  // Convert screen coordinates back into pitch coordinates.
  if (state.fieldOrientation === 'vertical') {
    const oldX = x;
    const oldY = y;

    x = 100 - oldY;
    y = oldX;
  }

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y))
  };
}
// Distance at which the ball and a player count as attached
// (in % of pitch width).
const ATTACH_DISTANCE = 4.5;

// The pitch is 1060:640, so one y-unit is shorter than one x-unit.
const PITCH_ASPECT_Y = 640 / 1060;

// Distance between two pitch points, measured as a true circle.
function pitchDistance(a, b) {
  return Math.hypot(
    a.x - b.x,
    (a.y - b.y) * PITCH_ASPECT_Y
  );
}


/* =========================================================
   13. PLAYER DRAGGING AND GROUP SELECTION
   ========================================================= */

function onPlayerPointerDown(event) {

  if (isAnimating) return;

  event.stopPropagation();

  const id = event.currentTarget.dataset.id;

  const player = state.players.find(p => p.id === id);

  if (!player) return;


  // GROUP TOOL: Add or remove a player from the selection.
  if (state.tool === 'group') {

    if (state.groupSelection.includes(id)) {

      state.groupSelection = state.groupSelection.filter(
        playerId => playerId !== id
      );

    } else {

      state.groupSelection.push(id);

    }

    render();

    return;

  }


  // ERASER TOOL: Delete a player.
  if (state.tool === 'eraser') {

    snapshot();

    state.players = state.players.filter(p => p.id !== id);

    removePlayerFromGroups(id);

    removePlayerFromAnimationFrames(id);

    if (state.selectedId === id) {
      state.selectedId = null;
    }

    render();

    return;

  }


  // Players can only be dragged using Select or Player.
  if (
  state.tool !== 'select' &&
  state.tool !== 'player' &&
  state.tool !== 'ball'
) {
  return;
}


  snapshot();

  state.selectedId = id;

  state.activeTeam = player.team;


  // Check whether the ball is close enough to this player
  // to be considered attached.
  // Holding Shift drags the player alone, even with the ball in range.
  const ballIsAttached =
    !event.shiftKey &&
    pitchDistance(state.ball, player) <= ATTACH_DISTANCE;


  drag = {

    type: 'player',

    id: id,

    carriesBall: ballIsAttached,

    // Preserve the ball's position relative to the player.
    ballOffsetX: state.ball.x - player.x,

    ballOffsetY: state.ball.y - player.y

  };


  // Start recording the dribbling path.
  dribblePath = ballIsAttached
    ? [{ x: state.ball.x, y: state.ball.y }]
    : [];


  event.currentTarget.setPointerCapture(event.pointerId);

  playersLayer.querySelectorAll('.player').forEach(el => {

    el.classList.toggle(
      'selected',
      el.dataset.id === id
    );

  });

  renderPlayerLabels();

  updateEditor();

}


/* =========================================================
   14. BALL DRAGGING
   ========================================================= */

function onBallPointerDown(event) {

  console.log("BALL CLICKED - ACTIVE TOOL:", state.tool);

  if (isAnimating) return;

  event.stopPropagation();

  if (state.tool === 'group') {
    return;
  }

  // Eraser resets the ball.
  if (state.tool === 'eraser') {

    snapshot();

    state.ball = {
      x: 50,
      y: 50
    };

    render();

    return;
  }

  // Only Select and Player tools can drag the ball.
  if (state.tool !== 'select' && state.tool !== 'player') {
    return;
  }

  snapshot();

  // Find the closest player to the ball.
  let closestPlayer = null;
  let closestDistance = ATTACH_DISTANCE;

  state.players.forEach(player => {

    const distance = pitchDistance(player, state.ball);

    // Holding Shift drags the ball alone, even with a player in range.
    if (!event.shiftKey && distance <= closestDistance) {
      closestDistance = distance;
      closestPlayer = player;
    }

  });

  // Start dragging the ball.
  drag = {
    type: 'ball',

    // Attach the closest player if they are within range.
    carriesPlayer: closestPlayer ? closestPlayer.id : null,

    // Remember the player's position relative to the ball.
    playerOffsetX: closestPlayer
      ? closestPlayer.x - state.ball.x
      : 0,

    playerOffsetY: closestPlayer
      ? closestPlayer.y - state.ball.y
      : 0
  };

  // Start the dribbling trail at the ball's current position.
  dribblePath = closestPlayer
    ? [{ x: state.ball.x, y: state.ball.y }]
    : [];

  event.currentTarget.setPointerCapture(event.pointerId);

}



/* =========================================================
   15. HANDLE MOVEMENT
   ========================================================= */

pitch.addEventListener('pointermove', event => {


  if (isAnimating) return;

  // Continue if either an object is being dragged
  // or a freehand drawing is currently in progress.
  if (!drag && !currentPath) return;

  if (drag) {
    console.log("DRAGGING:", drag);
  }

  // Get the current pointer position on the pitch.
  const point = coordsFromEvent(event);

  // Move a player.
  if (drag && drag.type === 'player') {

    const player = state.players.find(
      p => p.id === drag.id
    );

    if (player) {

      const oldX = player.x;
      const oldY = player.y;

      player.x = point.x;
      player.y = point.y;


      // If the player is carrying the ball, move it too.
      if (drag.carriesBall) {

        state.ball = {

          x: Math.max(0, Math.min(
            100,
            player.x + drag.ballOffsetX
          )),

          y: Math.max(0, Math.min(
            100,
            player.y + drag.ballOffsetY
          ))

        };

        dribblePath.push({
          x: state.ball.x,
          y: state.ball.y
        });

      }


      // Update the player's position visually.
      const element = playersLayer.querySelector(
        `[data-id="${CSS.escape(drag.id)}"]`
      );

      if (element) {

        element.style.left = `${player.x}%`;
        element.style.top = `${player.y}%`;

      }


      // Update the ball visually.
      if (drag.carriesBall) {

        const ballElement = playersLayer.querySelector('.ball');

        if (ballElement) {

          ballElement.style.left = `${state.ball.x}%`;
          ballElement.style.top = `${state.ball.y}%`;

        }

      }


      renderDrawings();

    }

  }

  // Move the ball.
  else if (drag && drag.type === 'ball') {

    state.ball.x = point.x;
    state.ball.y = point.y;
    if (drag.carriesPlayer) {
    dribblePath.push({
      x: state.ball.x,
      y: state.ball.y
    });
}

    // If the ball is carrying a player, move that player too.
    if (drag.carriesPlayer) {

      const player = state.players.find(
        p => p.id === drag.carriesPlayer
      );

      if (player) {

        player.x = Math.max(0, Math.min(
          100,
          state.ball.x + drag.playerOffsetX
        ));

        player.y = Math.max(0, Math.min(
          100,
          state.ball.y + drag.playerOffsetY
        ));

        const playerElement = playersLayer.querySelector(
          `[data-id="${CSS.escape(player.id)}"]`
        );

        if (playerElement) {
          playerElement.style.left = `${player.x}%`;
          playerElement.style.top = `${player.y}%`;
        }

      }

    }

    const ballElement = playersLayer.querySelector('.ball');

    if (ballElement) {
      ballElement.style.left = `${state.ball.x}%`;
      ballElement.style.top = `${state.ball.y}%`;
    }

    renderDrawings();

  }

  // Continue drawing a freehand path.
  if (currentPath) {

    const point = coordsFromEvent(event);

    currentPath.points.push([

      point.x * 10,

      point.y * 6.4

    ]);

    renderDrawings();

  }

});


window.addEventListener('pointerup', () => {

  drag = null;

  dribblePath = [];

  currentPath = null;

  // Remove the temporary dribbling trail.
  renderDrawings();

});


/* =========================================================
   16. PITCH CLICK ACTIONS
   ========================================================= */

pitch.addEventListener('pointerdown', event => {

  if (isAnimating) return;

  const point = coordsFromEvent(event);


  // Do nothing when the Group tool is active.
  if (state.tool === 'group') {

    return;

  }

  // Start creating a tactical zone.
  if (state.tool === 'zones') {

    snapshot();

    zoneStart = {
      x: point.x,
      y: point.y,
      end: point
    };

    pitch.setPointerCapture(event.pointerId);

    return;

  }


  // Add a new player.
  if (state.tool === 'player') {

    snapshot();

    const player = {

      id: `new-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,

      team: state.activeTeam,

      number: state.players.filter(
        p => p.team === state.activeTeam
      ).length + 1,

      x: point.x,

      y: point.y

    };

    state.players.push(player);

    // Make sure this player exists in both animation frames.
    addPlayerToAnimationFrames(player);

    state.selectedId = player.id;

    render();

    return;

  }


  // Move the ball by clicking the pitch.
  if (state.tool === 'ball') {

    snapshot();

    state.ball = point;

    render();

    return;

  }


  // Remove the most recent drawing.
  if (state.tool === 'eraser') {

    if (state.drawings.length > 0) {

      snapshot();

      state.drawings.pop();

      render();

    }

    return;

  }


  // Start drawing an arrow or straight line.
  if (state.tool === 'arrow' || state.tool === 'line') {

    drawStart = {

      x: point.x * 10,

      y: point.y * 6.4,

      type: state.tool

    };

    return;

  }


  // Start a freehand drawing.
  if (state.tool === 'draw') {

    snapshot();

    currentPath = {

      type: 'freehand',

      points: [[

        point.x * 10,

        point.y * 6.4

      ]],

      color: '#fff'

    };

    state.drawings.push(currentPath);

    // Keep tracking the mouse while drawing.
    pitch.setPointerCapture(event.pointerId);

    return;

  }


  // Clicking empty pitch with Select clears selection.
  state.selectedId = null;

  render();

});


/* =========================================================
   17. FINISH ARROWS AND LINES
   ========================================================= */

pitch.addEventListener('pointerup', event => {

  if (isAnimating) return;

  // Finish drawing a tactical zone, but wait for confirmation.
  if (zoneStart) {
    const end = coordsFromEvent(event);
    const x = Math.min(zoneStart.x, end.x);
    const y = Math.min(zoneStart.y, end.y);
    const width = Math.abs(end.x - zoneStart.x);
    const height = Math.abs(end.y - zoneStart.y);

    if (width >= 1 && height >= 1) {
      pendingZone = {
        x,
        y,
        width,
        height,
        color: document.getElementById('zoneColor').value
      };

      document.getElementById('zoneConfirmControls').hidden = false;
    }

    zoneStart = null;
    render();
    return;
  }

  // Finish drawing an arrow or line.
  if (!drawStart) return;

  const end = coordsFromEvent(event);

  snapshot();

  state.drawings.push({
    type: drawStart.type,
    // Only arrows get a style, and only while the toggle is on.
    style: (state.standardsMode && drawStart.type === 'arrow')
      ? state.arrowStyle
      : null,
    x1: drawStart.x,
    y1: drawStart.y,
    x2: end.x * 10,
    y2: end.y * 6.4,
    color: '#fff'
  });

  drawStart = null;
  render();

});


/* =========================================================
   18. GROUP POLYGON CALCULATIONS
   ========================================================= */


function getPolygonPoints(players) {

  if (players.length < 3) {
    return '';
  }

  // Sort players by horizontal position.
  const sorted = [...players].sort((a, b) => {
    return a.x - b.x || a.y - b.y;
  });

  // Determine which side of a line a point falls on.
  function cross(o, a, b) {

    return (
      (a.x - o.x) * (b.y - o.y) -
      (a.y - o.y) * (b.x - o.x)
    );

  }

  // Build the lower half of the hull.
  const lower = [];

  for (const player of sorted) {

    while (
      lower.length >= 2 &&
      cross(
        lower[lower.length - 2],
        lower[lower.length - 1],
        player
      ) <= 0
    ) {

      lower.pop();

    }

    lower.push(player);

  }

  // Build the upper half of the hull.
  const upper = [];

  for (let i = sorted.length - 1; i >= 0; i--) {

    const player = sorted[i];

    while (
      upper.length >= 2 &&
      cross(
        upper[upper.length - 2],
        upper[upper.length - 1],
        player
      ) <= 0
    ) {

      upper.pop();

    }

    upper.push(player);

  }

  // Combine both halves.
  lower.pop();
  upper.pop();

  const hull = lower.concat(upper);

  // Convert coordinates to SVG pitch coordinates.
  return hull.map(player =>
    `${player.x * 10},${player.y * 6.4}`
  ).join(' ');

}

/* =========================================================
   18b. AUTOMATIC MOVEMENT LINES
   - Edit mode: dashed arrow to where each player goes next frame
   - Playback: dashed trail behind each moving player
   ========================================================= */

const SHOW_MOVEMENT_LINES = true;   // set to false to turn the feature off
const MOVEMENT_THRESHOLD = 1;       // ignore moves smaller than this (% of pitch)
const PREVIEW_HOLD_MS = 900;        // pause showing planned paths before players move (0 = no pause)

// Where every player started the current animation move.
let animationTrail = null;

// Which frame the board is currently animating toward.
let animationTargetIndex = null;

// Where the ball started the current animation move.
let animationBallStart = null;

function startAnimationTrail() {

  animationTrail = new Map(
    state.players.map(player => [
      player.id,
      { x: player.x, y: player.y }
    ])
  );

  animationBallStart = deepCopy(state.ball);

}

// Which player is carrying the ball during this move? A player counts
// if the ball is attached to them at the start AND still with them
// at the target frame. Returns the player id, or null.
function findBallCarrierId(ballStart, ballEnd, startMap, endMap) {

  if (!ballStart || !ballEnd || !startMap || !endMap) return null;

  let carrierId = null;
  let closest = ATTACH_DISTANCE;

  startMap.forEach((start, id) => {

    const end = endMap.get(id);

    if (!end) return;

    const startDistance = pitchDistance(ballStart, start);

    if (
      startDistance <= closest &&
      pitchDistance(ballEnd, end) <= ATTACH_DISTANCE
    ) {
      closest = startDistance;
      carrierId = id;
    }

  });

  return carrierId;

}

// Builds a wavy SVG path from (x1,y1) to (x2,y2) in drawing coordinates.
// The wave is always shaped for the FULL length, so a partial path
// (drawLength) lines up exactly with the full one.
function buildSquigglePath(x1, y1, x2, y2, drawLength) {

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);

  if (length < 1) return '';

  const limit = drawLength === undefined
    ? length
    : Math.min(drawLength, length);

  if (limit < 1) return '';

  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;

  const WAVELENGTH = 16;
  const AMPLITUDE = 4.5;
  const STEP = 2;
  const TAPER = 22;

  function pointAt(s) {

    const envelope = Math.min(1, s / TAPER, (length - s) / TAPER);

    const offset =
      Math.sin((s / WAVELENGTH) * Math.PI * 2) * AMPLITUDE * envelope;

    return [
      x1 + ux * s + nx * offset,
      y1 + uy * s + ny * offset
    ];

  }

  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;

  for (let s = STEP; s < limit; s += STEP) {

    const [px, py] = pointAt(s);

    d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;

  }

  const [lastX, lastY] = pointAt(limit);

  d += ` L ${lastX.toFixed(1)} ${lastY.toFixed(1)}`;

  return d;

}

function drawMovementLines(svgNamespace) {

    if (!state.standardsMode || !SHOW_MOVEMENT_LINES || !state.animation) return;

  const lines = [];

  if (isAnimating) {

    // PLAYBACK: planned path (faint, with arrowhead) plus the trail behind the player.
    if (!animationTrail) return;

    const targetFrame = state.animation.frames[animationTargetIndex];

    const targetPositions = targetFrame
      ? new Map(targetFrame.positions.map(position => [position.id, position]))
      : null;

        // Is the ball being carried by a player during this move?
    const carrierId = findBallCarrierId(
      animationBallStart,
      targetFrame ? targetFrame.ball : null,
      animationTrail,
      targetPositions
    );

    state.players.forEach(player => {

      const start = animationTrail.get(player.id);

      if (!start) return;

      // The carrier gets the squiggle instead of dashed lines.
      if (player.id === carrierId) return;

      // Planned path: start to destination, visible before the player moves.
      if (targetPositions) {

        const target = targetPositions.get(player.id);

        if (
          target &&
          Math.hypot(target.x - start.x, target.y - start.y) >= MOVEMENT_THRESHOLD
        ) {

          lines.push({
            x1: start.x * 10,
            y1: start.y * 6.4,
            x2: target.x * 10,
            y2: target.y * 6.4,
            arrow: true,
            opacity: 0.45
          });

        }

      }

      // Trail: start to the player's current position.
      if (Math.hypot(player.x - start.x, player.y - start.y) >= MOVEMENT_THRESHOLD) {

        lines.push({
          x1: start.x * 10,
          y1: start.y * 6.4,
          x2: player.x * 10,
          y2: player.y * 6.4,
          arrow: false,
          opacity: 0.9
        });

      }

    });

        // Ball: planned pass path, plus the line behind the moving ball.
    if (animationBallStart) {

      const ballTarget = targetFrame ? targetFrame.ball : null;

      if (
        ballTarget &&
        Math.hypot(
          ballTarget.x - animationBallStart.x,
          ballTarget.y - animationBallStart.y
        ) >= MOVEMENT_THRESHOLD
      ) {

        lines.push({
          x1: animationBallStart.x * 10,
          y1: animationBallStart.y * 6.4,
          x2: ballTarget.x * 10,
          y2: ballTarget.y * 6.4,
          arrow: true,
          opacity: 0.45,
          solid: true,
          squiggle: !!carrierId
        
        });

      }

            if (
        Math.hypot(
          state.ball.x - animationBallStart.x,
          state.ball.y - animationBallStart.y
        ) >= MOVEMENT_THRESHOLD
      ) {

        if (carrierId && ballTarget) {

          // Solid part = the stretch of the planned path already covered.
          const fullLength = Math.hypot(
            (ballTarget.x - animationBallStart.x) * 10,
            (ballTarget.y - animationBallStart.y) * 6.4
          );

          const coveredLength = Math.hypot(
            (state.ball.x - animationBallStart.x) * 10,
            (state.ball.y - animationBallStart.y) * 6.4
          );

          lines.push({
            x1: animationBallStart.x * 10,
            y1: animationBallStart.y * 6.4,
            x2: ballTarget.x * 10,
            y2: ballTarget.y * 6.4,
            // Once fully covered, the arrowhead turns solid too.
            arrow: coveredLength >= fullLength - 1,
            opacity: 1,
            solid: true,
            squiggle: true,
            drawUpTo: coveredLength
          });

        } else {

          lines.push({
            x1: animationBallStart.x * 10,
            y1: animationBallStart.y * 6.4,
            x2: state.ball.x * 10,
            y2: state.ball.y * 6.4,
            arrow: false,
            opacity: 0.9,
            solid: true
          });

        }

      }

    }

  } else {

    // EDIT MODE: line from each player to their position in the next frame.
    const nextFrame = state.animation.frames[state.animation.activeFrame + 1];

    if (!nextFrame) return;

    const nextPositions = new Map(
      nextFrame.positions.map(position => [position.id, position])
    );

    state.players.forEach(player => {

      // Skip the player if they are attached to the ball.
      if (
        drag &&
        (
          (drag.type === 'player' && drag.carriesBall && drag.id === player.id) ||
          (drag.type === 'ball' && drag.carriesPlayer === player.id)
        )
      ) {
        return;
      }

      const target = nextPositions.get(player.id);

      if (!target) return;

      if (Math.hypot(target.x - player.x, target.y - player.y) < MOVEMENT_THRESHOLD) return;

      lines.push({
        x1: player.x * 10,
        y1: player.y * 6.4,
        x2: target.x * 10,
        y2: target.y * 6.4,
        arrow: true,
        opacity: 0.85
      });

    });

    // Don't draw a separate ball arrow when it is attached to a player.
    const ballIsAttached =
      drag &&
      (
        (drag.type === 'player' && drag.carriesBall) ||
        (drag.type === 'ball' && drag.carriesPlayer)
      );

    if (
      !ballIsAttached &&
      nextFrame.ball &&
      Math.hypot(
        nextFrame.ball.x - state.ball.x,
        nextFrame.ball.y - state.ball.y
      ) >= MOVEMENT_THRESHOLD
    ) {

      lines.push({
        x1: state.ball.x * 10,
        y1: state.ball.y * 6.4,
        x2: nextFrame.ball.x * 10,
        y2: nextFrame.ball.y * 6.4,
        arrow: true,
        opacity: 0.85,
        solid: true
      });

    }

  }

  lines.forEach(item => {

        if (item.squiggle) {

      const squiggle = document.createElementNS(svgNamespace, 'path');

      squiggle.setAttribute(
        'd',
        buildSquigglePath(item.x1, item.y1, item.x2, item.y2, item.drawUpTo));

      squiggle.setAttribute('fill', 'none');
      squiggle.setAttribute('stroke', '#fff');
      squiggle.setAttribute('stroke-width', '3');
      squiggle.setAttribute('stroke-linecap', 'round');
      squiggle.setAttribute('stroke-linejoin', 'round');
      squiggle.setAttribute('opacity', item.opacity);

      if (item.arrow) {
        squiggle.setAttribute('marker-end', 'url(#arrowhead)');
      }

      drawingLayer.appendChild(squiggle);

      return;

    }

    const line = document.createElementNS(svgNamespace, 'line');

    line.setAttribute('x1', item.x1);
    line.setAttribute('y1', item.y1);
    line.setAttribute('x2', item.x2);
    line.setAttribute('y2', item.y2);
    line.setAttribute('stroke', '#fff');
    line.setAttribute('stroke-width', '3');
    if (!item.solid) {line.setAttribute('stroke-dasharray', '10 7');}
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', item.opacity);

    if (item.arrow) {
      line.setAttribute('marker-end', 'url(#arrowhead)');
    }

    drawingLayer.appendChild(line);

  });

}

/* =========================================================
   19. DRAWING RENDERER AND GROUP POLYGONS
   ========================================================= */

function renderDrawings() {

  drawingLayer.innerHTML = '';

  const svgNamespace = 'http://www.w3.org/2000/svg';

    // Draw saved tactical zones.
  [...state.zones, ...(pendingZone ? [pendingZone] : [])].forEach(zone => {

    const rectangle = document.createElementNS(
      svgNamespace,
      'rect'
    );

    rectangle.setAttribute('x', zone.x * 10);
    rectangle.setAttribute('y', zone.y * 6.4);
    rectangle.setAttribute('width', zone.width * 10);
    rectangle.setAttribute('height', zone.height * 6.4);

    rectangle.setAttribute('fill', zone.color || '#e4b84c');
    rectangle.setAttribute('fill-opacity', '0.20');

    rectangle.setAttribute('stroke', zone.color || '#e4b84c');
    rectangle.setAttribute('stroke-width', '2');
    rectangle.setAttribute(
    'stroke-dasharray',
    zone === pendingZone ? '7 4' : 'none'
    );

    drawingLayer.appendChild(rectangle);

  });


  // Draw the temporary zone while dragging.
  if (zoneStart && zoneStart.end) {

    const x = Math.min(zoneStart.x, zoneStart.end.x);
    const y = Math.min(zoneStart.y, zoneStart.end.y);

    const width = Math.abs(zoneStart.end.x - zoneStart.x);
    const height = Math.abs(zoneStart.end.y - zoneStart.y);

    const preview = document.createElementNS(
      svgNamespace,
      'rect'
    );

    preview.setAttribute('x', x * 10);
    preview.setAttribute('y', y * 6.4);
    preview.setAttribute('width', width * 10);
    preview.setAttribute('height', height * 6.4);


    const selectedZoneColor =
      document.getElementById('zoneColor').value || '#e4b84c';
    preview.setAttribute('fill', selectedZoneColor);
    preview.setAttribute('fill-opacity', '0.20');

    preview.setAttribute('stroke', selectedZoneColor);
    preview.setAttribute('stroke-width', '2');
    preview.setAttribute('stroke-dasharray', '7 4');

    drawingLayer.appendChild(preview);

  }


  // Draw completed player groups first.
  state.groups.forEach(group => {

    const groupPlayers = group.playerIds
      .map(id => state.players.find(player => player.id === id))
      .filter(Boolean);

    if (groupPlayers.length < 3) {

      return;

    }

    const polygon = document.createElementNS(
      svgNamespace,
      'polygon'
    );

    polygon.setAttribute(
      'points',
      getPolygonPoints(groupPlayers)
    );

    polygon.setAttribute('fill', group.color);

    polygon.setAttribute('fill-opacity', '0.25');

    polygon.setAttribute('stroke', group.color);

    polygon.setAttribute('stroke-width', '3');

    polygon.setAttribute('stroke-linejoin', 'round');

    drawingLayer.appendChild(polygon);

  });


  // Draw the temporary polygon while selecting players.
  const selectedPlayers = state.players.filter(
    player => state.groupSelection.includes(player.id)
  );

  if (selectedPlayers.length >= 3) {

    const preview = document.createElementNS(
      svgNamespace,
      'polygon'
    );

    preview.setAttribute(
      'points',
      getPolygonPoints(selectedPlayers)
    );

    preview.setAttribute('fill', '#e4b84c');

    preview.setAttribute('fill-opacity', '0.18');

    preview.setAttribute('stroke', '#e4b84c');

    preview.setAttribute('stroke-width', '3');

    preview.setAttribute('stroke-dasharray', '8 5');

    drawingLayer.appendChild(preview);

  }

    // Automatic movement lines (run previews and playback trails).
    drawMovementLines(svgNamespace);

    // Draw arrows, lines, and freehand drawings.
    state.drawings.forEach(drawing => {

    let element;

    if (drawing.type === 'freehand') {

      element = document.createElementNS(svgNamespace, 'polyline');

      element.setAttribute(
        'points',
        drawing.points.map(point => point.join(',')).join(' ')
      );

      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', drawing.color);
      element.setAttribute('stroke-width', '3');
      element.setAttribute('stroke-linecap', 'round');
      element.setAttribute('stroke-linejoin', 'round');

    } else if (drawing.type === 'arrow' && drawing.style === 'dribble') {

      // Squiggly line with an arrowhead.
      element = document.createElementNS(svgNamespace, 'polyline');

      element.setAttribute('points', getSquigglePoints(drawing));
      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', drawing.color);
      element.setAttribute('stroke-width', '3');
      element.setAttribute('stroke-linecap', 'round');
      element.setAttribute('stroke-linejoin', 'round');
      element.setAttribute('marker-end', 'url(#arrowhead)');

    } else {

      element = document.createElementNS(svgNamespace, 'line');

      element.setAttribute('x1', drawing.x1);
      element.setAttribute('y1', drawing.y1);
      element.setAttribute('x2', drawing.x2);
      element.setAttribute('y2', drawing.y2);
      element.setAttribute('stroke', drawing.color);
      element.setAttribute('stroke-width', '3');

      if (drawing.type === 'arrow') {
        element.setAttribute('marker-end', 'url(#arrowhead)');
      }

      // Player runs are dashed.
      if (drawing.style === 'run') {
        element.setAttribute('stroke-dasharray', '10 7');
      }

    }

    drawingLayer.appendChild(element);

  });




  // Define the arrowhead.
  const defs = document.createElementNS(
    svgNamespace,
    'defs'
  );

  defs.innerHTML = `
    <marker
      id="arrowhead"
      markerWidth="7"
      markerHeight="7"
      refX="5"
      refY="3"
      orient="auto">

      <path
        d="M0,0 L6,3 L0,6"
        fill="none"
        stroke="#fff"
        stroke-width="1.2"/>

    </marker>
  `;

  drawingLayer.prepend(defs);

}


/* =========================================================
   20a. GROUP MANAGEMENT
   ========================================================= */

function updateGroupInstructions() {

  const instructions = document.getElementById('groupInstructions');

  if (!instructions) return;

  const count = state.groupSelection.length;

  if (count === 0) {

    instructions.textContent =
      'Select three or more players on the pitch.';

  } else if (count < 3) {

    instructions.textContent =
      `${count} player${count === 1 ? '' : 's'} selected. Select at least ${3 - count} more.`;

  } else {

    instructions.textContent =
      `${count} players selected. Create your group when ready.`;

  }

}


// Displays all created groups in the sidebar.

function updateGroupsPanel() {

  const list = document.getElementById('groupsList');

  if (!list) return;

  list.innerHTML = '';

  if (state.groups.length === 0) {

    const message = document.createElement('p');

    message.textContent = 'No groups created yet.';

    list.appendChild(message);

    return;

  }


  state.groups.forEach(group => {

    const item = document.createElement('div');

    item.className = 'group-list-item';

    const name = document.createElement('div');

    name.className = 'group-list-name';

    const color = document.createElement('span');

    color.className = 'group-color-dot';

    color.style.background = group.color;

    const label = document.createElement('span');

    label.textContent = group.name;

    name.append(color, label);


    const deleteButton = document.createElement('button');

    deleteButton.className = 'group-delete-button';

    deleteButton.textContent = 'Delete';

    deleteButton.type = 'button';

    deleteButton.addEventListener('click', () => {

      snapshot();

      state.groups = state.groups.filter(
        g => g.id !== group.id
      );

      render();

      showToast('Group deleted');

    });

    item.append(name, deleteButton);

    list.appendChild(item);

  });

}

// Displays all created zones in the sidebar.
function updateZonesPanel() {

  const list = document.getElementById('zonesList');

  if (!list) return;

  list.innerHTML = '';

  if (state.zones.length === 0) {
    const message = document.createElement('p');
    message.textContent = 'No zones created yet.';
    list.appendChild(message);
    return;
  }

  state.zones.forEach((zone, index) => {

    const item = document.createElement('div');
    item.className = 'group-list-item';

    // Zone name and color indicator.
    const name = document.createElement('div');
    name.className = 'group-list-name';

    const color = document.createElement('span');
    color.className = 'group-color-dot';
    color.style.background = zone.color || '#e4b84c';

    const label = document.createElement('span');
    label.textContent = `Zone ${index + 1}`;

    name.append(color, label);

    // Delete button.
    const deleteButton = document.createElement('button');
    deleteButton.className = 'group-delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.type = 'button';

    deleteButton.addEventListener('click', () => {

      snapshot();

      state.zones = state.zones.filter(
        z => z.id !== zone.id
      );

      render();

      showToast('Zone deleted');

    });

    item.append(name, deleteButton);
    list.appendChild(item);

  });

}


// Remove a player from every group when that player is deleted.

function removePlayerFromGroups(playerId) {

  // Update the currently active groups.
  state.groups.forEach(group => {

    group.playerIds = group.playerIds.filter(
      id => id !== playerId
    );

  });

  // Update groups stored in every animation frame.
  if (state.animation) {

    state.animation.frames.forEach(frame => {

      (frame.groups || []).forEach(group => {

        group.playerIds = group.playerIds.filter(
          id => id !== playerId
        );

      });

    });

  }

  state.groupSelection = state.groupSelection.filter(
    id => id !== playerId
  );

}


//Setup group to be the largest sign while containing all the players
function expandGroupSelection(selectedPlayers) {

  if (selectedPlayers.length < 3) {
    return selectedPlayers;
  }

  // Calculate the bounding box of the selected players.
  const minX = Math.min(...selectedPlayers.map(p => p.x));
  const maxX = Math.max(...selectedPlayers.map(p => p.x));
  const minY = Math.min(...selectedPlayers.map(p => p.y));
  const maxY = Math.max(...selectedPlayers.map(p => p.y));

  // Include all players inside the selected boundary.
  return state.players.filter(player => {

    return (
      player.x >= minX &&
      player.x <= maxX &&
      player.y >= minY &&
      player.y <= maxY
    );

  });

}


// Create a group using the selected players.

const finishGroupBtn = document.getElementById('finishGroupBtn');

if (finishGroupBtn) {

  finishGroupBtn.addEventListener('click', () => {

    const initiallySelected = state.players.filter(
      player => state.groupSelection.includes(player.id)
    );

    const selectedPlayers = initiallySelected;

    if (selectedPlayers.length < 3) {

      showToast('Select at least three players');

      return;

    }

    const nameInput = document.getElementById('groupName');

    const colorInput = document.getElementById('groupColor');

    const groupName = nameInput.value.trim() || 'New group';

    snapshot();

    state.groups.push({

      id: `group-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,

      name: groupName,

      color: colorInput.value,

      playerIds: selectedPlayers.map(player => player.id)

    });

    state.groupSelection = [];

    nameInput.value = 'New group';

    render();

    showToast('Player group created');

  });

}


// Cancel the current selection.

const cancelGroupBtn = document.getElementById('cancelGroupBtn');

if (cancelGroupBtn) {

  cancelGroupBtn.addEventListener('click', () => {

    state.groupSelection = [];

    render();

    showToast('Group selection cleared');

  });

}

/* =========================================================
   20b. DIAGRAM STANDARDS (pass / run / dribble)
   ========================================================= */

// Build a wavy line from the arrow's start to its end.
function getSquigglePoints(drawing) {

  const dx = drawing.x2 - drawing.x1;
  const dy = drawing.y2 - drawing.y1;
  const length = Math.hypot(dx, dy);

  // Too short to squiggle: draw it straight.
  if (length < 20) {
    return `${drawing.x1},${drawing.y1} ${drawing.x2},${drawing.y2}`;
  }

  const WAVELENGTH = 26;   // distance between wave peaks
  const AMPLITUDE = 6;     // how far the wave swings sideways
  const TAPER = 20;        // the wave flattens near the tip so the arrowhead points straight

  // Unit vector perpendicular to the arrow.
  const nx = -dy / length;
  const ny = dx / length;

  const steps = Math.ceil(length / 2);
  const points = [];

  for (let i = 0; i <= steps; i++) {

    const distance = (i / steps) * length;
    const fade = Math.min(1, (length - distance) / TAPER);

    const offset =
      Math.sin((distance / WAVELENGTH) * 2 * Math.PI) * AMPLITUDE * fade;

    const x = drawing.x1 + dx * (distance / length) + nx * offset;
    const y = drawing.y1 + dy * (distance / length) + ny * offset;

    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);

  }

  return points.join(' ');

}


const standardsToggle = document.getElementById('standardsToggle');
const standardsPanel = document.getElementById('standardsPanel');

function updateStandardsUI() {

  standardsPanel.hidden = !state.standardsMode;

  document.querySelectorAll('.style-button').forEach(button => {
    button.classList.toggle('active', button.dataset.style === state.arrowStyle);
  });

}

// Switching standards on jumps straight to the Arrow tool.
standardsToggle.addEventListener('change', () => {

  if (isAnimating) {
    standardsToggle.checked = state.standardsMode;
    return;
  }

  state.standardsMode = standardsToggle.checked;

  if (state.standardsMode) {
    document.querySelector('.tool-button[data-tool="arrow"]').click();
  }

  updateStandardsUI();

  showToast(
    state.standardsMode
      ? 'Diagram standards on'
      : 'Diagram standards off'
  );

});

// Picking Pass / Run / Dribble also selects the Arrow tool.
document.querySelectorAll('.style-button').forEach(button => {

  button.addEventListener('click', () => {

    if (isAnimating) return;

    state.arrowStyle = button.dataset.style;

    document.querySelector('.tool-button[data-tool="arrow"]').click();

    updateStandardsUI();

  });

});


/* =========================================================
   21. TOOL BUTTONS
   ========================================================= */

document.querySelectorAll('.tool-button').forEach(button => {

  button.addEventListener('click', () => {

    if (isAnimating) return;

    state.tool = button.dataset.tool;

    // Keep pending zones when switching tools, but hide their controls
    // unless the Zones tool is selected.
    const zoneControls = document.getElementById('zoneConfirmControls');

    if (zoneControls) {
      zoneControls.hidden = !pendingZone || state.tool !== 'zones';
    }


    // Clear temporary selection when leaving Groups.
    if (state.tool !== 'group') {

      state.groupSelection = [];

    }


    // Show or hide the Groups panel.
    // Show or hide the Groups panel.
    const groupPanel = document.getElementById('groupPanel');

    if (groupPanel) {

      groupPanel.hidden = state.tool !== 'group';

    }

    // Show or hide the Zones panel.
    const zonePanel = document.getElementById('zonePanel');

    if (zonePanel) {

      zonePanel.hidden = state.tool !== 'zones';

    }


    // Highlight the active tool.
    document.querySelectorAll('.tool-button').forEach(toolButton => {

      toolButton.classList.toggle(
        'active',
        toolButton === button
      );

    });


    // Update the board instructions.
    const hints = {

      select: 'Drag players and the ball to reposition them.',

      player: 'Click anywhere on the pitch to add a player.',

      ball: 'Click the pitch to move the ball.',

      arrow: 'Click and drag to draw an arrow.',

      line: 'Click and drag to draw a line.',

      draw: 'Click and drag to draw freely.',

      eraser: 'Click a player, ball, or pitch drawing to remove it.',

      group: 'Click three or more players to create a tactical group.',

      zones: 'Click and drag on the pitch to create a tactical zone.'

    };

    document.getElementById('boardHint').textContent =
      hints[state.tool] || '';

    render();

  });

});


/* =========================================================
   22. HOME / AWAY TEAM SELECTION
   ========================================================= */

document.querySelectorAll('.team-tab').forEach(button => {

  button.addEventListener('click', () => {

    if (isAnimating) return;

    state.activeTeam = button.dataset.team;

    document.querySelectorAll('.team-tab').forEach(teamButton => {
      teamButton.classList.toggle(
        'active',
        teamButton.dataset.team === state.activeTeam
      );
    });

    updateTeamColorVisibility();
    updateGoalkeeperColorVisibility();
    updateFormationVisibility();

  });

});


/* =========================================================
   23. FORMATION SELECTORS
   ========================================================= */

document.getElementById('formationSelect').addEventListener(
  'change',
  event => applyFormation('home', event.target.value)
);

document.getElementById('awayFormationSelect').addEventListener(
  'change',
  event => applyFormation('away', event.target.value)
);


function applyFormation(team, formation) {

  if (isAnimating) return;

  const coords = formations[formation];

  if (!coords) {

    showToast('Formation not found');

    return;

  }

  snapshot();

  const teamPlayers = state.players.filter(
    player => player.team === team
  );

  coords.forEach(([x, y], i) => {

    if (teamPlayers[i]) {

      teamPlayers[i].x = team === 'home' ? x : 100 - x;

      teamPlayers[i].y = y;

    }

  });

  render();

  showToast(
    `${team === 'home' ? 'Home' : 'Away'} formation updated`
  );

}


// Reset field.

document.getElementById('resetFieldBtn').addEventListener(
  'click',
  () => {

    if (isAnimating) return;

    snapshot();

    state.players = [

      ...makeTeam(
        'home',
        document.getElementById('formationSelect').value
      ),

      ...makeTeam(
        'away',
        document.getElementById('awayFormationSelect').value
      )

    ];

    state.ball = {

      x: 50,

      y: 50

    };

    // New players have new IDs, so start a fresh animation.
    state.animation = null;

    state.groups = [];

    state.groupSelection = [];

    state.selectedId = null;

    render();

    showToast('Both teams reset');

  }
);


/* =========================================================
   24. PLAYER EDITOR
   ========================================================= */

document.getElementById('playerName').addEventListener(
  'input',
  event => {

    const player = state.players.find(
      p => p.id === state.selectedId
    );

    if (player) {

      player.name = event.target.value;

      renderPlayerLabels();

    }

  }
);


document.getElementById('playerNumber').addEventListener(
  'change',
  event => {

    const player = state.players.find(
      p => p.id === state.selectedId
    );

    if (player) {

      snapshot();

      player.number = Math.max(
        1,
        Math.min(99, Number(event.target.value) || 1)
      );

      render();

    }

  }
);


document.getElementById('playerTeam').addEventListener(
  'change',
  event => {

    const player = state.players.find(
      p => p.id === state.selectedId
    );

    if (player) {

      snapshot();

      player.team = event.target.value;

      state.activeTeam = player.team;

      render();

    }

  }
);

document.getElementById('playerRole').addEventListener('change', event => {
  if (isAnimating) return;

  const player = state.players.find(p => p.id === state.selectedId);

  if (!player) return;

  snapshot();

  player.role = event.target.value;

  render();
});


function renderPlayerLabels() {

  // Remove existing player labels.
  playersLayer.querySelectorAll('.player-label').forEach(label => {
    label.remove();
  });

  // Find the currently selected player.
  const player = state.players.find(
    p => p.id === state.selectedId
  );

  if (!player || !player.name) return;

  // Find that player's marker.
  const element = playersLayer.querySelector(
    `[data-id="${CSS.escape(state.selectedId)}"]`
  );

  if (!element) return;

  // Create the name label.
  const label = document.createElement('span');

  label.className = 'player-label';

  label.textContent = player.name;

  element.appendChild(label);

}


// Delete the currently selected player.

document.getElementById('deletePlayerBtn').addEventListener(
  'click',
  () => {

    if (isAnimating || !state.selectedId) return;

    snapshot();

    removePlayerFromGroups(state.selectedId);

    removePlayerFromAnimationFrames(state.selectedId);

    state.players = state.players.filter(
      player => player.id !== state.selectedId
    );

    state.selectedId = null;

    render();

  }
);



/* =========================================================
   25. UNDO AND REDO
   ========================================================= */

document.getElementById('undoBtn').addEventListener(
  'click',
  undo
);

document.getElementById('redoBtn').addEventListener(
  'click',
  redo
);


// Keyboard shortcuts for Undo and Redo.
document.addEventListener('keydown', (event) => {

  // Don't trigger shortcuts while typing in an input or editable element.
  const isTyping = event.target.closest(
    'input, textarea, select, [contenteditable="true"]'
  );

  if (isTyping || event.target.isContentEditable) return;

  // Ctrl + Z (or Cmd + Z) = Undo
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {

    event.preventDefault();

    if (event.shiftKey) {
      // Ctrl/Cmd + Shift + Z = Redo
      redo();
    } else {
      undo();
    }

  }

});


function restoreBoardState(savedState) {

  const previous = JSON.parse(savedState);

  state.players = previous.players;

  state.teamColors = previous.teamColors || {
    home: '#265ebd',
    away: '#ef0808'
  };

  state.ball = previous.ball;

  state.drawings = previous.drawings;

  state.groups = previous.groups || [];

  state.zones = deepCopy(previous.zones || []);

  state.animation = previous.animation || null;

  state.fieldOrientation = previous.fieldOrientation || 'horizontal';

  applyFieldOrientation();

  state.groupSelection = [];

  state.selectedId = null;

  // Restore the selected frame's positions.
  if (state.animation) {
    applyAnimationFrame(state.animation.activeFrame);
  }

  render();

}


function undo() {

  if (isAnimating) return;

  const previousState = undoStack.pop();

  if (!previousState) {
    showToast('Nothing to undo');
    return;
  }

  // Save the current state so Redo can restore it.
  redoStack.push(captureBoardState());

  if (redoStack.length > 40) {
    redoStack.shift();
  }

  restoreBoardState(previousState);
  showToast('Undo successful');

}


function redo() {

  if (isAnimating) return;

  const nextState = redoStack.pop();

  if (!nextState) {
    showToast('Nothing to redo');
    return;
  }

  // Save the current state so Undo can reverse the Redo.
  undoStack.push(captureBoardState());

  if (undoStack.length > 40) {
    undoStack.shift();
  }

  restoreBoardState(nextState);
  showToast('Redo successful');

}


/* =========================================================
   26. CLEAR THE BOARD
   ========================================================= */

document.getElementById('clearBtn').addEventListener(
  'click',
  () => {

    if (isAnimating) return;

    if (!confirm('Clear all players and drawings from the board?')) {

      return;

    }

    snapshot();

    state.players = [];

    state.drawings = [];

    state.groups = [];

    state.zones = [];

    pendingZone = null;
    zoneStart = null;

    document.getElementById('zoneConfirmControls').hidden = true;

    state.groupSelection = [];

    state.animation = null;

    state.ball = {

      x: 50,

      y: 50

    };

    state.selectedId = null;

    render();

    showToast('Board cleared');

  }
);


/* =========================================================
   27. FLIP THE PITCH
   ========================================================= */

document.getElementById('flipBtn').addEventListener(
  'click',
  () => {

    if (isAnimating) return;

    snapshot();

    state.players.forEach(player => {

      player.x = 100 - player.x;

      player.y = 100 - player.y;

    });

    state.ball = {

      x: 100 - state.ball.x,

      y: 100 - state.ball.y

    };

    render();

  }
);


/* =========================================================
   28. RENAME THE TACTIC
   ========================================================= */

document.getElementById('boardName').addEventListener(
  'click',
  () => {

    const name = prompt(
      'Name this tactic:',
      state.boardName
    );

    if (name && name.trim()) {

      state.boardName = name.trim();

      document.getElementById('boardName').textContent =
        state.boardName;

    }

  }
);


/* =========================================================
   29. SAVE THE BOARD
   ========================================================= */

// One place that defines everything a saved tactic contains.
function buildSavePayload() {

  saveActiveFrame();

  return {
    players: state.players,
    teamColors: state.teamColors,
    fieldOrientation: state.fieldOrientation,
    ball: state.ball,
    drawings: state.drawings,
    groups: state.groups,
    zones: state.zones,
    animation: state.animation,
    boardName: state.boardName,
    homeFormation: document.getElementById('formationSelect').value,
    awayFormation: document.getElementById('awayFormationSelect').value
  };

}

// Save inside this browser (your existing button).
document.getElementById('saveBtn').addEventListener('click', () => {

  if (isAnimating) return;

  localStorage.setItem(
    'tactcl-board-save',
    JSON.stringify(buildSavePayload())
  );

  showToast('Tactic saved in this browser');

});


/* =========================================================
   29b. SAVE AS (download a file) AND IMPORT
   ========================================================= */

const FILE_APP_ID = 'tactcl-soccer-board';
const FILE_VERSION = 1;

function safeFileName(name) {

  return String(name)
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'TACTCL-Board';

}

document.getElementById('saveAsBtn').addEventListener('click', async () => {

  if (isAnimating) return;

  const fileContents = JSON.stringify({
    app: FILE_APP_ID,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    data: buildSavePayload()
  }, null, 2);

  const filename = `${safeFileName(state.boardName)}.tactcl.json`;

  // Chrome / Edge: real "Save As" dialog.
  if (window.showSaveFilePicker) {

    try {

      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'TACTCL tactic',
          accept: { 'application/json': ['.json'] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(fileContents);
      await writable.close();

      showToast(`Saved ${handle.name}`);
      return;

    } catch (error) {

      if (error.name === 'AbortError') return;   // user cancelled
      console.warn('Save dialog failed, downloading instead:', error);

    }

  }

  // Firefox / Safari: normal download.
  const blob = new Blob([fileContents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 10000);

  showToast(`Saved ${filename}`);

});


// Check that imported data is safe to load.
function validateSavedData(data) {

  if (!data || typeof data !== 'object') return 'The file is empty or damaged';

  if (!Array.isArray(data.players)) return 'No players found in this file';

  if (data.players.length > 200) return 'This file has too many players';

  const playersAreValid = data.players.every(player =>
    player &&
    typeof player.id === 'string' &&
    (player.team === 'home' || player.team === 'away') &&
    Number.isFinite(player.x) &&
    Number.isFinite(player.y)
  );

  if (!playersAreValid) return 'Player data is damaged';

  if (data.ball && !(Number.isFinite(data.ball.x) && Number.isFinite(data.ball.y))) {
    return 'Ball data is damaged';
  }

  for (const key of ['drawings', 'groups', 'zones']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return `${key} data is damaged`;
    }
  }

  return null;

}


const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

importBtn.addEventListener('click', () => {

  if (isAnimating) return;

  importFile.click();

});

importFile.addEventListener('change', () => {

  const file = importFile.files[0];

  importFile.value = '';   // lets the same file be imported twice

  if (!file) return;

  if (file.size > 20 * 1024 * 1024) {
    showToast('That file is too large');
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {

    try {

      const parsed = JSON.parse(reader.result);

      if (parsed.app !== FILE_APP_ID || !parsed.data) {
        throw new Error('This is not a TACTCL file');
      }

      if (parsed.version > FILE_VERSION) {
        throw new Error('This file was made with a newer version');
      }

      const problem = validateSavedData(parsed.data);

      if (problem) throw new Error(problem);

      if (!confirm('Importing will replace the current board. Continue?')) {
        return;
      }

      snapshot();                       // so Undo can bring the old board back
      applySavedData(parsed.data);

      showToast(`Imported "${state.boardName}"`);

    } catch (error) {

      console.error('Import error:', error);
      showToast(`Import failed: ${error.message}`);

    }

  };

  reader.onerror = () => showToast('Could not read that file');

  reader.readAsText(file);

});


/* =========================================================
   30. LOAD A SAVED BOARD
   ========================================================= */

// Rebuild the whole board from saved data.
// Used by both the browser save and file import.
function applySavedData(saved) {

  state.players = (saved.players || state.players).map(player => ({
    ...player,
    role: player.role || (player.number === 1 ? 'goalkeeper' : 'outfield')
  }));

  state.teamColors = {
    home: /^#[0-9a-f]{6}$/i.test(saved.teamColors?.home || '')
      ? saved.teamColors.home
      : '#265ebd',

    away: /^#[0-9a-f]{6}$/i.test(saved.teamColors?.away || '')
      ? saved.teamColors.away
      : '#ef0808'
  };

  state.fieldOrientation =
    saved.fieldOrientation === 'vertical'
      ? 'vertical'
      : 'horizontal';

  applyFieldOrientation();

  state.ball = saved.ball || state.ball;

  state.drawings = saved.drawings || [];

  state.groups = saved.groups || [];

  state.zones = saved.zones || [];

  state.groupSelection = [];

  state.selectedId = null;

  // Clear any half-finished zone.
  pendingZone = null;
  zoneStart = null;
  document.getElementById('zoneConfirmControls').hidden = true;

  state.boardName = saved.boardName || 'Untitled tactic';


  // Restore animation frames.
  if (
    saved.animation &&
    Array.isArray(saved.animation.frames) &&
    saved.animation.frames.length >= 1 &&
    saved.animation.frames.length <= MAX_ANIMATION_FRAMES
  ) {

    state.animation = saved.animation;

    // Older saves may not have per-frame drawings, groups, or zones.
    state.animation.frames.forEach(frame => {

      if (!Array.isArray(frame.positions)) frame.positions = [];

      if (!Array.isArray(frame.drawings)) {
        frame.drawings = deepCopy(saved.drawings || []);
      }

      if (!Array.isArray(frame.groups)) {
        frame.groups = deepCopy(saved.groups || []);
      }

      if (!Array.isArray(frame.zones)) {
        frame.zones = [];
      }

    });

    state.animation.activeFrame = Math.max(
      0,
      Math.min(
        state.animation.frames.length - 1,
        Number(saved.animation.activeFrame) || 0
      )
    );

    applyAnimationFrame(state.animation.activeFrame);

  } else {

    state.animation = null;

  }

  document.getElementById('boardName').textContent = state.boardName;

  if (formations[saved.homeFormation]) {
    document.getElementById('formationSelect').value = saved.homeFormation;
  }

  if (formations[saved.awayFormation]) {
    document.getElementById('awayFormationSelect').value = saved.awayFormation;
  }

  render();

}


// Load the browser save when the page opens.
function loadSaved() {

  const raw = localStorage.getItem('tactcl-board-save');

  if (!raw) return;

  try {

    applySavedData(JSON.parse(raw));

  } catch (error) {

    console.warn('Could not load saved tactic:', error);

  }

}


//Export Video
async function exportAnimatedVideo(board) {

  if (typeof VideoEncoder === 'undefined' || typeof Mp4Muxer === 'undefined') {
    showToast('Video export needs a recent Chrome/Edge and the mp4-muxer script');
    return;
  }

  const FPS = 30;
  const CAPTURE_SCALE = 2;
  const STEPS = Math.round((FRAME_ANIMATION_DURATION / 1000) * FPS);
  const isVertical = state.fieldOrientation === 'vertical';

  const OUTPUT_WIDTH = isVertical ? 2200 : 3644;
  const OUTPUT_HEIGHT = isVertical ? 3644 : 2200;
  const HOLD_START_MS = 700;
  const HOLD_END_MS = 1000;
  const BITRATE = 30000000;          // 30 Mbps keeps thin lines and borders crisp
  const PITCH_GREEN = '#2d8054';

  const frames = state.animation.frames;
  const originalFrame = state.animation.activeFrame;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const captureOptions = {
    scale: CAPTURE_SCALE,
    backgroundColor: PITCH_GREEN,
    useCORS: true,
    logging: false,
    onclone: prepareCloneForExport          // draws the two-tone grass
  };

  
  let width = 0;
  let height = 0;

  async function grab() {
    const canvas = await html2canvas(board, captureOptions);
    width = canvas.width - (canvas.width % 2);
    height = canvas.height - (canvas.height % 2);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  function showInterpolated(fromIndex, toIndex, t) {

    const fromMap = new Map(frames[fromIndex].positions.map(p => [p.id, p]));
    const toMap = new Map(frames[toIndex].positions.map(p => [p.id, p]));

    state.players.forEach(player => {
      const a = fromMap.get(player.id);
      const b = toMap.get(player.id);
      if (!a || !b) return;

      player.x = a.x + (b.x - a.x) * t;
      player.y = a.y + (b.y - a.y) * t;

      const el = playersLayer.querySelector(`[data-id="${CSS.escape(player.id)}"]`);
      if (el) {
        el.style.left = `${player.x}%`;
        el.style.top = `${player.y}%`;
      }
    });

    const fb = frames[fromIndex].ball;
    const tb = frames[toIndex].ball;

    state.ball = {
      x: fb.x + (tb.x - fb.x) * t,
      y: fb.y + (tb.y - fb.y) * t
    };

    const ballEl = playersLayer.querySelector('.ball');
    if (ballEl) {
      ballEl.style.left = `${state.ball.x}%`;
      ballEl.style.top = `${state.ball.y}%`;
    }

    renderDrawings();
  }

  try {

    isAnimating = true;
    updateAnimationControls();

    // ---------- PASS 1: render every step ----------
    applyAnimationFrame(0);
    render();

    const shots = [];
    shots.push({ blob: await grab(), repeat: Math.round(HOLD_START_MS / 1000 * FPS) });

    for (let index = 1; index < frames.length; index++) {

      applyAnimationFrame(index - 1);
      startAnimationTrail();
      animationTargetIndex = index;          // <-- add
      renderDrawings();

      // Hold on the planned paths before the move starts.   <-- add these 2 lines
      shots.push({ blob: await grab(), repeat: Math.round(PREVIEW_HOLD_MS / 1000 * FPS) });

      for (let step = 1; step <= STEPS; step++) {

        showInterpolated(index - 1, index, ease(step / STEPS));

        if (step === STEPS) {
          applyAnimationFrame(index);
          renderDrawings();
        }

        shots.push({ blob: await grab(), repeat: 1 });
        showToast(`Rendering ${index}/${frames.length - 1}: ${step}/${STEPS}`);
      }
    }

    shots[shots.length - 1].repeat = Math.round(HOLD_END_MS / 1000 * FPS);

    // ---------- PASS 2: encode H.264 ----------
    showToast('Encoding video...');

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width, height },
      fastStart: 'in-memory'
    });

    const encoderConfig = {
      codec: 'avc1.640033',          // H.264 High profile, level 5.1
      width,
      height,
      bitrate: BITRATE,
      framerate: FPS,
      latencyMode: 'quality',
      avc: { format: 'avc' }
    };

    const support = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
      throw new Error('This browser cannot encode H.264 at this size');
    }

    let encoderError = null;

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { encoderError = e; }
    });

    encoder.configure(encoderConfig);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let frameNumber = 0;
    const frameDuration = 1000000 / FPS;

    for (const shot of shots) {

      const bitmap = await createImageBitmap(shot.blob);
      ctx.fillStyle = PITCH_GREEN;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      for (let r = 0; r < shot.repeat; r++) {

        const videoFrame = new VideoFrame(canvas, {
          timestamp: Math.round(frameNumber * frameDuration),
          duration: Math.round(frameDuration)
        });

        encoder.encode(videoFrame, { keyFrame: frameNumber % FPS === 0 });
        videoFrame.close();
        frameNumber++;

        if (encoder.encodeQueueSize > 10) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    await encoder.flush();
    encoder.close();

    if (encoderError) throw encoderError;

    muxer.finalize();

    // ---------- Download ----------
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const safeName = state.boardName
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    link.download = `${safeName || 'TACTCL-Board'}.mp4`;
    link.href = url;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 10000);

    showToast('Video exported successfully!');

  } catch (error) {

    console.error('Video export error:', error);
    showToast(`Video export failed: ${error.message}`);

  } finally {

    isAnimating = false;
    applyAnimationFrame(originalFrame);
    render();
  }
}


/* =========================================================
   ANIMATED GIF EXPORT
   ========================================================= */

async function exportAnimatedGif(board) {

  if (typeof GIF === 'undefined') {

    showToast('GIF export library has not loaded');

    return;

  }

  const originalFrame = state.animation.activeFrame;

  const gif = new GIF({

    workers: 2,

    quality: 10,

    workerScript:
      './gif.worker.js'

  });

  const canvasOptions = {

    scale: 1,

    backgroundColor: null,

    useCORS: true,

    logging: false,

    onclone: prepareCloneForExport

  };


  // Capture the current board as a GIF frame.

  async function captureGifFrame(delay = 100) {

    const canvas = await html2canvas(
      board,
      canvasOptions
    );

    gif.addFrame(canvas, {

      copy: true,

      delay: delay

    });

  }


  try {

    showToast('Generating animated GIF...');

    // Always begin at Frame 1.

    applyAnimationFrame(0);

    render();

    await captureGifFrame(500);


    // Animate through every remaining frame.

    isAnimating = true;

    updateAnimationControls();

    for (
      let index = 1;
      index < state.animation.frames.length;
      index++
    ) {

      let finished = false;

      // Capture the board while it is moving.
      const capturePromise = (async () => {

        let lastCapture = performance.now();

        while (!finished) {

          const canvas = await html2canvas(
            board,
            canvasOptions
          );

          const now = performance.now();

          const delay = Math.max(
            50,
            Math.min(300, now - lastCapture)
          );

          gif.addFrame(canvas, {

            copy: true,

            delay: delay

          });

          lastCapture = now;

          await new Promise(resolve =>
            setTimeout(resolve, 100)
          );

        }

      })();

      // Use your existing animation system.
      await animateToFrame(index);

      finished = true;

      await capturePromise;

    }

    // Hold the final frame briefly.
    await captureGifFrame(700);

    isAnimating = false;

    // Restore the user's previously selected frame.
    applyAnimationFrame(originalFrame);

    render();

    updateAnimationControls();


    // Generate the final GIF.
    gif.on('finished', blob => {

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');

      const safeName = state.boardName
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      link.download =
        `${safeName || 'TACTCL-Board'}.gif`;

      link.href = url;

      link.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);

      showToast('Animated GIF exported successfully!');

    });

    gif.on('error', error => {

      console.error('GIF encoding error:', error);

      showToast('Could not generate animated GIF');

    });

    gif.render();

  } catch (error) {

    isAnimating = false;

    applyAnimationFrame(originalFrame);

    render();

    updateAnimationControls();

    console.error('GIF export error:', error);

    console.error('Error details:', error.message);

    showToast(`GIF export failed: ${error.message}`);

  }

}



/* =========================================================
   31. EXPORT BOARD
   Supports PNG and animated GIF exports.
   ========================================================= */

document.getElementById('exportBtn').addEventListener(
  'click',
  async () => {

    if (isAnimating) {

      showToast('Wait for the animation to finish');

      return;

    }

    const board = document.querySelector('.pitch-stage');

    if (!board) {

      showToast('Could not find the tactics board');

      return;

    }

    if (typeof html2canvas === 'undefined') {

      showToast('Export library has not loaded');

      return;

    }

    // Save the latest changes to the selected frame.
    saveActiveFrame();

    // Offer animated export when multiple frames exist.
    if (state.animation && state.animation.frames.length > 1) {

      const exportChoice = window.prompt(
        'Choose export format:\n\n1 = Animated GIF\n2 = Video (MP4)\n3 = Static PNG'
      );

      if (exportChoice === '1') {
        await exportAnimatedGif(board);
        return;
      }

      if (exportChoice === '2') {
        await exportAnimatedVideo(board);
        return;
      }

      if (exportChoice === null || exportChoice === '3') {
        // Continue to the existing static PNG export below.
      } else {
        showToast('Invalid export selection');
        return;
      }

    }

    // Otherwise export a static PNG.
    try {

      showToast('Generating your PNG...');

      const canvas = await html2canvas(board, {

        scale: 2,

        backgroundColor: null,

        useCORS: true,

        logging: false,

        onclone: prepareCloneForExport

      });

      const image = canvas.toDataURL('image/png');

      const link = document.createElement('a');

      const safeName = state.boardName
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      link.download =
        `${safeName || 'TACTCL-Board'}.png`;

      link.href = image;

      link.click();

      showToast('Tactics board exported successfully!');

    } catch (error) {

      console.error('Export error:', error);

      showToast('Could not export the tactics board');

    }

  }
);



/* =========================================================
   32. START THE APPLICATION
   ========================================================= */

initialize();

loadSaved();

// Apply the correct visibility settings on startup.
updateFormationVisibility();
updateTeamColorVisibility();
updateGoalkeeperColorVisibility();

// CONFIRM TACTICAL ZONE
document.getElementById('confirmZoneButton').addEventListener('click', () => {
  if (!pendingZone) return;

  snapshot();

  state.zones.push({
    ...pendingZone,
    id: `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
  });

  pendingZone = null;

  document.getElementById('zoneConfirmControls').hidden = true;

  render();
  showToast('Zone created');
});


// CANCEL TACTICAL ZONE
document.getElementById('cancelZoneButton').addEventListener('click', () => {
  pendingZone = null;

  document.getElementById('zoneConfirmControls').hidden = true;

  render();
});