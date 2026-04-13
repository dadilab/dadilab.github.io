
class Timer {
    constructor(container) {
        this.container = container;
        this.isRunning = false;
        this.isCountdown = false;
        this.time = 0;
        this.interval = null;
        this.createTimerElement();
    }

    createTimerElement() {
        this.card = document.createElement('div');
        this.card.className = 'timer-card';
        
        // 计时器类型选择
        this.typeSelect = document.createElement('div');
        this.typeSelect.className = 'timer-type';
        this.typeSelect.innerHTML = `
            <label>
                <input type="radio" name="timerType" value="countup" checked> 正计时
            </label>
            <label>
                <input type="radio" name="timerType" value="countdown"> 倒计时
            </label>
        `;
        this.card.appendChild(this.typeSelect);

        // 计时器显示
        this.display = document.createElement('div');
        this.display.className = 'timer-display';
        this.display.textContent = '00:00:00';
        this.card.appendChild(this.display);

        // 计时器控制按钮
        this.controls = document.createElement('div');
        this.controls.className = 'timer-controls';
        this.controls.innerHTML = `
            <button class="start">开始</button>
            <button class="pause">暂停</button>
            <button class="reset">重置</button>
            <button class="fullscreen">全屏</button>
            <button class="delete">删除</button>
        `;
        this.card.appendChild(this.controls);

        // 添加事件监听
        this.addEventListeners();
        this.container.appendChild(this.card);
    }

    addEventListeners() {
        // 计时器类型切换
        this.typeSelect.querySelectorAll('input').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.isCountdown = e.target.value === 'countdown';
                if (this.isCountdown) {
                    const timeStr = prompt('请输入倒计时时间(格式: HH:MM:SS)', '00:00:10');
                    if (timeStr) {
                        this.setCountdownTime(timeStr);
                    } else {
                        this.typeSelect.querySelector('input[value="countup"]').checked = true;
                        this.isCountdown = false;
                    }
                }
            });
        });

        // 控制按钮
        this.controls.querySelector('.start').addEventListener('click', () => this.start());
        this.controls.querySelector('.pause').addEventListener('click', () => this.pause());
        this.controls.querySelector('.reset').addEventListener('click', () => this.reset());
        this.controls.querySelector('.fullscreen').addEventListener('click', () => this.toggleFullscreen());
        this.controls.querySelector('.delete').addEventListener('click', () => this.delete());
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.interval = setInterval(() => this.updateTime(), 1000);
        }
    }

    pause() {
        if (this.isRunning) {
            clearInterval(this.interval);
            this.isRunning = false;
        }
    }

    reset() {
        this.pause();
        this.time = this.isCountdown ? this.countdownStartTime : 0;
        this.updateDisplay();
    }

    updateTime() {
        if (this.isCountdown) {
            if (this.time <= 0) {
                this.pause();
                alert('倒计时结束!');
                return;
            }
            this.time--;
        } else {
            this.time++;
        }
        this.updateDisplay();
    }

    updateDisplay() {
        const hours = Math.floor(this.time / 3600);
        const minutes = Math.floor((this.time % 3600) / 60);
        const seconds = this.time % 60;
        this.display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    setCountdownTime(timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        this.countdownStartTime = hours * 3600 + minutes * 60 + seconds;
        this.time = this.countdownStartTime;
        this.updateDisplay();
    }

    toggleFullscreen() {
        this.card.classList.toggle('fullscreen');
        if (this.card.classList.contains('fullscreen')) {
            document.addEventListener('keydown', this.handleEscape);
        } else {
            document.removeEventListener('keydown', this.handleEscape);
        }
    }

    handleEscape = (e) => {
        if (e.key === 'Escape' && this.card.classList.contains('fullscreen')) {
            this.card.classList.remove('fullscreen');
            document.removeEventListener('keydown', this.handleEscape);
        }
    }

    delete() {
        clearInterval(this.interval);
        this.container.removeChild(this.card);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const timersContainer = document.getElementById('timersContainer');
    const addTimerBtn = document.getElementById('addTimer');

    addTimerBtn.addEventListener('click', () => {
        new Timer(timersContainer);
    });

    // 默认添加一个计时器
    new Timer(timersContainer);
});
