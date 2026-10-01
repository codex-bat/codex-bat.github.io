(function () {
    'use strict';

    function getFileName(el) {
        var src = el.currentSrc || el.src || '';
        var parts = src.split('/');
        var name = parts[parts.length - 1];
        try { name = decodeURIComponent(name); } catch (e) { /* ignore */ }
        return name || 'audio';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var players = document.querySelectorAll('.audio-player');

        players.forEach(function (wrapper) {
            var audio = wrapper.querySelector('audio');
            if (!audio) return;

            var label = wrapper.querySelector('.audio-label');
            var fileName = getFileName(audio);

            // restore saved volume
            try {
                var saved = localStorage.getItem('codex-volume');
                if (saved !== null) audio.volume = parseFloat(saved);
            } catch (e) { /* ignore */ }

            // persist volume changes
            audio.addEventListener('volumechange', function () {
                try { localStorage.setItem('codex-volume', audio.volume); } catch (e) { }
            });

            function setState(state) {
                if (!label) return;
                if (state === 'playing') {
                    label.innerHTML = '▶ now playing: <span class="highlight">' + fileName + '</span>';
                } else if (state === 'paused') {
                    label.innerHTML = '❚❚ paused: <span class="highlight">' + fileName + '</span>';
                } else if (state === 'ended') {
                    label.innerHTML = '■ ended: <span class="highlight">' + fileName + '</span>';
                }
            }

            audio.addEventListener('play', function () { setState('playing'); });
            audio.addEventListener('pause', function () { if (!audio.ended) setState('paused'); });
            audio.addEventListener('ended', function () { setState('ended'); });

            audio.addEventListener('loadedmetadata', function () {
                if (audio.paused) setState('paused');
            });
        });
    });
})();