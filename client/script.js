async function main() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    const name = sessionStorage.getItem('name');

    if (!roomId) {
        const createBtn = document.getElementById('createBtn');
        createBtn.addEventListener('click', () => {
            window.location.href = `/?room=${uuid.v4()}`;
        });

        const roomSelectionWrapper = document.getElementById('room-selection-wrapper');
        roomSelectionWrapper.style.display = 'flex';
        return;
    }

    if (!name) {
        const joinCallBtn = document.getElementById('join-call-btn');
        joinCallBtn.addEventListener('click', () => {
            const nam = nameInput.value;
            if (!nam) {
                alert("Please enter your name.");
                return;
            }
            sessionStorage.setItem('name', nam);

            document.querySelector('#localVideo + .name-tag').textContent = nam + " (You)";

            namePopupOverlay.style.display = 'none';
            main();
        });

        const namePopupOverlay = document.getElementById('name-popup-overlay');
        const nameInput = document.getElementById('name-input');
        namePopupOverlay.style.display = 'flex';
        nameInput.style.display = 'flex';
        return;
    }

    document.querySelector('#localVideo + .name-tag').textContent = name + " (You)";

    const videosContainer = document.getElementById('videos-container');
    videosContainer.style.display = 'flex';

    const socket = io('/');

    const toggleAudioButton = document.getElementById('toggleAudioButton');
    toggleAudioButton.addEventListener('click', toggleAudio);
    const toggleVideoButton = document.getElementById('toggleVideoButton');
    toggleVideoButton.addEventListener('click', toggleVideo);
    const leaveBtn = document.getElementById('leaveBtn');
    leaveBtn.addEventListener('click', leaveMeeting);
    const wave = document.getElementById('wave');

    const videoGrid = document.getElementById('videos');
    const localVideoWrapper = document.getElementById('local-video-wrapper');


    let audioEnabled = false;
    let videoEnabled = false;
    const peers = {};
    let roomState = {};
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const tracks = mediaStream.getTracks();
    for (const track of tracks) {
        track.enabled = false;
    };

    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = mediaStream;

    let audioContext, analyser, dataArray, source;

    stopAudio();
    stopVideo();

    await join();

    function toggleAudio() {
        if (audioEnabled) {
            stopAudio();
        } else {
            startAudio();
        }
        socket.emit('toggle-audio', audioEnabled);
    }

    function toggleVideo() {
        if (videoEnabled) {
            stopVideo();
        } else {
            startVideo();
        }
    }

    function leaveMeeting() {
        socket.disconnect();
        window.location.href = '/';
    }

    async function startAudio() {
        if (!mediaStream) return;

        mediaStream.getAudioTracks().forEach(track => {
            track.enabled = true;
        });

        toggleAudioButton.classList.remove('inactive');
        toggleAudioButton.classList.add('active');
        toggleAudioButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2s-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;
        audioEnabled = true;
        localVideoWrapper.classList.remove('muted');
        initAudioVisualizer();
    }

    function stopAudio() {
        if (!mediaStream) return;

        mediaStream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });

        toggleAudioButton.classList.remove('active');
        toggleAudioButton.classList.add('inactive');
        toggleAudioButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.12.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>`;
        audioEnabled = false;
        localVideoWrapper.classList.add('muted');
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
    }

    async function startVideo() {
        if (!mediaStream) return;

        mediaStream.getVideoTracks().forEach(track => {
            track.enabled = true;
        });

        toggleVideoButton.classList.remove('inactive');
        toggleVideoButton.classList.add('active');
        toggleVideoButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM15 16H5V8h10v8z"/></svg>`;
        videoEnabled = true;
    }

    function stopVideo() {
        if (!mediaStream) return;

        mediaStream.getVideoTracks().forEach(track => {
            track.enabled = false;
        });

        toggleVideoButton.classList.remove('active');
        toggleVideoButton.classList.add('inactive');
        toggleVideoButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/></svg>`;
        videoEnabled = false;
    }

    function initAudioVisualizer() {
        if (audioContext) return;
        console.log('Initializing audio visualizer');
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        visualize();
    }

    function visualize() {
        if (!audioContext || !audioEnabled) {
            wave.style.transform = 'scale(1)';
            wave.style.opacity = '0';
            return;
        };

        requestAnimationFrame(visualize);

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        let avg = sum / dataArray.length;
        console.log('Average volume:', avg);

        const scale = 1 + (avg / 256) * 2;
        const opacity = avg / 256;

        wave.style.transform = `scale(${scale})`;
        wave.style.opacity = opacity;
    }

    async function join() {
        socket.on('room-state', (state) => {
            console.log('event room-state', state);
            roomState = state;
        });

        socket.on('peer-connected', async (clientId, nam) => {
            console.log('event peer-connected:', clientId, nam);

            const peer = createPeer(clientId, nam);

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);

            console.log('sending offer to user', clientId);
            socket.emit('offer', offer, clientId, name);
        });

        socket.on('offer', async (offer, clientId, nam) => {
            console.log('event offer', offer, clientId);

            const peer = createPeer(clientId, nam);

            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            console.log('emitting answer to', answer, clientId);
            socket.emit('answer', answer, clientId);
        });

        socket.on('answer', async (answer, clientId) => {
            console.log('event answer', answer, clientId);

            const peer = peers[clientId];
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('ice-candidate', (candidate, clientId) => {
            console.log('event ice-candidate', candidate, clientId);

            peers[clientId].addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on('peer-disconnected', clientId => {
            console.log('event peer-disconnected:', clientId);

            removePeer(clientId);
        });

        socket.on('toggle-audio', (clientId, audioEnabled) => {
            const wrapper = document.getElementById(clientId);
            if (wrapper) {
                if (audioEnabled) {
                    wrapper.classList.remove('muted');
                } else {
                    wrapper.classList.add('muted');
                }
            }
        });

        socket.emit('join', roomId, name);
    }

    function createPeer(clientId, nam) {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:localhost:3478" },
                // { urls: "stun:stun.l.google.com:19302" }
            ]
        });

        peer.onicecandidate = event => {
            console.log('event peer onicecandidate:', event);

            if (event.candidate) {
                socket.emit('ice-candidate', event.candidate, clientId);
            }
        };

        mediaStream.getTracks().forEach(track => {
            peer.addTrack(track, mediaStream);
        });

        const video = addVideoElement(clientId, nam);
        peer.ontrack = event => {
            console.log('event peer ontrack:', event);

            video.srcObject = event.streams[0];
        };

        if (roomState[clientId] && !roomState[clientId].audioEnabled) {
            const wrapper = document.getElementById(clientId);
            if (wrapper) {
                wrapper.classList.add('muted');
            }
        }

        peers[clientId] = peer;

        return peer;
    }

    function removePeer(clientId) {
        if (peers[clientId]) {
            peers[clientId].ontrack = null;
            peers[clientId].close();
            delete peers[clientId];
        }
        removeVideoElement(clientId);
    }

    function addVideoElement(clientId, nam) {
        if (document.getElementById(clientId)) {
            console.log(`peer ${clientId} element already added`);
            return;
        }

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
        const nameTag = document.createElement('span');
        nameTag.className = 'name-tag';
        nameTag.textContent = nam;

        const micIcon = document.createElement('div');
        micIcon.className = 'mic-icon';
        micIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.12.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>`;

        const wrapper = document.createElement('div');
        wrapper.id = clientId;
        wrapper.className = 'video-wrapper';
        wrapper.appendChild(video);
        wrapper.appendChild(nameTag);
        wrapper.appendChild(micIcon);

        videoGrid.append(wrapper);

        updateVideoLayout();

        return video;
    }

    function removeVideoElement(clientId) {
        const el = document.getElementById(clientId);
        if (!el) {
            console.log(`peer ${clientId} element not found`);
            return;
        }
        el.remove();

        updateVideoLayout();
    }

    function updateVideoLayout() {
        const participantCount = document.querySelectorAll('.video-wrapper').length;
        let columns = Math.ceil(Math.sqrt(participantCount));
        let rows = Math.ceil(participantCount / columns);

        // Optimize for common cases
        if (participantCount === 2) {
            columns = 2;
            rows = 1;
        } else if (participantCount === 3 || participantCount === 4) {
            columns = 2;
            rows = 2;
        } else if (participantCount > 4 && participantCount <= 6) {
            columns = 3;
            rows = 2;
        } else if (participantCount > 6 && participantCount <= 9) {
            columns = 3;
            rows = 3;
        }


        const videoWrappers = document.querySelectorAll('.video-wrapper');
        videoWrappers.forEach(wrapper => {
            wrapper.style.width = `calc(${100 / columns}% - 15px)`;
            wrapper.style.height = `calc(${100 / rows}% - 15px)`;
        });
    }

}

main();