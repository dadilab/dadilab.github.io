
// 游戏常量
const GRID_SIZE = 20;
const TILE_SIZE = 20;
const GAME_SPEED = 100;

// 游戏状态
let gameRunning = false;
let gameOver = false;
let winner = null;

// 游戏元素
let canvas, ctx;
let playerSnake, aiSnake;
let food = {x: 0, y: 0};

// 初始化游戏
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    const startScreen = document.getElementById('startScreen');
    const startButton = document.getElementById('startButton');
    
    // 设置画布大小
    canvas.width = GRID_SIZE * TILE_SIZE;
    canvas.height = GRID_SIZE * TILE_SIZE;
    
    // 重置游戏状态
    resetGame();
    
    // 开始按钮事件
    startButton.addEventListener('click', () => {
        startScreen.style.display = 'none';
        gameRunning = true;
        gameLoop();
    });
    
    // 显示开始界面
    startScreen.style.display = 'flex';
}

// 重置游戏
function resetGame() {
    // 初始化蛇
    playerSnake = {
        body: [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10}
        ],
        direction: 'right',
        color: '#4CAF50'
    };
    
    aiSnake = {
        body: [
            {x: 15, y: 10},
            {x: 16, y: 10},
            {x: 17, y: 10}
        ],
        direction: 'left',
        color: '#F44336'
    };
    
    // 重置游戏状态
    gameOver = false;
    winner = null;
    
    // 生成食物
    generateFood();
    
    // 更新分数显示
    updateScores();
}

// 更新分数显示
function updateScores() {
    document.getElementById('playerScore').textContent = `玩家: ${playerSnake.body.length}`;
    document.getElementById('aiScore').textContent = `AI: ${aiSnake.body.length}`;
}

// 游戏主循环
function gameLoop() {
    if (gameOver) {
        showGameOver();
        return;
    }
    
    update();
    draw();
    
    setTimeout(gameLoop, GAME_SPEED);
}

// 显示游戏结束
function showGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', canvas.width/2, canvas.height/2 - 30);
    ctx.fillText(`${winner}获胜!`, canvas.width/2, canvas.height/2 + 30);
    
    ctx.font = '20px Arial';
    ctx.fillText('按F5重新开始', canvas.width/2, canvas.height/2 + 80);
}

// 更新游戏状态
function update() {
    // 移动蛇
    moveSnake(playerSnake);
    updateAiDirection();
    moveSnake(aiSnake);
    
    // 检查碰撞
    checkCollisions();
}

// 更新AI蛇方向
function updateAiDirection() {
    // 简单AI: 优先向食物移动，但避免撞到自己
    const head = aiSnake.body[0];
    const possibleDirections = [];
    
    // 计算各方向到食物的距离
    const dx = food.x - head.x;
    const dy = food.y - head.y;
    
    // 优先选择缩短与食物距离的方向
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && aiSnake.direction !== 'left') {
            possibleDirections.push('right');
        } else if (dx < 0 && aiSnake.direction !== 'right') {
            possibleDirections.push('left');
        }
    } else {
        if (dy > 0 && aiSnake.direction !== 'up') {
            possibleDirections.push('down');
        } else if (dy < 0 && aiSnake.direction !== 'down') {
            possibleDirections.push('up');
        }
    }
    
    // 如果没有直接路径，尝试其他方向
    if (possibleDirections.length === 0) {
        if (aiSnake.direction !== 'left') possibleDirections.push('right');
        if (aiSnake.direction !== 'right') possibleDirections.push('left');
        if (aiSnake.direction !== 'down') possibleDirections.push('up');
        if (aiSnake.direction !== 'up') possibleDirections.push('down');
    }
    
    // 随机选择一个可行方向
    if (possibleDirections.length > 0) {
        const newDirection = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
        
        // 检查新方向是否安全
        const testHead = {x: head.x, y: head.y};
        switch(newDirection) {
            case 'up': testHead.y = (testHead.y - 1 + GRID_SIZE) % GRID_SIZE; break;
            case 'down': testHead.y = (testHead.y + 1) % GRID_SIZE; break;
            case 'left': testHead.x = (testHead.x - 1 + GRID_SIZE) % GRID_SIZE; break;
            case 'right': testHead.x = (testHead.x + 1) % GRID_SIZE; break;
        }
        
        // 检查是否会撞到自己
        let safe = true;
        for (let i = 0; i < aiSnake.body.length - 1; i++) {
            if (testHead.x === aiSnake.body[i].x && testHead.y === aiSnake.body[i].y) {
                safe = false;
                break;
            }
        }
        
        if (safe) {
            aiSnake.direction = newDirection;
        }
    }
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制食物
    drawFood();
    
    // 绘制蛇
    drawSnake(playerSnake);
    drawSnake(aiSnake);
}

// 生成食物
function generateFood() {
    let validPosition = false;
    let newFoodX, newFoodY;
    
    while (!validPosition) {
        newFoodX = Math.floor(Math.random() * GRID_SIZE);
        newFoodY = Math.floor(Math.random() * GRID_SIZE);
        
        // 检查是否在蛇身上
        const onPlayerSnake = playerSnake.body.some(segment => 
            segment.x === newFoodX && segment.y === newFoodY
        );
        const onAiSnake = aiSnake.body.some(segment => 
            segment.x === newFoodX && segment.y === newFoodY
        );
        
        validPosition = !onPlayerSnake && !onAiSnake;
    }
    
    food.x = newFoodX;
    food.y = newFoodY;
}

// 移动蛇
function moveSnake(snake) {
    // 获取蛇头
    const head = {x: snake.body[0].x, y: snake.body[0].y};
    
    // 根据方向移动蛇头
    switch(snake.direction) {
        case 'up':
            head.y = (head.y - 1 + GRID_SIZE) % GRID_SIZE;
            break;
        case 'down':
            head.y = (head.y + 1) % GRID_SIZE;
            break;
        case 'left':
            head.x = (head.x - 1 + GRID_SIZE) % GRID_SIZE;
            break;
        case 'right':
            head.x = (head.x + 1) % GRID_SIZE;
            break;
    }
    
    // 添加新头部
    snake.body.unshift(head);
    
    // 移除尾部
    snake.body.pop();
}

// 绘制蛇
function drawSnake(snake) {
    snake.body.forEach((segment, index) => {
        // 蛇头用不同颜色
        const color = index === 0 ? 
            `${snake.color}CC` :  // 头部半透明
            snake.color;          // 身体实色
            
        ctx.fillStyle = color;
        ctx.fillRect(
            segment.x * TILE_SIZE, 
            segment.y * TILE_SIZE, 
            TILE_SIZE, 
            TILE_SIZE
        );
        
        // 添加边框
        ctx.strokeStyle = '#000';
        ctx.strokeRect(
            segment.x * TILE_SIZE, 
            segment.y * TILE_SIZE, 
            TILE_SIZE, 
            TILE_SIZE
        );
    });
}

// 绘制食物
function drawFood() {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(
        (food.x + 0.5) * TILE_SIZE,
        (food.y + 0.5) * TILE_SIZE,
        TILE_SIZE / 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// 检查碰撞
function checkCollisions() {
    // 检查玩家蛇是否吃到食物
    if (playerSnake.body[0].x === food.x && playerSnake.body[0].y === food.y) {
        // 增加玩家蛇长度
        playerSnake.body.push({...playerSnake.body[playerSnake.body.length-1]});
        generateFood();
        updateScores();
    }
    
    // 检查AI蛇是否吃到食物
    if (aiSnake.body[0].x === food.x && aiSnake.body[0].y === food.y) {
        // 增加AI蛇长度
        aiSnake.body.push({...aiSnake.body[aiSnake.body.length-1]});
        generateFood();
        updateScores();
    }
    
    // 检查玩家蛇是否撞到自己
    for (let i = 1; i < playerSnake.body.length; i++) {
        if (playerSnake.body[0].x === playerSnake.body[i].x && 
            playerSnake.body[0].y === playerSnake.body[i].y) {
            gameOver = true;
            winner = 'AI';
            return;
        }
    }
    
    // 检查AI蛇是否撞到自己
    for (let i = 1; i < aiSnake.body.length; i++) {
        if (aiSnake.body[0].x === aiSnake.body[i].x && 
            aiSnake.body[0].y === aiSnake.body[i].y) {
            gameOver = true;
            winner = '玩家';
            return;
        }
    }
    
    // 检查玩家蛇是否撞到AI蛇
    for (let i = 0; i < aiSnake.body.length; i++) {
        if (playerSnake.body[0].x === aiSnake.body[i].x && 
            playerSnake.body[0].y === aiSnake.body[i].y) {
            gameOver = true;
            winner = 'AI';
            return;
        }
    }
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    switch(e.key) {
        case 'ArrowUp':
            if (playerSnake.direction !== 'down') 
                playerSnake.direction = 'up';
            break;
        case 'ArrowDown':
            if (playerSnake.direction !== 'up') 
                playerSnake.direction = 'down';
            break;
        case 'ArrowLeft':
            if (playerSnake.direction !== 'right') 
                playerSnake.direction = 'left';
            break;
        case 'ArrowRight':
            if (playerSnake.direction !== 'left') 
                playerSnake.direction = 'right';
            break;
    }
});

// 重新开始游戏
document.addEventListener('keydown', (e) => {
    if (gameOver && e.key === 'r') {
        resetGame();
        gameRunning = true;
        gameLoop();
    }
});

// 启动游戏
window.onload = init;
