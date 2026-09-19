const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve files from the root folder (where index.html is)
app.use(express.static(__dirname));

// In-memory game state
const rooms = {};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', (data) => {
    const { room, player } = data;
    if (!rooms[room]) rooms[room] = { players: {} };

    for (const r in rooms) {
      if (rooms[r].players[socket.id]) {
        delete rooms[r].players[socket.id];
        socket.leave(r);
      }
    }

    socket.join(room);
    rooms[room].players[socket.id] = player;
    socket.room = room;

    io.to(room).emit('roomUpdate', Object.values(rooms[room].players));
    socket.emit('joined', { room, players: Object.values(rooms[room].players) });
  });

  socket.on('chat', (msg) => {
    if (socket.room) {
      io.to(socket.room).emit('chat', {
        name: rooms[socket.room]?.players[socket.id]?.name || 'Unknown',
        text: msg
      });
    }
  });

  socket.on('challenge', (targetId) => {
    if (socket.room && rooms[socket.room].players[targetId]) {
      io.to(targetId).emit('challengeReceived', {
        fromId: socket.id,
        fromName: rooms[socket.room].players[socket.id].name
      });
    }
  });

  socket.on('acceptChallenge', (fromId) => {
    if (socket.room) {
      io.to(fromId).emit('challengeAccepted', {
        opponentId: socket.id,
        opponent: rooms[socket.room].players[socket.id]
      });
      socket.emit('challengeAccepted', {
        opponentId: fromId,
        opponent: rooms[socket.room].players[fromId]
      });
    }
  });

  socket.on('combatAction', (data) => {
    if (data.to) {
      io.to(data.to).emit('combatAction', data);
    }
  });

  socket.on('updatePlayer', (player) => {
    if (socket.room && rooms[socket.room].players[socket.id]) {
      rooms[socket.room].players[socket.id] = player;
      io.to(socket.room).emit('roomUpdate', Object.values(rooms[socket.room].players));
    }
  });

  socket.on('disconnect', () => {
    if (socket.room && rooms[socket.room]) {
      delete rooms[socket.room].players[socket.id];
      io.to(socket.room).emit('roomUpdate', Object.values(rooms[socket.room].players));
      if (Object.keys(rooms[socket.room].players).length === 0) {
        delete rooms[socket.room];
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Ebonfall server running on port ${PORT}`);
});
