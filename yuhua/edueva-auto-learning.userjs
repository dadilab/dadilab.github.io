// ==UserScript==
// @name         自动确认下一个视频
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动点击“您已观看完该视频，是否要观看下一个？”弹窗的【是】按钮
// @author       助手
// @match        https://video.edueva.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=edueva.org
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function autoOperate() {
        // 1. 自动点击 是否观看下一个 的【是】按钮
        const yesBtn = document.querySelector('.layui-layer-btn0');
        if (yesBtn && yesBtn.offsetParent !== null) {
            yesBtn.click();
            console.log('✅ 已自动点击：观看下一个【是】');
        }

        // 2. 自动点击视频播放按钮 id="replaybtn"
        const playBtn = document.getElementById('replaybtn');
        if (playBtn && playBtn.style.display === 'block') {
            playBtn.click();
            console.log('✅ 已自动点击视频播放按钮');
        }
    }

    // 定时循环检测
    setInterval(autoOperate, 500);
})();
