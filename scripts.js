
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


/* =========================================================
   1. CONNECT JAVASCRIPT TO THE HTML
   ========================================================= */

const pitch = document.getElementById('pitch');
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

const MAX_ANIMATION_FRAMES = 5;
const FRAME_ANIMATION_DURATION = 1000;


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

  ball: {
    x: 50,
    y: 50
  },

  drawings: [],

  groups: [],

  groupSelection: [],

  selectedId: null,

  activeTeam: 'home',

  tool: 'select',

  flipped: false,

  boardName: 'Untitled tactic',

  // Stores the two animation frames.
  animation: null

};

let undoStack = [];

let drag = null;

let drawStart = null;

let currentPath = null;

let toastTimer;

let isAnimating = false;


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

function captureFrame() {

  return {

    positions: state.players.map(player => ({

      id: player.id,

      x: player.x,

      y: player.y

    })),

    ball: deepCopy(state.ball)

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


    const startBall = deepCopy(state.ball);

    const endBall = deepCopy(targetFrame.ball);

    const startTime = performance.now();


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


    requestAnimationFrame(animate);

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

function snapshot() {

  // Save the current frame before recording the undo state.
  saveActiveFrame();

  undoStack.push(JSON.stringify({

    players: state.players,

    ball: state.ball,

    drawings: state.drawings,

    groups: state.groups,

    animation: state.animation

  }));

  if (undoStack.length > 40) {

    undoStack.shift();

  }

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

    x: team === 'home' ? x : 100 - x,

    y: y

  }));

}


/* =========================================================
   8. INITIALIZE THE BOARD
   ========================================================= */

function initialize() {

  state.players = [

    ...makeTeam('home'),

    ...makeTeam('away')

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

  // Keep the active frame synchronized with the board.
  saveActiveFrame();

  playersLayer.innerHTML = '';

  state.players.forEach(player => {

    const el = document.createElement('div');

    el.className = `player ${player.team}
      ${state.selectedId === player.id ? 'selected' : ''}
      ${state.groupSelection.includes(player.id) ? 'group-selected' : ''}`;

    el.style.left = `${player.x}%`;

    el.style.top = `${player.y}%`;

    el.dataset.id = player.id;

    el.innerHTML = `
      <span>${escapeHtml(player.number)}</span>
      <span class="player-label">${escapeHtml(player.name)}</span>
    `;

    el.addEventListener('pointerdown', onPlayerPointerDown);

    playersLayer.appendChild(el);

  });


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

  updateGroupInstructions();


  // Highlight the selected team.
  document.querySelectorAll('.team-tab').forEach(button => {

    button.classList.toggle(
      'active',
      button.dataset.team === state.activeTeam
    );

  });


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

}


/* =========================================================
   12. COORDINATE CALCULATIONS
   ========================================================= */

function coordsFromEvent(event) {

  const rect = pitch.getBoundingClientRect();

  return {

    x: Math.max(
      0,
      Math.min(100, (event.clientX - rect.left) / rect.width * 100)
    ),

    y: Math.max(
      0,
      Math.min(100, (event.clientY - rect.top) / rect.height * 100)
    )

  };

}


/* =========================================================
   13. PLAYER DRAGGING AND GROUP SELECTION
   ========================================================= */

function onPlayerPointerDown(event) {

  if (isAnimating) return;

  event.stopPropagation();

  const id = event.currentTarget.dataset.id;

  const player = state.players.find(p => p.id === id);


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
  if (state.tool !== 'select' && state.tool !== 'player') {

    return;

  }


  snapshot();

  state.selectedId = id;

  state.activeTeam = player.team;

  drag = {

    type: 'player',

    id: id

  };

  event.currentTarget.setPointerCapture(event.pointerId);

  playersLayer.querySelectorAll('.player').forEach(el => {

    el.classList.toggle(
      'selected',
      el.dataset.id === id
    );

  });

  updateEditor();

}


/* =========================================================
   14. BALL DRAGGING
   ========================================================= */

function onBallPointerDown(event) {

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

  drag = {

    type: 'ball'

  };

  event.currentTarget.setPointerCapture(event.pointerId);

}


/* =========================================================
   15. HANDLE MOVEMENT
   ========================================================= */

pitch.addEventListener('pointermove', event => {

  if (isAnimating) return;

  if (drag) {

    const point = coordsFromEvent(event);


    // Move a player.
    if (drag.type === 'player') {

      const player = state.players.find(
        p => p.id === drag.id
      );

      if (player) {

        player.x = point.x;

        player.y = point.y;

        const element = playersLayer.querySelector(
          `[data-id="${CSS.escape(drag.id)}"]`
        );

        if (element) {

          element.style.left = `${player.x}%`;

          element.style.top = `${player.y}%`;

        }

        // Update polygons while their players move.
        renderDrawings();

      }

    }


    // Move the ball.
    else if (drag.type === 'ball') {

      state.ball = point;

      const ballElement = playersLayer.querySelector('.ball');

      if (ballElement) {

        ballElement.style.left = `${point.x}%`;

        ballElement.style.top = `${point.y}%`;

      }

    }

    return;

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

  currentPath = null;

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


  // Add a new player.
  if (state.tool === 'player') {

    snapshot();

    const player = {

      id: `new-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,

      team: state.activeTeam,

      number: state.players.filter(
        p => p.team === state.activeTeam
      ).length + 1,

      name: 'New player',

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

  if (isAnimating || !drawStart) return;

  const point = coordsFromEvent(event);

  snapshot();

  state.drawings.push({

    type: drawStart.type,

    x1: drawStart.x,

    y1: drawStart.y,

    x2: point.x * 10,

    y2: point.y * 6.4,

    color: '#fff'

  });

  drawStart = null;

  renderDrawings();

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
   19. DRAWING RENDERER AND GROUP POLYGONS
   ========================================================= */

function renderDrawings() {

  drawingLayer.innerHTML = '';

  const svgNamespace = 'http://www.w3.org/2000/svg';


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


  // Draw arrows, lines, and freehand drawings.
  state.drawings.forEach(drawing => {

    let element;


    if (drawing.type === 'freehand') {

      element = document.createElementNS(
        svgNamespace,
        'polyline'
      );

      element.setAttribute(
        'points',
        drawing.points.map(point => point.join(',')).join(' ')
      );

      element.setAttribute('fill', 'none');

      element.setAttribute('stroke', drawing.color);

      element.setAttribute('stroke-width', '3');

      element.setAttribute('stroke-linecap', 'round');

      element.setAttribute('stroke-linejoin', 'round');

    } else {

      element = document.createElementNS(
        svgNamespace,
        'line'
      );

      element.setAttribute('x1', drawing.x1);

      element.setAttribute('y1', drawing.y1);

      element.setAttribute('x2', drawing.x2);

      element.setAttribute('y2', drawing.y2);

      element.setAttribute('stroke', drawing.color);

      element.setAttribute('stroke-width', '3');

      if (drawing.type === 'arrow') {

        element.setAttribute(
          'marker-end',
          'url(#arrowhead)'
        );

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
   20. GROUP MANAGEMENT
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


// Remove a player from every group when that player is deleted.

function removePlayerFromGroups(playerId) {

  state.groups.forEach(group => {

    group.playerIds = group.playerIds.filter(
      id => id !== playerId
    );

  });

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

    const selectedPlayers = expandGroupSelection(initiallySelected);

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
   21. TOOL BUTTONS
   ========================================================= */

document.querySelectorAll('.tool-button').forEach(button => {

  button.addEventListener('click', () => {

    if (isAnimating) return;

    state.tool = button.dataset.tool;


    // Clear temporary selection when leaving Groups.
    if (state.tool !== 'group') {

      state.groupSelection = [];

    }


    // Show or hide the Groups panel.
    const groupPanel = document.getElementById('groupPanel');

    if (groupPanel) {

      groupPanel.hidden = state.tool !== 'group';

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

      group: 'Click three or more players to create a tactical group.'

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
        teamButton === button
      );

    });

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


function renderPlayerLabels() {

  const player = state.players.find(
    p => p.id === state.selectedId
  );

  if (!player) return;

  const element = playersLayer.querySelector(
    `[data-id="${CSS.escape(state.selectedId)}"]`
  );

  if (element) {

    element.querySelector('.player-label').textContent =
      player.name;

  }

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
   25. UNDO
   ========================================================= */

document.getElementById('undoBtn').addEventListener(
  'click',
  undo
);


function undo() {

  if (isAnimating) return;

  const previousState = undoStack.pop();

  if (!previousState) {

    showToast('Nothing to undo');

    return;

  }

  const previous = JSON.parse(previousState);

  state.players = previous.players;

  state.ball = previous.ball;

  state.drawings = previous.drawings;

  state.groups = previous.groups || [];

  state.animation = previous.animation || null;

  state.groupSelection = [];

  state.selectedId = null;

  // Restore the selected frame's positions.
  if (state.animation) {

    applyAnimationFrame(state.animation.activeFrame);

  }

  render();

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

document.getElementById('renameBtn').addEventListener(
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

document.getElementById('saveBtn').addEventListener(
  'click',
  () => {

    if (isAnimating) return;

    // Save the latest active frame before saving the tactic.
    saveActiveFrame();

    const payload = {

      players: state.players,

      ball: state.ball,

      drawings: state.drawings,

      groups: state.groups,

      // Save both animation frames.
      animation: state.animation,

      boardName: state.boardName,

      homeFormation:
        document.getElementById('formationSelect').value,

      awayFormation:
        document.getElementById('awayFormationSelect').value

    };

    localStorage.setItem(
      'tactcl-board-save',
      JSON.stringify(payload)
    );

    showToast('Tactic saved in this browser');

  }
);


/* =========================================================
   30. LOAD A SAVED BOARD
   ========================================================= */

function loadSaved() {

  const raw = localStorage.getItem('tactcl-board-save');

  if (!raw) return;

  try {

    const saved = JSON.parse(raw);

    state.players = saved.players || state.players;

    state.ball = saved.ball || state.ball;

    state.drawings = saved.drawings || [];

    state.groups = saved.groups || [];

    state.groupSelection = [];

    state.boardName = saved.boardName || state.boardName;


    // Restore saved animation frames.
    // Restore saved animation frames.

    if (
      saved.animation &&
      Array.isArray(saved.animation.frames) &&
      saved.animation.frames.length >= 1 &&
      saved.animation.frames.length <= MAX_ANIMATION_FRAMES
    ) {

      state.animation = saved.animation;

      state.animation.activeFrame = Math.max(
        0,
        Math.min(
          state.animation.frames.length - 1,
          Number(saved.animation.activeFrame) || 0
        )
      );

    } else {

      state.animation = null;

    }


    // Restore the currently selected frame.

    if (state.animation) {

      applyAnimationFrame(state.animation.activeFrame);

    }

    document.getElementById('boardName').textContent =
      state.boardName;

    if (saved.homeFormation) {

      document.getElementById('formationSelect').value =
        saved.homeFormation;

    }

    if (saved.awayFormation) {

      document.getElementById('awayFormationSelect').value =
        saved.awayFormation;

    }

    render();

  } catch (error) {

    console.warn('Could not load saved tactic:', error);

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

    scale: 1.5,

    backgroundColor: null,

    useCORS: true,

    logging: false

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
    if (
      state.animation &&
      state.animation.frames.length > 1
    ) {

      const exportGif = window.confirm(
        'Export full animation as a GIF?\n\n' +
        'OK = Animated GIF\n' +
        'Cancel = Static PNG'
      );

      if (exportGif) {

        await exportAnimatedGif(board);

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

        logging: false

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
