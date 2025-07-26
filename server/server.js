const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  const clientId = socket.id;
  console.log('user connected', clientId);

  socket.on('join', (roomId) => {
    socket.join(roomId);

    socket.to(roomId).emit('peer-connected', clientId);

    socket.on('offer', (offer, targetUserId) => {
      socket.to(targetUserId).emit('offer', offer, clientId);
    });

    socket.on('answer', (answer, targetUserId) => {
      socket.to(targetUserId).emit('answer', answer, clientId);
    });

    socket.on('ice-candidate', (candidate, targetUserId) => {
      socket.to(targetUserId).emit('ice-candidate', candidate, clientId);
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('peer-disconnected', clientId);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});