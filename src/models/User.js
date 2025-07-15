class User {
  constructor(row) {
    this.id = row.id;
    this.username = row.username;
    this.email = row.email || null;
    this.createdAt = row.createdAt !== undefined ? row.createdAt : row.created_at;
    this.active = row.active !== undefined ? row.active : true;
  }
}
module.exports = User;
