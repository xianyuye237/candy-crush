const BOARD_SIZE = 8;
const CANDY_SIZE = 64;
const ANIMATION_DURATION = 200;

const CANDIES = [
  { color: "#FF69B4", image: "🍬" }, // Pink
  { color: "#9370DB", image: "🍭" }, // Purple
  { color: "#20B2AA", image: "🍪" }, // Mint
  { color: "#FFD700", image: "🍯" }, // Gold
  { color: "#FF6347", image: "🍓" }, // Red
  { color: "#98FB98", image: "🍏" }, // Green
];

const LEVEL_CONFIG = [
  { target: 1000, moves: 30 },
  { target: 2000, moves: 25 },
  { target: 3500, moves: 25 },
  { target: 5000, moves: 20 },
  { target: 7500, moves: 20 },
];

let canvas, ctx;
let board = [];
let score = 0;
let level = 1;
let moves = 0;
let selectedCandy = null;
let isAnimating = false;

class Candy {
  constructor(row, col, type) {
    this.row = row;
    this.col = col;
    this.type = type;
    this.x = col * CANDY_SIZE;
    this.y = row * CANDY_SIZE;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  draw() {
    // Smooth movement animation
    if (this.x !== this.targetX) {
      this.x += (this.targetX - this.x) * 0.2;
    }
    if (this.y !== this.targetY) {
      this.y += (this.targetY - this.y) * 0.2;
    }

    ctx.font = `${CANDY_SIZE * 0.7}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      CANDIES[this.type].image,
      this.x + CANDY_SIZE / 2,
      this.y + CANDY_SIZE / 2
    );

    if (this === selectedCandy) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x, this.y, CANDY_SIZE, CANDY_SIZE);
    }
  }
}

function initGame() {
  canvas = document.getElementById("gameBoard");
  ctx = canvas.getContext("2d");
  canvas.width = BOARD_SIZE * CANDY_SIZE;
  canvas.height = BOARD_SIZE * CANDY_SIZE;

  // Add click event listener
  canvas.addEventListener("click", handleClick);

  startGame();
}

function startGame() {
  level = 1;
  score = 0;
  moves = LEVEL_CONFIG[level - 1].moves;
  initBoard();
  updateUI();
  document.getElementById("gameOver").style.display = "none";
  document.getElementById("levelComplete").style.display = "none";
}

function initBoard() {
  board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      let type;
      do {
        type = Math.floor(Math.random() * CANDIES.length);
      } while (
        (row >= 2 &&
          board[row - 1][col]?.type === type &&
          board[row - 2][col]?.type === type) ||
        (col >= 2 &&
          board[row][col - 1]?.type === type &&
          board[row][col - 2]?.type === type)
      );
      board[row][col] = new Candy(row, col, type);
    }
  }
  draw();
}

function handleClick(e) {
  if (isAnimating) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const col = Math.floor(x / CANDY_SIZE);
  const row = Math.floor(y / CANDY_SIZE);

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;

  const clickedCandy = board[row][col];

  if (!selectedCandy) {
    selectedCandy = clickedCandy;
  } else {
    if (isAdjacent(selectedCandy, clickedCandy)) {
      swapCandies(selectedCandy, clickedCandy);
    }
    selectedCandy = null;
  }
  draw();
}

function isAdjacent(candy1, candy2) {
  const rowDiff = Math.abs(candy1.row - candy2.row);
  const colDiff = Math.abs(candy1.col - candy2.col);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

async function swapCandies(candy1, candy2) {
  if (moves <= 0 || isAnimating) return;
  isAnimating = true;

  // 保存原始位置，用于交换失败时恢复
  const candy1OriginalPos = { row: candy1.row, col: candy1.col };
  const candy2OriginalPos = { row: candy2.row, col: candy2.col };

  // 第一次交换
  await performSwap(candy1, candy2);

  // 检查是否有匹配
  const matches = findMatches();

  if (matches.length === 0) {
    // 如果没有匹配，交换回来
    await performSwap(candy1, candy2);

    // 恢复原始位置
    candy1.row = candy1OriginalPos.row;
    candy1.col = candy1OriginalPos.col;
    candy2.row = candy2OriginalPos.row;
    candy2.col = candy2OriginalPos.col;

    board[candy1.row][candy1.col] = candy1;
    board[candy2.row][candy2.col] = candy2;
  } else {
    // 如果有匹配，扣除移动次数
    moves--;
    // 处理匹配
    while (await removeMatches()) {
      await fillBoard();
    }
    updateUI();
  }

  isAnimating = false;
  selectedCandy = null;
  checkGameState();
}

// 新增辅助函数：执行交换动画
async function performSwap(candy1, candy2) {
  // 交换位置
  const tempRow = candy1.row;
  const tempCol = candy1.col;

  candy1.row = candy2.row;
  candy1.col = candy2.col;
  candy2.row = tempRow;
  candy2.col = tempCol;

  // 更新目标位置
  candy1.targetX = candy1.col * CANDY_SIZE;
  candy1.targetY = candy1.row * CANDY_SIZE;
  candy2.targetX = candy2.col * CANDY_SIZE;
  candy2.targetY = candy2.row * CANDY_SIZE;

  // 更新棋盘数组
  board[candy1.row][candy1.col] = candy1;
  board[candy2.row][candy2.col] = candy2;

  // 等待动画完成
  return animate();
}

// 优化动画函数，确保动画完全结束
function animate() {
  return new Promise((resolve) => {
    let startTime = null;
    function animation(currentTime) {
      if (!startTime) startTime = currentTime;
      const progress = currentTime - startTime;

      draw();

      if (progress < ANIMATION_DURATION) {
        requestAnimationFrame(animation);
      } else {
        // 确保最后一帧动画完成
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col]) {
              board[row][col].x = board[row][col].targetX;
              board[row][col].y = board[row][col].targetY;
            }
          }
        }
        draw();
        resolve();
      }
    }
    requestAnimationFrame(animation);
  });
}

function findMatches() {
  const matches = new Set();

  // Check horizontal matches
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 2; col++) {
      const candy1 = board[row][col];
      const candy2 = board[row][col + 1];
      const candy3 = board[row][col + 2];
      if (candy1.type === candy2.type && candy2.type === candy3.type) {
        matches.add(candy1);
        matches.add(candy2);
        matches.add(candy3);
      }
    }
  }

  // Check vertical matches
  for (let row = 0; row < BOARD_SIZE - 2; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const candy1 = board[row][col];
      const candy2 = board[row + 1][col];
      const candy3 = board[row + 2][col];
      if (candy1.type === candy2.type && candy2.type === candy3.type) {
        matches.add(candy1);
        matches.add(candy2);
        matches.add(candy3);
      }
    }
  }

  return Array.from(matches);
}

async function removeMatches() {
  const matches = findMatches();
  if (matches.length === 0) return false;

  score += matches.length * 100;

  // Remove matched candies
  for (const candy of matches) {
    board[candy.row][candy.col] = null;
  }

  await animate();
  return true;
}

async function fillBoard() {
  // Move existing candies down
  for (let col = 0; col < BOARD_SIZE; col++) {
    let emptyRow = BOARD_SIZE - 1;
    for (let row = BOARD_SIZE - 1; row >= 0; row--) {
      if (board[row][col]) {
        if (row !== emptyRow) {
          board[emptyRow][col] = board[row][col];
          board[emptyRow][col].row = emptyRow;
          board[emptyRow][col].targetY = emptyRow * CANDY_SIZE;
          board[row][col] = null;
        }
        emptyRow--;
      }
    }

    // Fill empty spaces with new candies
    for (let row = emptyRow; row >= 0; row--) {
      const type = Math.floor(Math.random() * CANDIES.length);
      board[row][col] = new Candy(row, col, type);
      board[row][col].y = -CANDY_SIZE;
      board[row][col].targetY = row * CANDY_SIZE;
    }
  }

  await animate();
}

function checkGameState() {
  const currentLevel = LEVEL_CONFIG[level - 1];

  // Update progress bar
  const progress = Math.min((score / currentLevel.target) * 100, 100);
  document.getElementById("progress").style.width = `${progress}%`;

  if (score >= currentLevel.target) {
    // Level complete
    if (level < LEVEL_CONFIG.length) {
      document.getElementById("levelComplete").style.display = "flex";
      document.getElementById("finalScore").textContent = score;
    } else {
      // Game complete
      document.getElementById("gameOver").style.display = "flex";
      document.getElementById("gameOverScore").textContent = score;
    }
  } else if (moves <= 0) {
    // Game over
    document.getElementById("gameOver").style.display = "flex";
    document.getElementById("gameOverScore").textContent = score;
  }
}

function nextLevel() {
  level++;
  moves = LEVEL_CONFIG[level - 1].moves;
  document.getElementById("levelComplete").style.display = "none";
  initBoard();
  updateUI();
}

function updateUI() {
  document.getElementById("score").textContent = score;
  document.getElementById("level").textContent = level;
  document.getElementById("moves").textContent = moves;
  document.getElementById("target").textContent =
    LEVEL_CONFIG[level - 1].target;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid background
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw candies
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col]) {
        board[row][col].draw();
      }
    }
  }
}

// Initialize game when window loads
window.onload = initGame;
