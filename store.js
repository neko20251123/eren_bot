const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "data.json");

function load() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(filePath));
}

function save(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getIntro(userId) {
  const data = load();
  return data[userId] || null;
}

function setIntro(userId, content) {
  const data = load();
  data[userId] = content;
  save(data);
}

module.exports = {
  getIntro,
  setIntro,
};