class User {
  constructor(row) {
    this.id = row.id;
    this.username = row.username;
    this.email = row.email || null;
    this.createdAt = row.createdAt !== undefined ? row.createdAt : row.created_at;

    // Handle active field
    if (row.active !== undefined) {
      this.active = row.active === 1 || row.active === true || row.active === '1';
    } else {
      this.active = true;
    }
  }
}
module.exports = User;
