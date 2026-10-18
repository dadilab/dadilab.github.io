// ==UserScript==
// @name         凭据拾取与自动填充助手（通用）
// @namespace    https://github.com/xudadi
// @version      1.0.0
// @description  可拖拽悬浮窗拾取用户名/密码框 XPath，导入多组凭据（别名/用户名/密码），点击别名自动填充真实账号与密码。适配所有网站。
// @author       大地老师
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* =========================================================
   * 说明：本脚本在本机 localStorage（GM_ 存储）中以明文保存凭据，
   * 仅用于你个人账号的便捷填充。请勿在公共/共享电脑上使用，
   * 也不要把导出的配置分享给他人。
   * ========================================================= */

  const HOST = location.hostname;
  const STORE_KEY = 'ccfg:' + HOST;     // 每个域名独立配置
  const POS_KEY = 'ccfg:pos';           // 悬浮窗位置

  // ---------- 存储 ----------
  function loadConfig() {
    try {
      const raw = GM_getValue(STORE_KEY, null);
      if (raw) {
        const c = JSON.parse(raw);
        c.credentials = Array.isArray(c.credentials) ? c.credentials : [];
        if (typeof c.autofill !== 'boolean') c.autofill = true;
        return c;
      }
    } catch (e) {}
    return { usernameXPath: '', passwordXPath: '', credentials: [], autofill: true };
  }
  function saveConfig() { GM_setValue(STORE_KEY, JSON.stringify(config)); }
  let config = loadConfig();

  // ---------- XPath 工具 ----------
  function getXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `//*[@id="${el.id}"]`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      let idx = 1;
      let sib = node.previousElementSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.tagName === node.tagName) idx++;
        sib = sib.previousElementSibling;
      }
      const sameTag = node.parentNode
        ? [...node.parentNode.children].filter(c => c.tagName === node.tagName).length
        : 1;
      const tag = node.tagName.toLowerCase();
      parts.unshift(tag + (sameTag > 1 ? `[${idx}]` : ''));
      node = node.parentNode;
    }
    return '//' + parts.join('/');
  }
  function byXPath(xp) {
    if (!xp) return null;
    try {
      return document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) { return null; }
  }

  // ---------- 字段识别（兼容自定义组件 / 内层元素 / 可编辑区域） ----------
  function isField(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'textbox' || role === 'combobox') return true;
    return false;
  }
  function findField(node) {
    let el = node;
    let depth = 0;
    while (el && el.nodeType === 1 && depth < 6) {
      if (isField(el)) return el;
      el = el.parentElement;
      depth++;
    }
    return null;
  }

  // ---------- 设值（兼容 React/Vue 等受控组件） ----------
  function setNativeValue(el, value) {
    if (!el) return;
    try {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc.set.call(el, value);
    } catch (e) {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- 转义 ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- 样式 ----------
  const CSS = `
  #__ccfg_panel{position:fixed;right:16px;bottom:16px;width:300px;max-width:90vw;
    background:#fff;color:#222;border:1px solid #d7dde5;border-radius:10px;
    box-shadow:0 8px 30px rgba(0,0,0,.18);font:13px/1.5 -apple-system,"Microsoft YaHei",sans-serif;
    z-index:2147483646;user-select:none;overflow:hidden;}
  #__ccfg_panel *{box-sizing:border-box;}
  .__ccfg_head{display:flex;align-items:center;justify-content:space-between;
    background:#2d7ff9;color:#fff;padding:8px 10px;cursor:move;}
  .__ccfg_title{font-weight:600;}
  .__ccfg_min{cursor:pointer;font-weight:700;padding:0 4px;}
  .__ccfg_body{padding:10px;max-height:70vh;overflow:auto;}
  .__ccfg_body.collapsed{display:none;}
  .__ccfg_row{margin:6px 0;}
  .__ccfg_btn{background:#2d7ff9;color:#fff;border:none;border-radius:6px;
    padding:6px 10px;cursor:pointer;font-size:13px;}
  .__ccfg_btn:hover{background:#1c6fe0;}
  .__ccfg_btn.sm{padding:4px 8px;font-size:12px;}
  .__ccfg_btn.danger{background:#e5484d;}
  .__ccfg_btn.danger:hover{background:#c93b40;}
  .__ccfg_status{font-size:12px;color:#555;background:#f3f6fb;border-radius:6px;
    padding:6px 8px;word-break:break-all;margin:6px 0;}
  .__ccfg_status code{color:#1a73e8;}
  .__ccfg_xrow{display:flex;align-items:center;gap:4px;margin:3px 0;}
  .__ccfg_xp{flex:1;min-width:0;font:11px/1.4 monospace;padding:2px 4px;
    border:1px solid #cdd6e2;border-radius:4px;color:#1a73e8;}
  .__ccfg_sep{font-size:12px;color:#888;margin:8px 0 4px;border-top:1px dashed #e3e8ef;padding-top:6px;}
  .__ccfg_creds{display:flex;flex-direction:column;gap:4px;margin-bottom:6px;}
  .__ccfg_cred{display:flex;align-items:center;gap:6px;background:#f7f9fc;border-radius:6px;padding:3px 6px;}
  .__ccfg_alias{font-weight:600;color:#2d7ff9;flex:0 0 auto;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .__ccfg_uname{flex:1;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .__ccfg_add{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px;}
  .__ccfg_add input{width:100%;padding:4px 6px;border:1px solid #d7dde5;border-radius:6px;font-size:12px;}
  .__ccfg_add .__ccfg_btn{grid-column:1/-1;}
  #__ccfg_bulk{width:100%;height:54px;resize:vertical;border:1px solid #d7dde5;border-radius:6px;padding:6px;font-size:12px;font-family:monospace;}
  .__ccfg_toggle{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#555;margin-left:6px;}
  body.__ccfg_picking{cursor:crosshair!important;}
  body.__ccfg_picking input:hover,body.__ccfg_picking textarea:hover{
    outline:2px solid #ff5722!important;outline-offset:1px;}
  .__ccfg_aflist{position:fixed;background:#fff;border:1px solid #d7dde5;border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:2147483647;max-height:220px;overflow:auto;display:none;min-width:160px;}
  .__ccfg_afitem{padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f3f7;}
  .__ccfg_afitem:last-child{border-bottom:none;}
  .__ccfg_afitem:hover{background:#eef4ff;}
  .__ccfg_afitem .__ccfg_idx{display:inline-block;min-width:18px;color:#2d7ff9;font-weight:700;}
  .__ccfg_afitem .__ccfg_sub{display:block;font-size:11px;color:#999;}
  #__ccfg_toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);
    background:rgba(33,37,41,.92);color:#fff;padding:8px 16px;border-radius:20px;
    font-size:13px;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .25s;}
  #__ccfg_toast.show{opacity:1;}
  `;

  // ---------- 悬浮窗 ----------
  let panel, pickBtn, statusEl, credsEl, afToggle, bulkEl;
  let pickStage = 0;            // 0 无 / 1 等用户名 / 2 等密码
  let dragState = null;

  function banner(msg) {
    let t = document.getElementById('__ccfg_toast');
    if (!t) { t = document.createElement('div'); t.id = '__ccfg_toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__t);
    t.__t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function createPanel() {
    if (document.getElementById('__ccfg_panel')) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = '__ccfg_panel';
    panel.innerHTML = `
      <div class="__ccfg_head">
        <span class="__ccfg_title">🔑 凭据助手</span>
        <span class="__ccfg_min" title="折叠/展开">▁</span>
      </div>
      <div class="__ccfg_body">
        <div class="__ccfg_row">
          <button class="__ccfg_btn" id="__ccfg_pick">🎯 拾取输入框</button>
        </div>
        <div class="__ccfg_status" id="__ccfg_status"></div>
        <div class="__ccfg_sep">账号凭据（别名 / 用户名 / 密码）</div>
        <div class="__ccfg_creds" id="__ccfg_creds"></div>
        <div class="__ccfg_add">
          <input id="__ccfg_a" placeholder="别名" />
          <input id="__ccfg_u" placeholder="用户名" />
          <input id="__ccfg_p" type="password" placeholder="密码" />
          <button class="__ccfg_btn sm" id="__ccfg_add">＋ 添加</button>
        </div>
        <div class="__ccfg_row">
          <textarea id="__ccfg_bulk" placeholder="批量导入：每行 别名|用户名|密码&#10;或粘贴 JSON 数组 [{\"alias\":\"\",\"username\":\"\",\"password\":\"\"}]"></textarea>
        </div>
        <div class="__ccfg_row">
          <button class="__ccfg_btn sm" id="__ccfg_import">导入批量</button>
          <label class="__ccfg_btn sm" for="__ccfg_file" style="display:inline-block;cursor:pointer;">📁 导入Excel/CSV</label>
          <input type="file" id="__ccfg_file" accept=".xlsx,.xls,.csv" style="display:none" />
          <button class="__ccfg_btn sm danger" id="__ccfg_clear">清空</button>
          <label class="__ccfg_toggle"><input type="checkbox" id="__ccfg_af" ${config.autofill ? 'checked' : ''}/> 自动填充</label>
        </div>
      </div>`;
    document.body.appendChild(panel);

    // 恢复位置
    try {
      const pos = JSON.parse(GM_getValue(POS_KEY, 'null'));
      if (pos && pos.l && pos.t) {
        panel.style.left = pos.l; panel.style.top = pos.t;
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
      }
    } catch (e) {}

    pickBtn = panel.querySelector('#__ccfg_pick');
    statusEl = panel.querySelector('#__ccfg_status');
    credsEl = panel.querySelector('#__ccfg_creds');
    bulkEl = panel.querySelector('#__ccfg_bulk');
    afToggle = panel.querySelector('#__ccfg_af');

    // 折叠
    panel.querySelector('.__ccfg_min').addEventListener('click', () => {
      panel.querySelector('.__ccfg_body').classList.toggle('collapsed');
    });
    // 拖拽
    panel.querySelector('.__ccfg_head').addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('__ccfg_min')) return;
      dragState = { x: e.clientX, y: e.clientY, l: panel.offsetLeft, t: panel.offsetTop };
      e.preventDefault();
    });
    // 拾取
    pickBtn.addEventListener('click', enterPick);
    // 添加单条
    panel.querySelector('#__ccfg_add').addEventListener('click', () => {
      const a = panel.querySelector('#__ccfg_a').value.trim();
      const u = panel.querySelector('#__ccfg_u').value.trim();
      const p = panel.querySelector('#__ccfg_p').value;
      if (!u) { banner('用户名不能为空'); return; }
      upsertCred({ alias: a, username: u, password: p });
      panel.querySelector('#__ccfg_a').value = '';
      panel.querySelector('#__ccfg_u').value = '';
      panel.querySelector('#__ccfg_p').value = '';
      saveConfig(); render(); setupAutoFill();
      banner('已添加凭据');
    });
    // 批量导入
    panel.querySelector('#__ccfg_import').addEventListener('click', () => {
      importBulk(bulkEl.value); bulkEl.value = '';
    });
    // Excel / CSV 文件导入
    panel.querySelector('#__ccfg_file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleFile(f);
      e.target.value = '';
    });
    // 清空
    panel.querySelector('#__ccfg_clear').addEventListener('click', () => {
      if (!confirm('确定清空全部凭据（用户名/密码/别名）？\nXPath 将保留，需手动清空。')) return;
      config.credentials = [];   // 仅清空凭据，保留 XPath
      saveConfig(); render(); setupAutoFill();
      banner('已清空凭据（XPath 已保留，可手动清空）');
    });
    // 开关自动填充
    afToggle.addEventListener('change', () => {
      config.autofill = afToggle.checked; saveConfig();
      if (config.autofill) setupAutoFill(); else teardownAutoFill();
    });

    render();
  }

  function upsertCred(c) {
    const key = c.alias || c.username;
    const ex = config.credentials.find(x => (x.alias || x.username) === key);
    if (ex) Object.assign(ex, c); else config.credentials.push(c);
  }

  function importBulk(text) {
    text = (text || '').trim();
    if (!text) return;
    let list = [];
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j)) {
        list = j.map(o => ({ alias: o.alias || '', username: o.username || '', password: o.password || '' }));
      }
    } catch (e) {
      text.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line) return;
        let m = line.split('|');
        if (m.length >= 3) {
          list.push({ alias: m[0].trim(), username: m[1].trim(), password: m[2].trim() });
        } else {
          m = line.split(',');
          if (m.length >= 3) list.push({ alias: m[0].trim(), username: m[1].trim(), password: m[2].trim() });
        }
      });
    }
    if (!list.length) { banner('未解析到有效凭据'); return; }
    list.forEach(upsertCred);
    saveConfig(); render(); setupAutoFill();
    banner('已导入 ' + list.length + ' 组凭据');
  }

  // ---------- Excel / CSV 文件导入 ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQ = false;
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function importRows(rows) {
    if (!rows || !rows.length) { banner('文件为空'); return; }
    let headerMap = null;
    const first = rows[0];
    if (Array.isArray(first) && first.length) {
      const idx = (kw) => first.findIndex(c => String(c == null ? '' : c).trim().toLowerCase().includes(kw));
      const a = idx('alias') >= 0 ? idx('alias') : idx('别名');
      const u = idx('user') >= 0 ? idx('user') : idx('用户名');
      const p = idx('pass') >= 0 ? idx('pass') : idx('密码');
      if (u >= 0 || p >= 0 || a >= 0) headerMap = { a: a, u: u, p: p, hasHeader: true };
    }
    let start = (headerMap && headerMap.hasHeader) ? 1 : 0;
    const list = [];
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.length) continue;
      let alias = '', username = '', password = '';
      if (headerMap) {
        alias = String(r[headerMap.a] == null ? '' : r[headerMap.a]).trim();
        username = String(r[headerMap.u] == null ? '' : r[headerMap.u]).trim();
        password = String(r[headerMap.p] == null ? '' : r[headerMap.p]).trim();
      } else {
        if (r.length >= 3) { alias = r[0]; username = r[1]; password = r[2]; }
        else if (r.length === 2) { username = r[0]; password = r[1]; }
        alias = String(alias).trim(); username = String(username).trim(); password = String(password).trim();
      }
      if (!username) continue;
      list.push({ alias: alias, username: username, password: password });
    }
    if (!list.length) { banner('未解析到有效凭据（需含用户名列）'); return; }
    list.forEach(upsertCred);
    saveConfig(); render(); setupAutoFill();
    banner('已导入 ' + list.length + ' 组凭据');
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows;
        if (typeof XLSX !== 'undefined') {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
        } else {
          rows = parseCSV(new TextDecoder().decode(e.target.result));
        }
        importRows(rows);
      } catch (err) { banner('读取失败：' + (err && err.message ? err.message : err)); }
    };
    reader.onerror = () => banner('文件读取失败');
    reader.readAsArrayBuffer(file);
  }

  function render() {
    statusEl.innerHTML =
      `<div class="__ccfg_xrow">用户名XPath:<input id="__ccfg_ux" class="__ccfg_xp" value="${esc(config.usernameXPath)}" placeholder="（未拾取，可手动粘贴）"/></div>` +
      `<div class="__ccfg_xrow">密码XPath:<input id="__ccfg_px" class="__ccfg_xp" value="${esc(config.passwordXPath)}" placeholder="（未拾取，可手动粘贴）"/></div>`;
    const ux = statusEl.querySelector('#__ccfg_ux');
    const px = statusEl.querySelector('#__ccfg_px');
    ux.addEventListener('change', () => { config.usernameXPath = ux.value.trim(); saveConfig(); setupAutoFill(); });
    px.addEventListener('change', () => { config.passwordXPath = px.value.trim(); saveConfig(); setupAutoFill(); });
    credsEl.innerHTML = '';
    if (!config.credentials.length) {
      credsEl.innerHTML = '<div style="font-size:12px;color:#aaa;">暂无凭据，请添加或批量导入</div>';
    }
    config.credentials.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = '__ccfg_cred';
      const alias = document.createElement('span');
      alias.className = '__ccfg_alias'; alias.textContent = (i + 1) + '. ' + (c.alias || '(无别名)');
      const uname = document.createElement('span');
      uname.className = '__ccfg_uname'; uname.textContent = c.username;
      const del = document.createElement('button');
      del.className = '__ccfg_btn sm danger'; del.textContent = '✕';
      del.title = '删除';
      del.addEventListener('click', () => {
        config.credentials.splice(i, 1); saveConfig(); render(); setupAutoFill();
      });
      row.appendChild(alias); row.appendChild(uname); row.appendChild(del);
      credsEl.appendChild(row);
    });
  }

  // ---------- 拾取模式 ----------
  function enterPick() {
    if (pickStage) { exitPick(); return; }
    pickStage = 1;
    document.body.classList.add('__ccfg_picking');
    pickBtn.textContent = '① 点击【用户名框】…';
    banner('拾取模式：请点击网页中的用户名输入框');
    document.addEventListener('mouseover', hoverHi, true);
    document.addEventListener('click', onPickClick, true);
  }
  function exitPick() {
    pickStage = 0;
    document.body.classList.remove('__ccfg_picking');
    document.removeEventListener('mouseover', hoverHi, true);
    document.removeEventListener('click', onPickClick, true);
    pickBtn.textContent = '🎯 重新拾取';
  }
  function hoverHi(e) {
    document.querySelectorAll('.__ccfg_hi').forEach(n => n.classList.remove('__ccfg_hi'));
    const field = findField(e.target);
    if (field && !panel.contains(field)) field.classList.add('__ccfg_hi');
  }
  function onPickClick(e) {
    if (!pickStage) return;
    const field = findField(e.target);
    if (!field) { banner('请点击输入框（input / textarea / 可编辑区域）'); return; }
    if (panel.contains(field)) return;
    e.preventDefault(); e.stopPropagation();
    field.classList.remove('__ccfg_hi');
    if (pickStage === 1) {
      config.usernameXPath = getXPath(field);
      pickStage = 2;
      pickBtn.textContent = '② 点击【密码框】…';
      banner('已记录用户名框，请点击密码输入框');
    } else if (pickStage === 2) {
      config.passwordXPath = getXPath(field);
      exitPick();
      banner('拾取完成 ✓');
      saveConfig(); render(); setupAutoFill();
    }
  }

  // ---------- 自动填充下拉 ----------
  let afDropdown = null, afInput = null, afGlobalBound = false;

  function teardownAutoFill() {
    if (afDropdown) { afDropdown.style.display = 'none'; afDropdown.innerHTML = ''; }
    if (afInput) { afInput.removeAttribute('placeholder'); }
    afInput = null;
  }

  function setupAutoFill() {
    if (!config.autofill || !config.usernameXPath) return;
    const u = byXPath(config.usernameXPath);
    if (!u) return; // 交由 MutationObserver 稍后重试
    afInput = u;
    u.setAttribute('placeholder', `🔑 点击选择账号（已配 ${config.credentials.length} 个）`);
    if (!afDropdown) {
      afDropdown = document.createElement('div');
      afDropdown.id = '__ccfg_af';
      afDropdown.className = '__ccfg_aflist';
      document.body.appendChild(afDropdown);
    }
    refreshDropdown();
    if (!u.__ccfgBound) {
      u.__ccfgBound = true;
      u.addEventListener('focus', showDropdown);
      u.addEventListener('input', () => { if (!u.value) showDropdown(); else hideDropdown(); });
    }
    if (!afGlobalBound) {
      afGlobalBound = true;
      document.addEventListener('click', outsideClose, true);
      window.addEventListener('scroll', () => { if (afDropdown && afDropdown.style.display === 'block') positionDropdown(); }, true);
      window.addEventListener('resize', () => { if (afDropdown && afDropdown.style.display === 'block') positionDropdown(); });
    }
  }

  function refreshDropdown() {
    if (!afDropdown) return;
    afDropdown.innerHTML = '';
    if (!config.credentials.length) {
      const empty = document.createElement('div');
      empty.className = '__ccfg_afitem';
      empty.style.color = '#aaa';
      empty.textContent = '（暂无凭据）';
      afDropdown.appendChild(empty);
      return;
    }
    config.credentials.forEach((c, i) => {
      const item = document.createElement('div');
      item.className = '__ccfg_afitem';
      item.innerHTML = `<span class="__ccfg_idx">${i + 1}.</span> ${esc(c.alias || c.username)}<span class="__ccfg_sub">${esc(c.username)}</span>`;
      item.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        fillCredential(c);
        hideDropdown();
      });
      afDropdown.appendChild(item);
    });
  }

  function fillCredential(c) {
    const u = byXPath(config.usernameXPath);
    const p = byXPath(config.passwordXPath);
    setNativeValue(u, c.username);
    if (p) setNativeValue(p, c.password);
    banner('已填充：' + (c.alias || c.username));
  }

  function positionDropdown() {
    if (!afInput || !afDropdown) return;
    const r = afInput.getBoundingClientRect();
    afDropdown.style.minWidth = Math.max(r.width, 160) + 'px';
    let top = r.bottom + window.scrollY + 2;
    let left = r.left + window.scrollX;
    // 防止溢出视口底部
    const dh = Math.min(220, config.credentials.length * 34 + 10);
    if (r.bottom + dh > window.innerHeight) top = r.top + window.scrollY - dh - 2;
    afDropdown.style.top = top + 'px';
    afDropdown.style.left = left + 'px';
  }

  function showDropdown() {
    if (!afDropdown || !config.autofill) return;
    refreshDropdown();
    afDropdown.style.display = 'block';
    positionDropdown();
  }
  function hideDropdown() { if (afDropdown) afDropdown.style.display = 'none'; }
  function outsideClose(e) {
    if (!afDropdown) return;
    if (afDropdown.contains(e.target)) return;
    if (e.target === afInput) return;
    hideDropdown();
  }

  // ---------- SPA 兼容：输入框晚出现或被替换时重试 ----------
  const obs = new MutationObserver(() => {
    if (config.autofill && config.usernameXPath) {
      const u = byXPath(config.usernameXPath);
      if (u && u !== afInput) setupAutoFill();
      else if (!u && afInput && !document.contains(afInput)) { afInput = null; teardownAutoFill(); }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // ---------- 启动 ----------
  function init() {
    createPanel();
    // 若已配置，则挂载自动填充
    if (config.autofill && config.usernameXPath) {
      setupAutoFill();
      // 兜底：延迟再试一次（部分站点异步渲染）
      setTimeout(setupAutoFill, 1500);
    }
  }

  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);
})();
