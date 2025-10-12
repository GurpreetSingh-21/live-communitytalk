// backend/sockets/events.js

/**
 * Registers Events-related socket rooms & live updates.
 * In server.js:
 *   const registerEventSockets = require("./sockets/events");
 *   registerEventSockets(io);
 *
 * Clients join with:
 *   socket.emit("events:join", { room: `college:${collegeId}:faith:${faithId}` })
 */
module.exports = function registerEventSockets(io) {
  io.on("connection", (socket) => {
    // ───────────────────────── Join scoped room ─────────────────────────
    socket.on("events:join", (payload = {}) => {
      const room = payload.room;
      if (typeof room === "string" && room.length) {
        // basic allow-list check for safety
        if (room.startsWith("college:") && room.includes(":faith:")) {
          socket.join(room);
          console.log(`[Socket] ${socket.id} joined room ${room}`);
        }
      }
    });

    // ───────────────────────── Leave room ─────────────────────────
    socket.on("events:leave", (payload = {}) => {
      const room = payload.room;
      if (typeof room === "string" && room.length) {
        socket.leave(room);
        console.log(`[Socket] ${socket.id} left room ${room}`);
      }
    });
  });

  // ───────────────────────── Utility Emitters ─────────────────────────
  io.events = {
    broadcastCreated: (event) => {
      if (!event?.collegeId || !event?.faithId) return;
      const room = `college:${event.collegeId}:faith:${event.faithId}`;
      io.to(room).emit("events:created", event);
    },
    broadcastUpdated: (event) => {
      if (!event?._id || !event?.collegeId || !event?.faithId) return;
      const room = `college:${event.collegeId}:faith:${event.faithId}`;
      io.to(room).emit("events:updated", event);
    },
    broadcastDeleted: (eventId, collegeId, faithId) => {
      if (!eventId || !collegeId || !faithId) return;
      const room = `college:${collegeId}:faith:${faithId}`;
      io.to(room).emit("events:deleted", { eventId });
    },
  };
};