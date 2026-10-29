// ==UserScript==
// @name         21tb 自动学习助手
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  自动检测视频学习状态，完成后自动跳转下一个视频（带状态栏）
// @author       Blueprint
// @match        https://cqrl.21tb.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============ 配置区 ============
    const POLL_INTERVAL = 5000;  // 轮询间隔（毫秒）
    const INIT_DELAY    = 3000;  // 启动延迟（毫秒），等页面渲染完
    const TAG           = '[21tb自动学习]';
    // =================================

    // ============ 状态栏 UI ============
    let barEl = null;
    let dotEl = null;
    let textEl = null;
    let progressEl = null;
    let timerEl = null;
    let minimizeBtn = null;
    let startTime = Date.now();
    let shownDoneAlert = false;  // 全完成弹窗只弹一次

    /**
     * 创建悬浮状态栏
     */
    function createStatusBar() {
        barEl = document.createElement('div');
        barEl.id = 'tb-auto-bar';

        Object.assign(barEl.style, {
            position: 'fixed',
            bottom: '12px',
            right: '12px',
            zIndex: '999999',
            background: 'rgba(30, 35, 45, 0.96)',
            color: '#fff',
            fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif",
            fontSize: '13px',
            lineHeight: '1.5',
            borderRadius: '10px',
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            minWidth: '300px',
            maxWidth: '420px',
            transition: 'opacity 0.3s',
            userSelect: 'none',
            cursor: 'move'
        });

        // ---- 第一行：状态指示灯 + 文本 ----
        var row1 = document.createElement('div');
        Object.assign(row1.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px'
        });

        dotEl = document.createElement('span');
        Object.assign(dotEl.style, {
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#888',
            flexShrink: '0',
            boxShadow: '0 0 6px currentColor'
        });

        textEl = document.createElement('span');
        Object.assign(textEl.style, { flex: '1', fontWeight: '600' });

        // 最小化按钮
        minimizeBtn = document.createElement('span');
        minimizeBtn.textContent = '\u2013'; // —
        Object.assign(minimizeBtn.style, {
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#aaa',
            flexShrink: '0',
            lineHeight: '1',
            padding: '0 2px'
        });
        minimizeBtn.title = '最小化 / 展开';

        row1.appendChild(dotEl);
        row1.appendChild(textEl);
        row1.appendChild(minimizeBtn);
        barEl.appendChild(row1);

        // ---- 第二行：进度条 ----
        progressEl = document.createElement('div');
        Object.assign(progressEl.style, {
            height: '6px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '5px'
        });

        var progressFill = document.createElement('div');
        progressFill.id = 'tb-auto-progress-fill';
        Object.assign(progressFill.style, {
            height: '100%',
            width: '0%',
            borderRadius: '3px',
            transition: 'width 0.4s ease'
        });
        progressEl.appendChild(progressFill);
        barEl.appendChild(progressEl);

        // ---- 第三行：进度文字 + 运行时间 ----
        var row3 = document.createElement('div');
        Object.assign(row3.style, {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.65)'
        });

        var progressText = document.createElement('span');
        progressText.id = 'tb-auto-progress-text';
        progressText.textContent = '0/0';

        timerEl = document.createElement('span');
        timerEl.id = 'tb-auto-timer';
        timerEl.textContent = '⏱ 00:00:00';

        row3.appendChild(progressText);
        row3.appendChild(timerEl);
        barEl.appendChild(row3);

        document.body.appendChild(barEl);

        // ---- 拖拽功能 ----
        enableDrag(barEl, row1);

        // ---- 最小化功能 ----
        var minimized = false;
        minimizeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            minimized = !minimized;
            progressEl.style.display = minimized ? 'none' : 'block';
            row3.style.display = minimized ? 'none' : 'flex';
            barEl.style.padding = minimized ? '6px 12px' : '12px 16px';
            minimizeBtn.textContent = minimized ? '+' : '\u2013';
        });
    }

    /**
     * 拖拽实现
     */
    function enableDrag(bar, handle) {
        var dragging = false;
        var offsetX = 0, offsetY = 0;

        handle.addEventListener('mousedown', function (e) {
            if (e.target === minimizeBtn) return;
            dragging = true;
            var rect = bar.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var x = e.clientX - offsetX;
            var y = e.clientY - offsetY;
            x = Math.max(0, Math.min(x, window.innerWidth - bar.offsetWidth));
            y = Math.max(0, Math.min(y, window.innerHeight - bar.offsetHeight));
            bar.style.left = x + 'px';
            bar.style.top = y + 'px';
            bar.style.right = 'auto';
        });

        document.addEventListener('mouseup', function () {
            dragging = false;
        });
    }

    /**
     * 更新状态栏
     * @param {string} status  - idle | searching | learning | jumping | done
     * @param {string} message - 显示文字
     * @param {number} current - 当前第几个（从1开始）
     * @param {number} total   - 总数
     */
    function updateBar(status, message, current, total) {
        if (!barEl) return;

        // 颜色映射
        var colorMap = {
            idle:       '#888888',
            searching:  '#4FC3F7',  // 蓝
            learning:   '#FFD54F',  // 黄
            jumping:    '#81C784',  // 绿
            done:       '#4CAF50',  // 深绿
            error:      '#EF5350'   // 红
        };
        var color = colorMap[status] || '#888';
        dotEl.style.background = color;
        dotEl.style.color = color;

        textEl.textContent = message;

        // 进度条
        var fill = document.getElementById('tb-auto-progress-fill');
        var pct = total > 0 ? (current / total * 100) : 0;
        fill.style.width = pct + '%';
        fill.style.background = color;

        // 进度文字
        var pt = document.getElementById('tb-auto-progress-text');
        pt.textContent = current + '/' + total + ' 已完成';

        // 运行时间
        timerEl.textContent = '⏱ ' + formatTime(Date.now() - startTime);
    }

    function formatTime(ms) {
        var s = Math.floor(ms / 1000);
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = s % 60;
        function pad(n) { return n < 10 ? '0' + n : '' + n; }
        return pad(h) + ':' + pad(m) + ':' + pad(sec);
    }

    // ============ 核心逻辑 ============

    /**
     * 获取课程 li 列表
     * 优先用 XPath 定位容器，兜底用 class 选择器
     */
    function getLiItems() {
        const xpathResult = document.evaluate(
            '//*[@id="app"]/div/div[2]/div[2]/div/ul/div',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        let container = xpathResult.singleNodeValue;

        if (!container) {
            container = document.querySelector('div.section');
        }

        if (!container) return [];

        return Array.from(container.children).filter(function (el) {
            return el.tagName.toLowerCase() === 'li';
        });
    }

    /**
     * 判断单个 li 的学习状态
     * @returns {'learning' | 'completed' | 'none'}
     */
    function getStatus(li) {
        var firstLine = li.querySelector('.first-line');
        if (!firstLine) return 'none';

        var children = firstLine.children;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.classList && child.classList.contains('icon-box')) continue;

            var text = child.textContent.trim();
            if (text === '学习中') return 'learning';
            if (text === '已完成') return 'completed';
        }
        return 'none';
    }

    /**
     * 点击 li 开始学习
     */
    function clickLi(li) {
        var target = li.querySelector('.first-line') || li;
        target.click();
    }

    /**
     * 获取课程标题
     */
    function getTitle(li) {
        var span = li.querySelector('.section-title');
        return span ? span.textContent.trim() : '未知课程';
    }

    /**
     * 主逻辑
     */
    function checkAndAct() {
        var items = getLiItems();
        if (items.length === 0) {
            console.log(TAG, '未找到课程列表，等待页面加载...');
            updateBar('searching', '🔍 搜索课程列表中...', 0, 0);
            return;
        }

        var total = items.length;
        var completedCount = 0;

        // 统计 + 打印状态概览
        var summary = items.map(function (li, i) {
            var s = getStatus(li);
            if (s === 'completed') completedCount++;
            return '[' + (i + 1) + ']' + s;
        }).join('  ');
        console.log(TAG, '状态: ' + summary);

        for (var i = 0; i < items.length; i++) {
            var status = getStatus(items[i]);
            var title = getTitle(items[i]);
            var shortTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;

            if (status === 'completed') {
                continue;
            }

            if (status === 'learning') {
                console.log(TAG, '第' + (i + 1) + '个视频学习中，等待完成...');
                updateBar('learning',
                    '▶ 第' + (i + 1) + '/' + total + ' 学习中: ' + shortTitle,
                    completedCount, total);
                return;
            }

            if (status === 'none') {
                var firstLine = items[i].querySelector('.first-line');
                var isActive = firstLine && firstLine.classList.contains('active');

                if (!isActive) {
                    console.log(TAG, '第' + (i + 1) + '个视频未学习，自动跳转...');
                    updateBar('jumping',
                        '➡ 跳转到第' + (i + 1) + '/' + total + ': ' + shortTitle,
                        completedCount, total);
                    clickLi(items[i]);
                } else {
                    console.log(TAG, '第' + (i + 1) + '个视频已选中，等待状态更新...');
                    updateBar('learning',
                        '▶ 第' + (i + 1) + '/' + total + ' 已选中: ' + shortTitle,
                        completedCount, total);
                }
                return;
            }
        }

        console.log(TAG, '🎉 所有视频已完成学习！');
        updateBar('done', '🎉 全部 ' + total + ' 个视频已完成！', total, total);

        // 弹窗提醒（只弹一次）
        if (!shownDoneAlert) {
            shownDoneAlert = true;
            alert('已学习该章节');
        }
    }

    // ============ 启动 ============
    function init() {
        createStatusBar();
        updateBar('idle', '⏳ 等待启动...', 0, 0);
        console.log(TAG, '脚本已加载，' + (INIT_DELAY / 1000) + '秒后开始监控...');

        setTimeout(function () {
            console.log(TAG, '开始监控，轮询间隔 ' + (POLL_INTERVAL / 1000) + ' 秒');
            checkAndAct();
            setInterval(checkAndAct, POLL_INTERVAL);

            // 每秒刷新运行时间
            setInterval(function () {
                if (timerEl) {
                    timerEl.textContent = '⏱ ' + formatTime(Date.now() - startTime);
                }
            }, 1000);
        }, INIT_DELAY);
    }

    // 等 body 就绪
    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
