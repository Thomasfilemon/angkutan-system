const bcrypt = require("bcrypt");
const db = require("./db");

async function hashExistingPasswords() {
  try {
    const users = await db.query("SELECT id, password_hash FROM users");

    for (const user of users.rows) {
      const hashedPassword = await bcrypt.hash(user.password_hash, 10);
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        hashedPassword,
        user.id,
      ]);
      console.log(`Updated password for user ID: ${user.id}`);
    }

    console.log("All passwords hashed successfully");
  } catch (error) {
    console.error("Error hashing passwords:", error);
  }
}

hashExistingPasswords();
