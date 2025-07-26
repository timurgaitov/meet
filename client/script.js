const socket = io('/');
const videoGrid = document.getElementById('videos');
const roomSelectionWrapper = document.getElementById('room-selection-wrapper');
const videosContainer = document.getElementById('videos-container');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const roomIdInput = document.getElementById('roomId');

// Popup elements
const namePopupOverlay = document.getElementById('name-popup-overlay');
const nameInput = document.getElementById('name-input');
const joinCallBtn = document.getElementById('join-call-btn');


const peers = {};
let localStream;
let myName = '';

// --- Room and Name Entry Logic ---

const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const savedName = sessionStorage.getItem('userName');

if (ROOM_ID) {
    roomSelectionWrapper.style.display = 'none';
    if (savedName) {
        // If name is found, skip popup and join call directly
        myName = savedName;
        videosContainer.style.display = 'flex';
        document.querySelector('#localVideo + .name-tag').textContent = myName + " (You)";
        startCall();
    } else {
        // If no name, show the popup
        namePopupOverlay.style.display = 'flex';
    }
} else {
    // Otherwise, show the room selection screen
    roomSelectionWrapper.style.display = 'flex';
}

createBtn.addEventListener('click', () => {
    const newRoomId = Math.random().toString(36).substr(2, 9);
    window.location.href = `/?room=${newRoomId}`;
});

joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value;
    if (roomId) {
        window.location.href = `/?room=${roomId}`;
    } else {
        alert("Please enter a Room ID");
    }
});

joinCallBtn.addEventListener('click', () => {
    myName = nameInput.value;
    if (!myName) {
        alert("Please enter your name.");
        return;
    }
    sessionStorage.setItem('userName', myName);

    // Hide popup and show video call UI
    namePopupOverlay.style.display = 'none';
    videosContainer.style.display = 'flex';

    // Set local user's name tag
    document.querySelector('#localVideo + .name-tag').textContent = myName + " (You)";

    // Start the WebRTC call logic
    startCall();
});


// --- WebRTC Logic ---

function startCall() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        const myVideo = document.getElementById('localVideo');
        addVideoStream(myVideo.parentElement, myVideo, stream);
        updateVideoLayout(); // Initial layout update

        socket.emit('join-room', ROOM_ID, socket.id, myName);

        socket.on('user-connected', (userId, name) => {
            console.log('User connected:', userId, name);
            connectToNewUser(userId, name, stream);
        });

        socket.on('offer', (offer, userId, name) => {
            console.log('Receiving offer from', name);
            const peer = createPeer(userId, name, stream);
            peer.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => peer.createAnswer())
                .then(answer => {
                    peer.setLocalDescription(answer);
                    socket.emit('answer', answer, userId);
                });
        });

        socket.on('answer', (answer, userId) => {
            console.log('Receiving answer from', userId);
            peers[userId].peer.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('ice-candidate', (candidate, userId) => {
            peers[userId].peer.addIceCandidate(new RTCIceCandidate(candidate));
        });

    }).catch(err => {
        console.error("Failed to get local stream", err);
        alert("Could not access camera and microphone.");
    });

    socket.on('user-disconnected', userId => {
        console.log('User disconnected:', userId);
        if (peers[userId]) {
            peers[userId].peer.close();
            peers[userId].wrapper.remove();
            delete peers[userId];
            updateVideoLayout(); // Update layout on disconnect
        }
    });
}

function connectToNewUser(userId, name, stream) {
    const peer = createPeer(userId, name, stream);
    peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        console.log('Sending offer to', name);
        socket.emit('offer', offer, userId);
    });
}

function createPeer(userId, name, stream) {
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
    });

    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    const video = document.createElement('video');
    const nameTag = document.createElement('span');
    nameTag.className = 'name-tag';
    nameTag.textContent = name;
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(nameTag);

    peer.ontrack = event => {
        addVideoStream(videoWrapper, video, event.streams[0]);
        updateVideoLayout(); // Update layout when remote stream is added
    };

    peer.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, userId);
        }
    };

    peers[userId] = { peer, wrapper: videoWrapper };
    return peer;
}

function addVideoStream(wrapper, video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(wrapper);
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