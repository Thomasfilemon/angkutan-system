const cors = require('cors');
const express = require('express');

module.exports = (app) => {
  // Enable CORS for HTTPS
  app.use(cors({
    origin: [
    'https://localhost:3000',
    'https://192.168.1.7:3000',
    'http://192.168.1.7:3001',  // Add HTTP origin
    'https://qy2vwpw-anonymous-8081.exp.direct',
    'http://localhost:8081',
    'https://localhost:8081'
  ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};
