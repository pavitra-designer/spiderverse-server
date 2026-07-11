import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();

app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {

    cors: {

        origin: "*",

    },

    maxHttpBufferSize: 1e8,

});

const rooms = new Map();

io.on("connection", (socket) => {

    console.log("🟢 Connected:", socket.id);

    // ==========================================
    // CREATE ROOM
    // ==========================================

    socket.on("create-room", () => {

        const roomId = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

        rooms.set(roomId, {

            host: socket.id,

            guest: null,

            ready: new Set(),

        });

        socket.join(roomId);

        socket.emit("room-created", roomId);

        console.log("✅ Room Created:", roomId);

    });

    // ==========================================
    // JOIN ROOM
    // ==========================================

    socket.on("join-room", (roomId) => {

        const room = rooms.get(roomId);

        if (!room) {

            socket.emit("room-not-found");

            return;

        }

        if (room.guest && room.guest !== socket.id) {

            socket.emit("room-full");

            return;

        }

        room.guest = socket.id;

        socket.join(roomId);

        console.log("👥 Guest Joined:", roomId);

        io.to(roomId).emit("session-ready");

    });

    // ==========================================
    // CAMERA READY
    // ==========================================

    socket.on("camera-ready", ({ roomId }) => {

        const room = rooms.get(roomId);

        if (!room) return;

        if (room.ready.has(socket.id)) return;

        room.ready.add(socket.id);

        console.log(
            `📷 Camera Ready ${room.ready.size}/2`
        );

        if (room.ready.size === 2) {

            console.log("🚀 Sending create-offer");

            io.to(room.host).emit("create-offer");

        }

    });

    // ==========================================
    // OFFER
    // ==========================================

    socket.on("offer", ({ roomId, offer }) => {

        console.log("📤 Offer");

        socket.to(roomId).emit("offer", offer);

    });

    // ==========================================
    // ANSWER
    // ==========================================

    socket.on("answer", ({ roomId, answer }) => {

        console.log("📥 Answer");

        socket.to(roomId).emit("answer", answer);

    });

    // ==========================================
    // ICE
    // ==========================================

    socket.on("ice-candidate", ({ roomId, candidate }) => {

        socket.to(roomId).emit("ice-candidate", candidate);

    });

    // ==========================================
    // PHOTO SESSION
    // ==========================================

    socket.on("start-session", ({ roomId }) => {

        console.log("📸 Starting Photo Session");

        io.to(roomId).emit("start-countdown");

    });

    // ==========================================
    // PHOTO CAPTURED
    // ==========================================

    socket.on("photo-captured", ({ roomId, image, index }) => {

        console.log(

            `📸 Photo ${index} received from ${socket.id}`

        );

        io.to(roomId).emit("partner-photo", {

            sender: socket.id,

            image,

            index,

        });

    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on("disconnect", () => {

        console.log("🔴 Disconnected:", socket.id);

        for (const [roomId, room] of rooms.entries()) {

            if (

                room.host === socket.id ||

                room.guest === socket.id

            ) {

                io.to(roomId).emit("partner-left");

                rooms.delete(roomId);

                console.log("🗑 Room Deleted:", roomId);

                break;

            }

        }

    });

});

app.get("/", (_, res) => {

    res.send("SpiderVerse Signaling Server Running");

});

httpServer.listen(3001, () => {

    console.log("🚀 Server running on http://localhost:3001");

});


