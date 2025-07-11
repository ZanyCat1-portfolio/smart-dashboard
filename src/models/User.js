class User {
  constructor({
    id = null,
    username,
    email = null,
    createdAt = null,
    active = true
  }) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.createdAt = createdAt;
    this.active = active;
  }
}

module.exports = User;