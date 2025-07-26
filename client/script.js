const socket = io('/');

const roomId = 1;
const peers = {};
let localMedia = new MediaStream([]);

const toggleVideoButton = document.getElementById('toggleVideoButton');
toggleVideoButton.addEventListener('click', toggleVideo);
const videoGrid = document.getElementById('videos');
const localVideo = document.getElementById('localVideo');

join();

function toggleVideo() {
    if (localMedia.getVideoTracks().length > 0) {
        stopVideo();
    } else {
        startVideo();
    }
}

async function startVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = stream.getVideoTracks()[0];
        console.log(`track label ${track.label}`);

        localMedia.addTrack(track);

        Object.values(peers).forEach(peer => {
            peer.addTrack(track, localMedia);
        });

        localVideo.srcObject = localMedia;
        toggleVideoButton.textContent = 'Turn camera off';
    } catch (error) {
        console.error("Error starting video.", error);
    }
}

function stopVideo() {
    if (!localMedia) return;

    localMedia.getVideoTracks().forEach(track => {
        track.stop();
        localMedia.removeTrack(track);
        // Object.values(peers).forEach(peer => {
        //     peer.removeTrack(track, localStream);
        // });
    });

    toggleVideoButton.textContent = 'Turn camera on';
}

function join() {
    socket.on('peer-connected', async (clientId) => {
        console.log('event peer-connected:', clientId);

        const peer = createPeer(clientId);

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        console.log('sending offer to user', clientId);
        socket.emit('offer', offer, clientId);
    });

    socket.on('offer', async (offer, clientId) => {
        console.log('event offer', offer, clientId);

        const peer = createPeer(clientId);

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        console.log('emitting answer to', answer, clientId);
        socket.emit('answer', answer, clientId);

        UI_AddPeer(clientId);
    });

    socket.on('answer', async (answer, clientId) => {
        console.log('event answer', answer, clientId);

        const peer = peers[clientId];
        await peer.setRemoteDescription(new RTCSessionDescription(answer));

        UI_AddPeer(clientId);
    });

    socket.on('ice-candidate', (candidate, clientId) => {
        console.log('event ice-candidate', candidate, clientId);

        peers[clientId].addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('peer-disconnected', clientId => {
        console.log('event peer-disconnected:', clientId);

        if (peers[clientId]) {
            peers[clientId].close();
            delete peers[clientId];
        }

        UI_RemovePeer(clientId);
    });

    socket.emit('join', roomId);
}

function UI_AddPeer(clientId) {
    if (document.getElementById(clientId)) {
        console.log(`peer ${clientId} element already added`);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = clientId;
    wrapper.className = 'video-wrapper';
    const video = document.createElement('video');
    wrapper.appendChild(video);

    videoGrid.append(wrapper);

    peers[clientId].ontrack = event => {
        console.log('event peer ontrack:', event);

        video.srcObject = event.streams[0];
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
    };
}

function UI_RemovePeer(clientId) {
    if (peers[clientId]) {
        peers[clientId].ontrack = null;
    }

    const el = document.getElementById(clientId);
    if (!el) {
        console.log(`peer ${clientId} element not found`);
        return;
    }
    el.remove();
}

function createPeer(clientId) {
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

    peers[clientId] = peer;
    return peer;
}
