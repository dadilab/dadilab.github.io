// ==UserScript==
// @name         城域网上网认证
// @namespace    http://tampermonkey.net/
// @version      10.2
// @description  自动填充用户名密码并延迟3秒点击登录
// @author       You
// @match        http://10.10.10.4:8445/*
// @match        https://hao.360.com/*
// @match        https://hao.360.com/?a1004
// @icon         http://10.10.10.4:8445/favicon.ico
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    // 等待页面元素加载完成
    function waitForElement(selector, callback) {
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval);
                callback(element);
            }
        }, 100); // 每100毫秒检查一次
    }

    // 填充用户名
    waitForElement('#username', (usernameInput) => {
        usernameInput.value = '这里改为用户名';
        // 触发输入事件，确保页面能检测到值的变化
        usernameInput.dispatchEvent(new Event('input'));
    });

    // 填充密码
    waitForElement('#password', (passwordInput) => {
        passwordInput.value = '这里改为密码';
        // 触发输入事件
        passwordInput.dispatchEvent(new Event('input'));
    });

    // 等待登录按钮加载完成后，延迟3秒点击
    waitForElement('#loginBtn', (loginBtn) => {
        setTimeout(() => {
            loginBtn.click();
            console.log('已延迟3秒点击登录按钮');
        }, 3000); // 3000毫秒 = 3秒
    });
})();
