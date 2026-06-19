import { log } from "console";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import axios from "axios";

const app = express();
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("UserJoined", Array.from(rooms.get(currentRoom)));
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);

    io.to(roomId).emit("UserJoined", Array.from(rooms.get(currentRoom)));
  });
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("UserJoined", Array.from(rooms.get(currentRoom)));
      socket.leave(currentRoom);

      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("UserJoined", Array.from(rooms.get(currentRoom)));
    }
    console.log("user disconnected");
  });
});

const PORT = 8000;

app.post("/run", async (req, res) => {
  try {
    const { code, language } = req.body;

    const languageMap = {
      javascript: 63,
      python: 71,
      java: 62,
      cpp: 54,
    };

    const language_id = languageMap[language];

    const response = await axios.post(
      "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: code,
        language_id,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key":
            "e008646b5bmsh900cc333e562fb3p168f3ejsn2bc5b57de7c9",
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      }
    );

    res.json({
      output:
        response.data.stdout ||
        response.data.stderr ||
        response.data.compile_output ||
        "No Output",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      output: "Execution Error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
