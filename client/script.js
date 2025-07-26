const socket = io('/');

(async function() {

const roomId = 1;
const peers = {};
const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
const tracks = mediaStream.getTracks();
for (const track of tracks) {
    track.enabled = false;
};

const toggleAudioButton = document.getElementById('toggleAudioButton');
toggleAudioButton.addEventListener('click', toggleAudio);
const toggleVideoButton = document.getElementById('toggleVideoButton');
toggleVideoButton.addEventListener('click', toggleVideo);
const videoGrid = document.getElementById('videos');
const localVideo = document.getElementById('localVideo');
localVideo.srcObject = mediaStream;
let audioEnabled = false;
let videoEnabled = false;

await main();

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

async function main() {
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

    socket.emit('join', roomId);
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

    mediaStream.getTracks().forEach(track => {
        peer.addTrack(track, mediaStream);
    });

    const video = addVideoElement(clientId);
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

function addVideoElement(clientId) {
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

    const wrapper = document.createElement('div');
    wrapper.id = clientId;
    wrapper.className = 'video-wrapper';
    wrapper.appendChild(video);

    videoGrid.append(wrapper);

    return video;
}

function removeVideoElement(clientId) {
    const el = document.getElementById(clientId);
    if (!el) {
        console.log(`peer ${clientId} element not found`);
        return;
    }
    el.remove();
}

})();