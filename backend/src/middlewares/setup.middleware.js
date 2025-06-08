const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const setupMiddleware = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};

module.exports = setupMiddleware;
