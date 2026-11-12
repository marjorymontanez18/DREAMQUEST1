const { init, DB_PATH } = require("./db");

init()
  .then((dbPath) => {
    console.log("Database initialized:", dbPath);
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  });
