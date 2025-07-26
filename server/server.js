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

const users = {};

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join-room', (roomId, userId, name) => {
    users[socket.id] = { name };
    socket.join(roomId);
    // Pass the new user's info to existing clients
    socket.to(roomId).emit('user-connected', userId, name);

    // Pass the existing users' info to the new user
    const existingUsers = {};
    const clients = io.sockets.adapter.rooms.get(roomId);
    if (clients) {
        for (const clientId of clients) {
            if (clientId !== socket.id && users[clientId]) {
                existingUsers[clientId] = users[clientId].name;
            }
        }
    }
    socket.emit('existing-users', existingUsers);

    socket.on('offer', (offer, targetUserId) => {
      socket.to(targetUserId).emit('offer', offer, socket.id, users[socket.id].name);
    });

    socket.on('answer', (answer, targetUserId) => {
      socket.to(targetUserId).emit('answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, targetUserId) => {
      socket.to(targetUserId).emit('ice-candidate', candidate, socket.id);
    });

    socket.on('disconnect', () => {
      delete users[socket.id];
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});