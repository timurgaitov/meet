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
    const videoGrid = document.getElementById('videos');

    let audioEnabled = false;
    let videoEnabled = false;
    const peers = {};
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const tracks = mediaStream.getTracks();
    for (const track of tracks) {
        track.enabled = false;
    };

    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = mediaStream;

    await join();

    function toggleAudio() {
        if (audioEnabled) {
            stopAudio();
        } else {
            startAudio();
        }
    }

    function toggleVideo() {
        if (videoEnabled) {
            stopVideo();
        } else {
            startVideo();
        }
    }

    async function startAudio() {
        if (!mediaStream) return;

        mediaStream.getAudioTracks().forEach(track => {
            track.enabled = true;
        });

        toggleAudioButton.textContent = 'Mute';
        audioEnabled = true;
    }

    function stopAudio() {
        if (!mediaStream) return;

        mediaStream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });

        toggleAudioButton.textContent = 'Unmute';
        audioEnabled = false;
    }

    async function startVideo() {
        if (!mediaStream) return;

        mediaStream.getVideoTracks().forEach(track => {
            track.enabled = true;
        });

        toggleVideoButton.textContent = 'Turn camera off';
        videoEnabled = true;
    }

    function stopVideo() {
        if (!mediaStream) return;

        mediaStream.getVideoTracks().forEach(track => {
            track.enabled = false;
        });

        toggleVideoButton.textContent = 'Turn camera on';
        videoEnabled = false;
    }

    async function join() {
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

        const wrapper = document.createElement('div');
        wrapper.id = clientId;
        wrapper.className = 'video-wrapper';
        wrapper.appendChild(video);
        wrapper.appendChild(nameTag);

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