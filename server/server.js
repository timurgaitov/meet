const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on('connection', (socket) => {
  const clientId = socket.id;
  console.log('user connected', clientId);

  socket.on('join', (roomId, name) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {};
    }
    
    socket.emit('room-state', rooms[roomId]);

    rooms[roomId][clientId] = { name, audioEnabled: false };

    socket.to(roomId).emit('peer-connected', clientId, name);

    socket.on('offer', (offer, targetUserId, name) => {
      socket.to(targetUserId).emit('offer', offer, clientId, name);
    });

    socket.on('answer', (answer, targetUserId) => {
      socket.to(targetUserId).emit('answer', answer, clientId);
    });

    socket.on('ice-candidate', (candidate, targetUserId) => {
      socket.to(targetUserId).emit('ice-candidate', candidate, clientId);
    });

    socket.on('toggle-audio', (audioEnabled) => {
      if (rooms[roomId] && rooms[roomId][clientId]) {
        rooms[roomId][clientId].audioEnabled = audioEnabled;
      }
      socket.to(roomId).emit('toggle-audio', clientId, audioEnabled);
    });

    socket.on('disconnect', () => {
      if (rooms[roomId]) {
        delete rooms[roomId][clientId];
        if (Object.keys(rooms[roomId]).length === 0) {
          delete rooms[roomId];
        }
      }
      socket.to(roomId).emit('peer-disconnected', clientId);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
