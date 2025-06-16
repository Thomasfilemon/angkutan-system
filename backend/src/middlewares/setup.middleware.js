const cors = require("cors");
const express = require("express");

module.exports = (app) => {
  // Enable CORS for development including ngrok
  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Allow localhost and local network
        if (origin.includes("localhost") || origin.includes("192.168.43.105")) {
          return callback(null, true);
        }

        // Allow ngrok domains
        if (origin.includes("ngrok-free.app") || origin.includes("ngrok.io")) {
          return callback(null, true);
        }

        // Allow expo domains
        if (origin.includes("exp.direct")) {
          return callback(null, true);
        }

        callback(null, true); // Allow all origins in development
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "ngrok-skip-browser-warning",
      ],
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};
