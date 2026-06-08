// ==UserScript==
// @name         重庆市中小学教师培训学分信息管理系统登录助手
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  上传Excel（姓名/身份证号/密码），选择姓名后自动填充登录表单。用户名XPath: //*[@id="form-validation-field-0"]，密码XPath: //*[@id="form"]/div[2]/div[1]/label[2]/input
// @author       xudada
// @match        *://teacher.jsfz.cqedu.cn/*
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    /* ========== 配置区（可按需修改） ========== */
    const CONFIG = {
        usernameXPath: '//*[@id="form-validation-field-0"]',
        passwordXPath: '//*[@id="form"]/div[2]/div[1]/label[2]/input',
    };

    const STORAGE_KEY = 'id_login_helper_data';
    /* ======================================== */

    // ------ 工具函数 ------

    /** 通过 XPath 查找元素 */
    function getElementByXPath(xpath, context) {
        return document.evaluate(
            xpath,
            context || document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
    }

    /** 通过 XPath 查找所有匹配元素 */
    function getAllElementsByXPath(xpath, context) {
        const result = document.evaluate(
            xpath,
            context || document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
        );
        const nodes = [];
        for (let i = 0; i < result.snapshotLength; i++) {
            nodes.push(result.snapshotItem(i));
        }
        return nodes;
    }

    /** 用多种方式触发框架事件，确保框架（React/Vue/Angular等）感知到值变化 */
    function triggerEvents(element) {
        // 方式1: 标准 input/change 事件
        ['input', 'change', 'blur'].forEach(type => {
            element.dispatchEvent(new Event(type, { bubbles: true }));
        });
        // 方式2: InputEvent（React合成事件、Vue v-model 等会监听这个）
        try {
            element.dispatchEvent(new InputEvent('input', {
                inputType: 'insertText',
                bubbles: true,
                cancelable: true,
                data: element.value,
            }));
        } catch(e) { /* 兼容老旧浏览器 */ }
        // 方式3: compositionend（部分 Vue 实现依赖此事件）
        try {
            element.dispatchEvent(new CompositionEvent('compositionend', {
                bubbles: true,
                data: element.value,
            }));
        } catch(e) { /* ignore */ }
    }

    /** 用原生 setter 设置 input 值 + focus + select，绕过框架绑定 */
    function setNativeValue(element, value) {
        // 先获得焦点——很多框架需要焦点后才能正确注册值变更
        element.focus();
        element.select();

        const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        )?.set;
        if (nativeSetter) {
            nativeSetter.call(element, value);
        } else {
            element.value = value;
        }
        triggerEvents(element);

        // 再设一次光标到末尾
        element.setSelectionRange(value.length, value.length);
    }

    /** 填充单个字段，返回是否成功。isFocusField=true时最后保持焦点 */
    function fillField(xpath, value, label, isFocusField) {
        const el = getElementByXPath(xpath);
        if (!el) {
            console.warn(`[登录助手] 未找到字段: ${label} (${xpath})`);
            return false;
        }
        setNativeValue(el, value);

        // 是用户名字段则保持焦点并全选
        if (isFocusField) {
            el.focus();
            el.select();
        }

        // 绿色高亮闪烁提示
        const origOutline = el.style.outline;
        el.style.outline = '3px solid #4CAF50';
        el.style.outlineOffset = '1px';
        setTimeout(() => {
            el.style.outline = origOutline;
        }, 1500);

        console.log(`[登录助手] ✅ 已填充 ${label}`);
        return true;
    }

    // ------ 主逻辑 ------

    function init() {
        // 如果在 iframe 中则跳过（让顶层窗口执行即可）
        if (window !== window.top) {
            console.log('[登录助手] 在 iframe 中，跳过执行');
            return;
        }

        // 强力清理：先移除所有残留面板，避免重复/部分残留
        document.querySelectorAll('#id-login-helper').forEach(el => el.remove());
        // 清理所有带 #id-login-helper 的旧样式（包括之前 GM_addStyle 注入的无标记样式）
        document.querySelectorAll('style').forEach(el => {
            if (el.textContent.includes('#id-login-helper')) el.remove();
        });

        // 注入全局样式（带标记以便后续清理）
        const styleEl = document.createElement('style');
        styleEl.setAttribute('data-idh', '1');
        styleEl.textContent = `
            #id-login-helper {
                all: initial;
                position: fixed !important;
                top: 12px !important;
                right: 12px !important;
                z-index: 2147483647 !important;
                font-family: "Microsoft YaHei", "PingFang SC", sans-serif !important;
                font-size: 13px !important;
                background: #ffffff !important;
                border: 1px solid #d0d5dd !important;
                border-radius: 10px !important;
                padding: 14px 16px 12px !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
                width: 260px !important;
                color: #1d2939 !important;
                line-height: 1.5 !important;
                box-sizing: border-box !important;
                user-select: none !important;
            }
            #id-login-helper * {
                all: revert;
                box-sizing: border-box;
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                color: inherit;
            }
            #id-login-helper .idh-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                cursor: move;
                font-weight: 600;
                font-size: 14px;
                color: #1d2939;
            }
            #id-login-helper .idh-header .idh-minbtn {
                cursor: pointer;
                background: none;
                border: none;
                font-size: 16px;
                color: #98a2b3;
                padding: 0 4px;
                line-height: 1;
            }
            #id-login-helper .idh-header .idh-minbtn:hover { color: #475467; }
            #id-login-helper .idh-section { margin: 8px 0; }
            #id-login-helper .idh-file-input {
                width: 100%;
                font-size: 12px;
                padding: 4px 0;
                color: #475467;
            }
            #id-login-helper .idh-file-input::file-selector-button {
                padding: 4px 12px;
                background: #f2f4f7;
                border: 1px solid #d0d5dd;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                color: #344054;
                margin-right: 8px;
            }
            #id-login-helper .idh-file-input::file-selector-button:hover {
                background: #e4e7ec;
            }
            #id-login-helper .idh-info {
                font-size: 12px;
                color: #667085;
                margin: 4px 0 6px;
                min-height: 18px;
            }
            #id-login-helper .idh-select {
                width: 100%;
                padding: 6px 8px;
                border: 1px solid #d0d5dd;
                border-radius: 6px;
                background: #fff;
                font-size: 13px;
                color: #1d2939;
                margin: 4px 0 8px;
                cursor: pointer;
            }
            #id-login-helper .idh-select:disabled {
                background: #f9fafb;
                color: #98a2b3;
                cursor: not-allowed;
            }
            #id-login-helper .idh-btn-row {
                display: flex;
                gap: 6px;
            }
            #id-login-helper .idh-btn {
                flex: 1;
                padding: 6px 10px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                text-align: center;
            }
            #id-login-helper .idh-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            #id-login-helper .idh-btn-primary {
                background: #2d6cc9;
                color: #fff;
            }
            #id-login-helper .idh-btn-primary:hover:not(:disabled) { background: #1e5bb5; }
            #id-login-helper .idh-btn-danger {
                background: #f2f4f7;
                color: #b42318;
                border: 1px solid #d0d5dd;
            }
            #id-login-helper .idh-btn-danger:hover:not(:disabled) { background: #fef3f2; }
            #id-login-helper .idh-status-ok {
                color: #039855;
                font-weight: 500;
            }
            #id-login-helper .idh-status-warn {
                color: #dc6803;
            }
            #id-login-helper .idh-status-err {
                color: #d92d20;
            }
            #id-login-helper.idh-collapsed {
                width: auto !important;
                min-width: 0 !important;
                padding: 6px 10px !important;
                cursor: pointer;
            }
            #id-login-helper.idh-collapsed .idh-body { display: none; }
            #id-login-helper.idh-collapsed .idh-header { margin-bottom: 0; cursor: pointer; }
        `;
        if (document.head) {
            document.head.appendChild(styleEl);
        } else {
            // 极罕见情况：head 不可用，直接追加到 document
            document.documentElement.appendChild(styleEl);
        }

        createPanel();
    }

    function createPanel() {
        // 容器
        const panel = document.createElement('div');
        panel.id = 'id-login-helper';

        panel.innerHTML = `
            <div class="idh-header">
                <span>📋教师培训学分信息管理系统</span>
                <button class="idh-minbtn" id="idh-toggle" title="折叠/展开">−</button>
            </div>
            <div class="idh-body">
                <div class="idh-section">
                    <input type="file" class="idh-file-input" id="idh-file" accept=".xlsx,.xls,.csv">
                </div>
                <div class="idh-info" id="idh-info">未加载数据</div>
                <div class="idh-section">
                    <select class="idh-select" id="idh-select" disabled>
                        <option value="">-- 请先上传 Excel --</option>
                    </select>
                </div>
                <div class="idh-btn-row">
                    <button class="idh-btn idh-btn-primary" id="idh-fill" disabled>填充选中</button>
                    <button class="idh-btn idh-btn-danger" id="idh-clear">清除</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 获取元素引用
        const fileInput = document.getElementById('idh-file');
        const nameSelect = document.getElementById('idh-select');
        const fillBtn = document.getElementById('idh-fill');
        const clearBtn = document.getElementById('idh-clear');
        const info = document.getElementById('idh-info');
        const toggleBtn = document.getElementById('idh-toggle');

        let data = [];

        // ------ 从 localStorage 恢复 ------
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    data = parsed;
                    refreshSelect();
                    info.innerHTML = `<span class="idh-status-ok">✅ 缓存 ${data.length} 条记录</span>`;
                    nameSelect.disabled = false;
                    fillBtn.disabled = false;
                }
            }
        } catch(e) {
            // ignore
        }

        // ------ 刷新下拉列表 ------
        function refreshSelect() {
            nameSelect.innerHTML = '<option value="">-- 请选择姓名 --</option>';
            data.forEach((item, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = item.name;
                nameSelect.appendChild(opt);
            });
            nameSelect.disabled = false;
            fillBtn.disabled = false;
        }

        // ------ 执行填充 ------
        function doFill(index) {
            const item = data[index];
            if (!item) return;

            console.log(`[登录助手] 开始填充: ${item.name}`);

            // 先检查字段是否存在
            const usernameEl = getElementByXPath(CONFIG.usernameXPath);
            const passwordEl = getElementByXPath(CONFIG.passwordXPath);

            let msg = '';
            let statusClass = 'idh-status-ok';
            const okUser = fillField(CONFIG.usernameXPath, item.idCard, '用户名(身份证)', true);
            const okPass = fillField(CONFIG.passwordXPath, item.password, '密码');

            if (okUser && okPass) {
                msg = `✅ 已填充: ${item.name}`;
            } else if (okUser) {
                msg = `⚠️ 密码字段未找到，仅填充了用户名`;
                statusClass = 'idh-status-warn';
            } else if (okPass) {
                msg = `⚠️ 用户名字段未找到，仅填充了密码`;
                statusClass = 'idh-status-warn';
            } else {
                msg = `❌ 两个字段都未找到，请检查页面是否加载完成或 XPath 是否正确`;
                statusClass = 'idh-status-err';
            }

            info.innerHTML = `<span class="${statusClass}">${msg}</span>`;
        }

        // ------ 文件上传 ------
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // 清空选择（允许重新选择同一文件）
            fileInput.value = '';

            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const wb = XLSX.read(ev.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

                    data = rows
                        .filter(row => row[0] && String(row[0]).trim() !== '')
                        .map(row => ({
                            name:     String(row[0] || '').trim(),
                            idCard:   String(row[1] || '').trim(),
                            password: String(row[2] || '').trim(),
                        }))
                        .filter(item => item.name && item.idCard);

                    if (data.length === 0) {
                        info.innerHTML = `<span class="idh-status-warn">⚠️ Excel 中没有有效数据（需姓名/身份证号/密码三列）</span>`;
                        return;
                    }

                    // 存入缓存
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

                    refreshSelect();
                    info.innerHTML = `<span class="idh-status-ok">✅ 已加载 ${data.length} 条记录</span>`;

                    // 自动选中第一条
                    if (data.length > 0) {
                        nameSelect.value = 0;
                    }
                } catch(err) {
                    info.innerHTML = `<span class="idh-status-err">❌ 解析失败: ${err.message}</span>`;
                    console.error('[登录助手] Excel解析错误:', err);
                }
            };
            reader.readAsArrayBuffer(file);
        });

        // ------ 填充按钮 ------
        fillBtn.addEventListener('click', function() {
            const idx = parseInt(nameSelect.value);
            if (isNaN(idx) || idx < 0) {
                info.innerHTML = `<span class="idh-status-warn">⚠️ 请先选择姓名</span>`;
                return;
            }
            doFill(idx);
        });

        // ------ 双击下拉框也触发填充 ------
        nameSelect.addEventListener('dblclick', function() {
            const idx = parseInt(nameSelect.value);
            if (!isNaN(idx) && idx >= 0) doFill(idx);
        });

        // ------ 回车键触发填充（当下拉框聚焦时） ------
        nameSelect.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const idx = parseInt(nameSelect.value);
                if (!isNaN(idx) && idx >= 0) doFill(idx);
            }
        });

        // ------ 清除数据 ------
        clearBtn.addEventListener('click', function() {
            if (data.length === 0) return;
            if (!confirm('确认清除所有已加载的数据？')) return;
            data = [];
            localStorage.removeItem(STORAGE_KEY);
            nameSelect.innerHTML = '<option value="">-- 请先上传 Excel --</option>';
            nameSelect.disabled = true;
            fillBtn.disabled = true;
            info.textContent = '已清除数据';
            fileInput.value = '';
        });

        // ------ 折叠/展开 ------
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            panel.classList.toggle('idh-collapsed');
            toggleBtn.textContent = panel.classList.contains('idh-collapsed') ? '+' : '−';
        });
        // 折叠状态下点击标题展开
        panel.addEventListener('click', function(e) {
            if (panel.classList.contains('idh-collapsed')) {
                panel.classList.remove('idh-collapsed');
                toggleBtn.textContent = '−';
            }
        });

        // ------ 可拖拽（带边界限制） ------
        let isDragging = false, dragOffsetX, dragOffsetY;
        const header = panel.querySelector('.idh-header');
        header.addEventListener('mousedown', function(e) {
            // 排除点击按钮
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            panel.style.cursor = 'grabbing';
            panel.style.transition = 'none';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            // 边界限制：不让面板超出视口
            const pw = panel.offsetWidth;
            const ph = panel.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let x = e.clientX - dragOffsetX;
            let y = e.clientY - dragOffsetY;
            x = Math.max(0, Math.min(x, vw - pw));
            y = Math.max(0, Math.min(y, vh - ph));
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });
        document.addEventListener('mouseup', function() {
            if (!isDragging) return;
            isDragging = false;
            panel.style.cursor = '';
            // 拖完恢复 transition
            panel.style.transition = '';
        });
    }

    // 等待 DOM 准备后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
