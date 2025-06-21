const errorHandler = (err, req, res, next) => {
  console.error(err); // Log the full error for server-side debugging

  // Check if the error is a Sequelize validation error
  if (err.name === "SequelizeValidationError") {
    // Extract the specific error messages from the error object
    const messages = err.errors.map((e) => e.message).join(". ");
    // Send a 400 Bad Request with the detailed messages
    return res.status(400).json({
      message: "Validation Failed",
      details: messages,
    });
  }

  // --- Handle other types of errors ---
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      message: "Conflict",
      details: "A record with one of the unique fields already exists.",
    });
  }

  // Default to a 500 server error if it's not a known type
  res.status(500).json({
    message: "An unexpected error occurred on the server.",
    details: err.message,
  });
};

module.exports = errorHandler;
