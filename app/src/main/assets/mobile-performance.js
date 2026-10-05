// Host-page optimization only. Never inject into character or benchmark iframes.
(async () => {
    if (location.origin !== 'http://127.0.0.1:8787') return;
    const MODE = 'apk:mobile-performance:enabled';
    const BACKUP = 'apk:mobile-performance:backup';
    const KEYS = ['chat_truncation'];
    const STATUS_KEYS = ['fast_ui_mode', 'blur_strength', 'chat_truncation'];
    // Do not become an alternative entry point into ST's circular module graph
    // while its own script.js is still starting.
    for (let attempt = 0; attempt < 300 && (!window.SillyTavern?.getContext || !document.querySelector('#chat .mes')); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!window.SillyTavern?.getContext || !document.querySelector('#chat .mes')) return;
    const main = await import('/script.js');
    const {power_user} = await import('/scripts/power-user.js');
    if (window.__apkMobilePerformance) return;
    let enabled = localStorage.getItem(MODE) === 'true';
    let scheduled = false;
    let observer;
    const chat = document.querySelector('#chat');
    if (!chat) return;
    const style = document.createElement('style');
    style.id = 'apk-mobile-performance-style';
    // The chat is a flex column. Offscreen containment otherwise lets flex-shrink
    // collapse a measured placeholder down to its padding and breaks scrolling.
    style.textContent = '#chat > .apk-deferred-message { content-visibility:auto; flex-shrink:0; } #send_textarea[data-apk-long-input] { font-family:system-ui,sans-serif!important; }';
    const input = document.querySelector('#send_textarea');
    let previousInputLength = input?.value.length || 0;
    let acceleratedDraft = false;
    function updateLongInput(event) {
        // Long drafts need expensive shaping in some decorative web fonts.
        // Keep the theme's font for normal input and all message content.
        if (!input) return;
        const length = input.value.length;
        const nativeEvent = event?.originalEvent || event;
        const bulkEdit = event?.type !== 'focus' && (!nativeEvent?.isTrusted || nativeEvent?.inputType === 'insertFromPaste' || (nativeEvent?.data?.length || 0) >= 4096 || length - previousInputLength >= 4096);
        previousInputLength = length;
        if (nativeEvent?.isComposing) return;
        if (!enabled || length < 4096) acceleratedDraft = false;
        else if (bulkEdit) acceleratedDraft = true;
        input.toggleAttribute('data-apk-long-input', enabled && acceleratedDraft);
    }

    function synchronizeSettings() {
        $('#chat_truncation').val(power_user.chat_truncation);
        $('#chat_truncation_counter').val(power_user.chat_truncation);
    }

    function updateHistoricalMessages() {
        scheduled = false;
        if (!enabled) return;
        const messages = [...chat.querySelectorAll(':scope > .mes')];
        // Read geometry before writing styles so the pass does not alternate layouts.
        const plan = messages.map(message => {
            const live = message.classList.contains('last_mes') || message.querySelector('iframe,canvas,video,audio,.edit_textarea,.reasoning_edit_textarea,.mes_reasoning_details[open]');
            if (live) return {message, live:true};
            if (message.classList.contains('apk-deferred-message')) return {message, ready:true};
            const css = getComputedStyle(message);
            const height = message.getBoundingClientRect().height - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - parseFloat(css.borderTopWidth) - parseFloat(css.borderBottomWidth);
            return {message, height:Math.max(1, height)};
        });
        for (const item of plan) {
            if (item.live) {
                item.message.classList.remove('apk-deferred-message');
                item.message.style.removeProperty('contain-intrinsic-size');
            } else if (!item.ready) {
                item.message.style.setProperty('contain-intrinsic-size', `auto ${item.height}px`);
                item.message.classList.add('apk-deferred-message');
            }
        }
    }

    function schedule() {
        if (!enabled || scheduled) return;
        scheduled = true;
        requestAnimationFrame(updateHistoricalMessages);
    }

    function apply() {
        if (enabled) {
            let backup;
            try { backup = JSON.parse(localStorage.getItem(BACKUP)); } catch {}
            // A theme can change settings while this mode is enabled. Rebase the
            // restore point on that theme rather than restoring the former UI.
            if (!backup?.settings || backup.theme !== power_user.theme) localStorage.setItem(BACKUP, JSON.stringify({theme:power_user.theme, settings:Object.fromEntries(KEYS.map(key => [key, power_user[key]]))}));
            power_user.chat_truncation = 30;
            if (!style.isConnected) document.head.appendChild(style);
            $(input).off('.apkMobilePerformance').on('input.apkMobilePerformance change.apkMobilePerformance focus.apkMobilePerformance', updateLongInput);
            if (!observer) {
                observer = new MutationObserver(records => {
                    if (records.some(record => record.target === chat || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches('iframe,canvas,video,audio,.edit_textarea,.reasoning_edit_textarea') || node.querySelector('iframe,canvas,video,audio,.edit_textarea,.reasoning_edit_textarea'))))) schedule();
                });
            }
            observer.observe(chat, {childList:true, subtree:true});
            schedule();
        } else {
            const backup = localStorage.getItem(BACKUP);
            if (backup) {
                const parsed = JSON.parse(backup);
                if (parsed.settings && parsed.theme === power_user.theme) for (const key of KEYS) power_user[key] = parsed.settings[key];
            }
            $(input).off('.apkMobilePerformance');
            observer?.disconnect();
            style.remove();
            for (const message of chat.querySelectorAll('.apk-deferred-message')) {
                message.classList.remove('apk-deferred-message');
                message.style.removeProperty('contain-intrinsic-size');
            }
        }
        updateLongInput();
        synchronizeSettings();
        main.saveSettingsDebounced();
    }

    const api = window.__apkMobilePerformance = {
        status: () => ({enabled, deferred:chat.querySelectorAll('.apk-deferred-message').length, longInput:input?.hasAttribute('data-apk-long-input') || false, settings:Object.fromEntries(STATUS_KEYS.map(key => [key, power_user[key]]))}),
        setEnabled: async value => {
            enabled = !!value;
            localStorage.setItem(MODE, String(enabled));
            apply();
            if (!enabled) localStorage.removeItem(BACKUP);
            return api.status();
        },
        toggle: async () => {
            await api.setEnabled(!enabled);
            window.toastr?.info(enabled ? '流畅模式已开启：分批加载历史消息' : '流畅模式已关闭：已恢复原设置');
        },
        refresh: schedule,
    };
    // An untouched installation remains in the user's original mode.
    if (enabled) apply();
    if (window.__APK_PERFORMANCE_TOGGLE_REQUESTED__) {
        delete window.__APK_PERFORMANCE_TOGGLE_REQUESTED__;
        await api.toggle();
    }
})().catch(error => console.error('Mobile performance mode failed', error));
